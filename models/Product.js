// models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    exchangeFor: { type: String, required: false, trim: true },
    imageUrls: [{ type: String, required: false }],
    isActive: { type: Boolean, default: true },
    exchangeStatus: {
        type: String,
        enum: ['ACTIVE', 'COMPLETED', 'CANCELED'],
        default: 'ACTIVE'
    }
}, {
    timestamps: true
});

ProductSchema.index({ owner: 1, isActive: 1 });
ProductSchema.index({ exchangeStatus: 1, isActive: 1 });

module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);