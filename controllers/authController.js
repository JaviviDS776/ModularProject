// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = process.env; 

const getSignedJwtToken = (userId) => {
    return jwt.sign({ user: { id: userId } }, JWT_SECRET, {
        expiresIn: '20m', // Token expira en 20 minutos
    });
};

exports.register = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) { return res.status(400).json({ msg: 'El usuario con este email ya existe.' }); }
        user = new User({ name, email, password });
        await user.save();
        const token = getSignedJwtToken(user.id);
        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al registrar.');
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) { return res.status(400).json({ msg: 'Credenciales inválidas.' }); }
        const isMatch = await user.matchPassword(password);
        if (!isMatch) { return res.status(400).json({ msg: 'Credenciales inválidas.' }); }
        const token = getSignedJwtToken(user.id);
        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al iniciar sesión.');
    }
};

// 🚨 FUNCIÓN DE RENOVACIÓN DE TOKEN
exports.refresh = async (req, res) => {
    try {
        // Genera un nuevo token con una nueva expiración de 20m
        const newToken = getSignedJwtToken(req.user.id);
        res.json({ token: newToken });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al renovar la sesión.');
    }
};