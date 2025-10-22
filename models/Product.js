// models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    exchangeFor: { type: String, required: false, trim: true },
    imageUrl: { type: String, required: false, default: 'placeholder.jpg' },
    isActive: { type: Boolean, default: true },
    exchangeStatus: {
        type: String,
        enum: ['ACTIVE', 'COMPLETED'],
        default: 'ACTIVE'
    }
}, {
    timestamps: true
});

// Index for efficient queries
ProductSchema.index({ owner: 1, isActive: 1 });
ProductSchema.index({ exchangeStatus: 1, isActive: 1 });

module.exports = mongoose.model('Product', ProductSchema);
