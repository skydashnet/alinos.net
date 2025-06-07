const mikrotikService = require('../services/mikrotikService');
const routerConfigService = require('../services/routerConfigService');
const { RouterOSAPI } = require('node-routeros'); 
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
require('dotenv').config();


async function getActiveUserMikrotikConfigForWs(userId) {
    try {
        const userDbConfig = await routerConfigService.getActiveMikrotikConfig(userId);
        if (!userDbConfig || !userDbConfig.host || !userDbConfig.user || typeof userDbConfig.password !== 'string') {
            console.warn(`[LIVE_TRAFFIC_WS] Konfigurasi Mikrotik dari DB untuk User ID ${userId} tidak valid/lengkap. Password type: ${typeof userDbConfig?.password}`);
            return null;
        }
        return {
            host: userDbConfig.mikrotik_host,
            user: userDbConfig.mikrotik_user,
            password: userDbConfig.decrypted_password,
            port: parseInt(userDbConfig.mikrotik_port_api || userDbConfig.port || '8728', 10),
            timeout: 10,
            keepalive: true
        };
    } catch (error) {
        console.error(`[LIVE_TRAFFIC_WS_ERROR] Gagal mendapatkan konfigurasi Mikrotik untuk User ID ${userId}:`, error);
        return null;
    }
}

async function getActiveConfigOrSendError(userId, res, actionDescription = "operasi Mikrotik") {
    try {
        const userDbConfig = await routerConfigService.getActiveMikrotikConfig(userId);
        if (!userDbConfig || !userDbConfig.host || !userDbConfig.user || typeof userDbConfig.password === 'undefined') {
            const errorMessage = `Konfigurasi Mikrotik untuk Anda belum diatur, tidak lengkap, atau password gagal didekripsi. Silakan atur di halaman Pengaturan Router.`;
            console.warn(`[MIKROTIK_CONTROLLER] ${errorMessage} (User ID: ${userId})`);
            if (res && !res.headersSent) {
                res.status(400).json({ message: errorMessage });
            }
            return null;
        }
        return {
            host: userDbConfig.host,
            user: userDbConfig.user,
            password: userDbConfig.password,
            port: userDbConfig.port || 8728,
            timeout: userDbConfig.timeout || 15,
            keepalive: userDbConfig.keepalive !== undefined ? userDbConfig.keepalive : true
        };
    } catch (error) {
        console.error(`[MIKROTIK_CONTROLLER_ERROR] Gagal mendapatkan konfigurasi Mikrotik untuk user ID ${userId} saat ${actionDescription}:`, error);
        if (res && !res.headersSent) {
            res.status(500).json({ message: `Gagal memuat konfigurasi Mikrotik untuk ${actionDescription}.` });
        }
        return null;
    }
}

// --- Endpoint untuk Dashboard & Informasi Umum Mikrotik ---
exports.getDeviceInfo = async (req, res) => {
    try {
        const config = await getActiveConfigOrSendError(req.user.id, res, "mengambil info device");
        if (!config) return;
        const deviceInfo = await mikrotikService.getDeviceInfo(config);
        res.json(deviceInfo);
    } catch (error) {
        res.status(500).json({ message: error.message || "Gagal mengambil informasi device." });
    }
};

exports.getPelangganOn = async (req, res) => {
    try {
        const config = await getActiveConfigOrSendError(req.user.id, res);
        if (!config) return;
        const activeConnections = await mikrotikService.getActivePppoeConnections(config);
        res.json({ count: activeConnections.length });
    } catch (error) {
        res.status(500).json({ message: error.message || "Gagal mengambil pelanggan PPPoE aktif." });
    }
};

