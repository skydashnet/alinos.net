// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const cors = require('cors');
const db = require('./src/config/db');
const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

const authRoutes = require('./src/routes/authRoutes');
const mikrotikRoutes = require('./src/routes/mikrotikRoutes');
const managementRoutes = require('./src/routes/managementRoutes');
const hotspotRoutes = require('./src/routes/hotspotRoutes');
const odpOdcRoutes = require('./src/routes/odpOdcRoutes');
const pppoeRoutes = require('./src/routes/pppoeRoutes');
const authMiddleware = require('./src/middleware/authMiddleware');
const userSettingsRoutes = require('./src/routes/userSettingsRoutes');
const routerConfigRoutes = require('./src/routes/routerConfigRoutes');
const { initializeBaileysClient, getConnectionStatus, getQrCode } = require('./src/services/baileysService');

const { setupLiveTrafficWebSocket } = require('./src/controllers/mikrotikController');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    // console.log(`[SERVER_LOG] Menerima request: ${req.method} ${req.originalUrl}`);
    next();
});
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const newPath = req.path.slice(0, -5); // Hapus '.html'
        res.redirect(301, newPath);
    } else {
        next();
    }
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/customer', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'customer.html'));
});
app.get('/router', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'router.html'));
});
app.get('/odcodp', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'odp_odc.html'));
});
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Rute API
app.use('/api/auth', authRoutes);
app.use('/api/mikrotik', noCache, authMiddleware, mikrotikRoutes);
app.use('/api/pppoe', noCache, authMiddleware, pppoeRoutes);
app.use('/api/hotspot', noCache, authMiddleware, hotspotRoutes);
app.use('/api/management', noCache, authMiddleware, managementRoutes);
app.use('/api/odp-odc', noCache, authMiddleware, odpOdcRoutes);
app.use('/api/router-config', noCache, authMiddleware, routerConfigRoutes);
app.use('/api/settings', noCache, authMiddleware, userSettingsRoutes);
app.use('/api/router-config', noCache, authMiddleware, routerConfigRoutes);

setupLiveTrafficWebSocket(wss);
app.get('/api/baileys/status', async (req, res) => {
    try {
        const status = await getConnectionStatus();
        res.json(status);
    } catch (error) {
        console.error('Error getting Baileys status:', error);
        res.status(500).json({ error: 'Failed to get connection status' });
    }
});

initializeBaileysClient().catch(err => {
console.error("!!! KRITIKAL: Gagal inisialisasi Baileys saat startup !!!", err.message);
});

server.listen(PORT, async () => { 
    console.log(`------------------------------------------------------`);
    console.log(`Backend server ALINOS.NET berjalan di http://localhost:${PORT}`);
    console.log(`Frontend dapat diakses di http://localhost:${PORT}`);
    console.log(`------------------------------------------------------`);
    try {
        const dbTest = await db.query('SELECT NOW()');
        console.log(`[INFO] Koneksi ke PostgreSQL berhasil pada: ${dbTest.rows[0].now}`);
    } catch (err) {
        console.error('!!! KRITIKAL: Gagal terhubung ke PostgreSQL !!!');
        console.error(err.message);
    }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
  process.exit(1);
});