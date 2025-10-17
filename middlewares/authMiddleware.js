// middlewares/authMiddleware.js
const passport = require('passport');

/**
 * Middleware para proteger rutas REST.
 */
exports.protect = passport.authenticate('jwt', { session: false });