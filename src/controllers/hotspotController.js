const hotspotService = require('../services/mikrotikService');
const routerConfigService = require('../services/routerConfigService');

async function getActiveUserMikrotikConfig(userId, res, actionDescription = "operasi Hotspot") {
    try {
        const userDbConfig = await routerConfigService.getActiveMikrotikConfig(userId);
        if (!userDbConfig || !userDbConfig.host || !userDbConfig.user || typeof userDbConfig.password === 'undefined') {
            const errorMessage = `Konfigurasi Mikrotik untuk Anda belum diatur/tidak lengkap. Silakan atur di Pengaturan Router.`;
            if (res && !res.headersSent) res.status(400).json({ message: errorMessage });
            return null;
        }
        return {
            host: userDbConfig.host,
            user: userDbConfig.user,
            password: userDbConfig.password,
            port: parseInt(userDbConfig.port || userDbConfig.port_api || '8728', 10),
            timeout: 15, keepalive: true
        };
    } catch (error) {
        console.error(`[HOTSPOT_CONTROLLER_ERROR] Gagal mendapatkan konfigurasi Mikrotik untuk user ID ${userId} saat ${actionDescription}:`, error);
        if (res && !res.headersSent) res.status(500).json({ message: `Gagal memuat konfigurasi Mikrotik untuk ${actionDescription}.` });
        return null;
    }
}

// 1. Get Hotspot Profiles
exports.getProfiles = async (req, res) => {
    try {
        const config = await getActiveUserMikrotikConfig(req.user.id, res, "mengambil profil hotspot");
        if (!config) return;
        const profiles = await hotspotService.getHotspotProfiles(config);
        res.json(profiles);
    } catch (error) {
        res.status(500).json({ message: error.message || "Gagal mengambil profil hotspot." });
    }
};

// 2. Get All Hotspot Users
exports.getAllUsers = async (req, res) => {
    try {
        const config = await getActiveUserMikrotikConfig(req.user.id, res, "mengambil semua user hotspot");
        if (!config) return;
        const users = await hotspotService.getAllHotspotUsers(config);
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message || "Gagal mengambil daftar user hotspot." });
    }
};

// 3. Add New Hotspot User
exports.addUser = async (req, res) => {
    try {
        const config = await getActiveUserMikrotikConfig(req.user.id, res, "menambah user hotspot");
        if (!config) return;
        const { user, password, profile, server, timeLimit, dataLimit, comment } = req.body;
        const userData = { user, password, profile, server, timeLimit, dataLimit, comment };

        await hotspotService.addHotspotUser(config, userData);
        res.status(201).json({ success: true, message: `User hotspot ${userData.user} berhasil ditambahkan.` });
    } catch (error) {
        console.error("[HOTSPOT_CONTROLLER_ERROR] addUser:", error.message);
        res.status(500).json({ success: false, message: error.message || "Gagal menambahkan user hotspot." });
    }
};

// 3.1 Get Hotspot User Details (untuk prefill form edit)
exports.getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const config = await getActiveUserMikrotikConfig(req.user.id, res, `mengambil detail user hotspot ID ${id}`);
        if (!config) return;
        const user = await hotspotService.getHotspotUserDetails(config, id);
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: `User hotspot dengan ID ${id} tidak ditemukan.` });
        }
    } catch (error) {
        res.status(500).json({ message: error.message || "Gagal mengambil detail user hotspot." });
    }
};


// 4. Edit Hotspot User
exports.editUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userData = req.body; 
        const config = await getActiveUserMikrotikConfig(req.user.id, res, `mengubah user hotspot ID ${id}`);
        if (!config) return;
        await hotspotService.editHotspotUser(config, id, userData);
        res.json({ success: true, message: `User hotspot dengan ID ${id} berhasil diubah.` });
    } catch (error) {
        console.error(`[HOTSPOT_CONTROLLER_ERROR] editUser (ID: ${req.params.id}):`, error.message);
        res.status(500).json({ success: false, message: error.message || "Gagal mengubah user hotspot." });
    }
};

