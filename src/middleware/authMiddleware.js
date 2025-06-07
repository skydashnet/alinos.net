const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).send('Akses ditolak. Tidak ada token.');
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).send('Akses ditolak. Format token salah.');
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next(); 
    } catch (err) {
        res.status(400).send('Token tidak valid.');
    }
};