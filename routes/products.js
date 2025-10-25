// routes/products.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect } = require('../middlewares/authMiddleware'); 

router.post('/', protect, productController.upload.array('images', 5), productController.createProduct);

router.get('/', protect, productController.getFeed);

router.get('/:id', protect, productController.getProductById);

router.put('/:id', protect, productController.upload.array('images', 5), productController.updateProduct);

router.put('/:id/finalize', protect, productController.finalizeExchange);
// Nota: Esta ruta ya no se usa, la reemplaza /exchanges/:id/complete, pero la mantenemos por referencia.

module.exports = router;