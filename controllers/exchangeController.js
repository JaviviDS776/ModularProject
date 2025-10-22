// controllers/exchangeController.js
const Exchange = require('../models/Exchange');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// @route POST /api/exchanges/propose
exports.proposeExchange = async (req, res) => {
    const { productId, ownerId, offeredProductId } = req.body;
    const interestedPartyId = req.user.id; 

    // 1. VALIDACIÓN RÁPIDA DE IDS
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(offeredProductId)) {
         return res.status(400).json({ msg: 'IDs de producto inválidos.' });
    }

    try {
        // 2. VERIFICACIÓN DEL PRODUCTO A INTERCAMBIAR
        const product = await Product.findById(productId);
        if (!product || product.owner.toString() !== ownerId || product.exchangeStatus !== 'ACTIVE') {
            return res.status(404).json({ msg: 'Producto principal no encontrado, Dueño inválido o no activo.' });
        }
        
        // 3. VERIFICACIÓN DEL PRODUCTO OFRECIDO (DEBE PERTENECER AL INTERESADO)
        const offeredProduct = await Product.findById(offeredProductId);
        if (!offeredProduct) {
             return res.status(404).json({ msg: 'El producto ofrecido no existe.' });
        }
        if (offeredProduct.owner.toString() !== interestedPartyId) {
             return res.status(401).json({ msg: 'El producto ofrecido no te pertenece.' });
        }
        
        // 4. EVITAR DUPLICADOS Y VERIFICAR ESTADO ACTIVO
        let exchange = await Exchange.findOne({ 
            product: productId, 
            interestedParty: interestedPartyId, 
            status: { $in: ['PENDING', 'ACCEPTED'] }
        });

        if (exchange) {
             return res.status(200).json({ msg: `Propuesta ${exchange.status} ya existe.`, exchange });
        }

        // 5. CREAR PROPUESTA
        exchange = new Exchange({
            product: productId,
            owner: ownerId,
            interestedParty: interestedPartyId,
            offeredProduct: offeredProductId,
            status: 'PENDING'
        });
        await exchange.save();

        res.status(201).json({ msg: 'Propuesta creada.', exchange });

    } catch (err) {
        console.error('Error al proponer intercambio (catch):', err.message);
        res.status(500).json({ msg: 'Fallo interno al procesar la propuesta.' });
    }
};


// @route PUT /api/exchanges/:productId/:interestedPartyId/accept
exports.acceptExchange = async (req, res) => {
    const { productId, interestedPartyId } = req.params;
    const currentUserId = req.user.id; 

    try {
        const exchange = await Exchange.findOne({
            product: productId,
            interestedParty: interestedPartyId,
            status: 'PENDING'
        });

        if (!exchange) { return res.status(404).json({ msg: 'Propuesta pendiente no encontrada.' }); }
        if (exchange.owner.toString() !== currentUserId) { return res.status(401).json({ msg: 'Solo el dueño del producto puede aceptar.' }); }
        
        exchange.status = 'ACCEPTED';
        await exchange.save();
        
        await Product.findByIdAndUpdate(productId, { isActive: false });

        res.json({ msg: 'Propuesta aceptada. Intercambio PENDIENTE de finalizar.', exchange });

    } catch (err) {
        console.error('Error al aceptar intercambio:', err.message);
        res.status(500).send('Error del servidor');
    }
};

// @route PUT /api/exchanges/:productId/:interestedPartyId/reject
exports.rejectExchange = async (req, res) => {
    const { productId, interestedPartyId } = req.params;
    const currentUserId = req.user.id; 

    try {
        const exchange = await Exchange.findOne({
            product: productId,
            interestedParty: interestedPartyId,
            status: 'PENDING'
        });

        if (!exchange) { return res.status(404).json({ msg: 'Propuesta pendiente no encontrada.' }); }
        if (exchange.owner.toString() !== currentUserId) { return res.status(401).json({ msg: 'Solo el dueño del producto puede rechazar.' }); }
        
        exchange.status = 'REJECTED';
        await exchange.save();

        await Product.findByIdAndUpdate(productId, { isActive: true, exchangeStatus: 'ACTIVE' }); // Reactivar el producto

        res.json({ msg: 'Propuesta rechazada.', exchange });

    } catch (err) {
        console.error('Error al rechazar intercambio:', err.message);
        res.status(500).send('Error del servidor');
    }
};


// @route PUT /api/exchanges/:productId/:interestedPartyId/complete
exports.completeExchange = async (req, res) => {
    const { productId, interestedPartyId } = req.params;
    
    try {
        const exchange = await Exchange.findOne({
            product: productId,
            interestedParty: interestedPartyId,
            status: 'ACCEPTED' 
        });

        if (!exchange) { return res.status(404).json({ msg: 'El intercambio no está en estado ACEPTADO.' }); }
        
        const currentUserId = req.user.id;
        const isOwner = exchange.owner.toString() === currentUserId;
        const isInterested = exchange.interestedParty.toString() === currentUserId;

        if (!isOwner && !isInterested) { return res.status(401).json({ msg: 'No eres parte de este intercambio.' }); }

        exchange.status = 'COMPLETED';
        exchange.completedAt = new Date();
        await exchange.save();

        // Mark both products as completed and inactive
        await Product.findByIdAndUpdate(productId, { exchangeStatus: 'COMPLETED', isActive: false });
        await Product.findByIdAndUpdate(exchange.offeredProduct, { exchangeStatus: 'COMPLETED', isActive: false });

        // Get product details for response
        const mainProduct = await Product.findById(productId).populate('owner', 'name');
        const offeredProduct = await Product.findById(exchange.offeredProduct).populate('owner', 'name');

        res.json({ 
            msg: `Intercambio CONCRETADO: "${mainProduct.title}" por "${offeredProduct.title}". Ambos productos han sido eliminados del feed.`, 
            exchange,
            completedProducts: {
                main: mainProduct.title,
                offered: offeredProduct.title
            }
        });

    } catch (err) {
        console.error('Error al completar intercambio:', err.message);
        res.status(500).send('Error del servidor');
    }
};


// @route GET /api/exchanges/status/:productId/:interestedPartyId
exports.getExchangeStatus = async (req, res) => {
    const { productId, interestedPartyId } = req.params;
    
    try {
        const exchange = await Exchange.findOne({
            product: productId,
            interestedParty: interestedPartyId,
            status: { $in: ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'] }
        }).sort({ createdAt: -1 }).populate('offeredProduct', 'title imageUrl'); 

        if (!exchange) {
            return res.status(404).json({ msg: 'No se encontró un intercambio activo o pendiente para estas partes.' });
        }
        
        res.json({ exchange });
    } catch (err) {
        console.error('Error al obtener estado de intercambio:', err.message);
        res.status(500).send('Error del servidor');
    }
};

// @route GET /api/exchanges/profile
exports.getProfileExchanges = async (req, res) => {
    const currentUserId = req.user.id;
    
    try {
        const exchanges = await Exchange.find({
            $or: [
                { owner: currentUserId },
                { interestedParty: currentUserId }
            ],
            status: { $in: ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'] }
        })
        .sort({ createdAt: -1 })
        .populate('product', 'title imageUrl')
        .populate('offeredProduct', 'title imageUrl')
        .populate('owner', 'name')
        .populate('interestedParty', 'name');

        res.json(exchanges);
    } catch (err) {
        console.error('Error al obtener intercambios del perfil:', err.message);
        res.status(500).json({ msg: 'Error al cargar las propuestas.' });
    }
};
