// server.js
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
// 🚨 Cargar las variables de entorno primero
require('dotenv').config({ path: './.env' }); 

const connectDB = require('./config/db'); 
const passport = require('passport'); 
const authRoutes = require('./routes/auth'); 
const chatRoutes = require('./routes/chat'); // 🚨 Importar rutas de chat
const chatController = require('./controllers/chatController');

// --- Inicialización ---
const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"]
    }
}); 

connectDB();

// --- Middlewares ---
app.use(express.static(path.join(__dirname, 'public'))); 
app.use(express.json()); 
app.use(passport.initialize()); 
require('./config/passport')(passport); 

// --- Rutas REST ---
app.use('/api/auth', authRoutes); 
app.use('/api/chat', chatRoutes); // 🚨 Rutas de Historial

// --- Socket.io (Chat) ---
io.use(chatController.socketAuthMiddleware); 
io.on('connection', chatController.handleConnection(io)); 


// --- Inicio del Servidor ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Servidor Node.js (BACKEND) corriendo en http://localhost:${PORT}`));