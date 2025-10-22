// controllers/chatHistoryController.js
const Message = require('../models/Message');
const { decrypt } = require('../utils/cryptoUtils');

exports.getChatHistory = async (req, res) => {
    const user1Id = req.user.id; 
    const user2Id = req.params.recipientId;

    try {
        const messages = await Message.find({
            $or: [
                { sender: user1Id, recipient: user2Id },
                { sender: user2Id, recipient: user1Id }
            ]
        })
        .sort({ timestamp: 1 }) 
        .lean(); 

        const decryptedMessages = messages.map(msg => {
            try {
                const decryptedContent = decrypt(msg.content);
                
                return {
                    id: msg._id,
                    senderId: msg.sender,
                    message: decryptedContent, 
                    timestamp: msg.createdAt,
                    productId: msg.productId || null,
                };
            } catch (e) {
                console.error(`Error al descifrar el mensaje ${msg._id}:`, e);
                return {
                    id: msg._id,
                    senderId: msg.sender,
                    message: "[Mensaje Cifrado Corrupto]",
                    timestamp: msg.createdAt,
                };
            }
        });

        res.json(decryptedMessages);

    } catch (err) {
        console.error('Error al cargar historial de chat:', err);
        res.status(500).json({ msg: 'Fallo al cargar el historial.' });
    }
};