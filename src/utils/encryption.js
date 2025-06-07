const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = Buffer.from(process.env.MIKROTIK_CREDENTIAL_ENCRYPTION_KEY, 'hex');
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

if (ENCRYPTION_KEY.length !== 32) {
    throw new Error('Kunci enkripsi (MIKROTIK_CREDENTIAL_ENCRYPTION_KEY) harus 32 byte (64 karakter hex).');
}

function encrypt(text) {
    if (text === null || typeof text === 'undefined') return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        authTag: authTag.toString('hex')
    };
}

function decrypt(encryptedObject) {
    if (!encryptedObject || !encryptedObject.iv || !encryptedObject.encryptedData || !encryptedObject.authTag) {
        console.warn("[DECRYPT] Objek enkripsi tidak lengkap, mengembalikan null.");
        return null;
    }
    try {
        const iv = Buffer.from(encryptedObject.iv, 'hex');
        const authTag = Buffer.from(encryptedObject.authTag, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedObject.encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error("[DECRYPT_ERROR] Gagal melakukan dekripsi:", error.message);
        return null;
    }
}

module.exports = { encrypt, decrypt };