// server.js
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
require('dotenv').config({ path: './.env' }); 

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
        origin: "*", 
        methods: ["GET", "POST", "PUT"] 
    }
}); 

connectDB();

// --- 2. Middlewares ---
// Esto permite a Express servir archivos estáticos (HTML, CSS, JS, e imágenes subidas)
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