# ChatApp & Trade

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)
![Express.js](https://img.shields.io/badge/Express.js-4.x-blue.svg)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-blue.svg)

**ChatApp & Trade** es una aplicación web full-stack construida con Node.js que ofrece una plataforma para que los usuarios puedan chatear en tiempo real y, al mismo tiempo, publicar y proponer intercambios de productos.

## Características Principales

*   **Autenticación Segura:** Registro e inicio de sesión basados en JSON Web Tokens (JWT).
*   **Chat en Tiempo Real:** Comunicación instantánea y privada entre usuarios, impulsada por WebSockets.
*   **Gestión de Productos:** Sistema completo para que los usuarios listen productos que desean intercambiar, incluyendo subida de imágenes.
*   **Sistema de Intercambio:** Flujo de trabajo para proponer, aceptar o rechazar intercambios de productos entre usuarios.
*   **API RESTful:** Un backend bien estructurado y modular que expone endpoints claros para la gestión de recursos.

## Tecnologías Utilizadas

| Área          | Tecnología                                       |
|---------------|--------------------------------------------------|
| **Backend**   | Node.js, Express.js, Socket.io, Mongoose         |
| **Autenticación** | Passport.js (estrategia JWT), bcryptjs, jsonwebtoken |
| **Base de Datos** | MongoDB                                          |
| **Frontend**  | HTML5, CSS3, JavaScript (Vanilla)                |
| **Otros**     | Multer (subida de archivos), dotenv (variables de entorno) |

## Estructura del Proyecto

El proyecto está organizado de forma modular para facilitar su mantenimiento y escalabilidad:

```
/
├── config/         # Configuración de DB y Passport
├── controllers/    # Lógica de negocio (controladores)
├── middlewares/    # Middlewares de Express (ej. autenticación)
├── models/         # Esquemas de datos de Mongoose
├── public/         # Frontend estático (HTML, CSS, JS) y archivos subidos
├── routes/         # Definición de rutas de la API
├── utils/          # Funciones de utilidad (ej. cifrado)
├── .env.example    # Ejemplo de variables de entorno
├── server.js       # Punto de entrada de la aplicación
└── package.json    # Dependencias y scripts
```

## Instalación y Ejecución

Sigue estos pasos para levantar el proyecto en un entorno de desarrollo local.

### 1. Prerrequisitos

*   Node.js (versión 18.x o superior)
*   MongoDB (local o en un servicio como MongoDB Atlas)

### 2. Clonar el Repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd <NOMBRE_DEL_DIRECTORIO>
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto. Puedes copiar el contenido de `.env.example` y rellenarlo con tus propios valores.

**`.env.example`**
```env
# Puerto en el que correrá el servidor
PORT=5000

# URI de conexión a tu base de datos MongoDB
MONGODB_URI=mongodb://localhost:27017/chatapp_db

# Clave secreta para firmar los JSON Web Tokens
JWT_SECRET=tu_clave_secreta_super_segura
```

### 5. Iniciar el Servidor

*   Para un entorno de producción:
    ```bash
    npm start
    ```
*   Para desarrollo con reinicio automático (requiere `nodemon`):
    ```bash
    npm run dev
    ```

Una vez iniciado, la aplicación estará disponible en `http://localhost:5000`.

## Documentación de la API

A continuación se detallan los endpoints más importantes de la API.

**Nota:** Las rutas protegidas requieren un `token` JWT en el encabezado `Authorization` como `Bearer <token>`.

--- 

### Autenticación (`/api/auth`)

#### `POST /register`

Registra un nuevo usuario.

*   **Body:**
    ```json
    {
      "name": "Usuario de Prueba",
      "email": "prueba@example.com",
      "password": "password123"
    }
    ```
*   **Respuesta Exitosa (200 OK):**
    ```json
    {
      "token": "ey... (JWT)"
    }
    ```

#### `POST /login`

Autentica un usuario y devuelve un token.

*   **Body:**
    ```json
    {
      "email": "prueba@example.com",
      "password": "password123"
    }
    ```
*   **Respuesta Exitosa (200 OK):**
    ```json
    {
      "token": "ey... (JWT)"
    }
    ```

--- 

### Productos (`/api/products`)

#### `GET /`

Obtiene una lista de todos los productos. **(Ruta protegida)**

*   **Respuesta Exitosa (200 OK):**
    ```json
    [
      {
        "_id": "60d...e1",
        "title": "Mi Producto Increíble",
        "description": "Una descripción detallada.",
        "owner": {
          "_id": "60d...f3",
          "name": "Usuario de Prueba"
        },
        "imageUrl": "/uploads/imagen.jpg"
      }
    ]
    ```

#### `POST /`

Crea un nuevo producto. **(Ruta protegida)**

*   **Body:** `multipart/form-data`
    *   `title` (String)
    *   `description` (String)
    *   `exchangeFor` (String)
    *   `image` (File, opcional)

*   **Respuesta Exitosa (201 Created):**
    ```json
    {
      "msg": "Producto creado con éxito",
      "product": { ... }
    }
    ```

--- 

### Historial de Chat (`/api/chat`)

#### `GET /history/:recipientId`

Obtiene el historial de mensajes entre el usuario autenticado y otro usuario. **(Ruta protegida)**

*   **Parámetros de URL:**
    *   `recipientId`: El ID del otro usuario.
*   **Respuesta Exitosa (200 OK):**
    ```json
    [
      {
        "id": "60d...a1",
        "senderId": "60d...f3",
        "senderName": "Usuario de Prueba",
        "message": "¡Hola! ¿Cómo estás?",
        "timestamp": "2024-10-23T10:00:00.000Z"
      }
    ]
    ```

## Licencia

Este proyecto está distribuido bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.
