const RouterOSAPI = require('routeros-api').RouterOSAPI;
require('dotenv').config();

const MIKROTIK_HOST = process.env.MIKROTIK_HOST;
const MIKROTIK_USER = process.env.MIKROTIK_USER;
const MIKROTIK_PASSWORD = process.env.MIKROTIK_PASSWORD;

const createMikrotikAPIConnection = () => {
    if (!MIKROTIK_HOST || !MIKROTIK_USER) {
        throw new Error('Konfigurasi Mikrotik tidak lengkap.');
    }
    return new RouterOSAPI({
        host: MIKROTIK_HOST,
        user: MIKROTIK_USER,
        password: MIKROTIK_PASSWORD,
        keepalive: true 
    });
};

module.exports = { createMikrotikAPIConnection };