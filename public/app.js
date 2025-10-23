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
let unreadMessagesCount = {}; 
let hasNewProposals = false;


// --- 1. FUNCIONES DE UI Y UTILIDAD ---

function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    const toastId = 'toast-' + Date.now();
    
    const titles = {
        success: '<i class="fas fa-check-circle"></i> Éxito',
        error: '<i class="fas fa-times-circle"></i> Error', 
        info: '<i class="fas fa-info-circle"></i> Información',
        warning: '<i class="fas fa-exclamation-triangle"></i> Advertencia'
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
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    const progressBar = toast.querySelector('.toast-progress');
    setTimeout(() => {
        progressBar.style.transition = `width ${duration}ms linear`;
        progressBar.style.width = '0%';
    }, 100);
    
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

function updateTabBadge(tabId) {
    const tabButton = document.querySelector(`.tab-button[onclick="switchTab('${tabId}')"]`);
    if (!tabButton) return;

    let badge = tabButton.querySelector('.tab-notification-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'tab-notification-badge';
        tabButton.appendChild(badge);
    }

    if (tabId === 'contacts') {
        const totalUnread = Object.values(unreadMessagesCount).reduce((sum, count) => sum + count, 0);
        badge.textContent = totalUnread > 0 ? totalUnread : '';
        badge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
    } else if (tabId === 'proposals') {
        badge.textContent = hasNewProposals ? '!' : '';
        badge.style.display = hasNewProposals ? 'inline-block' : 'none';
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

function showInAppMessage(message, isError = false, duration = 3000) {
    const modal = document.getElementById('post-modal');
    const output = document.getElementById('post-output');
    const formContent = document.getElementById('post-form-content');
    
    formContent.style.display = 'none'; 
    document.getElementById('modal-title').textContent = isError ? 'Error' : 'Notificación';
    
    output.textContent = message;
    output.style.color = isError ? 'red' : 'green';
    
    modal.style.display = 'block';
    
    if (isError || duration > 0) {
         setTimeout(() => {
             modal.style.display = 'none';
             formContent.style.display = 'block'; 
             output.textContent = ''; 
             document.getElementById('modal-title').textContent = 'Nueva Publicación';
         }, duration);
    }
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
            switchTab('feed');
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
    feedDiv.innerHTML = `<p style="text-align: center; color: #999; padding-top: 20px;">Cargando productos...</p>`;

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

        if (response.ok) {
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
    card.style.border = '1px solid #ddd';
    card.style.borderRadius = '6px';
    card.style.padding = '15px';
    card.style.marginBottom = '15px';
    card.style.backgroundColor = '#fff';
    
    const imageUrl = product.imageUrl && product.imageUrl.startsWith('/') ? `${BACKEND_URL}${product.imageUrl}` : 'https://via.placeholder.com/300x150?text=Sin+Imagen';

    let actionButton;
    const isOwner = product.owner._id === currentUserId;
    
    if (isOwner && product.exchangeStatus === 'ACTIVE') {
        actionButton = `<span style="display: block; text-align: center; color: var(--primary-color); font-weight: bold; margin-top: 10px;">¡Tu Publicación!</span>`;
    } else if (product.exchangeStatus === 'ACTIVE') {
        actionButton = `<button onclick="handleChatInitiation('${product.owner._id}', '${product.owner.name}', '${product._id}')" style="padding: 8px; width: 100%; margin-top: 10px; background-color: #ffc107; color: #333; border: none; border-radius: 4px;">Chatear para Intercambio</button>`;
    } else {
        actionButton = `<span style="display: block; text-align: center; color: green; font-weight: bold; margin-top: 10px;">¡Intercambio Concretado!</span>`;
    }

    card.innerHTML = `
        <div style="margin-bottom: 10px;">
            <img src="${imageUrl}" alt="${product.title}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px;">
        </div>
        <h4 style="margin-top:0; color:var(--primary-color);">${product.title}</h4>
        <p style="font-size:14px; margin-bottom: 5px;">${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}</p>
        <p style="font-size:12px; color:var(--secondary-color);">Busca: ${product.exchangeFor}</p>
        <p style="font-size:12px; margin-top: 10px;">Publicado por: <strong>${isOwner ? 'Tú' : product.owner.name}</strong></p>
        ${actionButton}
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

            const unread = unreadMessagesCount[user.id] || 0;
            const badgeHtml = unread > 0 ? `<span class="unread-badge">${unread}</span>` : '';

            li.innerHTML = `
                <div><strong>${user.name}</strong></div>
                ${badgeHtml}
            `;
            list.appendChild(li);

            if (user.id === activeRecipientId) { li.classList.add('selected'); }
        });
}

async function loadProposalsFeed() {
    const proposalsDiv = document.getElementById('proposals-list');
    proposalsDiv.innerHTML = `<p style="text-align: center; color: #999; padding-top: 20px;">Cargando propuestas...</p>`;

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
            hasNewProposals = false; 
            updateTabBadge('proposals');
            return;
        }

        proposalsDiv.innerHTML = '';
        hasNewProposals = exchanges.some(e => e.status === 'PENDING' && e.owner._id === currentUserId);
        
        exchanges.forEach(exchange => {
            proposalsDiv.appendChild(createProposalCard(exchange));
        });
        
        updateTabBadge('proposals'); 

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
        'PENDING': '#ffc107',
        'ACCEPTED': '#007bff',
        'REJECTED': '#dc3545',
        'COMPLETED': '#28a745'
    }[exchange.status] || 'gray';
    
    const actionText = isOwner ? 'RECIBIDA' : 'ENVIADA';
    const otherParty = isOwner ? exchange.interestedParty.name : exchange.owner.name;
    
    const mainProductTitle = exchange.product.title; 
    const offeredProductTitle = exchange.offeredProduct.title;
    
    const mainProductImageUrl = exchange.product.imageUrl && exchange.product.imageUrl.startsWith('/') ? `${BACKEND_URL}${exchange.product.imageUrl}` : 'https://via.placeholder.com/50x50?text=Prod';
    const offeredProductImageUrl = exchange.offeredProduct.imageUrl && exchange.offeredProduct.imageUrl.startsWith('/') ? `${BACKEND_URL}${exchange.offeredProduct.imageUrl}` : 'https://via.placeholder.com/50x50?text=Offr';


    let actionButtons = '';
    const interestedPartyId = exchange.interestedParty._id;
    const productId = exchange.product._id;
    const productName = exchange.product.title;

    if (isOwner && exchange.status === 'PENDING') {
        actionButtons = `
            <button onclick="handleAcceptReject('accept', '${productId}', '${interestedPartyId}', '${productName}')" 
                class="chat-action-btn accept-btn" style="width: 48%; margin-right: 4%;"
            ><i class="fas fa-check"></i> Aceptar</button>
            <button onclick="handleAcceptReject('reject', '${productId}', '${interestedPartyId}', '${productName}')" 
                class="chat-action-btn reject-btn" style="width: 48%;"
            ><i class="fas fa-times"></i> Rechazar</button>
        `;
    }

    card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 10px;">
            <h4 style="margin: 0; color: #333;"><i class="fas fa-list-alt"></i> Propuesta ${actionText}</h4>
            <span style="color: white; background-color: ${statusColor}; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">${exchange.status}</span>
        </div>

        <div style="margin-bottom: 10px;">
            <div style="display: flex; align-items: center; justify-content: center; background: #eee; padding: 10px; border-radius: 4px; text-align: center;">
                <img src="${offeredProductImageUrl}" alt="Ofrecido" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%; margin-right: 10px;">
                <span style="font-size: 14px; font-weight: bold; flex-shrink: 1;">${offeredProductTitle}</span> 🔄 <span style="font-size: 14px; font-weight: bold; flex-shrink: 1;">${mainProductTitle}</span>
                <img src="${mainProductImageUrl}" alt="Principal" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%; margin-left: 10px;">
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

    if (!title || !description) {
        output.textContent = 'El título y la descripción son obligatorios.';
        output.style.color = 'red';
        return;
    }

    output.textContent = 'Publicando...';
    output.style.color = 'blue';

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
            output.textContent = '✅ Publicación creada con éxito.';
            output.style.color = 'green';
            setTimeout(() => {
                closePostModal();
                loadProductFeed(); 
            }, 1500);
        } else {
            const data = await response.json();
            output.textContent = `❌ Error al publicar: ${data.msg || 'Token inválido.'}`;
            output.style.color = 'red';
        }
    } catch (error) {
        output.textContent = '❌ Error de red al publicar.';
        output.style.color = 'red';
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

    openPostModal(); 
    document.getElementById('modal-title').textContent = 'Proponer Intercambio';
    const formContent = document.getElementById('post-form-content');
    const ownerId = recipientId; 

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
            showInAppMessage(`Propuesta de intercambio enviada: ${currentExchangeState.status}`, false, 3000);
            
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
            loadProposalsFeed(); 
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
        } else if (exchangeStatus === 'COMPLETED') {
             actionsDiv.innerHTML = `<span style="color: green; font-weight: bold;">Intercambio Finalizado</span>`;
        }
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

    // Clear unread messages for this recipient
    if (unreadMessagesCount[userId]) {
        delete unreadMessagesCount[userId];
        updateTabBadge('contacts');
    }

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
             const productResponse = await fetch(`${BACKEND_URL}/api/products`);
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
    
    if (senderId !== currentUserId && senderId !== activeRecipientId) {
        const senderName = localConnectedUsers[senderId] ? localConnectedUsers[senderId].name : 'Desconocido';
        showNotification(senderName, message); 

        unreadMessagesCount[senderId] = (unreadMessagesCount[senderId] || 0) + 1;
        const badge = document.getElementById(`unread-badge-${senderId}`);
        if (badge) {
            badge.textContent = unreadMessagesCount[senderId];
            badge.style.display = 'inline-block';
        }
        updateTabBadge('contacts');

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
                <div style="background: rgba(255,255,255,0.2); border-left: 3px solid #ffc107; padding: 5px; margin-bottom: 8px; font-size: 11px; border-radius: 4px; color: #333;">
                    Referencia a Publicación: <strong>${productRef}...</strong>
                </div>
            `;
        }

        messageDiv.innerHTML = `
            ${referenceHTML}
            <div style="margin-bottom: 4px;">${message}</div>
            <span class="message-info">
                ${isSent ? '<i class="fas fa-paper-plane"></i>' : '<i class="fas fa-envelope-open-text"></i>'} ${senderName} • ${timeStr}
            </span>
        `;
    }
    
    if (chatLogDiv.innerHTML.includes('Selecciona un usuario') || chatLogDiv.innerHTML.includes('Cargando historial')) {
        chatLogDiv.innerHTML = ''; 
    }

    chatLogDiv.appendChild(messageDiv);
    
    chatLogDiv.scrollTo({
        top: chatLogDiv.scrollHeight,
        behavior: 'smooth'
    });
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

    socket.on('newMessage', (data) => { 
        if (data.senderId === activeRecipientId) {
            addChatMessage(data.message, data.senderId, data.timestamp, data.productId);
            if (unreadMessagesCount[data.senderId]) { delete unreadMessagesCount[data.senderId]; updateTabBadge('contacts'); }
        } else if (data.senderId !== currentUserId) {
            addChatMessage(data.message, data.senderId, data.timestamp, data.productId); 
        }
        
        if (data.productId) {
            loadProposalsFeed();
        }
    });
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
    
    addChatMessage(message, currentUserId, new Date().toISOString(), conversationProductId);
    
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