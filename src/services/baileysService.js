const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WAProto
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const AUTH_FILE_PATH = path.join(__dirname, '..', '..', 'baileys_auth_info');
let sock = null;
let connectionState = {
    status: 'DISCONNECTED',
    message: 'Belum terkoneksi.',
    lastQr: null
};
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15000;

const logger = P({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' });

function clearAuthInfo() {
    if (fs.existsSync(AUTH_FILE_PATH)) {
        // console.log('[Baileys] Membersihkan informasi autentikasi lama...');
        try {
            fs.rmSync(AUTH_FILE_PATH, { recursive: true, force: true });
            // console.log('[Baileys] Folder autentikasi berhasil dihapus.');
        } catch (e) {
            // console.error('[Baileys] Gagal menghapus folder autentikasi:', e);
        }
    }
}

async function initializeBaileysClient() {
    if (sock && (connectionState.status === 'CONNECTED' || connectionState.status === 'CONNECTING')) {
        console.log('[Baileys] Klien sudah aktif atau sedang dalam proses koneksi.');
        return;
    }

    console.log('[Baileys] Menginisialisasi klien WhatsApp...');
    connectionState.status = 'CONNECTING';
    connectionState.message = 'Mencoba menghubungkan ke WhatsApp...';
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FILE_PATH);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`[Baileys] Menggunakan Baileys versi: ${version.join('.')}, Apakah versi terbaru: ${isLatest}`);

        sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false,
            linkPreviewImageThumbnailWidth: 100,
            generateHighQualityLinkPreview: false,
            getMessage: async (key) => {
                return { conversation: 'placeholder_msg' };
            }
        });

        sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        // console.log('[Baileys Connection Update]', JSON.stringify(update));
            connectionState.lastQr = qr || null;
            qrCodeForScan = qr || null;

            if (qr) {
                connectionState.status = 'QR_RECEIVED';
                connectionState.message = 'QR Code diterima. Silakan pindai dengan WhatsApp Anda dari perangkat tertaut.';
                console.log(`[Baileys] ${connectionState.message}`);
                qrcode.generate(qr, { small: true }, (qrString) => {
                    console.log(qrString);
                });
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = 
                    statusCode !== DisconnectReason.loggedOut &&
                    statusCode !== DisconnectReason.restartRequired &&
                    statusCode !== DisconnectReason.multideviceMismatch;

                connectionState.message = `Koneksi WhatsApp ditutup. Alasan: ${DisconnectReason[statusCode] || statusCode || 'Tidak diketahui'} (${lastDisconnect?.error || 'Error tidak spesifik'}).`;
                
                if (statusCode === DisconnectReason.loggedOut) {
                    connectionState.status = 'ERROR_LOGGED_OUT';
                    // console.error(`[Baileys] ${connectionState.message} Anda telah logout. Harap hapus folder '${AUTH_FILE_PATH}' dan pindai QR code baru.`);
                    clearAuthInfo();
                } else if (statusCode === DisconnectReason.badSession || statusCode === DisconnectReason.multideviceMismatch) {
                    connectionState.status = 'DISCONNECTED';
                    // console.warn(`[Baileys] ${connectionState.message} Sesi buruk atau tidak cocok. Membersihkan info auth dan mencoba lagi...`);
                    clearAuthInfo();
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        // console.log(`[Baileys] Mencoba koneksi ulang (percobaan ${retryCount}/${MAX_RETRIES}) dalam ${RETRY_DELAY_MS / 1000} detik...`);
                        setTimeout(initializeBaileysClient, RETRY_DELAY_MS);
                    } else {
                        connectionState.status = 'ERROR_MAX_RETRIES';
                        connectionState.message = `Gagal menghubungkan kembali setelah ${MAX_RETRIES} percobaan.`;
                        // console.error(`[Baileys] ${connectionState.message}`);
                    }
                } else if (shouldReconnect) {
                    connectionState.status = 'DISCONNECTED';
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        // console.warn(`[Baileys] ${connectionState.message} Mencoba koneksi ulang (percobaan ${retryCount}/${MAX_RETRIES}) dalam ${RETRY_DELAY_MS / 1000} detik...`);
                        setTimeout(initializeBaileysClient, RETRY_DELAY_MS);
                    } else {
                        connectionState.status = 'ERROR_MAX_RETRIES';
                        connectionState.message = `Gagal menghubungkan kembali setelah ${MAX_RETRIES} percobaan.`;
                        // console.error(`[Baileys] ${connectionState.message}`);
                    }
                } else if (statusCode === DisconnectReason.restartRequired) {
                    connectionState.status = 'ERROR_RESTART_REQUIRED';
                    connectionState.message = 'Koneksi WhatsApp memerlukan restart aplikasi Baileys.';
                    // console.error(`[Baileys] ${connectionState.message} Silakan restart server.`);
                } else {
                    connectionState.status = 'DISCONNECTED';
                    // console.warn(`[Baileys] Koneksi ditutup dengan alasan tidak tertangani atau tidak perlu reconnect (Code: ${statusCode}).`);
                }
            } else if (connection === 'open') {
                connectionState.status = 'CONNECTED';
                connectionState.message = 'Berhasil terhubung ke WhatsApp!';
                // console.log(`[Baileys] ${connectionState.message}`);
                retryCount = 0; 
                connectionState.lastQr = null;
                qrCodeForScan = null;
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error("!!!!! GAGAL INISIALISASI BAILEYS !!!!!");
        console.error("Error Detail:", error);
        connectionState.status = 'ERROR_INIT';
        connectionState.message = `Gagal total inisialisasi Baileys: ${error.message}`;
    }
}

