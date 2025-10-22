// routes/exchanges.js
const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/propose', protect, exchangeController.proposeExchange);

router.put('/:productId/:interestedPartyId/accept', protect, exchangeController.acceptExchange);
router.put('/:productId/:interestedPartyId/reject', protect, exchangeController.rejectExchange);

router.put('/:productId/:interestedPartyId/complete', protect, exchangeController.completeExchange);

router.get('/status/:productId/:interestedPartyId', protect, exchangeController.getExchangeStatus);

router.get('/profile', protect, exchangeController.getProfileExchanges); // 🚨 Nueva ruta de feed de propuestas

module.exports = router;