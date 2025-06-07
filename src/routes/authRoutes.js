const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register/request-otp', authController.requestRegistrationOtp);
router.post('/register/complete', authController.completeRegistration);

module.exports = router;