/**
 * @param {string} jid
 * @param {string} text
 * @returns {Promise<WAProto.WebMessageInfo>}
 * @throws {Error}
 */
async function sendMessage(jid, text, retries = 3, delay = 1000) {

    let isReady = sock &&
                  connectionState && connectionState.status === 'CONNECTED' &&
                  sock.ws;

    if (!isReady) {
        if (retries > 0) {
            // console.warn(`[Baileys] sendMessage: Kondisi belum siap (isReady: ${isReady} - hanya cek sock, status, dan sock.ws). Mencoba lagi dalam <span class="math-inline">\{delay\}ms\.\.\. \(</span>{retries - 1} percobaan tersisa)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendMessage(jid, text, retries - 1, delay);
        } else {
            const errorMessage = 'Layanan WhatsApp tidak tersedia atau belum siap mengirim pesan setelah beberapa percobaan (hanya cek sock, status, dan sock.ws).';
            // console.error(`[Baileys] ${errorMessage} (isReady: ${isReady})`);
            throw new Error(errorMessage);
        }
    }

    try {
        // console.log(`[Baileys] Kondisi dianggap SIAP (tanpa cek readyState). Mencoba sock.onWhatsApp untuk JID: ${jid}`);
        const [result] = await sock.onWhatsApp(jid); 
        if (!result || !result.exists) {
            const notFoundMsg = `Nomor ${jid} tidak terdaftar di WhatsApp.`;
            // console.error(`[Baileys] ${notFoundMsg}`);
            throw new Error(notFoundMsg);
        }
        // console.log(`[Baileys] Mencoba sock.sendMessage ke JID: ${jid}`);
        const sentMsg = await sock.sendMessage(jid, { text: text });
        // console.log(`[Baileys] Pesan berhasil dikirim ke ${jid}.`);
        return sentMsg;
    } catch (error) {
        // console.error(`[Baileys] Gagal mengirim pesan ke ${jid} (setelah kondisi dianggap siap tanpa cek readyState):`, error);
        throw error;
    }
}
/**
 * @returns {object|null}
 */
function getWhatsAppClient() {
    return sock;
}

/**
 * @returns {object}
 */
function getConnectionStatus() {
    return { ...connectionState };
}

module.exports = { 
    initializeBaileysClient,
    sendMessage,
    getWhatsAppClient,
    getConnectionStatus,
};