// public/app.js
const BACKEND_URL = 'http://192.168.0.102:5000'; 
let currentToken = localStorage.getItem('jwtToken') || ''; 
let currentUserId = ''; 
let socket = null;
let refreshIntervalId = null; 
const localConnectedUsers = {}; 
let activeRecipientId = null; 

// --- FUNCIONES DE UTILIDAD Y UI ---

function showInterface(idToShow) {
    document.getElementById('auth-interface').style.display = 'none';
    document.getElementById('chat-interface').style.display = 'none';
    
    const mainContainer = document.querySelector('.app-container');
    if (idToShow === 'chat-interface') {
        document.getElementById(idToShow).style.display = 'flex';
        mainContainer.style.maxWidth = '1000px';
        mainContainer.style.height = '90vh';
    } else {
        document.getElementById(idToShow).style.display = 'block';
        mainContainer.style.maxWidth = '400px';
        mainContainer.style.height = 'auto';
    }
}

function updateAuthOutput(message, isError = false) {
    const outputSpan = document.getElementById('auth-output');
    outputSpan.style.color = isError ? 'red' : 'green';
    outputSpan.textContent = message;
}

function updateSocketStatus(isConnected) {
    const statusDiv = document.getElementById('socket-status');
    statusDiv.textContent = isConnected ? 'Estado: Conectado' : 'Estado: Desconectado';
    statusDiv.style.color = isConnected ? 'green' : 'red';
}

function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

function showNotification(senderName, messageContent) {
    if (Notification.permission === "granted") {
        new Notification(`Mensaje de ${senderName}`, {
            body: messageContent.substring(0, 50) + '...',
            icon: 'icon.png'
        });
    }
}


// --- GESTIÓN DEL TOKEN Y SESIÓN ---

async function attemptTokenRefresh() {
    if (!currentToken) return stopTokenRefreshLoop();

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            currentToken = data.token;
            localStorage.setItem('jwtToken', currentToken);
        } else {
            console.warn("❌ Falló la renovación del token. Sesión caducada.");
            logout();
        }
    } catch (error) {
        console.error("Error de red al intentar renovar el token:", error);
        logout();
    }
}

function startTokenRefreshLoop() {
    stopTokenRefreshLoop(); 
    const refreshInterval = 15 * 60 * 1000; // 15 minutos
    refreshIntervalId = setInterval(attemptTokenRefresh, refreshInterval);
}

function stopTokenRefreshLoop() {
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
    }
}


// --- AUTENTICACIÓN (REST) ---

async function handleAuth(endpoint) {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const body = { email, password };
    if (endpoint === 'register') { body.name = name; }
    updateAuthOutput(`Intentando ${endpoint}...`);

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (response.ok) {
            currentToken = data.token;
            localStorage.setItem('jwtToken', currentToken); 
            const payload = JSON.parse(atob(currentToken.split('.')[1]));
            currentUserId = payload.user.id; 
            document.getElementById('current-user-id').textContent = currentUserId.substring(0, 8) + '...';
            updateAuthOutput(`✅ ${endpoint.toUpperCase()} exitoso. ID: ${currentUserId.substring(0, 8)}...`);
            
            startTokenRefreshLoop(); 
            requestNotificationPermission(); 
            showInterface('chat-interface');
        } else {
            updateAuthOutput(`❌ Error en ${endpoint.toUpperCase()}: ${data.msg || 'Error desconocido'}`, true);
            currentToken = '';
            localStorage.removeItem('jwtToken');
        }
    } catch (error) {
        updateAuthOutput(`❌ Error de conexión: ${error.message}`, true);
    }
}

function registerUser() { handleAuth('register'); }
function loginUser() { handleAuth('login'); }

function logout() {
    currentToken = '';
    currentUserId = '';
    activeRecipientId = null;
    localStorage.removeItem('jwtToken'); 
    stopTokenRefreshLoop(); 
    if (socket && socket.connected) { socket.disconnect(); }
    
    document.getElementById('chat-messages').innerHTML = '<p style="text-align: center; color: #999;">Selecciona un usuario a la izquierda para comenzar a chatear.</p>';
    document.getElementById('recipient-name-display').textContent = 'Selecciona un Contacto';
    document.getElementById('recipientId-display').textContent = 'N/A';
    document.getElementById('message-input').disabled = true;
    document.querySelector('.send-button').disabled = true;
    
    Object.keys(localConnectedUsers).forEach(key => delete localConnectedUsers[key]);
    renderUsersList(); 
    updateAuthOutput('Sesión cerrada.', false);
    showInterface('auth-interface');
}


// --- GESTIÓN DE LA LISTA DE USUARIOS Y SELECCIÓN ---

async function selectRecipient(userId, userName) {
    if (activeRecipientId === userId) return; 

    if (activeRecipientId) {
        const prevLi = document.querySelector(`#user-${activeRecipientId}`);
        if (prevLi) prevLi.classList.remove('selected');
    }
    
    activeRecipientId = userId;
    const newLi = document.querySelector(`#user-${userId}`);
    if (newLi) newLi.classList.add('selected');

    document.getElementById('recipient-name-display').textContent = userName;
    document.getElementById('recipientId-display').textContent = userId.substring(0, 8) + '...';

    document.getElementById('message-input').disabled = false;
    document.querySelector('.send-button').disabled = false;
    
    // 🚨 CARGAR HISTORIAL
    document.getElementById('chat-messages').innerHTML = `<p style="text-align: center; color: #999;">Cargando historial con ${userName}...</p>`;
    document.getElementById('message-input').focus();
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat/history/${userId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        const history = await response.json();
        const chatLogDiv = document.getElementById('chat-messages');
        chatLogDiv.innerHTML = ''; 
        
        if (response.ok && history.length > 0) {
            history.forEach(msg => {
                addChatMessage(msg.message, msg.senderId, msg.timestamp); 
            });
        } else if (response.ok && history.length === 0) {
            chatLogDiv.innerHTML = `<p style="text-align: center; color: #999;">¡Comiencen su conversación!</p>`;
        } else {
            chatLogDiv.innerHTML = `<p style="text-align: center; color: red;">Error al cargar: ${history.msg || 'Token inválido o expirado.'}</p>`;
        }

    } catch (error) {
        document.getElementById('chat-messages').innerHTML = `<p style="text-align: center; color: red;">Error de red al cargar historial.</p>`;
    }
}

