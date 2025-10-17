// utils/cryptoUtils.js
const crypto = require('crypto');
// 🚨 OBTENER CLAVE DE .env
const CRYPTO_SECRET = process.env.CRYPTO_SECRET; 
const IV_LENGTH = 16; 

if (!CRYPTO_SECRET || CRYPTO_SECRET.length !== 64) {
    // Es vital que la clave sea de 32 bytes (64 chars hex) y esté definida
    console.error("❌ ERROR: CRYPTO_SECRET no está definida o no tiene 64 caracteres Hex.");
    // Usar una clave dummy (NO USAR EN PRODUCCIÓN)
    // process.exit(1); 
}

/**
 * Cifra el texto usando AES-256-CBC.
 * @param {string} text - El mensaje plano a cifrar.
 * @returns {string} El texto cifrado en formato IV:Cifrado.
 */
exports.encrypt = (text) => {
    // Asegurarse de usar Buffer.from(CRYPTO_SECRET, 'hex') si la clave es hex en .env
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(CRYPTO_SECRET, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
};

/**
 * Descifra el texto usando AES-256-CBC.
 * @param {string} text - El texto cifrado en formato IV:Cifrado.
 * @returns {string} El mensaje plano descifrado.
 */
exports.decrypt = (text) => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(CRYPTO_SECRET, 'hex'), iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
};