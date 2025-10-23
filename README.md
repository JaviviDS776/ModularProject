# ChatApp

## Descripción General

**ChatApp** es una aplicación web completa y modular que combina funcionalidades de chat en tiempo real con un sistema de intercambio de productos. Permite a los usuarios registrarse, iniciar sesión, comunicarse instantáneamente entre sí y gestionar listados de productos para intercambiar.

## Características Principales

*   **Autenticación de Usuarios:** Registro, inicio de sesión y cierre de sesión seguros con gestión de sesiones.
*   **Chat en Tiempo Real:** Comunicación instantánea entre usuarios a través de mensajes de texto.
*   **Gestión de Productos:** Los usuarios pueden crear, ver, actualizar y eliminar sus listados de productos para intercambio.
*   **Subida de Imágenes:** Soporte para subir imágenes de productos.
*   **Propuestas de Intercambio:** Funcionalidad para que los usuarios propongan intercambios de productos entre sí.
*   **Historial de Chat:** Acceso al historial de conversaciones.

## Tecnologías Utilizadas

### Backend

*   **Node.js:** Entorno de ejecución de JavaScript del lado del servidor.
*   **Express.js:** Framework web para Node.js, utilizado para construir la API RESTful y manejar las rutas.
*   **Socket.io:** Librería para habilitar la comunicación bidireccional en tiempo real, esencial para la funcionalidad de chat.
*   **Mongoose:** Modelado de objetos para MongoDB, facilitando la interacción con la base de datos.
*   **Passport.js:** Middleware de autenticación flexible para Node.js, utilizado para la gestión de sesiones y estrategias de autenticación local.
*   **bcryptjs:** Librería para el hashing seguro de contraseñas.
*   **Multer:** Middleware para Node.js que maneja datos `multipart/form-data`, utilizado para la subida de archivos (imágenes de productos).
*   **dotenv:** Carga variables de entorno desde un archivo `.env` para la configuración de la aplicación.
*   **body-parser:** Middleware para analizar los cuerpos de las solicitudes HTTP.
*   **cookie-parser:** Analiza las cookies adjuntas a la solicitud del cliente.
*   **express-session:** Middleware para la gestión de sesiones de usuario.
*   **connect-flash:** Proporciona mensajes flash para notificaciones temporales al usuario.

### Frontend

El frontend de ChatApp está diseñado para ser intuitivo y reactivo, proporcionando una experiencia de usuario fluida. Se construye utilizando las siguientes tecnologías:

*   **EJS (Embedded JavaScript):** Actúa como nuestro motor de plantillas del lado del servidor. Esto significa que las páginas HTML se generan dinámicamente en el servidor antes de ser enviadas al navegador del usuario, permitiendo que el contenido (como listas de productos o mensajes de chat iniciales) se personalice y se cargue rápidamente.
*   **HTML5:** Proporciona la estructura semántica y el contenido de todas las páginas web de la aplicación.
*   **CSS3:** Se utiliza para estilizar la interfaz de usuario, asegurando un diseño limpio, moderno y responsivo que se adapta a diferentes tamaños de pantalla. Los estilos se gestionan principalmente a través de `public/style.css`.
*   **JavaScript (Cliente):** El archivo `public/app.js` contiene la lógica del lado del cliente que potencia la interactividad de la aplicación. Esto incluye:
    *   Manejo de eventos de usuario (clics, envíos de formularios).
    *   Actualizaciones en tiempo real del chat a través de `Socket.io`, mostrando nuevos mensajes sin necesidad de recargar la página.
    *   Posiblemente validaciones de formularios y otras mejoras de la experiencia de usuario.

En conjunto, estas tecnologías trabajan para ofrecer una interfaz de usuario clara, funcional y fácil de navegar, donde los usuarios pueden interactuar con el chat y gestionar sus productos de intercambio de manera eficiente.

### Base de Datos

*   **MongoDB:** Base de datos NoSQL orientada a documentos, utilizada para almacenar todos los datos de la aplicación.

## Estructura del Proyecto

El proyecto sigue una estructura modular para una mejor organización y mantenimiento:

*   `config/`: Archivos de configuración para la base de datos (`db.js`) y la autenticación (`passport.js`).
*   `controllers/`: Contiene la lógica de negocio para manejar las solicitudes y respuestas (ej. `authController.js`, `chatController.js`, `productController.js`, `exchangeController.js`).
*   `models/`: Define los esquemas de Mongoose para los datos de la aplicación (ej. `User.js`, `Message.js`, `Product.js`, `Exchange.js`).
*   `routes/`: Define los endpoints de la API y las rutas de la aplicación, mapeando URLs a funciones de controlador (ej. `auth.js`, `chat.js`, `products.js`, `exchanges.js`).
*   `middlewares/`: Funciones middleware personalizadas, como `authMiddleware.js` para proteger rutas.
*   `public/`: Contiene los archivos estáticos del frontend (HTML, CSS, JavaScript del cliente) y las imágenes subidas (`uploads/`).
*   `utils/`: Archivos de utilidades, como `cryptoUtils.js` para operaciones criptográficas.
*   `server.js`: El punto de entrada principal de la aplicación.

## Instalación y Ejecución

Para configurar y ejecutar el proyecto localmente, sigue estos pasos:

1.  **Clonar el repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd ChatApp
    ```
    *(Nota: Reemplaza `<URL_DEL_REPOSITORIO>` con la URL real de tu repositorio Git.)*

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno:**
    Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:
    ```
    PORT=3000
    MONGODB_URI=mongodb://localhost:27017/chatapp_db
    SESSION_SECRET=tu_secreto_de_sesion_seguro
    ```
    *Asegúrate de reemplazar `tu_secreto_de_sesion_seguro` con una cadena de caracteres aleatoria y segura.*

4.  **Iniciar el servidor:**
    ```bash
    npm start
    ```
    O para desarrollo con reinicio automático:
    ```bash
    npm run dev
    ```

5.  **Acceder a la aplicación:**
    Abre tu navegador web y navega a `http://localhost:3000` (o el puerto que hayas configurado).

## Uso

1.  **Registro/Inicio de Sesión:** Crea una nueva cuenta o inicia sesión con tus credenciales.
2.  **Chat:** Una vez autenticado, podrás ver otros usuarios y comenzar conversaciones en tiempo real.
3.  **Productos:** Navega por los productos listados, crea tus propios listados y sube imágenes.
4.  **Intercambios:** Propón intercambios a otros usuarios por sus productos.

## Contribución

Las contribuciones son bienvenidas. Por favor, abre un "issue" o envía un "pull request" con tus mejoras.

## Licencia

Este proyecto está bajo la Licencia MIT.