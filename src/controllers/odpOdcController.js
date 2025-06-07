const odpOdcService = require('../services/odpOdcService');
const db = require('../config/db');

exports.getAllOdpOdc = async (req, res) => {
    try {
        const devices = await odpOdcService.getAllNetworkDevices();
        // console.log('[ODP_ODC_CONTROLLER] Mengirim data semua perangkat ODP/ODC...');
        res.json(devices); 
    } catch (error) {
        // console.error('[ODP_ODC_CONTROLLER_ERROR] getAllOdpOdc:', error.message);
        res.status(500).json({ message: error.message || "Gagal mengambil data ODP/ODC." });
    }
};

exports.addOdpOdc = async (req, res) => {
    try {
        const newDevice = await odpOdcService.addNetworkDevice(req.body);
        // console.log('[ODP_ODC_CONTROLLER] Menambah ODP/ODC baru:', newDevice);
        res.status(201).json(newDevice);
    } catch (error) {
        // console.error('[ODP_ODC_CONTROLLER_ERROR] addOdpOdc:', error.message);
        res.status(400).json({ message: error.message || "Gagal menyimpan data perangkat ODP/ODC." });
    }
};
   
exports.getOdpOdcDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const deviceDetails = await odpOdcService.getNetworkDeviceDetails(id);
        if (deviceDetails) {
            // console.log(`[ODP_ODC_CONTROLLER] Mengirim detail untuk device ID: ${id}`);
            res.json(deviceDetails);
        } else {
            // console.log(`[ODP_ODC_CONTROLLER] Device ID: ${id} tidak ditemukan.`);
            res.status(404).json({ message: 'Perangkat tidak ditemukan.' });
        }
    } catch (error) {
        // console.error(`[ODP_ODC_CONTROLLER_ERROR] getOdpOdcDetails for ID ${id}:`, error.message);
        res.status(500).json({ message: error.message || "Gagal mengambil detail perangkat ODP/ODC." });
    }
};

exports.updateOdpOdc = async (req, res) => {
    const { id } = req.params;
    try {
        const updatedDevice = await odpOdcService.updateNetworkDevice(id, req.body);
        // console.log(`[ODP_ODC_CONTROLLER] Perangkat ID ${id} diupdate:`, updatedDevice);
        res.json(updatedDevice);
    } catch (error) {
        // console.error(`[ODP_ODC_CONTROLLER_ERROR] updateOdpOdc for ID ${id}:`, error.message);
        res.status(error.message.includes("tidak ditemukan") ? 404 : 400).json({ message: error.message || "Gagal memperbarui data perangkat." });
    }
};

exports.getOdpList = async (req, res) => {
    try {
        const queryText = `
            SELECT id, name FROM network_devices 
            WHERE type = 'ODP' 
            ORDER BY
                CAST(substring(name from '(\\d+)') AS INTEGER);
        `;
        const { rows } = await db.query(queryText);
        res.json(rows);
    } catch (error) {
        console.error('[ODP_ODC_CONTROLLER_ERROR] getOdpList:', error);
        res.status(500).json({ message: "Gagal mengambil daftar ODP." });
    }
};

exports.deleteOdpOdc = async (req, res) => {
    const { id } = req.params;
    try {
        await odpOdcService.deleteNetworkDevice(id);
        // console.log(`[ODP_ODC_CONTROLLER] Perangkat ID ${id} dihapus.`);
        res.status(204).send();
    } catch (error) {
        // console.error(`[ODP_ODC_CONTROLLER_ERROR] deleteOdpOdc for ID ${id}:`, error.message);
        res.status(error.message.includes("tidak ditemukan") ? 404 : 500).json({ message: error.message || "Gagal menghapus data perangkat." });
    }
};
exports.assignCustomerToOdpSlot = async (req, res) => {
    const { deviceId, slotNumber } = req.params;
    const { customer_pppoe_name, notes, status } = req.body; 

    try {
        const updatedSlot = await odpOdcService.assignCustomerToSlot(
            deviceId, 
            slotNumber, 
            customer_pppoe_name,
            notes,
            status
        );
        res.json({ message: 'Slot berhasil diperbarui.', slot: updatedSlot });
    } catch (error) {
        // console.error(`[ODP_ODC_CONTROLLER_ERROR] assignCustomerToOdpSlot (Device: ${deviceId}, Slot: ${slotNumber}):`, error.message);
        res.status(400).json({ message: error.message || "Gagal memperbarui slot ODP/ODC." });
    }
};
exports.updateOdpOdcSlot = async (req, res) => {
    const { deviceId, slotNumber } = req.params;
    try {
        // req.body akan berisi { customer_pppoe_name, notes } atau { linked_device_id, notes }
        const updatedSlot = await odpOdcService.updateOdpOdcSlot(deviceId, slotNumber, req.body);
        res.json({ message: 'Slot berhasil diperbarui.', slot: updatedSlot });
    } catch (error) {
        res.status(400).json({ message: error.message || "Gagal memperbarui slot ODP/ODC." });
    }
};
exports.getAllSlots = async (req, res) => {
    try {
        const { rows } = await db.query("SELECT linked_device_id FROM odp_slots");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil semua data slot." });
    }
};