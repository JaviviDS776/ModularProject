// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware'); 

router.post('/register', authController.register);
router.post('/login', authController.login);

// 🚨 RUTA DE RENOVACIÓN PROTEGIDA
router.get('/refresh', protect, authController.refresh);

module.exports = router;