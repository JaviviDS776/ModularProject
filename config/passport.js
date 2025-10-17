// config/passport.js
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const mongoose = require('mongoose');
const User = require('../models/User'); 
const { JWT_SECRET } = process.env;

const opts = {};
// Extraer el token del encabezado 'Authorization' como 'Bearer <token>'
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
// Usar la clave secreta definida en .env
opts.secretOrKey = JWT_SECRET;

module.exports = (passport) => {
    passport.use(
        new JwtStrategy(opts, (jwt_payload, done) => {
            // jwt_payload contiene la información codificada en el token (ej: el id del usuario)
            User.findById(jwt_payload.user.id)
                .then(user => {
                    if (user) {
                        // Usuario encontrado, autenticación exitosa
                        return done(null, user); 
                    }
                    // Usuario no encontrado
                    return done(null, false);
                })
                .catch(err => console.log(err));
        })
    );
};