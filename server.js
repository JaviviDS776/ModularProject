// server.js
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
require('dotenv').config({ path: './.env' });

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'CRYPTO_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
}

const connectDB = require('./config/db'); 
const passport = require('passport'); 

const authRoutes = require('./routes/auth'); 
const chatRoutes = require('./routes/chat'); 
const productRoutes = require('./routes/products'); 
const exchangeRoutes = require('./routes/exchanges'); 
const chatController = require('./controllers/chatController');

// --- 1. Inicialización ---
const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    cors: { 
        origin: process.env.NODE_ENV === 'production' 
            ? ["https://yourdomain.com"] 
            : ["http://localhost:3000", "http://localhost:5000", "http://127.0.0.1:5000"], 
        methods: ["GET", "POST", "PUT"],
        credentials: true
    }
});

connectDB();

// --- 2. Middlewares ---
app.use(express.static(path.join(__dirname, 'public'))); 
app.use(express.json()); 
app.use(passport.initialize()); 
require('./config/passport')(passport); 

// --- 3. Rutas REST ---
app.use('/api/auth', authRoutes); 
app.use('/api/chat', chatRoutes); 
app.use('/api/products', productRoutes); 
app.use('/api/exchanges', exchangeRoutes); 

// --- 4. Socket.io (Chat) ---
io.use(chatController.socketAuthMiddleware); 
io.on('connection', chatController.handleConnection(io)); 


// --- 5. Inicio del Servidor ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Servidor Node.js corriendo en puerto ${PORT}`));