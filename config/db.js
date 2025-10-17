// config/db.js
const mongoose = require('mongoose');
// Necesitas cargar dotenv en tu server.js antes de que se ejecute este script
// Pero para fines de demostración, asumimos que MONGO_URI está disponible
// Si no lo tienes configurado globalmente, usa:
// require('dotenv').config({ path: './.env' });
const { MONGO_URI } = process.env;

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        
        console.log('✅ MongoDB Conectado Satisfactoriamente');
    } catch (error) {
        console.error('❌ Error al conectar a MongoDB:', error.message);
        // Salir del proceso con fallo
        process.exit(1);
    }
};

module.exports = connectDB;