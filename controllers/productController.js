// controllers/productController.js
const Product = require('../models/Product');
const User = require('../models/User'); 
const multer = require('multer'); 
const path = require('path'); 

// --- Configuración de Multer ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads/')); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
    }
});

exports.upload = multer({ storage: storage }); 

exports.createProduct = async (req, res) => {
    try {
        const { title, description, exchangeFor } = req.body;
        
        // Input validation
        if (!title || !description) {
            return res.status(400).json({ msg: 'Título y descripción son obligatorios.' });
        }
        
        if (title.length < 3 || title.length > 100) {
            return res.status(400).json({ msg: 'El título debe tener entre 3 y 100 caracteres.' });
        }
        
        if (description.length < 10 || description.length > 500) {
            return res.status(400).json({ msg: 'La descripción debe tener entre 10 y 500 caracteres.' });
        }
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : 'placeholder.jpg'; 
        
        const newProduct = new Product({
            owner: req.user.id,
            title,
            description,
            exchangeFor,
            imageUrl
        });

        await newProduct.save();
        res.status(201).json(newProduct);

    } catch (err) {
        console.error('Error al crear producto:', err.message);
        res.status(500).json({ msg: 'Fallo al crear la publicación.' });
    }
};

exports.getFeed = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true, exchangeStatus: 'ACTIVE' })
            .sort({ createdAt: -1 })
            .populate('owner', 'name email'); 

        res.json(products);

    } catch (err) {
        console.error('Error al obtener el feed:', err.message);
        res.status(500).json({ msg: 'Fallo al cargar el feed.' });
    }
};

exports.finalizeExchange = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) { return res.status(404).json({ msg: 'Publicación no encontrada.' }); }
        if (product.owner.toString() !== req.user.id) { return res.status(401).json({ msg: 'No autorizado. Solo el dueño puede finalizar el intercambio.' }); }

        product.exchangeStatus = 'COMPLETED';
        product.isActive = false; 

        await product.save();

        res.json({ msg: 'Intercambio marcado como COMPLETED y desactivado del feed.', product });

    } catch (err) {
        console.error('Error al finalizar intercambio:', err.message);
        if (err.kind === 'ObjectId') { return res.status(400).json({ msg: 'ID de producto inválido.' }); }
        res.status(500).send('Error del servidor');
    }
};