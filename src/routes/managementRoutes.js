const express = require('express');
const router = express.Router();
const managementController = require('../controllers/managementController');
router.get('/income-customers', managementController.getIncomeCustomers);
router.put('/income-customers/:username', managementController.updateIncomeCustomer);
router.get('/expenses', managementController.getExpenses);
router.post('/expenses', managementController.addExpense);
router.put('/expenses/:id', managementController.updateExpense);

module.exports = router;