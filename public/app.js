// public/app.js
const BACKEND_URL = 'http://localhost:5000'; 
let currentToken = localStorage.getItem('jwtToken') || ''; 
let currentUserId = ''; 
let socket = null;
let refreshIntervalId = null; 
const localConnectedUsers = {}; 
let activeRecipientId = null; 
let conversationProductId = null; 
let currentExchangeState = null; 
let userOwnProducts = [];


// --- 1. FUNCIONES DE UI Y UTILIDAD ---

// Toast Notification System
function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    const toastId = 'toast-' + Date.now();
    
    const titles = {
        success: '✅ Éxito',
        error: '❌ Error', 
        info: 'ℹ️ Información',
        warning: '⚠️ Advertencia'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = toastId;
    
    toast.innerHTML = `
        <div class="toast-header">
            <h4 class="toast-title">${titles[type] || titles.info}</h4>
            <button class="toast-close" onclick="closeToast('${toastId}')">&times;</button>
        </div>
        <div class="toast-body">${message}</div>
        <div class="toast-progress" style="width: 100%;"></div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Show toast with animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Animate progress bar
    const progressBar = toast.querySelector('.toast-progress');
    setTimeout(() => {
        progressBar.style.transition = `width ${duration}ms linear`;
        progressBar.style.width = '0%';
    }, 100);
    
    // Auto remove
    setTimeout(() => closeToast(toastId), duration);
    
    return toastId;
}

function closeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

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

function switchTab(tabId) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const button = document.querySelector(`.tab-button[onclick="switchTab('${tabId}')"]`);
    const content = document.getElementById(`${tabId}-tab-content`);

    if (button) button.classList.add('active');
    if (content) content.classList.add('active');

    if (tabId === 'feed') {
        loadProductFeed();
    } else if (tabId === 'proposals') { 
        loadProposalsFeed(); 
    } else if (tabId === 'contacts') {
        renderUsersList();
    }
}

// Legacy function - now uses toast notifications
function showInAppMessage(message, isError = false, duration = 3000) {
    showToast(message, isError ? 'error' : 'success', duration);
}

function openPostModal(isNewPost = true) {
    closePostModal(); 
    
    const formContent = document.getElementById('post-form-content');
    const modalTitle = document.getElementById('modal-title');

    if (isNewPost) {
        modalTitle.textContent = 'Nueva Publicación';
        formContent.innerHTML = `
            <input type="text" id="post-title" placeholder="Título del Producto" required>
            <textarea id="post-description" placeholder="Descripción detallada del producto..." rows="4"></textarea>
            <input type="file" id="post-image-file" name="image" accept="image/*" style="margin-top: 10px;">
            <input type="text" id="post-exchange-for" placeholder="Busco a cambio de este producto (ej: libros, servicios)">
            <button onclick="submitNewPost()">Publicar Ahora</button>
        `;
    } 
    
    document.getElementById('post-modal').style.display = 'block';
    document.getElementById('post-output').textContent = '';
}

function closePostModal() {
    document.getElementById('post-modal').style.display = 'none';
    
    // Restaurar el contenido del formulario de publicación base
    document.getElementById('post-form-content').innerHTML = `
        <input type="text" id="post-title" placeholder="Título del Producto" required>
        <textarea id="post-description" placeholder="Descripción detallada del producto..." rows="4"></textarea>
        <input type="file" id="post-image-file" name="image" accept="image/*" style="margin-top: 10px;">
        <input type="text" id="post-exchange-for" placeholder="Busco a cambio de este producto (ej: libros, servicios)">
        <button onclick="submitNewPost()">Publicar Ahora</button>
    `;
    document.getElementById('modal-title').textContent = 'Nueva Publicación';
    document.getElementById('post-output').textContent = '';
    document.getElementById('post-form-content').style.display = 'block';
}


// --- 2. GESTIÓN DEL TOKEN Y SESIÓN ---

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
    const refreshInterval = 15 * 60 * 1000;
    refreshIntervalId = setInterval(attemptTokenRefresh, refreshInterval);
}

function stopTokenRefreshLoop() {
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
    }
}


// --- 3. AUTENTICACIÓN (REST) ---

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
            await loadProductFeed();
            connectChat();
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
    conversationProductId = null;
    currentExchangeState = null;
    
    localStorage.removeItem('jwtToken'); 
    stopTokenRefreshLoop(); 
    if (socket && socket.connected) { socket.disconnect(); }
    
    document.getElementById('chat-messages').innerHTML = '<p style="text-align: center; color: #999;">Selecciona un usuario a la izquierda para comenzar a chatear.</p>';
    document.getElementById('recipient-name-display').textContent = 'Selecciona un Contacto';
    document.getElementById('recipientId-display').textContent = 'N/A';
    document.getElementById('message-input').disabled = true;
    document.querySelector('.send-button').disabled = true;
    
    Object.keys(localConnectedUsers).forEach(key => delete localConnectedUsers[key]);
    showInterface('auth-interface');
}


// --- 4. LÓGICA DE FEED DE PRODUCTOS Y USUARIOS ---

async function loadProductFeed() {
    const feedDiv = document.getElementById('product-feed-list');
    feedDiv.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #666;">
            <div style="display: inline-block; width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px;"></div>
            <p style="margin: 0; font-size: 14px;">Cargando productos...</p>
        </div>
    `;

    if (!currentToken) {
        feedDiv.innerHTML = `<p style="text-align: center; color: red; padding-top: 20px;">Error: Autenticación requerida.</p>`;
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/products`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        if (response.status === 401) {
             showInAppMessage("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.", true, 5000);
             logout();
             return;
        }

        const products = await response.json();
        
        userOwnProducts = products.filter(p => p.owner._id === currentUserId);

        if (response.ok && products.length > 0) {
            feedDiv.innerHTML = ''; 
            products.forEach(product => {
                if (product.owner._id === currentUserId || product.exchangeStatus === 'ACTIVE') {
                    localConnectedUsers[product.owner._id] = { id: product.owner._id, name: product.owner.name };
                    feedDiv.appendChild(createProductCard(product));
                }
            });
            if (feedDiv.children.length === 0) {
                 feedDiv.innerHTML = `<p style="text-align: center; color: #999;">Aún no hay publicaciones activas.</p>`;
            }
        } else if (response.ok) {
            feedDiv.innerHTML = `<p style="text-align: center; color: #999;">El feed está vacío.</p>`;
        } else {
             feedDiv.innerHTML = `<p style="text-align: center; color: red;">Error al cargar el feed.</p>`;
        }
    } catch (error) {
        feedDiv.innerHTML = `<p style="text-align: center; color: red;">Error de red al cargar el feed.</p>`;
    }
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.cssText = `
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 0;
        margin-bottom: 20px;
        background: linear-gradient(145deg, #ffffff, #f8f9fa);
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
        overflow: hidden;
        position: relative;
    `;
    
    // Add hover effect
    card.onmouseenter = function() {
        this.style.transform = 'translateY(-5px)';
        this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
    };
    card.onmouseleave = function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    };
    
    const imageUrl = product.imageUrl && product.imageUrl.startsWith('/') ? `${BACKEND_URL}${product.imageUrl}` : 'https://via.placeholder.com/300x150?text=Sin+Imagen';

    let actionButton;
    let finalizeButton = '';
    const isOwner = product.owner._id === currentUserId;
    const statusBadge = isOwner ? '📍 Tuyo' : '🔄 Disponible';
    const statusColor = isOwner ? '#28a745' : '#007bff';
    
    if (isOwner && product.exchangeStatus === 'ACTIVE') {
        finalizeButton = `<button onclick="finalizeExchange('${product._id}', '${product.title}')" class="finalize-btn" style="padding: 10px 15px; width: 100%; margin-top: 15px; background: linear-gradient(45deg, #dc3545, #c82333); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.3s ease;">💯 Finalizar Intercambio</button>`;
        actionButton = `<div style="display: flex; align-items: center; justify-content: center; color: ${statusColor}; font-weight: bold; margin: 15px 0 5px; padding: 8px; background: rgba(40, 167, 69, 0.1); border-radius: 6px; font-size: 14px;"><span style="margin-right: 5px;">${statusBadge}</span></div>`;
    } else if (product.exchangeStatus === 'ACTIVE') {
        actionButton = `
            <div style="display: flex; align-items: center; justify-content: center; color: ${statusColor}; font-weight: bold; margin: 15px 0 10px; padding: 8px; background: rgba(0, 123, 255, 0.1); border-radius: 6px; font-size: 14px;"><span style="margin-right: 5px;">${statusBadge}</span></div>
            <button onclick="handleChatInitiation('${product.owner._id}', '${product.owner.name}', '${product._id}')" style="padding: 10px 15px; width: 100%; background: linear-gradient(45deg, #ffc107, #e0a800); color: #333; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.3s ease;">💬 Chatear para Intercambio</button>
        `;
    } else {
        actionButton = `<div style="display: flex; align-items: center; justify-content: center; color: #28a745; font-weight: bold; margin: 15px 0; padding: 8px; background: rgba(40, 167, 69, 0.1); border-radius: 6px; font-size: 14px;">✅ Intercambio Concretado</div>`;
    }

    card.innerHTML = `
        <div style="position: relative; margin-bottom: 0;">
            <img src="${imageUrl}" alt="${product.title}" style="width: 100%; height: 180px; object-fit: cover;">
            <div style="position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.9); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; color: ${statusColor};">${statusBadge}</div>
        </div>
        <div style="padding: 15px;">
            <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px; line-height: 1.3;">${product.title}</h4>
            <p style="font-size: 14px; color: #666; line-height: 1.4; margin: 0 0 10px 0;">${product.description.substring(0, 120)}${product.description.length > 120 ? '...' : ''}</p>
            <div style="display: flex; align-items: center; margin-bottom: 10px; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                <span style="font-size: 12px; color: #666; margin-right: 5px;">🔍 Busca:</span>
                <span style="font-size: 12px; color: #333; font-weight: 500;">${product.exchangeFor || 'No especificado'}</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 12px; color: #999; margin-right: 5px;">👤 Por:</span>
                <strong style="font-size: 12px; color: #333;">${isOwner ? 'Ti' : product.owner.name}</strong>
            </div>
            ${actionButton}
            ${finalizeButton}
        </div>
    `;
    return card;
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
            
            li.onclick = () => {
                conversationProductId = null; 
                selectRecipient(user.id, user.name);
            };

            li.innerHTML = `
                <div><strong>${user.name}</strong></div>
                <div class="user-status">Online</div>
            `;
            list.appendChild(li);

            if (user.id === activeRecipientId) { li.classList.add('selected'); }
        });
}

// 🚨 LÓGICA DEL PANEL DE PROPUESTAS
async function loadProposalsFeed() {
    const proposalsDiv = document.getElementById('proposals-list');
    proposalsDiv.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #666;">
            <div style="display: inline-block; width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px;"></div>
            <p style="margin: 0; font-size: 14px;">Cargando propuestas...</p>
        </div>
    `;

    if (!currentToken) {
        proposalsDiv.innerHTML = `<p style="text-align: center; color: red; padding-top: 20px;">Error: Autenticación requerida.</p>`;
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/exchanges/profile`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        
        if (response.status === 401) { return logout(); }

        const exchanges = await response.json();
        
        if (exchanges.length === 0) {
            proposalsDiv.innerHTML = `<p style="text-align: center; color: #999;">No tienes propuestas pendientes, aceptadas o enviadas.</p>`;
            return;
        }

        proposalsDiv.innerHTML = '';
        exchanges.forEach(exchange => {
            proposalsDiv.appendChild(createProposalCard(exchange));
        });

    } catch (error) {
        proposalsDiv.innerHTML = `<p style="text-align: center; color: red;">Error de red al cargar propuestas.</p>`;
    }
}

function createProposalCard(exchange) {
    const card = document.createElement('div');
    card.style.border = '1px solid #007bff';
    card.style.borderRadius = '8px';
    card.style.padding = '15px';
    card.style.marginBottom = '15px';
    card.style.backgroundColor = '#fff';
    
    const isOwner = exchange.owner._id === currentUserId;
    const statusColor = {
        'PENDING': 'orange',
        'ACCEPTED': 'blue',
        'REJECTED': 'red',
        'COMPLETED': 'green'
    }[exchange.status] || 'gray';
    
    const actionText = isOwner ? 'RECIBIDA' : 'ENVIADA';
    const otherParty = isOwner ? exchange.interestedParty.name : exchange.owner.name;
    
    // El producto principal es el que el dueño recibe
    const mainProductTitle = exchange.product.title; 
    const offeredProductTitle = exchange.offeredProduct.title;

    let actionButtons = '';
    const interestedPartyId = exchange.interestedParty._id;
    const productId = exchange.product._id;
    const productName = exchange.product.title;

    if (isOwner && exchange.status === 'PENDING') {
        actionButtons = `
            <button onclick="handleAcceptReject('accept', '${productId}', '${interestedPartyId}', '${productName}')" 
                style="padding: 8px; width: 48%; background-color: #28a745; margin-right: 4%;"
            >Aceptar</button>
            <button onclick="handleAcceptReject('reject', '${productId}', '${interestedPartyId}', '${productName}')" 
                style="padding: 8px; width: 48%; background-color: #dc3545;"
            >Rechazar</button>
        `;
    } else if (exchange.status === 'ACCEPTED') {
        actionButtons = `
            <button onclick="finalizeExchange('${productId}', '${productName}')" 
                style="padding: 8px; width: 100%; background-color: #007bff; margin-top: 10px;"
            >Marcar como Concretado</button>
        `;
    }

    card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 10px;">
            <h4 style="margin: 0; color: #333;">Propuesta ${actionText}</h4>
            <span style="color: ${statusColor}; font-weight: bold;">${exchange.status}</span>
        </div>

        <div style="display: flex; margin-bottom: 10px;">
            <div>
                <p style="margin:0; font-size: 14px; font-weight: bold;">Buscan: ${mainProductTitle}</p>
                <p style="margin:0; font-size: 14px; color: #777;">Ofrecen: ${offeredProductTitle}</p>
            </div>
        </div>
        
        <p style="font-size: 12px; margin-bottom: 15px;">Parte Involucrada: <strong>${otherParty}</strong></p>
        
        <div style="display: flex; justify-content: space-between;">
            ${actionButtons}
        </div>
    `;
    return card;
}


// --- 5. LÓGICA DE PUBLICACIÓN Y FINALIZACIÓN ---

function openPostModal() {
    closePostModal(); 
    
    // Configurar el modal para la publicación
    document.getElementById('modal-title').textContent = 'Nueva Publicación';
    document.getElementById('post-form-content').innerHTML = `
        <input type="text" id="post-title" placeholder="Título del Producto" required>
        <textarea id="post-description" placeholder="Descripción detallada del producto..." rows="4"></textarea>
        <input type="file" id="post-image-file" name="image" accept="image/*" style="margin-top: 10px;">
        <input type="text" id="post-exchange-for" placeholder="Busco a cambio de este producto (ej: libros, servicios)">
        <button onclick="submitNewPost()">Publicar Ahora</button>
    `;
    
    document.getElementById('post-modal').style.display = 'block';
}

function closePostModal() {
    document.getElementById('post-modal').style.display = 'none';
    
    // Restaurar el formulario de publicación base
    document.getElementById('post-form-content').innerHTML = `
        <input type="text" id="post-title" placeholder="Título del Producto" required>
        <textarea id="post-description" placeholder="Descripción detallada del producto..." rows="4"></textarea>
        <input type="file" id="post-image-file" name="image" accept="image/*" style="margin-top: 10px;">
        <input type="text" id="post-exchange-for" placeholder="Busco a cambio de este producto (ej: libros, servicios)">
        <button onclick="submitNewPost()">Publicar Ahora</button>
    `;
    document.getElementById('modal-title').textContent = 'Nueva Publicación';
    document.getElementById('post-output').textContent = '';
    document.getElementById('post-form-content').style.display = 'block';
}

async function submitNewPost() {
    const title = document.getElementById('post-title').value.trim();
    const description = document.getElementById('post-description').value.trim();
    const exchangeFor = document.getElementById('post-exchange-for').value.trim();
    const imageFile = document.getElementById('post-image-file').files[0]; 
    const output = document.getElementById('post-output');
    const submitBtn = document.querySelector('#post-form-content button');

    if (!title || !description) {
        showToast('El título y la descripción son obligatorios.', 'warning');
        return;
    }

    // Add loading state to button
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.innerHTML = `
        <div style="display: inline-flex; align-items: center; gap: 8px;">
            <div style="width: 16px; height: 16px; border: 2px solid transparent; border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            Publicando...
        </div>
    `;
    
    showToast('Publicando producto...', 'info', 8000);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('exchangeFor', exchangeFor);
    
    if (imageFile) {
        formData.append('image', imageFile); 
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/products`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            showToast(`✅ Producto "${title}" publicado con éxito`, 'success');
            closePostModal();
            await loadProductFeed();
            switchTab('feed');
        } else {
            const data = await response.json();
            showToast(`Error al publicar: ${data.msg || 'Token inválido.'}`, 'error');
            
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.innerHTML = 'Publicar Ahora';
        }
    } catch (error) {
        showToast('Error de red al publicar. Verifica tu conexión.', 'error');
        
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.innerHTML = 'Publicar Ahora';
    }
}

async function finalizeExchange(productId, productName) {
    // Enhanced confirmation dialog
    const confirmMessage = `🔄 CONCRETAR INTERCAMBIO\n\n` +
        `Producto: "${productName}"\n` +
        `⚠️ ATENCIÓN: Esta acción eliminará AMBOS productos del feed permanentemente.\n\n` +
        `¿Confirmas que el intercambio se ha completado exitosamente?`;
        
    if (!window.confirm(confirmMessage)) {
        return;
    }
    
    // Show loading state
    const loadingToast = showToast('Finalizando intercambio...', 'info', 10000);
    
    // Obtener el ID del interesado del estado actual
    const interestedPartyId = activeRecipientId;

    try {
        const response = await fetch(`${BACKEND_URL}/api/exchanges/${productId}/${interestedPartyId}/complete`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        // Close loading toast
        closeToast(loadingToast);

        if (response.ok) {
            const data = await response.json();
            const successMessage = data.completedProducts ? 
                `Intercambio completado: "${data.completedProducts.main}" ↔️ "${data.completedProducts.offered}"\nAmbos productos han sido eliminados del feed.` :
                `Intercambio de "${productName}" finalizado con éxito.`;
            
            showToast(successMessage, 'success', 6000);
            
            // Refresh all relevant data
            await loadProductFeed();
            await loadProposalsFeed();
            switchTab('proposals'); 
        } else {
            const data = await response.json();
            showToast(`Error al finalizar: ${data.msg || 'No autorizado o error del servidor'}.`, 'error');
        }
    } catch (error) {
        closeToast(loadingToast);
        showToast('Error de red al intentar finalizar el intercambio.', 'error');
    }
}


// --- 6. CICLO DE VIDA DEL INTERCAMBIO Y CHAT ---

function handleChatInitiation(recipientId, recipientName, productId) {
    if (!socket || !socket.connected) {
        showInAppMessage("El chat no está conectado. Presiona 'Reconectar Chat' y vuelve a intentarlo.", true);
        return;
    }
    
    if (userOwnProducts.length === 0) {
        showInAppMessage("No puedes iniciar un intercambio. ¡Primero publica un producto tuyo!", true);
        return;
    }

    // 🚨 ABRIR MODAL DE SELECCIÓN DE PRODUCTOS PARA PROPUESTA
    openPostModal(); 
    document.getElementById('modal-title').textContent = 'Proponer Intercambio';
    const formContent = document.getElementById('post-form-content');
    const ownerId = recipientId; // El destinatario es el dueño del post

    formContent.innerHTML = `
        <h3 style="margin-top:0;">Intercambio por: ${productId.substring(0, 8)}...</h3>
        <p>Selecciona tu producto para ofrecer a ${recipientName}:</p>
        <select id="offered-product-select" required style="margin-bottom: 15px;">
            <option value="">-- Selecciona un Producto Tuyo --</option>
            ${userOwnProducts.map(p => 
                `<option value="${p._id}">[${p._id.substring(0, 4)}...] ${p.title} (Busca: ${p.exchangeFor})</option>`
            ).join('')}
        </select>
        <button onclick="submitProposal('${ownerId}', '${productId}', '${recipientName}')">Enviar Propuesta</button>
    `;
}

async function submitProposal(ownerId, productId, recipientName) {
    const offeredProductId = document.getElementById('offered-product-select').value;
    const output = document.getElementById('post-output');

    if (!offeredProductId) {
        output.textContent = 'Debes seleccionar un producto para ofrecer.';
        output.style.color = 'red';
        return;
    }

    output.textContent = 'Enviando propuesta...';
    output.style.color = 'blue';

    try {
        const response = await fetch(`${BACKEND_URL}/api/exchanges/propose`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ productId: productId, ownerId: ownerId, offeredProductId: offeredProductId })
        });

        const data = await response.json();

        if (response.ok || response.status === 200) { 
            currentExchangeState = data.exchange;
            conversationProductId = productId; 
            
            closePostModal();
            selectRecipient(ownerId, recipientName); 
            showInAppMessage(`Propuesta verificada/enviada: ${currentExchangeState.status}`, false, 3000);
            
        } else {
            output.textContent = `❌ Fallo al proponer: ${data.msg || 'Error desconocido'}`;
            output.style.color = 'red';
        }
    } catch (error) {
        output.textContent = '❌ Error de red al proponer intercambio.';
        output.style.color = 'red';
    }
}

async function handleAcceptReject(action, productId, interestedPartyId, productName) {
    const endpoint = action === 'accept' ? 'accept' : 'reject';
    
    if (!window.confirm(`¿Confirma ${action.toUpperCase()} la propuesta para ${productName}?`)) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/exchanges/${productId}/${interestedPartyId}/${endpoint}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        
        const data = await response.json();

        if (response.ok) {
            showInAppMessage(`Propuesta ${action.toUpperCase()} con éxito. Estado: ${data.exchange.status}`, false);
            selectRecipient(interestedPartyId, document.getElementById('recipient-name-display').textContent.split(' ')[0]);
            loadProductFeed(); 
            switchTab('proposals'); 
        } else {
            showInAppMessage(`Error: ${data.msg || 'Fallo en la operación.'}`, true);
        }
    } catch (error) {
        showInAppMessage('Error de red.', true);
    }
}


function renderChatActions(isOwner, productId, productName, exchangeStatus) {
    const chatHeader = document.querySelector('.chat-header');
    
    let existingActions = chatHeader.querySelector('#chat-actions');
    if (existingActions) { existingActions.remove(); }

    const actionsDiv = document.createElement('div');
    actionsDiv.id = 'chat-actions';
    actionsDiv.style.marginLeft = '20px'; 
    actionsDiv.style.display = 'flex'; 

    const interestedPartyId = activeRecipientId;

    if (isOwner) {
        if (exchangeStatus === 'PENDING') {
            const acceptBtn = document.createElement('button');
            acceptBtn.textContent = 'Aceptar Propuesta';
            acceptBtn.style.cssText = 'padding: 5px 10px; font-size: 12px; background-color: #007bff; margin-right: 10px;';
            acceptBtn.onclick = () => handleAcceptReject('accept', productId, interestedPartyId, productName);
            actionsDiv.appendChild(acceptBtn);

            const rejectBtn = document.createElement('button');
            rejectBtn.textContent = 'Rechazar';
            rejectBtn.style.cssText = 'padding: 5px 10px; font-size: 12px; background-color: #dc3545;';
            rejectBtn.onclick = () => handleAcceptReject('reject', productId, interestedPartyId, productName);
            actionsDiv.appendChild(rejectBtn);
        } else if (exchangeStatus === 'ACCEPTED') {
            const completeBtn = document.createElement('button');
            completeBtn.textContent = 'CONCRETAR Intercambio';
            completeBtn.style.cssText = 'padding: 5px 10px; font-size: 12px; background-color: #28a745;';
            completeBtn.onclick = () => finalizeExchange(productId, productName); 
            actionsDiv.appendChild(completeBtn);
        } else if (exchangeStatus === 'COMPLETED') {
             actionsDiv.innerHTML = `<span style="color: green; font-weight: bold;">Intercambio Finalizado</span>`;
        }
    } else if (exchangeStatus === 'ACCEPTED') {
        const completeBtn = document.createElement('button');
        completeBtn.textContent = 'CONCRETAR (Mi Parte)';
        completeBtn.style.cssText = 'padding: 5px 10px; font-size: 12px; background-color: #28a745;';
        completeBtn.onclick = () => finalizeExchange(productId, productName);
        actionsDiv.appendChild(completeBtn);
    }

    if (actionsDiv.children.length > 0) {
        chatHeader.appendChild(actionsDiv);
    }
}


async function selectRecipient(userId, userName) {
    if (activeRecipientId === userId) return; 

    document.querySelectorAll('#product-feed-list div[style*="border: 1px solid"]').forEach(el => el.style.border = '1px solid #ddd');
    document.querySelectorAll('#connected-users-list li').forEach(li => li.classList.remove('selected'));
    
    activeRecipientId = userId;
    currentExchangeState = null; 
    
    const li = document.querySelector(`#user-${userId}`);
    if (li) li.classList.add('selected');

    document.getElementById('recipient-name-display').textContent = userName;
    document.getElementById('recipientId-display').textContent = userId.substring(0, 8) + '...';

    document.getElementById('message-input').disabled = false;
    document.querySelector('.send-button').disabled = false;
    document.getElementById('message-input').focus();
    
    document.getElementById('chat-messages').innerHTML = `<p style="text-align: center; color: #999;">Cargando historial con ${userName}...</p>`;
    
    renderChatActions(false, null, null); 

    try {
        const response = await fetch(`${BACKEND_URL}/api/chat/history/${userId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        const history = await response.json();
        const chatLogDiv = document.getElementById('chat-messages');
        chatLogDiv.innerHTML = ''; 
        
        let productRef = null;
        let productName = userName;

        const productMsg = history.find(msg => msg.productId);
        if (productMsg) productRef = productMsg.productId;
        else if (conversationProductId) productRef = conversationProductId;
        
        // 2. Si hay referencia de producto, obtener el estado del intercambio
        if (productRef) {
             const productResponse = await fetch(`${BACKEND_URL}/api/products`, {
                 headers: { 'Authorization': `Bearer ${currentToken}` }
             });
             const allProducts = await productResponse.json();
             const product = allProducts.find(p => p._id === productRef);
             
             if (product) {
                 productName = product.title;
                 const isOwner = product.owner._id === currentUserId;
                 const interestedPartyId = isOwner ? userId : currentUserId; 
                 
                 // Obtener estado del intercambio
                 const exchangeStatusResponse = await fetch(`${BACKEND_URL}/api/exchanges/status/${productRef}/${interestedPartyId}`, {
                    headers: { 'Authorization': `Bearer ${currentToken}` }
                 });
                 const exchangeData = await exchangeStatusResponse.json();
                 
                 if (exchangeData.exchange) {
                    currentExchangeState = exchangeData.exchange;
                    // Renderizar botones si el intercambio es relevante
                    renderChatActions(isOwner, productRef, productName, currentExchangeState.status);
                 }
             }
        }
        
        // 3. Renderizar mensajes
        if (response.ok && history.length > 0) {
            history.forEach(msg => {
                addChatMessage(msg.message, msg.senderId, msg.timestamp, msg.productId); 
            });
        } else if (response.ok && history.length === 0) {
            if (conversationProductId) {
                 addChatMessage('¡Inicia la conversación para el intercambio!', currentUserId, new Date(), conversationProductId);
            } else {
                 chatLogDiv.innerHTML = `<p style="text-align: center; color: #999;">¡Comiencen su conversación!</p>`;
            }
        } else {
            chatLogDiv.innerHTML = `<p style="text-align: center; color: red;">Error al cargar: ${history.msg || 'Token inválido o expirado.'}</p>`;
        }
    } catch (error) {
        document.getElementById('chat-messages').innerHTML = `<p style="text-align: center; color: red;">Error de red al cargar historial.</p>`;
    }
}

function addChatMessage(message, senderId, timestamp, productId) {
    const chatLogDiv = document.getElementById('chat-messages');
    
    // Handle notifications for users not in current conversation
    if (senderId !== currentUserId && senderId !== activeRecipientId && senderId !== 'SYSTEM') {
        const senderName = localConnectedUsers[senderId] ? localConnectedUsers[senderId].name : 'Desconocido';
        showNotification(senderName, message);
        return;
    }

    const isSent = (senderId === currentUserId);
    const isSystem = (senderId === 'SYSTEM');
    const messageDiv = document.createElement('div');
    
    if (isSystem) {
        messageDiv.className = 'system-message';
        messageDiv.style.cssText = `
            text-align: center;
            padding: 8px 16px;
            margin: 10px 0;
            background: rgba(0, 123, 255, 0.1);
            border: 1px solid rgba(0, 123, 255, 0.2);
            border-radius: 20px;
            color: #007bff;
            font-size: 13px;
            font-style: italic;
        `;
        messageDiv.textContent = message;
    } else {
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        
        const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        }) : new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        const senderName = isSent ? 'Tú' : (localConnectedUsers[senderId] ? localConnectedUsers[senderId].name : 'Desconocido');
        
        let referenceHTML = '';
        if (productId) {
            const productRef = productId.substring(0, 8);
            referenceHTML = `
                <div style="
                    background: ${isSent ? 'rgba(255,255,255,0.2)' : 'rgba(0,123,255,0.1)'}; 
                    border-left: 3px solid #ffc107; 
                    padding: 6px 10px; 
                    margin-bottom: 8px; 
                    font-size: 11px; 
                    border-radius: 6px; 
                    color: ${isSent ? 'rgba(255,255,255,0.9)' : '#666'};
                    display: flex;
                    align-items: center;
                    gap: 5px;
                ">
                    📎 <strong>Ref. ${productRef}...</strong>
                </div>
            `;
        }

        messageDiv.innerHTML = `
            ${referenceHTML}
            <div style="margin-bottom: 4px;">${message}</div>
            <span class="message-info">
                ${isSent ? '📤' : '📬'} ${senderName} • ${timeStr}
            </span>
        `;
    }
    
    // Clear placeholder text
    if (chatLogDiv.innerHTML.includes('Selecciona un usuario') || chatLogDiv.innerHTML.includes('Cargando historial')) {
        chatLogDiv.innerHTML = '';
    }

    chatLogDiv.appendChild(messageDiv);
    
    // Smooth scroll to bottom
    chatLogDiv.scrollTo({
        top: chatLogDiv.scrollHeight,
        behavior: 'smooth'
    });
    
    // Add sound effect for new messages (optional)
    if (!isSent && !isSystem) {
        // You could add a subtle sound here
    }
}

function connectChat() {
    if (!currentToken) { showInAppMessage('Debes iniciar sesión para conectar el chat.', true); return; }
    if (socket && socket.connected) { showInAppMessage('Ya estás conectado.', false); return; }
    
    updateSocketStatus(false);
    socket = io(BACKEND_URL, { query: { token: currentToken }, transports: ['websocket'] });

    socket.on('connect', () => { updateSocketStatus(true); addChatMessage('Conexión con el servidor de chat establecida.', 'SYSTEM', new Date()); });
    socket.on('disconnect', () => { updateSocketStatus(false); addChatMessage('Desconectado del servidor de chat.', 'SYSTEM', new Date()); });
    socket.on('connect_error', (err) => {
        updateSocketStatus(false);
        if (err.message.includes('token')) { showInAppMessage(`❌ Token expirado o inválido. Cerrando sesión.`, true); return logout(); }
        showInAppMessage(`❌ Error de conexión: ${err.message}.`, true);
    });
    
    socket.on('usersList', (users) => { users.forEach(user => localConnectedUsers[user.id] = user); renderUsersList(); });
    socket.on('userConnected', (user) => { localConnectedUsers[user.id] = user; renderUsersList(); addChatMessage(`${user.name} se ha unido al chat.`, 'SYSTEM', new Date()); });
    socket.on('userDisconnected', (userId) => {
        const userName = localConnectedUsers[userId] ? localConnectedUsers[userId].name : 'Un usuario';
        delete localConnectedUsers[userId];
        renderUsersList(); 
        addChatMessage(`${userName} se ha desconectado.`, 'SYSTEM', new Date());

        if (userId === activeRecipientId) { 
            activeRecipientId = null;
            document.getElementById('recipient-name-display').textContent = 'Usuario Desconectado';
            document.getElementById('message-input').disabled = true;
            document.querySelector('.send-button').disabled = true;
        }
    });

    socket.on('newMessage', (data) => { addChatMessage(data.message, data.senderId, data.timestamp, data.productId); });
}

function sendMessage() {
    if (!socket || !socket.connected || !activeRecipientId) { showInAppMessage('No estás conectado o no has seleccionado un destinatario.', true); return; }

    const recipientId = activeRecipientId;
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (!message) return;

    const messageData = { 
        recipientId: recipientId, 
        message: message,
        productId: conversationProductId 
    };
    
    socket.emit('sendMessage', messageData);
    
    if (conversationProductId) {
        conversationProductId = null; 
    }
    
    messageInput.value = ''; 
    messageInput.focus();
}

// --- 7. SETUP INICIAL ---

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
            loadProductFeed(); 
            connectChat(); 
        } catch (e) {
            localStorage.removeItem('jwtToken');
            showInterface('auth-interface');
        }
    } else {
        showInterface('auth-interface');
    }
    setupMessageInputListener();
    switchTab('feed');
});