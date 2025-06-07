// src/routes/mikrotikRoutes.js
const express = require('express');
const router = express.Router();
const mikrotikController = require('../controllers/mikrotikController'); // Pastikan ini file controller yang benar

// Rute untuk informasi umum perangkat dan statistik PPPoE dasar
router.get('/device/info', mikrotikController.getDeviceInfo);
router.get('/pelanggan/on', mikrotikController.getPelangganOn);
router.get('/pppoe/secrets', mikrotikController.getAllPppoeSecrets);
router.get('/log/pppoe', mikrotikController.getPppoeLogs);

module.exports = router;