const db = require('../config/db');
const bcrypt = require('bcryptjs');
const otpGenerator = require('otp-generator');

const otpStore = new Map();
const OTP_VALIDITY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;

/**
 * @param {string} whatsappNumberJid
 * @returns {string}
 */
async function generateAndStoreOtp(whatsappNumberJid) {
    const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
    });
    const expiresAt = Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000;
    otpStore.set(whatsappNumberJid, { otp, expiresAt, attempts: 0 });
    // console.log(`[OTP_SERVICE] OTP untuk ${whatsappNumberJid}: ${otp} (Berlaku hingga: ${new Date(expiresAt).toLocaleTimeString()})`);
    return otp;
}

/**
 * @param {string} whatsappNumberJid
 * @param {string} otpAttempt
 * @returns {object}
 */
async function verifyOtp(whatsappNumberJid, otpAttempt) {
    const storedEntry = otpStore.get(whatsappNumberJid);

    if (!storedEntry) {
        return { valid: false, message: 'OTP tidak ditemukan atau sudah digunakan. Silakan minta OTP baru.' };
    }

    if (storedEntry.attempts >= MAX_OTP_ATTEMPTS) {
        otpStore.delete(whatsappNumberJid);
        return { valid: false, message: 'Terlalu banyak percobaan OTP yang salah. Silakan minta OTP baru.' };
    }

    if (Date.now() > storedEntry.expiresAt) {
        otpStore.delete(whatsappNumberJid);
        return { valid: false, message: 'OTP sudah kedaluwarsa. Silakan minta OTP baru.' };
    }

    if (storedEntry.otp === otpAttempt) {
        otpStore.delete(whatsappNumberJid);
        return { valid: true, message: 'OTP berhasil diverifikasi.' };
    } else {
        storedEntry.attempts++;
        otpStore.set(whatsappNumberJid, storedEntry);
        const attemptsLeft = MAX_OTP_ATTEMPTS - storedEntry.attempts;
        return {
            valid: false,
            message: `OTP salah. Sisa percobaan: ${attemptsLeft}.`,
        };
    }
}

/**
 * @param {string} username
 * @returns {Promise<object|null>}
 */
async function findUserByUsername(username) {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        return rows[0] || null;
    } catch (error) {
        // console.error('[DB_ERROR] Gagal mencari user berdasarkan username:', error);
        throw new Error('Terjadi kesalahan saat mengambil data pengguna.');
    }
}

/**
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findUserByEmail(email) {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        return rows[0] || null;
    } catch (error) {
        // console.error('[DB_ERROR] Gagal mencari user berdasarkan email:', error);
        throw new Error('Terjadi kesalahan saat mengambil data pengguna.');
    }
}

/**
 * @param {string} whatsappNumberJid
 * @returns {Promise<object|null>}
 */
async function findUserByWhatsapp(whatsappNumberJid) {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE whatsapp_number = $1', [whatsappNumberJid]);
        return rows[0] || null;
    } catch (error) {
        // console.error('[DB_ERROR] Gagal mencari user berdasarkan nomor WhatsApp:', error);
        throw new Error('Terjadi kesalahan saat mengambil data pengguna.');
    }
}

/**
 * @param {object} userData
 * @returns {Promise<object>} 
 * @throws {Error}
 */
