const { RouterOSAPI } = require('node-routeros');
/**
 * @param {object} mikrotikApiConfig
 * @param {string} path
 * @param {Array<string>} args
 * @returns {Promise<Array|object>}
 */
async function executeSingleCommand(mikrotikApiConfig, path, args = []) {
    if (!mikrotikApiConfig || !mikrotikApiConfig.host || !mikrotikApiConfig.user || typeof mikrotikApiConfig.password === 'undefined') {
        console.error("[MIKROTIK_SERVICE] Konfigurasi Mikrotik tidak lengkap untuk executeSingleCommand:", mikrotikApiConfig);
        throw new Error("Konfigurasi Mikrotik (host, user, password) tidak lengkap.");
    }
    
    const configToUse = {
        host: mikrotikApiConfig.host,
        user: mikrotikApiConfig.user,
        password: mikrotikApiConfig.password,
        port: parseInt(mikrotikApiConfig.port || mikrotikApiConfig.port_api || '8728', 10),
        timeout: mikrotikApiConfig.timeout || 15,
        keepalive: mikrotikApiConfig.keepalive !== undefined ? mikrotikApiConfig.keepalive : true
    };

    const conn = new RouterOSAPI(configToUse);
    // console.log(`[MIKROTIK_SERVICE] EXEC: ${path} ${args.join(' ')} using host ${configToUse.host}`);
    return new Promise((resolve, reject) => {
        conn.connect()
            .then(() => conn.write(path, args))
            .then((data) => {
                conn.close(); 
                resolve(data);
            })
            .catch((err) => {
                console.error(`[MIKROTIK_SERVICE_ERROR] executeSingleCommand: ${path} | ${err.message || err}`);
                try { conn.close(); } catch(e){}
                reject(new Error(`Gagal menjalankan perintah Mikrotik (${path}): ${err.message || err}`));
            });
    });
}

const formatMikrotikUptime = (uptimeString) => {
    if (!uptimeString || typeof uptimeString !== 'string') return 'N/A';
    let days = 0, hours = 0, minutes = 0;
    const dayMatch = uptimeString.match(/(\d+)d/);
    const hourMatch = uptimeString.match(/(\d+)h/);
    const minuteMatch = uptimeString.match(/(\d+)m/);
    if (dayMatch) days = parseInt(dayMatch[1]);
    if (hourMatch) hours = parseInt(hourMatch[1]);
    if (minuteMatch) minutes = parseInt(minuteMatch[1]);
    return `${days} Hari ${hours} Jam ${minutes} Menit`;
};

async function getDeviceInfo(mikrotikApiConfig) {
    try {
        const resourceData = await executeSingleCommand(mikrotikApiConfig, '/system/resource/print');
        const identityData = await executeSingleCommand(mikrotikApiConfig, '/system/identity/print');
        let boardModel = 'N/A';
        try {
            const routerboardData = await executeSingleCommand(mikrotikApiConfig, '/system/routerboard/print');
            if (routerboardData && routerboardData.length > 0) boardModel = routerboardData[0].model || 'N/A';
        } catch (e) {}

        if (resourceData && resourceData.length > 0 && identityData && identityData.length > 0) {
            const resource = resourceData[0];
            const identity = identityData[0];
            return {
                uptime: formatMikrotikUptime(resource.uptime),
                device: identity.name || 'N/A',
                information: `${resource['board-name'] || boardModel} (ROS: ${resource.version || 'N/A'})`
            };
        }
        throw new Error('Data resource atau identity Mikrotik tidak lengkap.');
    } catch (error) {
        console.error("[MIKROTIK_SERVICE_ERROR] getDeviceInfo:", error.message);
        throw error; 
    }
}

async function getPppoeActiveConnectionsCount(mikrotikApiConfig) {
    const response = await executeSingleCommand(mikrotikApiConfig, '/ppp/active/print', ['?service=pppoe']);
    return Array.isArray(response) ? response.length : 0;
}

async function getTotalPppoeSecretsCount(mikrotikApiConfig) {
    const response = await executeSingleCommand(mikrotikApiConfig, '/ppp/secret/print');
    return Array.isArray(response) ? response.length : 0;
}

async function getAllPppoeSecretDetails(mikrotikApiConfig) {
    const response = await executeSingleCommand(mikrotikApiConfig, '/ppp/secret/print');
    return response || []; 
}

async function getPppoeLogEntries(mikrotikApiConfig, entryLimit = 30) { 
    const logs = await executeSingleCommand(mikrotikApiConfig, '/log/print', ['?topics~"pppoe"', '?without-paging=']);
    if (logs && Array.isArray(logs)) {
        return logs.slice(-entryLimit).map(log => ({
            time: log.time || 'N/A',
            message: log.message || 'No message'
        })); 
    }
    return [];
}

async function getHotspotActiveUserCount(mikrotikApiConfig) {
    // Kita HAPUS 'count-only='
    const response = await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/active/print');
    return Array.isArray(response) ? response.length : 0;
}
async function getHotspotProfiles(mikrotikApiConfig) {
    return await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/user/profile/print') || [];
}

async function getAllHotspotUsers(mikrotikApiConfig) {
    return await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/user/print') || [];
}

