// models/Exchange.js
const mongoose = require('mongoose');

const ExchangeSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    interestedParty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    offeredProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    
    status: {
        type: String,
        enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'],
        default: 'PENDING'
    },
    
    completedAt: { type: Date }
}, {
    timestamps: true 
});

ExchangeSchema.index({ product: 1, interestedParty: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING' } });

module.exports = mongoose.model('Exchange', ExchangeSchema);