exports.getPelangganOff = async (req, res) => {
    try {
        const config = await getActiveConfigOrSendError(req.user.id, res);
        if (!config) return;

        const [allSecrets, activeConnections] = await Promise.all([
            mikrotikService.getAllPppoeSecretDetails(config),
            mikrotikService.getActivePppoeConnections(config)
        ]);

        const totalSecrets = allSecrets.length;
        const totalActive = activeConnections.length;

        console.log(`[PELANGGAN_OFF_FINAL_DEBUG] Total Secrets: ${totalSecrets}, Active Connections: ${totalActive}`);

        let pelangganOffCount = totalSecrets - totalActive;
        if (pelangganOffCount < 0) pelangganOffCount = 0;

        res.json({ count: pelangganOffCount });

    } catch (error) {
        console.error('[MIKROTIK_CONTROLLER_ERROR] getPelangganOff:', error);
        res.status(500).json({ message: error.message || "Gagal menghitung pelanggan PPPoE non-aktif." });
    }
};

// --- Endpoint untuk Daftar Secret PPPoE (digunakan di halaman ODP/ODC & Customer) ---
exports.getAllPppoeSecrets = async (req, res) => {
    try {
        const config = await getActiveConfigOrSendError(req.user.id, res, "mengambil semua secret PPPoE");
        if (!config) return;
        const secrets = await mikrotikService.getAllPppoeSecretDetails(config);
        res.json(secrets);
    } catch (error) {
        res.status(500).json({ message: error.message || "Gagal mengambil detail semua secret PPPoE." });
    }
};

// --- Endpoint untuk Log PPPoE ---
exports.getPppoeLogs = async (req, res) => {
    try {
        const config = await getActiveConfigOrSendError(req.user.id, res, "mengambil log PPPoE");
        if (!config) return;
        const logEntries = await mikrotikService.getPppoeLogEntries(config);
        res.json(logEntries);
    } catch (error) {
        res.status(500).json({ message: error.message || "Gagal mengambil log PPPoE." });
    }
};

