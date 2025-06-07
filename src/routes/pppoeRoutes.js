const express = require('express');
const router = express.Router();
const mikrotikController = require('../controllers/mikrotikController');

router.get('/secrets', mikrotikController.getAllPppoeSecrets);
router.get('/off/count', mikrotikController.getPelangganOff);
router.get('/off/details', mikrotikController.getPelangganOffDetails);

module.exports = router;