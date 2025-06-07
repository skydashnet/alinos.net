const express = require('express');
const router = express.Router();
const routerConfigController = require('../controllers/routerConfigController');

router.post('/', routerConfigController.saveConfig);
router.get('/', routerConfigController.getConfig);

module.exports = router;