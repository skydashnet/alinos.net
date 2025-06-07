const db = require('../config/db');

/**
 * @param {object} deviceData
 * @returns {Promise<object>}
 */
async function addNetworkDevice(deviceData) {
    const { name, type, latitude, longitude, splitter_capacity, comment } = deviceData;
    const queryText = `
        INSERT INTO network_devices (name, type, latitude, longitude, splitter_capacity, comment, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *;
    `;
    const values = [
        name,
        type,
        latitude,
        longitude,
        (type === 'ODP' || type === 'ODC') ? splitter_capacity : null,
        comment || null
    ];

    try {
        const { rows } = await db.query(queryText, values);
        // console.log('[ODP_SERVICE] Perangkat baru ditambahkan:', rows[0]);
        return rows[0];
    } catch (error) {
        // console.error('[ODP_SERVICE_ERROR] addNetworkDevice Gagal:', error.message);
        if (error.code === '23505') {
            throw new Error(`Nama perangkat '${name}' sudah ada.`);
        }
        throw error;
    }
}

/**
 * Mengambil semua perangkat jaringan (ODP/ODC) dari database
 * dengan pengurutan yang logis (berdasarkan tipe, lalu nomor).
 * @returns {Promise<Array<object>>} Array berisi objek perangkat.
 */
async function getAllNetworkDevices() {
    try {
        // Query yang sudah diperbaiki (menghapus 'NULLS FIRST')
        const queryText = `
            SELECT id, name, type, latitude, longitude, splitter_capacity, comment 
            FROM network_devices 
            ORDER BY
                type,
                CAST(substring(name from '(\\d+)') AS INTEGER);
        `;

        const { rows } = await db.query(queryText);
        return rows;

    } catch (error) {
        console.error('[ODP_SERVICE_ERROR] getAllNetworkDevices Gagal:', error);
        throw error;
    }
}

async function getNetworkDeviceDetails(deviceId) {
    try {
        const deviceQuery = await db.query('SELECT * FROM network_devices WHERE id = $1', [deviceId]);
        if (deviceQuery.rows.length === 0) return null;
        
        const deviceData = deviceQuery.rows[0];
        deviceData.slots = []; 

        if ((deviceData.type === 'ODP' || deviceData.type === 'ODC') && deviceData.splitter_capacity > 0) {
            // Ambil juga linked_device_id dari slot
            const slotsQuery = await db.query(
                'SELECT id as slot_id, slot_number, customer_pppoe_name, linked_device_id, status, notes FROM odp_slots WHERE device_id = $1 ORDER BY slot_number ASC',
                [deviceId]
            );
            
            const existingSlotsMap = new Map(slotsQuery.rows.map(slot => [slot.slot_number, slot]));
            for (let i = 1; i <= deviceData.splitter_capacity; i++) {
                const existingSlot = existingSlotsMap.get(i);
                if (existingSlot) {
                    deviceData.slots.push({
                        id: existingSlot.slot_id,
                        number: existingSlot.slot_number,
                        customer_name: existingSlot.customer_pppoe_name,
                        linked_device_id: existingSlot.linked_device_id, // Tambahkan ini
                        status: existingSlot.status || 'Tersedia',
                        notes: existingSlot.notes
                    });
                } else {
                    deviceData.slots.push({ id: null, number: i, customer_name: null, linked_device_id: null, status: 'Tersedia', notes: null });
                }
            }
        }
        return deviceData;
    } catch (error) {
        throw error;
    }
}
async function updateOdpOdcSlot(deviceId, slotNumber, updateData) {
    const { customer_pppoe_name, notes, linked_device_id } = updateData;

    let columnsToUpdate = 'notes = $3';
    let values = [deviceId, slotNumber, notes || null];
    let status = 'Tersedia';

    if (linked_device_id) {
        // Logika untuk ODC -> ODP
        status = 'Terpakai';
        columnsToUpdate += ', linked_device_id = $4, customer_pppoe_name = NULL';
        values.push(parseInt(linked_device_id));
    } else if (customer_pppoe_name && customer_pppoe_name.trim() !== '') {
        // Logika untuk ODP -> Customer
        status = 'Terpakai';
        columnsToUpdate += ', customer_pppoe_name = $4, linked_device_id = NULL';
        values.push(customer_pppoe_name);
    } else {
        // Logika untuk mengosongkan slot
        columnsToUpdate += ', customer_pppoe_name = NULL, linked_device_id = NULL';
    }

    columnsToUpdate += ', status = $'+ (values.length + 1);
    values.push(status);

    const queryText = `
        INSERT INTO odp_slots (device_id, slot_number, notes, ${linked_device_id ? 'linked_device_id' : 'customer_pppoe_name'}, status, updated_at)
        VALUES ($1, $2, $3, ${values.length > 3 ? '$4' : 'NULL'}, $${values.length > 3 ? '5' : '4'}, NOW())
        ON CONFLICT (device_id, slot_number) DO UPDATE SET
            ${columnsToUpdate},
            updated_at = NOW()
        RETURNING *;
    `;

    // Penyesuaian nilai untuk query INSERT agar cocok
    const insertValues = [deviceId, slotNumber, notes || null];
    if (linked_device_id) insertValues.push(parseInt(linked_device_id));
    else if (customer_pppoe_name) insertValues.push(customer_pppoe_name);
    else insertValues.push(null);
    insertValues.push(status);
    
    // Penyesuaian nilai untuk query UPDATE
    const updateValues = [deviceId, slotNumber, notes || null];
    if (linked_device_id) updateValues.push(parseInt(linked_device_id));
    else if(customer_pppoe_name) updateValues.push(customer_pppoe_name);
    
    // Perbaikan final pada query dan values, kita sederhanakan logikanya
    const finalQuery = `
        INSERT INTO odp_slots (device_id, slot_number, customer_pppoe_name, linked_device_id, notes, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (device_id, slot_number) DO UPDATE SET
            customer_pppoe_name = EXCLUDED.customer_pppoe_name,
            linked_device_id = EXCLUDED.linked_device_id,
            notes = EXCLUDED.notes,
            status = EXCLUDED.status,
            updated_at = NOW()
        RETURNING *;
    `;
    const finalValues = [
        deviceId, slotNumber, 
        linked_device_id ? null : customer_pppoe_name || null, // customer_name null jika linked_device_id diisi
        linked_device_id || null, 
        notes || null, 
        (linked_device_id || customer_pppoe_name) ? 'Terpakai' : 'Tersedia'
    ];

    try {
        const { rows } = await db.query(finalQuery, finalValues);
        return rows[0];
    } catch (error) {
        throw error;
    }
}

