// controllers/chatController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); 
const Message = require('../models/Message'); 
const { encrypt } = require('../utils/cryptoUtils');
const JWT_SECRET = process.env.JWT_SECRET; 

const connectedUsers = {};

// Periodic cleanup to prevent memory leaks
setInterval(() => {
    const userCount = Object.keys(connectedUsers).length;
    if (userCount > 100) { // Arbitrary threshold
        console.log(`⚠️ Warning: ${userCount} users in connectedUsers object. Consider investigating potential memory leaks.`);
    }
}, 60000); // Check every minute

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

    socket.on('sendMessage', async (data) => {
        const { recipientId, message, productId } = data;
        const senderId = socket.userId;

        try {
            const encryptedContent = encrypt(message); 

            const newMessage = new Message({
                sender: senderId,
                recipient: recipientId,
                content: encryptedContent,
                productId: productId || null, 
            });
            await newMessage.save();
            
            const senderName = connectedUsers[senderId] ? connectedUsers[senderId].name : 'Anónimo';

            const messagePayload = { 
                senderId: senderId,
                senderName: senderName,
                message: message, 
                timestamp: newMessage.createdAt, 
                id: newMessage._id,
                productId: productId || null, 
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
            const userName = connectedUsers[userId].name;
            delete connectedUsers[userId];
            io.emit('userDisconnected', userId);
            console.log(`👋 Usuario ${userName} (${userId.substring(0, 8)}...) se ha desconectado`);
        }
        
        // Cleanup: Remove user from any rooms they might have joined
        socket.leave(userId);
        
        // Additional cleanup for any lingering references
        socket.removeAllListeners();
    });
};