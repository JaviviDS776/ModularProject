// routes/chat.js
const express = require('express');
const router = express.Router();
const chatHistoryController = require('../controllers/chatHistoryController');
const { protect } = require('../middlewares/authMiddleware'); 

router.get('/history/:recipientId', protect, chatHistoryController.getChatHistory);

module.exports = router;