async function createUser(userData) {
    const { username, password, email, whatsapp_number, full_name } = userData;

    if (!username || !password || !email || !whatsapp_number || !full_name) {
        throw new Error('Semua field (username, password, email, nomor WhatsApp, nama lengkap) diperlukan untuk membuat user.');
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    const query = `
        INSERT INTO users (username, password_hash, email, whatsapp_number, full_name, is_verified)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING id, username, email, whatsapp_number, full_name, is_verified;
    `;
    const values = [username, password_hash, email, whatsapp_number, full_name];

    try {
        const { rows } = await db.query(query, values);
        if (rows.length === 0) {
            throw new Error('Gagal membuat pengguna, tidak ada data yang dikembalikan.');
        }
        // console.log(`[USER_SERVICE] User baru berhasil dibuat: ${rows[0].username}`);
        return rows[0];
    } catch (error) {
        // console.error('[DB_ERROR] Gagal membuat user baru:', error.message);
        if (error.code === '23505') {
            if (error.constraint && error.constraint.toLowerCase().includes('username')) {
                throw new Error('Username sudah terdaftar. Silakan gunakan username lain.');
            }
            if (error.constraint && error.constraint.toLowerCase().includes('email')) {
                throw new Error('Email sudah terdaftar. Silakan gunakan email lain.');
            }
            if (error.constraint && error.constraint.toLowerCase().includes('whatsapp_number')) {
                throw new Error('Nomor WhatsApp sudah terdaftar. Silakan gunakan nomor lain.');
            }
            throw new Error('Data yang Anda masukkan sudah terdaftar (username, email, atau nomor WhatsApp).');
        }
        throw new Error(`Gagal membuat pengguna di database: ${error.message}`);
    }
}

async function comparePassword(password, hash) {
    try {
        return await bcrypt.compare(password, hash);
    } catch (error) {
        return false;
    }
}

async function findUserById(id) {
    const { rows } = await db.query('SELECT id, username, email, whatsapp_number, full_name FROM users WHERE id = $1', [id]);
    return rows[0];
}

async function updateUserDetails(userId, userData) {
    const { fullName, email, whatsappNumber } = userData;
    let jid = null;
    if (whatsappNumber) {
        let normalizedWaNumber = whatsappNumber.replace(/\D/g, '');
        if (normalizedWaNumber.startsWith('0')) {
            normalizedWaNumber = '62' + normalizedWaNumber.substring(1);
        } else if (normalizedWaNumber && !normalizedWaNumber.startsWith('62')) {
            normalizedWaNumber = '62' + normalizedWaNumber;
        }
        if(normalizedWaNumber) jid = `${normalizedWaNumber}@s.whatsapp.net`;
    }

    const fieldsToUpdate = [];
    const values = [];
    let queryIndex = 1;

    if (fullName !== undefined) {
        fieldsToUpdate.push(`full_name = $${queryIndex++}`);
        values.push(fullName);
    }
    if (email !== undefined) {
        if(email) {
            const existingUser = await findUserByEmail(email);
            if (existingUser && existingUser.id !== userId) {
                throw new Error('Email sudah digunakan oleh akun lain.');
            }
        }
        fieldsToUpdate.push(`email = $${queryIndex++}`);
        values.push(email);
    }
    if (jid !== undefined) {
        if(jid) {
            const existingUser = await findUserByWhatsapp(jid);
            if (existingUser && existingUser.id !== userId) {
                throw new Error('Nomor WhatsApp sudah digunakan oleh akun lain.');
            }
        }
        fieldsToUpdate.push(`whatsapp_number = $${queryIndex++}`);
        values.push(jid);
    }

    if (fieldsToUpdate.length === 0) {
        throw new Error("Tidak ada data yang dikirim untuk diupdate.");
    }

    fieldsToUpdate.push(`updated_at = NOW()`);
    values.push(userId);

    const queryText = `
        UPDATE users
        SET ${fieldsToUpdate.join(', ')}
        WHERE id = $${queryIndex}
        RETURNING id, username, email, whatsapp_number, full_name;
    `;

    try {
        const { rows } = await db.query(queryText, values);
        if (rows.length === 0) throw new Error("User tidak ditemukan atau gagal update.");
        return rows[0];
    } catch (error) {
        if (error.code === '23505') {
            if (error.constraint && error.constraint.includes('email')) throw new Error('Email tersebut sudah terdaftar.');
            if (error.constraint && error.constraint.includes('whatsapp_number')) throw new Error('Nomor WhatsApp tersebut sudah terdaftar.');
        }
        throw error;
    }
}

async function changeUserPassword(userId, oldPassword, newPassword) {
    const user = await findUserById(userId);
    if (!user) throw new Error("User tidak ditemukan.");

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) throw new Error("Password lama salah.");

    if (newPassword.length < 6) throw new Error("Password baru minimal 6 karakter.");

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    const queryText = `
        UPDATE users
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, username;
    `;
    try {
        const { rows } = await db.query(queryText, [newPasswordHash, userId]);
        return rows[0];
    } catch (error) {
        throw new Error(`Gagal mengubah password: ${error.message}`);
    }
}


module.exports = {
    generateAndStoreOtp,
    verifyOtp,
    findUserByUsername,
    findUserByEmail,
    findUserByWhatsapp,
    createUser,
    findUserById,
    updateUserDetails,
    changeUserPassword,
    comparePassword,
};