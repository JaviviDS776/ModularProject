// controllers/chatHistoryController.js
const Message = require('../models/Message');
const { decrypt } = require('../utils/cryptoUtils'); // 🚨 Importar DESCIFRADO

/**
 * @route GET /api/chat/history/:recipientId
 * @desc Obtiene el historial de mensajes cifrados entre dos usuarios y los descifra.
 */
exports.getChatHistory = async (req, res) => {
    const user1Id = req.user.id; // ID del usuario autenticado
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

        // 🚨 DESCIFRAR TODOS LOS MENSAJES
        const decryptedMessages = messages.map(msg => {
            try {
                const decryptedContent = decrypt(msg.content);
                
                return {
                    id: msg._id,
                    senderId: msg.sender,
                    message: decryptedContent, // Contenido descifrado
                    timestamp: msg.createdAt,
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