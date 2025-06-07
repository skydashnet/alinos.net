const jwt = require('jsonwebtoken');
const userService = require('../services/userService');
const baileysService = require('../services/baileysService');
require('dotenv').config();


exports.login = async (req, res) => {
    const { username, password } = req.body;
    // console.log(`\n[AUTH_CONTROLLER] --- Proses Login Dimulai untuk User: ${username} ---`);
    // console.log(`[AUTH_CONTROLLER] --- Password yang diterima (panjangnya): ${password ? password.length : 'KOSONG'} ---`);
    if (!username || !password) {
        // console.log('[AUTH_CONTROLLER] DEBUG: Username atau password kosong dari request.');
        return res.status(400).json({ message: 'Username dan password diperlukan.' });
    }
    try {
        const user = await userService.findUserByUsername(username);
        if (!user) {
            console.log('[AUTH_CONTROLLER] DEBUG: User tidak ditemukan di database untuk username:', username);
            return res.status(401).send('Username tidak ditemukan.');
        }
        // console.log('[AUTH_CONTROLLER] DEBUG: User ditemukan:', {id: user.id, username: user.username, password_hash_tersimpan: user.password_hash ? 'ADA' : 'KOSONG'});
        const isMatch = await userService.comparePassword(password, user.password_hash);
        // console.log('[AUTH_CONTROLLER] DEBUG: Hasil bcrypt.compare (apakah password cocok?):', isMatch);
        if (!isMatch) {
            // console.log('[AUTH_CONTROLLER] DEBUG: Password tidak cocok.');
            return res.status(401).send('Password salah.');
        }
        // console.log('[AUTH_CONTROLLER] DEBUG: Login berhasil, membuat token...');
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
        res.json({ message: 'Login berhasil!', token });
    } catch (error) {
        // console.error('[AUTH_CONTROLLER] SERVER ERROR SAAT LOGIN:', error);
        res.status(500).json({ message: 'Terjadi error di server.' });
    }
};

exports.requestRegistrationOtp = async (req, res) => {
    const { username, email, password, whatsappNumber, fullName } = req.body;

    if (!username || !email || !password || !whatsappNumber || !fullName) {
        return res.status(400).json({ message: 'Semua field (username, email, password, nomor WhatsApp, nama lengkap) diperlukan.' });
    }
    
    let normalizedWaNumber = whatsappNumber.replace(/\D/g, '');
    if (normalizedWaNumber.startsWith('0')) {
        normalizedWaNumber = '62' + normalizedWaNumber.substring(1);
    } else if (!normalizedWaNumber.startsWith('62')) {
    }
    const jid = `${normalizedWaNumber}@s.whatsapp.net`;

    try {
        if (await userService.findUserByUsername(username)) {
            return res.status(409).json({ field: 'username', message: 'Username sudah terdaftar.' });
        }
        if (baileysService.getConnectionStatus().status !== 'CONNECTED') {
        return res.status(503).json({ message: 'Layanan WhatsApp sedang tidak tersedia, coba lagi nanti.' });
        }
        if (await userService.findUserByEmail(email)) {
            return res.status(409).json({ field: 'email', message: 'Email sudah terdaftar.' });
        }
        if (await userService.findUserByWhatsapp(jid)) {
            return res.status(409).json({ field: 'whatsappNumber', message: 'Nomor WhatsApp sudah terdaftar.' });
        }

        if (baileysService.getConnectionStatus().status !== 'CONNECTED') {
            return res.status(503).json({ message: 'Layanan WhatsApp sedang tidak tersedia, coba lagi nanti.' });
        }

        const otp = await userService.generateAndStoreOtp(jid);
        const otpMessage = `ALINOS.NET Dashboard Monitoring - Kode OTP registrasi Anda: *${otp}*. Berlaku 5 menit.`;
        await new Promise(resolve => setTimeout(resolve, 1000));
        await baileysService.sendMessage(jid, otpMessage);

                res.status(200).json({ message: `OTP telah dikirim ke nomor WhatsApp ${whatsappNumber}.` });
            } catch (error) {
                // console.error('[REQUEST_OTP_REG_ERROR]', error);
                res.status(500).json({ message: error.message || 'Gagal mengirim OTP. Coba lagi.' });
            }
        };