async function updateSlotInDb(slotId, slotData) {
    const { customer_name, notes, linked_device_id } = slotData;

    // Tentukan kolom mana yang akan diupdate
    let fieldToUpdate, valueToUpdate;
    let status = 'Tersedia'; // Default status

    if (linked_device_id) {
        // Jika mengedit slot ODC untuk link ke ODP
        fieldToUpdate = 'linked_device_id';
        valueToUpdate = parseInt(linked_device_id);
        // Kita bisa set customer_name menjadi deskriptif atau biarkan null
        await db.query('UPDATE odp_slots SET customer_name = NULL WHERE id = $1', [slotId]);
        status = 'Terpakai';
    } else {
        // Jika mengedit slot ODP untuk user PPPoE (logika lama)
        fieldToUpdate = 'customer_name';
        valueToUpdate = customer_name;
        await db.query('UPDATE odp_slots SET linked_device_id = NULL WHERE id = $1', [slotId]);
        if (customer_name && customer_name.trim() !== '') {
            status = 'Terpakai';
        }
    }

    const queryText = `
        UPDATE odp_slots 
        SET ${fieldToUpdate} = $1, notes = $2, status = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *;
    `;
    const values = [valueToUpdate, notes, status, slotId];
    const { rows } = await db.query(queryText, values);
    return rows[0];
}

async function updateNetworkDevice(deviceId, deviceData) {
    const { name, type, latitude, longitude, splitter_capacity, comment } = deviceData;
    const queryText = `
        UPDATE network_devices
        SET name = $1, type = $2, latitude = $3, longitude = $4,
            splitter_capacity = $5, comment = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING *;
    `;
    const values = [
        name,
        type,
        parseFloat(latitude),
        parseFloat(longitude),
        (type === 'ODP' || type === 'ODC') ? parseInt(splitter_capacity) : null,
        comment || null,
        deviceId
    ];

    try {
        const { rows } = await db.query(queryText, values);
        if (rows.length === 0) {
            throw new Error(`Perangkat dengan ID ${deviceId} tidak ditemukan untuk diupdate.`);
        }
        return rows[0];
    } catch (error) {
        if (error.code === '23505') {
            throw new Error(`Nama perangkat '${name}' sudah ada.`);
        }
        throw new Error(`Gagal mengupdate perangkat di database: ${error.message}`);
    }
}

async function deleteNetworkDevice(deviceId) {
    try {
        const { rowCount } = await db.query('DELETE FROM network_devices WHERE id = $1', [deviceId]);
        if (rowCount === 0) {
            throw new Error(`Perangkat dengan ID ${deviceId} tidak ditemukan untuk dihapus.`);
        }
        // console.log(`[ODP_SERVICE] Perangkat dengan ID ${deviceId} berhasil dihapus.`);
        return { success: true, message: `Perangkat ID ${deviceId} berhasil dihapus.` };
    } catch (error) {
        // console.error(`[ODP_SERVICE_ERROR] Gagal menghapus perangkat ID ${deviceId}:`, error.message);
        throw new Error(`Gagal menghapus perangkat dari database: ${error.message}`);
    }
}
module.exports = {
    addNetworkDevice,
    getAllNetworkDevices,
    getNetworkDeviceDetails,
    updateNetworkDevice,
    deleteNetworkDevice,
    updateOdpOdcSlot,
};