const userService = require('../services/userService');

exports.getAccountDetails = async (req, res) => {
    try {
        const user = await userService.findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User tidak ditemukan." });
        }
        res.json(user);
    } catch (error) {
        // console.error("[USER_SETTINGS_ERROR] getAccountDetails:", error);
        res.status(500).json({ message: "Gagal mengambil detail akun." });
    }
};

exports.updateAccountDetails = async (req, res) => {
    try {
        const { fullName, email, whatsappNumber } = req.body;
        const updatedUser = await userService.updateUserDetails(req.user.id, { fullName, email, whatsappNumber });
        res.json({ message: "Detail akun berhasil diperbarui.", user: updatedUser });
    } catch (error) {
        // console.error("[USER_SETTINGS_ERROR] updateAccountDetails:", error);
        res.status(400).json({ message: error.message || "Gagal memperbarui detail akun." });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmNewPassword } = req.body;
        if (!oldPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ message: "Password lama, password baru, dan konfirmasi password baru diperlukan." });
        }
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ message: "Password baru dan konfirmasi tidak cocok." });
        }
        
        await userService.changeUserPassword(req.user.id, oldPassword, newPassword);
        res.json({ message: "Password berhasil diubah." });
    } catch (error) {
        // console.error("[USER_SETTINGS_ERROR] changePassword:", error);
        res.status(400).json({ message: error.message || "Gagal mengubah password." });
    }
};