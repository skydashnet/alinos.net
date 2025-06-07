const db = require('../config/db');
const mikrotikService = require('../services/mikrotikService');
const routerConfigService = require('../services/routerConfigService');

async function getActiveUserMikrotikConfig(userId, res, actionDescription = "operasi Management") {
    try {
        const userDbConfig = await routerConfigService.getActiveMikrotikConfig(userId);
        if (!userDbConfig || !userDbConfig.host || !userDbConfig.user || typeof userDbConfig.password === 'undefined') {
            const errorMessage = `Konfigurasi Mikrotik untuk Anda belum diatur/tidak lengkap. Silakan atur di Pengaturan Router.`;
            if (res && !res.headersSent) res.status(400).json({ message: errorMessage });
            return null;
        }
        return {
            host: userDbConfig.host, user: userDbConfig.user,
            password: userDbConfig.password, port: parseInt(userDbConfig.port || userDbConfig.port_api || '8728', 10)
        };
    } catch (error) {
        if (res && !res.headersSent) res.status(500).json({ message: `Gagal memuat konfigurasi Mikrotik.` });
        return null;
    }
}


const PROFILE_NOMINAL_MAP = {
    'ISOLIR': 0,
    'UPTO || 3M BR': 30000,
    'UPTO || 5M BR': 60000,
    'UPTO || 7M || BR': 80000,
    'UPTO || 11M || BR': 100000,
    'UPTO || 15M || BR': 100000,
    'UPTO || 20M || BR': 150000,
    'UPTO || 30M || BR': 200000
};
function formatCurrencyForDB(amount) {
    if (typeof amount === 'string') {
        amount = amount.replace(/Rp\s?|\./g, '');
        amount = amount.replace(',', '.');
    }
    return parseFloat(amount) || 0;
}

function parseNominalFromComment(commentString) {
    if (!commentString || typeof commentString !== 'string') return null;
    const parts = commentString.split('||').map(part => part.trim());
    if (parts.length >= 2) {
        const potentialNominal = parts[1];
        const nominalMatch = potentialNominal.match(/^(\d+)(k|rb)?$/i);
        if (nominalMatch && nominalMatch[1]) {
            let nominalValue = parseInt(nominalMatch[1], 10);
            if (nominalMatch[2] && (nominalMatch[2].toLowerCase() === 'k' || nominalMatch[2].toLowerCase() === 'rb')) {
                nominalValue *= 1000;
            }
            return nominalValue;
        }
        return 0; 
    }
    return null;
}

function getNominalFromProfile(profileString) {
    return PROFILE_NOMINAL_MAP[profileString] !== undefined ? PROFILE_NOMINAL_MAP[profileString] : null;
}
exports.getIncomeCustomers = async (req, res) => {
    try {
        const config = await getActiveUserMikrotikConfig(req.user.id, res, "mengambil daftar pelanggan untuk pemasukan");
        if (!config) return;
        const pppoeSecrets = await mikrotikService.getAllPppoeSecretDetails(config);
        if (!pppoeSecrets) {
            return res.status(500).json({ message: "Gagal mengambil data PPPoE Secrets dari Mikrotik." });
        }
        if (pppoeSecrets.length === 0) {
            return res.json([]);
        }

        const customerFinancialDataPromises = pppoeSecrets.map(async (secret) => {
            const { rows } = await db.query(
                'SELECT nominal, tanggal_tagihan, comment FROM customer_financials WHERE pppoe_username = $1',
                [secret.name]
            );
            const dbFinancialInfo = rows[0] || {};

            let nominal = null;
            const commentFromMikrotik = secret.comment || '';
            const profileFromMikrotik = secret.profile || '';
            const nominalFromComment = parseNominalFromComment(secret.comment || '');
            const nominalFromProfileDefault = getNominalFromProfile(secret.profile || '');
            if (nominalFromComment !== null) {
                nominal = nominalFromComment;
            } else {
                nominal = nominalFromProfileDefault !== null ? nominalFromProfileDefault : 0;
            }
            const finalNominal = (dbFinancialInfo.nominal !== null && dbFinancialInfo.nominal !== undefined) 
                                 ? parseFloat(dbFinancialInfo.nominal) 
                                 : nominal;

            return {
                pppoe_username: secret.name, name: secret.name, profile: secret.profile,
                nominal: finalNominal,
                tanggal_tagihan: dbFinancialInfo.tanggal_tagihan,
                comment: dbFinancialInfo.comment || secret.comment || '',
            };
        });
        const combinedData = await Promise.all(customerFinancialDataPromises);
        res.json(combinedData);

    } catch (error) {
        console.error("[MGMT_CONTROLLER_ERROR] getIncomeCustomers:", error.message, error.stack);
        res.status(500).json({ message: error.message || "Gagal mengambil data pemasukan pelanggan." });
    }
};
exports.updateIncomeCustomer = async (req, res) => {
    const { username } = req.params;
    const { nominal, tanggal_tagihan, comment } = req.body;
    if (nominal === undefined || tanggal_tagihan === undefined || comment === undefined) {
        return res.status(400).json({ message: "Nominal, tanggal tagihan, dan comment diperlukan." });
    }
    const numericNominal = formatCurrencyForDB(nominal);
    try {
        const query = `
            INSERT INTO customer_financials (pppoe_username, nominal, tanggal_tagihan, comment, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (pppoe_username) DO UPDATE SET
                nominal = EXCLUDED.nominal,
                tanggal_tagihan = EXCLUDED.tanggal_tagihan,
                comment = EXCLUDED.comment,
                updated_at = NOW()
            RETURNING *;
        `;
        const { rows } = await db.query(query, [username, numericNominal, tanggal_tagihan || null, comment]);
        if (rows.length > 0) {
            res.json({ message: `Data untuk ${username} berhasil diperbarui.`, data: rows[0] });
        } else {
            res.status(404).json({ message: `Data untuk ${username} tidak ditemukan atau gagal diupdate.` });
        }
    } catch (error) {
        // console.error(`[MGMT_CONTROLLER_ERROR] updateIncomeCustomer for ${username}:`, error.message);
        res.status(500).json({ message: "Gagal memperbarui data pemasukan pelanggan." });
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, description, amount, TO_CHAR(expense_date, \'YYYY-MM-DD\') as expense_date FROM expenses ORDER BY expense_date DESC, created_at DESC');
        res.json(rows);
    } catch (error) {
        // console.error("[MGMT_CONTROLLER_ERROR] getExpenses:", error.message);
        res.status(500).json({ message: "Gagal mengambil data pengeluaran." });
    }
};

