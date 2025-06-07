const express = require('express');
const router = express.Router();
const hotspotController = require('../controllers/hotspotController');

router.get('/profiles', hotspotController.getProfiles);
router.get('/users/all', hotspotController.getAllUsers);
router.post('/users', hotspotController.addUser);
router.put('/users/:id', hotspotController.editUser);
router.delete('/users/:id', hotspotController.removeUser);
router.get('/active', hotspotController.getActiveUsers);
router.post('/active/:activeId/disconnect', hotspotController.disconnectActiveUser);
router.post('/active/:activeId/make-static', hotspotController.makeUserStatic);
router.get('/usage/:username', hotspotController.getUserBandwidth);
router.get('/users/active-count', hotspotController.getHotspotActiveCount);


module.exports = router;