function renderUsersList() {
    const list = document.getElementById('connected-users-list');
    list.innerHTML = ''; 
    
    Object.values(localConnectedUsers)
        .filter(user => user.id !== currentUserId) 
        .sort((a, b) => a.name.localeCompare(b.name)) 
        .forEach(user => {
            const li = document.createElement('li');
            li.id = `user-${user.id}`; 
            li.onclick = () => selectRecipient(user.id, user.name);

            li.innerHTML = `
                <div><strong>${user.name}</strong></div>
                <div class="user-status">Online</div>
            `;
            list.appendChild(li);

            if (user.id === activeRecipientId) { li.classList.add('selected'); }
        });
}


// --- CHAT (SOCKET.IO) ---

function addChatMessage(message, senderId, timestamp) {
    const chatLogDiv = document.getElementById('chat-messages');
    
    if (senderId !== currentUserId && senderId !== activeRecipientId) {
        const senderName = localConnectedUsers[senderId] ? localConnectedUsers[senderId].name : 'Desconocido';
        showNotification(senderName, message); 
        return; 
    }

    const isSent = (senderId === currentUserId);
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    const senderName = isSent ? 'Tú' : (localConnectedUsers[senderId] ? localConnectedUsers[senderId].name : 'Desconocido');
    
    messageDiv.innerHTML = `
        ${message}
        <span class="message-info">${isSent ? 'Enviado' : senderName} ${timeStr}</span>
    `;
    
    if (chatLogDiv.innerHTML.includes('Selecciona un usuario') || chatLogDiv.innerHTML.includes('Cargando historial')) {
        chatLogDiv.innerHTML = ''; 
    }

    chatLogDiv.appendChild(messageDiv);
    chatLogDiv.scrollTop = chatLogDiv.scrollHeight; 
}

function connectChat() {
    if (!currentToken) { alert('Debes iniciar sesión primero.'); return; }
    if (socket && socket.connected) { alert('Ya estás conectado.'); return; }
    
    updateSocketStatus(false);
    socket = io(BACKEND_URL, { query: { token: currentToken }, transports: ['websocket'] });

    socket.on('connect', () => { updateSocketStatus(true); addChatMessage('Conexión con el servidor de chat establecida.', 'SYSTEM', new Date()); });
    socket.on('disconnect', () => { updateSocketStatus(false); addChatMessage('Desconectado del servidor de chat.', 'SYSTEM', new Date()); });
    socket.on('connect_error', (err) => {
        updateSocketStatus(false);
        if (err.message.includes('token')) { addChatMessage(`❌ Token expirado o inválido. Cerrando sesión.`, 'SYSTEM', new Date()); return logout(); }
        addChatMessage(`❌ Error de conexión: ${err.message}.`, 'SYSTEM', new Date());
    });
    
    // Listeners de lista
    socket.on('usersList', (users) => {
        Object.keys(localConnectedUsers).forEach(key => delete localConnectedUsers[key]); 
        users.forEach(user => localConnectedUsers[user.id] = user);
        renderUsersList();
    });

    socket.on('userConnected', (user) => { localConnectedUsers[user.id] = user; renderUsersList(); addChatMessage(`${user.name} se ha unido al chat.`, 'SYSTEM', new Date()); });
    socket.on('userDisconnected', (userId) => {
        const userName = localConnectedUsers[userId] ? localConnectedUsers[userId].name : 'Un usuario';
        delete localConnectedUsers[userId];
        renderUsersList();
        addChatMessage(`${userName} se ha desconectado.`, 'SYSTEM', new Date());
        if (userId === activeRecipientId) { /* Lógica de desconexión de usuario activo */ }
    });

    // 🚨 Escuchar mensajes
    socket.on('newMessage', (data) => { addChatMessage(data.message, data.senderId, data.timestamp); });
}

function sendMessage() {
    if (!socket || !socket.connected || !activeRecipientId) { alert('No estás conectado o no has seleccionado un destinatario.'); return; }

    const recipientId = activeRecipientId;
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (!message) return;

    const messageData = { recipientId: recipientId, message: message };
    socket.emit('sendMessage', messageData);
    messageInput.value = ''; 
    messageInput.focus();
}

// --- SETUP INICIAL ---

function setupMessageInputListener() {
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !messageInput.disabled) {
            e.preventDefault();
            sendMessage();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => { 
    if (currentToken) {
        try {
            const payload = JSON.parse(atob(currentToken.split('.')[1]));
            currentUserId = payload.user.id;
            document.getElementById('current-user-id').textContent = currentUserId.substring(0, 8) + '...';

            showInterface('chat-interface');
            startTokenRefreshLoop(); 
            requestNotificationPermission(); 
        } catch (e) {
            localStorage.removeItem('jwtToken');
            showInterface('auth-interface');
        }
    } else {
        showInterface('auth-interface');
    }
    setupMessageInputListener();
});