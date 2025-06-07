const express = require('express');
const router = express.Router();
const odpOdcController = require('../controllers/odpOdcController');

router.get('/all', odpOdcController.getAllOdpOdc);
router.post('/', odpOdcController.addOdpOdc);
router.get('/:id/details', odpOdcController.getOdpOdcDetails);
router.put('/:id', odpOdcController.updateOdpOdc);
router.delete('/:id', odpOdcController.deleteOdpOdc);
router.get('/slots/all', odpOdcController.getAllSlots);
router.get('/odp-list', odpOdcController.getOdpList);
router.put('/device/:deviceId/slot/:slotNumber', odpOdcController.updateOdpOdcSlot);

module.exports = router;