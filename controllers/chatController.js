// controllers/chatController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); 
const Message = require('../models/Message'); 
const { encrypt } = require('../utils/cryptoUtils'); // 🚨 Importar CIFRADO
const JWT_SECRET = process.env.JWT_SECRET; 

const connectedUsers = {}; 

exports.socketAuthMiddleware = (socket, next) => {
    const token = socket.handshake.query.token;
    if (!token) { return next(new Error('Authentication error: No token provided')); }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.user.id; 
        next(); 
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
};

exports.handleConnection = (io) => (socket) => {
    const userId = socket.userId; 
    let userName = 'Usuario Desconocido'; 

    User.findById(userId, 'name')
        .then(user => {
            if (user) { userName = user.name; }

            if (!connectedUsers[userId]) {
                connectedUsers[userId] = { id: userId, name: userName };
                io.emit('userConnected', connectedUsers[userId]);
            }
            socket.join(userId); 
            socket.emit('usersList', Object.values(connectedUsers));
        })
        .catch(err => console.error("Error al buscar usuario:", err));

    // 🚨 Lógica de envío y CIFRADO
    socket.on('sendMessage', async (data) => {
        const { recipientId, message } = data;
        const senderId = socket.userId;

        try {
            // CIFRAR el contenido antes de guardar
            const encryptedContent = encrypt(message); 

            const newMessage = new Message({
                sender: senderId,
                recipient: recipientId,
                content: encryptedContent, // Guardar texto CIFRADO
            });
            await newMessage.save();
            
            const senderName = connectedUsers[senderId] ? connectedUsers[senderId].name : 'Anónimo';

            const messagePayload = { 
                senderId: senderId,
                senderName: senderName,
                message: message, // 🚨 Enviamos el texto PLAIN (descifrado) por Socket.io
                timestamp: newMessage.createdAt, 
                id: newMessage._id 
            };

            io.to(recipientId).emit('newMessage', messagePayload);
            io.to(senderId).emit('newMessage', messagePayload);

        } catch (error) {
            console.error('Error al guardar o enviar mensaje:', error);
            socket.emit('messageError', 'Fallo al guardar y enviar el mensaje.');
        }
    });

    socket.on('disconnect', () => {
        if (connectedUsers[userId]) {
            delete connectedUsers[userId];
            io.emit('userDisconnected', userId);
        }
    });
};