exports.completeRegistration = async (req, res) => {
    const { username, email, password, whatsappNumber, fullName, otp } = req.body;

    if (!username || !email || !password || !whatsappNumber || !fullName || !otp) {
        return res.status(400).json({ message: 'Semua field termasuk OTP diperlukan.' });
    }

    let normalizedWaNumber = whatsappNumber.replace(/\D/g, '');
    if (normalizedWaNumber.startsWith('0')) {
        normalizedWaNumber = '62' + normalizedWaNumber.substring(1);
    } else if (!normalizedWaNumber.startsWith('62')) {
        if (normalizedWaNumber.length >= 9 && normalizedWaNumber.length <= 13) {
             normalizedWaNumber = '62' + normalizedWaNumber;
        } else {
            return res.status(400).json({ field: 'whatsappNumber', message: 'Format nomor WhatsApp tidak valid.' });
        }
    }
    const jid = `${normalizedWaNumber}@s.whatsapp.net`;

    try {
        const otpVerification = await userService.verifyOtp(jid, otp);
        if (!otpVerification.valid) {
            return res.status(400).json({ field: 'otp', message: otpVerification.message });
        }
        const newUser = await userService.createUser({
            username,
            password,
            email,
            whatsapp_number: jid,
            full_name: fullName
        });
        try {
            const GREETING_MESSAGE_HEADER = `🎉 Selamat Datang di ALINOS.NET, ${fullName}! 🎉`; 
            
            const GREETING_MESSAGE_BODY = `
Kami sangat senang Anda bergabung! Akun Anda untuk *ALINOS.NET - DASHBOARD MONITOR* telah berhasil dibuat dan siap digunakan.

Berikut adalah detail login Anda:
Username: \`${username}\`
Password: \`${password}\`
Email: \`${email}\`

Untuk keamanan terbaik akun Anda 🛡️:
• Jaga kerahasiaan detail login ini.
• Jangan bagikan kepada siapapun.
• Waspada terhadap upaya phishing.

Selamat menjelajahi semua fitur dan kemudahan yang kami tawarkan!
Jika ada pertanyaan atau butuh bantuan, tim kami siap melayani.

Salam Sukses Selalu,

🚀 ~ _TEAM ALINOS_
            `;

            const fullMessage = `${GREETING_MESSAGE_HEADER}\n\n${GREETING_MESSAGE_BODY}`;

            if (baileysService.getConnectionStatus().status === 'CONNECTED') {
                await baileysService.sendMessage(jid, fullMessage);
                // console.log(`[AUTH_CONTROLLER] Pesan kredensial berhasil dikirim ke ${jid} setelah registrasi.`);
            } else {
                // console.warn(`[AUTH_CONTROLLER] Baileys tidak terkoneksi. Gagal mengirim pesan kredensial ke ${jid}. Pengguna tetap terdaftar.`);
            }
        } catch (waError) {
            // console.error(`[AUTH_CONTROLLER] Gagal mengirim pesan WhatsApp kredensial (versi menarik) ke ${jid}. Error: ${waError.message}`);
        }

        res.status(201).json({
            message: 'Registrasi berhasil! Silakan login. Detail akun juga dikirimkan via WhatsApp.',
            user: { id: newUser.id, username: newUser.username }
        });

    } catch (error) {
        // console.error('[COMPLETE_REG_ERROR]', error);
        if (error.message && (error.message.toLowerCase().includes("username sudah terdaftar") || error.message.toLowerCase().includes("email sudah terdaftar") || error.message.toLowerCase().includes("nomor whatsapp sudah terdaftar"))) {
            return res.status(409).json({ message: error.message });
        }
        res.status(500)
           .json({ message: error.message || 'Gagal menyelesaikan registrasi.' });
    }
};

module.exports = {
    login: exports.login, 
    requestRegistrationOtp: exports.requestRegistrationOtp,
    completeRegistration: exports.completeRegistration
};