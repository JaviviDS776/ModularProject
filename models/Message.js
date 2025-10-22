// models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
    
    timestamp: { type: Date, default: Date.now, index: true }
}, {
    timestamps: true 
});

module.exports = mongoose.model('Message', MessageSchema);