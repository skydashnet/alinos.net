const db = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');

async function saveOrUpdateMikrotikConfig(userId, configData) {
    const { mikrotik_host, mikrotik_user, mikrotik_password, mikrotik_port_api } = configData;

    if (!mikrotik_host || !mikrotik_user) {
        throw new Error("Host dan User Mikrotik diperlukan.");
    }
    
    let encryptedPasswordData = null;
    if (mikrotik_password !== undefined && mikrotik_password !== null && mikrotik_password !== '') {
        encryptedPasswordData = encrypt(mikrotik_password);
    }

    const queryText = `
        INSERT INTO user_mikrotik_configs 
            (user_id, mikrotik_host, mikrotik_user, encrypted_mikrotik_password, mikrotik_port_api, encryption_iv, auth_tag, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        ON CONFLICT (user_id) DO UPDATE SET 
            mikrotik_host = EXCLUDED.mikrotik_host,
            mikrotik_user = EXCLUDED.mikrotik_user,
            encrypted_mikrotik_password = COALESCE(EXCLUDED.encrypted_mikrotik_password, user_mikrotik_configs.encrypted_mikrotik_password),
            mikrotik_port_api = EXCLUDED.mikrotik_port_api,
            encryption_iv = COALESCE(EXCLUDED.encryption_iv, user_mikrotik_configs.encryption_iv),
            auth_tag = COALESCE(EXCLUDED.auth_tag, user_mikrotik_configs.auth_tag),
            is_active = TRUE,
            updated_at = NOW()
        RETURNING id, user_id, mikrotik_host, mikrotik_user, mikrotik_port_api, is_active; 
        -- Tidak mengembalikan password terenkripsi
    `;

    const values = [
        userId,
        mikrotik_host,
        mikrotik_user,
        encryptedPasswordData ? encryptedPasswordData.encryptedData : null,
        parseInt(mikrotik_port_api) || 8728,
        encryptedPasswordData ? encryptedPasswordData.iv : null,
        encryptedPasswordData ? encryptedPasswordData.authTag : null,
    ];
    // console.log('[SAVE_CONFIG_DEBUG] Menjalankan query ke DB dengan values:', values);
    try {
        const { rows } = await db.query(queryText, values);
        // console.log('[SAVE_CONFIG_DEBUG] Hasil query dari DB:', rows[0]);
        return rows[0];
    } catch (error) {
        // console.error("[ROUTER_CONFIG_SERVICE_ERROR] Gagal saat saveOrUpdate:", error);
        throw error;
    }
}

async function getActiveMikrotikConfig(userId) {
    try {
        const { rows } = await db.query(
            'SELECT mikrotik_host, mikrotik_user, encrypted_mikrotik_password, mikrotik_port_api, encryption_iv, auth_tag FROM user_mikrotik_configs WHERE user_id = $1 AND is_active = TRUE LIMIT 1',
            [userId]
        );

        if (rows.length > 0) {
            const config = rows[0];
            let finalPassword = '';
            if (config.encrypted_mikrotik_password && config.encryption_iv && config.auth_tag) {
                const decrypted = decrypt({
                    iv: config.encryption_iv,
                    encryptedData: config.encrypted_mikrotik_password,
                    authTag: config.auth_tag
                });
                if (decrypted !== null) finalPassword = decrypted;
            }

            return {
                host: config.mikrotik_host,
                user: config.mikrotik_user,
                password: finalPassword,
                port: parseInt(config.mikrotik_port_api || '8728', 10)
            };
        }
        return null;
    } catch (error) {
        // console.error("[ROUTER_CONFIG_SERVICE_ERROR] getActiveMikrotikConfig:", error);
        throw error;
    }
}

module.exports = { saveOrUpdateMikrotikConfig, getActiveMikrotikConfig };