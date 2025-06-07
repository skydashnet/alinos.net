const routerConfigService = require('../services/routerConfigService');

exports.saveConfig = async (req, res) => {
    const userId = req.user.id;
    console.log(`[SAVE_CONFIG_DEBUG] Menerima permintaan simpan untuk User ID: ${userId}`);
    const { mikrotikHost, mikrotikUser, mikrotikPassword, mikrotikPortApi } = req.body;

    try {
        const config = await routerConfigService.saveOrUpdateMikrotikConfig(userId, {
            mikrotik_host: mikrotikHost,
            mikrotik_user: mikrotikUser,
            mikrotik_password: mikrotikPassword,
            mikrotik_port_api: mikrotikPortApi
        });
        const { encrypted_mikrotik_password, encryption_iv, auth_tag, ...safeConfig } = config;
        res.status(201).json({ message: "Konfigurasi Mikrotik berhasil disimpan.", config: safeConfig });
    } catch (error) {
        console.error("[ROUTER_CONFIG_CONTROLLER_ERROR] saveConfig:", error);
        res.status(500).json({ message: error.message || "Gagal menyimpan konfigurasi Mikrotik." });
    }
};

exports.getConfig = async (req, res) => {
    const userId = req.user.id;
    try {
        const config = await routerConfigService.getActiveMikrotikConfig(userId);
        if (config) {
            res.json({
                mikrotik_host: config.mikrotik_host,
                mikrotik_user: config.mikrotik_user,
                mikrotik_port_api: config.mikrotik_port_api
            });
        } else {
            res.status(404).json({ message: "Konfigurasi Mikrotik belum diatur." });
        }
    } catch (error) {
        console.error("[ROUTER_CONFIG_CONTROLLER_ERROR] getConfig:", error);
        res.status(500).json({ message: "Gagal mengambil konfigurasi Mikrotik." });
    }
};