// 5. Remove Hotspot User
exports.removeUser = async (req, res) => {
    try {
        const { id } = req.params;
        const config = await getActiveUserMikrotikConfig(req.user.id, res, `menghapus user hotspot ID ${id}`);
        if (!config) return;
        await hotspotService.removeHotspotUser(config, id);
        res.json({ success: true, message: `User hotspot dengan ID ${id} berhasil dihapus.` });
    } catch (error) {
        console.error(`[HOTSPOT_CONTROLLER_ERROR] removeUser (ID: ${req.params.id}):`, error.message);
        res.status(500).json({ success: false, message: error.message || "Gagal menghapus user hotspot." });
    }
};

// 6. Get Active Hotspot Users
exports.getActiveUsers = async (req, res) => {
    try {
        const config = await getActiveUserMikrotikConfig(req.user.id, res, "mengambil user hotspot aktif");
        if (!config) return;
        const activeUsers = await hotspotService.getActiveHotspotUsersDetailed(config);
        res.json(activeUsers);
    } catch (error) {
        res.status(500).json({ message: error.message || "Gagal mengambil daftar user hotspot aktif." });
    }
};

// Fungsi untuk jumlah user hotspot aktif (jika dipakai dashboard)
exports.getActiveUserCount = async (req, res) => {
    try {
        const config = await getActiveUserMikrotikConfig(req.user.id, res, "menghitung user hotspot aktif");
        if (!config) return;
        const count = await hotspotService.getHotspotActiveUserCount(config);
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: error.message || "Gagal mengambil jumlah user hotspot aktif." });
    }
};


// 7. Disconnect Active Hotspot User
exports.disconnectActiveUser = async (req, res) => {
    try {
        const { activeId } = req.params;
        const config = await getActiveUserMikrotikConfig(req.user.id, res, `disconnect user aktif ID ${activeId}`);
        if (!config) return;
        await hotspotService.disconnectHotspotUser(config, activeId);
        res.json({ success: true, message: `User aktif dengan ID ${activeId} berhasil di-disconnect.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || "Gagal disconnect user aktif." });
    }
};

// 8. Make Binding/Cookie
exports.makeUserStatic = async (req, res) => {
    try {
        const { activeId } = req.params;
        const { action } = req.body;
        const config = await getActiveUserMikrotikConfig(req.user.id, res, `make static/cookie untuk ID ${activeId}`);
        if (!config) return;
        const result = await hotspotService.makeHotspotUserStatic(config, activeId, action);
        res.json({ success: true, message: result.message || `Proses make static/cookie untuk ${activeId} diproses.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || "Gagal memproses permintaan make static/cookie." });
    }
};

// 9. Get User Bandwidth Usage (Detail sesi aktif)
exports.getUserBandwidth = async (req, res) => {
    const { username } = req.params;
    try {
        const config = await getActiveUserMikrotikConfig(req.user.id, res, `mengambil bandwidth user ${username}`);
        if (!config) return;
        const ipAddress = await hotspotService.getHotspotUserIpAddress(config, username);
        if (!ipAddress) {
            return res.status(404).json({ message: `User ${username} tidak aktif atau IP tidak ditemukan.` });
        }
        const usageData = await hotspotService.getHotspotUserUsageStats(config, ipAddress);
        res.json(usageData);
    } catch (error) {
        res.status(500).json({ message: error.message || `Gagal mengambil data bandwidth untuk ${username}.` });
    }
};
exports.getHotspotActiveCount = async (req, res) => {
    try {
        const config = await getActiveUserMikrotikConfig(req.user.id, res, "menghitung user hotspot aktif");
        if (!config) return;
        const count = await hotspotService.getHotspotActiveUserCount(config);
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: error.message || "Gagal mengambil jumlah user hotspot aktif." });
    }
};