exports.addExpense = async (req, res) => {
    const { description, amount, expense_date } = req.body;
    if (!description || amount === undefined || !expense_date) {
        return res.status(400).json({ message: "Deskripsi, jumlah, dan tanggal pengeluaran diperlukan." });
    }
    const numericAmount = formatCurrencyForDB(amount);
    if (numericAmount <= 0) {
        return res.status(400).json({ message: "Jumlah pengeluaran harus lebih besar dari 0." });
    }
    try {
        const query = `
            INSERT INTO expenses (description, amount, expense_date)
            VALUES ($1, $2, $3)
            RETURNING id, description, amount, TO_CHAR(expense_date, 'YYYY-MM-DD') as expense_date;
        `;
        const { rows } = await db.query(query, [description, numericAmount, expense_date]);
        res.status(201).json(rows[0]);
    } catch (error) {
        // console.error("[MGMT_CONTROLLER_ERROR] addExpense:", error.message);
        res.status(500).json({ message: "Gagal menambahkan data pengeluaran." });
    }
};
exports.updateExpense = async (req, res) => {
    const { id } = req.params;
    const { description, amount, expense_date } = req.body;

    if (!description || amount === undefined || !expense_date) {
        return res.status(400).json({ message: "Deskripsi, jumlah, dan tanggal pengeluaran diperlukan." });
    }

    const numericAmount = formatCurrencyForDB(amount);
    if (numericAmount <= 0) {
        return res.status(400).json({ message: "Jumlah pengeluaran harus lebih besar dari 0." });
    }

    try {
        const query = `
            UPDATE expenses
            SET description = $1, amount = $2, expense_date = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING id, description, amount, TO_CHAR(expense_date, 'YYYY-MM-DD') as expense_date;
        `;
        const { rows } = await db.query(query, [description, numericAmount, expense_date, id]);

        if (rows.length > 0) {
            res.json({ message: 'Data pengeluaran berhasil diperbarui.', data: rows[0] });
        } else {
            res.status(404).json({ message: `Pengeluaran dengan ID ${id} tidak ditemukan.` });
        }
    } catch (error) {
        // console.error(`[MGMT_CONTROLLER_ERROR] updateExpense for ID ${id}:`, error.message);
        res.status(500).json({ message: "Gagal memperbarui data pengeluaran." });
    }
};
function parseNominalFromComment(commentString) {
    if (!commentString || typeof commentString !== 'string') return null;
    const parts = commentString.split('||').map(part => part.trim());
    if (parts.length >= 2) {
        const potentialNominalStr = parts[1];
        const K_RB_Match = potentialNominalStr.match(/^(\d+)(k|rb)$/i);
        if (K_RB_Match && K_RB_Match[1]) {
            return parseInt(K_RB_Match[1], 10) * 1000;
        }
        const numberOnlyMatch = potentialNominalStr.match(/^(\d+)$/);
        if (numberOnlyMatch && numberOnlyMatch[1]) {
            return parseInt(numberOnlyMatch[1], 10) * 1000; 
        }
        return 0; 
    }
    return null;
}

function getNominalFromProfile(profileString) {
    return PROFILE_NOMINAL_MAP[profileString] !== undefined ? PROFILE_NOMINAL_MAP[profileString] : null;
}
function formatCurrencyForDB(amount) {
    if (typeof amount === 'string') {
        amount = amount.replace(/Rp\s?|\./g, '');
        amount = amount.replace(',', '.');
    }
    return parseFloat(amount) || 0;
}