async function addHotspotUser(mikrotikApiConfig, userData) {
    const mikrotikParams = [`=name=${userData.user}`];
    if (userData.server) mikrotikParams.push(`=server=${userData.server}`); else mikrotikParams.push(`=server=all`);
    if (userData.password) mikrotikParams.push(`=password=${userData.password}`);
    if (userData.profile) mikrotikParams.push(`=profile=${userData.profile}`);
    if (userData.timeLimit) mikrotikParams.push(`=limit-uptime=${userData.timeLimit}`);
    if (userData.dataLimit) mikrotikParams.push(`=limit-bytes-total=${userData.dataLimit}`);
    if (userData.comment) mikrotikParams.push(`=comment=${userData.comment}`);
    return await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/user/add', mikrotikParams);
}

async function getHotspotUserDetails(mikrotikApiConfig, userId) {
    const users = await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/user/print', [`?.id=${userId}`]);
    if (users && users.length > 0) return users[0];
    return null;
}

async function editHotspotUser(mikrotikApiConfig, userId, userData) {
    const mikrotikParams = [`=.id=${userId}`];
    if (userData.password) mikrotikParams.push(`=password=${userData.password}`);
    if (userData.profile) mikrotikParams.push(`=profile=${userData.profile}`);
    if (userData['limit-uptime'] !== undefined) mikrotikParams.push(`=limit-uptime=${userData['limit-uptime']}`); 
    if (userData['limit-bytes-total'] !== undefined) mikrotikParams.push(`=limit-bytes-total=${userData['limit-bytes-total']}`);
    if (userData.comment !== undefined) mikrotikParams.push(`=comment=${userData.comment}`);
    if (mikrotikParams.length <= 1) throw new Error("Tidak ada data yang dikirim untuk diubah.");
    return await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/user/set', mikrotikParams);
}

async function removeHotspotUser(mikrotikApiConfig, userId) {
    return await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/user/remove', [`=.id=${userId}`]);
}

async function getActiveHotspotUsersDetailed(mikrotikApiConfig) {
    return await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/active/print') || [];
}
async function getAllPppoeSecretDetails(mikrotikApiConfig) {
    const response = await executeSingleCommand(mikrotikApiConfig, '/ppp/secret/print');
    return response || []; 
}

async function getTotalPppoeSecretsCount(mikrotikApiConfig) {
    const response = await executeSingleCommand(mikrotikApiConfig, '/ppp/secret/print', ['count-only=']);
    console.log('[MIKROTIK_SERVICE_RAW_DEBUG] Raw response for Total Secrets Count:', JSON.stringify(response));
    return response && response.length > 0 && response[0].ret ? parseInt(response[0].ret, 10) : 0;
}
async function disconnectHotspotUser(mikrotikApiConfig, activeId) {
    return await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/active/remove', [`=.id=${activeId}`]);
}

async function makeHotspotUserStatic(mikrotikApiConfig, activeId, actionType) {
    if (actionType === 'binding') {
        return { success: true, message: `Proses make binding untuk ID ${activeId} dijalankan (perlu logika backend).` };
    } else if (actionType === 'cookie') {
        return { success: true, message: `Proses login by cookie untuk ID ${activeId} dijalankan (perlu logika backend).` };
    }
    throw new Error(`Aksi '${actionType}' tidak didukung.`);
}

async function getHotspotUserIpAddress(mikrotikApiConfig, username) {
    if (!username) throw new Error("Username diperlukan.");
    const activeUsers = await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/active/print', [`?user=${username}`]);
    if (activeUsers && activeUsers.length > 0) return activeUsers[0].address;
    return null;
}

async function getHotspotUserUsageStats(mikrotikApiConfig, ipAddress) {
    if (!ipAddress) throw new Error("Alamat IP diperlukan.");
    const activeUsers = await executeSingleCommand(mikrotikApiConfig, '/ip/hotspot/active/print', [`?address=${ipAddress}`]);
    if (activeUsers && activeUsers.length > 0) {
        const userStats = activeUsers[0];
        return {
            user: userStats.user, address: userStats.address, macAddress: userStats['mac-address'],
            uptime: userStats.uptime, bytesIn: parseFloat(userStats['bytes-in'] || 0),
            bytesOut: parseFloat(userStats['bytes-out'] || 0), packetsIn: parseInt(userStats['packets-in'] || 0),
            packetsOut: parseInt(userStats['packets-out'] || 0),
        };
    }
    throw new Error(`Tidak ada user aktif ditemukan dengan IP ${ipAddress} untuk statistik sesi.`);
}

async function getActivePppoeConnections(mikrotikApiConfig) {
    const response = await executeSingleCommand(mikrotikApiConfig, '/ppp/active/print', ['?service=pppoe']);
    return response || [];
}

module.exports = {
    // Fungsi dasar Mikrotik
    getDeviceInfo,
    getPppoeActiveConnectionsCount,
    getTotalPppoeSecretsCount,
    getAllPppoeSecretDetails,
    getPppoeLogEntries,
    getActivePppoeConnections,
    getAllPppoeSecretDetails ,

    // Fungsi Hotspot
    getHotspotProfiles,
    getAllHotspotUsers,
    addHotspotUser,
    getHotspotUserDetails,
    editHotspotUser,
    removeHotspotUser,
    getActiveHotspotUsersDetailed,
    getHotspotActiveUserCount,
    disconnectHotspotUser,
    makeHotspotUserStatic,
    getHotspotUserIpAddress,
    getHotspotUserUsageStats,
};