exports.getPelangganOffDetails = async (req, res) => {
    try {
        const config = await getActiveConfigOrSendError(req.user.id, res, "mengambil detail pelanggan non-aktif");
        if (!config) return;
        const [allSecrets, activeConnections] = await Promise.all([
            mikrotikService.getAllPppoeSecretDetails(config),
            mikrotikService.getActivePppoeConnections(config)
        ]);
        const activeUsernames = new Set(activeConnections.map(conn => conn.name));
        const offlineUsers = allSecrets.filter(secret => !activeUsernames.has(secret.name));

        res.json(offlineUsers);

    } catch (error) {
        console.error('[MIKROTIK_CONTROLLER_ERROR] getPelangganOffDetails:', error);
        res.status(500).json({ message: error.message || "Gagal mengambil detail pelanggan PPPoE non-aktif." });
    }
};
// --- Setup WebSocket untuk Live Traffic (Menggunakan Konfigurasi Dinamis) ---
exports.setupLiveTrafficWebSocket = (wsServer) => {
    const clientConnections = new Map();

    wsServer.on('connection', (ws) => {
        const clientId = Date.now().toString() + Math.random().toString(36).substring(2);
        console.log(`[LIVE_TRAFFIC_WS] Client WebSocket baru terhubung (ID Sesi WS: ${clientId})`);

        clientConnections.set(clientId, {
            ws: ws, userId: null, mikrotikConfig: null,
            mikrotikApi: null, pollInterval: null, isAuthenticated: false
        });

        const cleanupClientConnection = async () => {
            const clientState = clientConnections.get(clientId);
            if (clientState) {
                if (clientState.pollInterval) clearInterval(clientState.pollInterval);
                if (clientState.mikrotikApi && clientState.mikrotikApi.connected) {
                    try { await clientState.mikrotikApi.close(); } catch (e) {}
                }
                clientConnections.delete(clientId);
                console.log(`[LIVE_TRAFFIC_WS] Koneksi dan polling untuk klien ${clientId} (User: ${clientState.userId || 'unknown'}) telah dibersihkan.`);
            }
        };

        const connectAndPoll = async (ifaceName) => {
            const clientState = clientConnections.get(clientId);
            if (!clientState || !clientState.isAuthenticated || !clientState.mikrotikConfig) {
                if (clientState?.ws.readyState === WebSocket.OPEN) clientState.ws.send(JSON.stringify({ type: 'ERROR', message: 'Autentikasi atau konfigurasi Mikrotik gagal.' }));
                return;
            }

            if (clientState.pollInterval) clearInterval(clientState.pollInterval);
            
            if (!clientState.mikrotikApi || !clientState.mikrotikApi.connected) {
                clientState.mikrotikApi = new RouterOSAPI(clientState.mikrotikConfig);
                try {
                    await clientState.mikrotikApi.connect();
                    console.log(`[LIVE_TRAFFIC_WS] (${clientId}) User ID ${clientState.userId}: Koneksi ke Mikrotik BERHASIL.`);
                } catch (err) {
                    console.error(`[LIVE_TRAFFIC_WS] (${clientId}) Gagal koneksi ke Mikrotik. Error:`, err);
                    if (clientState.ws.readyState === WebSocket.OPEN) clientState.ws.send(JSON.stringify({ type: 'ERROR', message: 'Koneksi ke Mikrotik Gagal.' }));
                    await cleanupClientConnection();
                    return;
                }
            }

            clientState.pollInterval = setInterval(async () => {
                const currentState = clientConnections.get(clientId);
                if (!currentState || !currentState.mikrotikApi || !currentState.mikrotikApi.connected || currentState.ws.readyState !== WebSocket.OPEN) {
                    if(currentState?.pollInterval) clearInterval(currentState.pollInterval);
                    return;
                }
                try {
                    const data = await currentState.mikrotikApi.write('/interface/monitor-traffic', [`=interface=${ifaceName}`, '=once=']);
                    if (data && data[0]) {
                        const trafficData = data[0];
                        const now = new Date();
                        const label = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
                        const uploadMbps = (parseFloat(trafficData['tx-bits-per-second'] || 0) / 1000000).toFixed(2);
                        const downloadMbps = (parseFloat(trafficData['rx-bits-per-second'] || 0) / 1000000).toFixed(2);
                        currentState.ws.send(JSON.stringify({
                            type: 'TRAFFIC_UPDATE', interface: ifaceName,
                            label, upload: parseFloat(uploadMbps), download: parseFloat(downloadMbps)
                        }));
                    }
                } catch (err) {
                    console.error(`[LIVE_TRAFFIC_WS] (${clientId}) Error saat polling interface ${ifaceName}:`, err.message);
                    if(clientState.pollInterval) clearInterval(clientState.pollInterval);
                }
            }, 1000);
        };

        ws.on('message', async (message) => {
        const clientState = clientConnections.get(clientId);
        if (!clientState) return;

        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'AUTH_TOKEN' && parsedMessage.token) {
                if (clientState.isAuthenticated) return;
                try {
                    const decoded = jwt.verify(parsedMessage.token, process.env.JWT_SECRET);
                    clientState.userId = decoded.id;
                    clientState.mikrotikConfig = await routerConfigService.getActiveMikrotikConfig(clientState.userId);

                    console.log('[DB_CONFIG_DEBUG] Objek config dari DB:', clientState.mikrotikConfig);

                    if (!clientState.mikrotikConfig) {
                        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'AUTH_FAILED', message: 'Konfigurasi Mikrotik tidak ditemukan.' }));
                        ws.terminate();
                    } else {
                        clientState.isAuthenticated = true;
                        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'AUTH_SUCCESS' }));
                        console.log(`[LIVE_TRAFFIC_WS] (${clientId}) User ID ${clientState.userId} berhasil diautentikasi via WS.`);
                    }
                } catch (err) {
                    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'AUTH_FAILED', message: 'Token tidak valid.' }));
                    ws.terminate();
                }
            } else if (parsedMessage.type === 'SET_INTERFACE' && parsedMessage.interface) {
                if (!clientState.isAuthenticated) return;
                console.log(`[LIVE_TRAFFIC_WS] (${clientId}) User ID ${clientState.userId}: Mengatur polling untuk interface: ${parsedMessage.interface}`);
                await connectAndPoll(parsedMessage.interface);
            }
        } catch (e) {
            console.error(`[LIVE_TRAFFIC_WS] (${clientId}) Error memproses pesan WebSocket:`, e.message);
        }
    });

        ws.on('close', () => { cleanupClientConnection(); });
        ws.on('error', () => { cleanupClientConnection(); });
    });
};