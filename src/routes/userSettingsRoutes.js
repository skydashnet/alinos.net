const express = require('express');
const router = express.Router();
const userSettingsController = require('../controllers/userSettingsController');

router.get('/account', userSettingsController.getAccountDetails);
router.put('/account', userSettingsController.updateAccountDetails);
router.put('/change-password', userSettingsController.changePassword);

module.exports = router;