
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

function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showInterface(idToShow) {
    const authInterface = document.getElementById('auth-interface');
    const chatInterface = document.getElementById('chat-interface');

    if (idToShow === 'chat-interface') {
        authInterface.style.display = 'none';
        chatInterface.style.display = 'flex';
    } else {
        authInterface.style.display = 'flex';
        chatInterface.style.display = 'none';
    }
}

function updateAuthOutput(message, isError = false) {
    showToast(message, isError ? 'error' : 'success');
}

function updateSocketStatus(isConnected) {
    const statusDiv = document.getElementById('socket-status');
    statusDiv.innerHTML = isConnected
        ? '<i class="fas fa-circle" style="color: var(--success-color);"></i> Conectado'
        : '<i class="fas fa-circle" style="color: var(--danger-color);"></i> Desconectado';
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

    let badge = tabButton.querySelector('.badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge';
        tabButton.appendChild(badge);
    }

    let count = 0;
    if (tabId === 'contacts') {
        count = Object.values(unreadMessagesCount).reduce((sum, c) => sum + c, 0);
    } else if (tabId === 'proposals') {
        count = hasNewProposals ? '!' : 0;
    }

    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'block' : 'none';
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.main-content .tab-content').forEach(content => content.style.display = 'none');
    document.getElementById('chat-view').style.display = 'none';

    const button = document.querySelector(`.tab-button[onclick="switchTab('${tabId}')"]`);
    button.classList.add('active');

    if (tabId === 'contacts') {
        document.querySelector('.sidebar-content').style.display = 'block';
        renderUsersList();
    } else {
        document.querySelector('.sidebar-content').style.display = 'none';
        const content = document.getElementById(`${tabId}-tab-content`);
        content.style.display = 'block';
        if (tabId === 'feed') loadProductFeed();
        if (tabId === 'proposals') loadProposalsFeed();
    }
}

function openPostModal(isNewPost = true) {
    const modal = document.getElementById('post-modal');
    const formContent = document.getElementById('post-form-content');
    const modalTitle = document.getElementById('modal-title');

    if (isNewPost) {
        modalTitle.textContent = 'Nueva Publicación';
        formContent.innerHTML = `
            <input type="text" id="post-title" placeholder="Título del Producto" required>
            <textarea id="post-description" placeholder="Descripción detallada..." rows="4"></textarea>
            <div id="image-preview-container"></div>
            <input type="file" id="post-image-file" name="images" accept="image/*" multiple onchange="previewImages()">
            <input type="text" id="post-exchange-for" placeholder="¿Qué buscas a cambio?">
            <button onclick="submitNewPost()">Publicar</button>
        `;
    }
    modal.style.display = 'flex';
}

function closePostModal() {
    document.getElementById('post-modal').style.display = 'none';
    document.getElementById('post-output').textContent = '';
}

function previewImages() {
    const previewContainer = document.getElementById('image-preview-container');
    const files = document.getElementById('post-image-file').files;
    previewContainer.innerHTML = ''; // Clear previous previews

    if (files.length > 5) {
        showToast('Puedes seleccionar un máximo de 5 imágenes.', 'warning');
        // Clear the file input
        document.getElementById('post-image-file').value = '';
        return;
    }

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '100px';
            img.style.maxHeight = '100px';
            img.style.margin = '5px';
            previewContainer.appendChild(img);
        }
        reader.readAsDataURL(file);
    }
}

function closeProductDetailsModal() {
    document.getElementById('product-details-modal').style.display = 'none';
}

async function openProductDetailsModal(productId) {
    const modal = document.getElementById('product-details-modal');
    const content = document.getElementById('product-details-content');
    content.innerHTML = '<p>Cargando detalles...</p>';
    modal.style.display = 'flex';

    try {
        const response = await fetch(`${BACKEND_URL}/api/products/${productId}`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) {
            throw new Error('Producto no encontrado');
        }
        const product = await response.json();

        const imagesHTML = product.imageUrls.map((url, index) => `
            <div class="carousel-slide">
                <img src="${BACKEND_URL}${url}" alt="${product.title}">
            </div>
        `).join('');

        const dotsHTML = product.imageUrls.map((url, index) => `
            <span class="carousel-dot" onclick="showSlide(${index})"></span>
        `).join('');

        const carouselHTML = `
            <div class="carousel-container">
                ${imagesHTML}
                <a class="carousel-prev" onclick="changeSlide(-1)">&#10094;</a>
                <a class="carousel-next" onclick="changeSlide(1)">&#10095;</a>
                <div class="carousel-dots">
                    ${dotsHTML}
                </div>
            </div>
        `;

        let editButton = '';
        if (product.owner._id === currentUserId) {
            editButton = `<button onclick='openEditProductModal(${JSON.stringify(product)})'>Editar</button>`;
        }

        content.innerHTML = `
            <h2>${product.title}</h2>
            ${carouselHTML}
            <p>${product.description}</p>
            <p><strong>Busca a cambio:</strong> ${product.exchangeFor}</p>
            <p><small>Publicado por: ${product.owner.name}</small></p>
            ${editButton}
        `;

        initializeCarousel();

    } catch (error) {
        content.innerHTML = `<p style="color:red;">${error.message}</p>`;
    }
}

let slideIndex = 0;

function initializeCarousel() {
    slideIndex = 0;
    showSlide(slideIndex);
}

function changeSlide(n) {
    showSlide(slideIndex += n);
}

function showSlide(n) {
    let i;
    let slides = document.getElementsByClassName("carousel-slide");
    let dots = document.getElementsByClassName("carousel-dot");
    if (n >= slides.length) {slideIndex = 0}
    if (n < 0) {slideIndex = slides.length - 1}
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }
    for (i = 0; i < dots.length; i++) {
        dots[i].className = dots[i].className.replace(" active-dot", "");
    }
    slides[slideIndex].style.display = "block";
    dots[slideIndex].className += " active-dot";
}

function openEditProductModal(product) {
    const content = document.getElementById('product-details-content');

    const existingImagesHTML = product.imageUrls.map(url => `
        <div class="existing-image-preview">
            <img src="${BACKEND_URL}${url}" />
            <input type="checkbox" name="existingImages" value="${url}" checked> Mantener
        </div>
    `).join('');

    content.innerHTML = `
        <h2>Editando: ${product.title}</h2>
        <input type="text" id="edit-post-title" value="${product.title}" required>
        <textarea id="edit-post-description" rows="4">${product.description}</textarea>
        <p>Imágenes existentes:</p>
        <div class="existing-images-container">${existingImagesHTML}</div>
        <p>Añadir nuevas imágenes:</p>
        <div id="edit-image-preview-container"></div>
        <input type="file" id="edit-post-image-file" name="images" accept="image/*" multiple onchange="previewEditImages()">
        <input type="text" id="edit-post-exchange-for" value="${product.exchangeFor}">
        <button onclick="saveProductChanges('${product._id}')">Guardar Cambios</button>
    `;
}

function previewEditImages() {
    const previewContainer = document.getElementById('edit-image-preview-container');
    const files = document.getElementById('edit-post-image-file').files;
    previewContainer.innerHTML = ''; // Clear previous previews

    if (files.length > 5) {
        showToast('Puedes seleccionar un máximo de 5 imágenes.', 'warning');
        document.getElementById('edit-post-image-file').value = '';
        return;
    }

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '100px';
            img.style.maxHeight = '100px';
            img.style.margin = '5px';
            previewContainer.appendChild(img);
        }
        reader.readAsDataURL(file);
    }
}

async function saveProductChanges(productId) {
    const title = document.getElementById('edit-post-title').value.trim();
    const description = document.getElementById('edit-post-description').value.trim();
    const exchangeFor = document.getElementById('edit-post-exchange-for').value.trim();
    const imageFiles = document.getElementById('edit-post-image-file').files;
    
    const existingImages = Array.from(document.querySelectorAll('input[name="existingImages"]:checked')).map(cb => cb.value);

    if (!title || !description) {
        showToast('Título y descripción son obligatorios', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('exchangeFor', exchangeFor);
    
    existingImages.forEach(img => {
        formData.append('existingImages', img);
    });

    if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
            formData.append('images', imageFiles[i]);
        }
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/products/${productId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: formData
        });

        if (response.ok) {
            showToast('Publicación actualizada con éxito', 'success');
            closeProductDetailsModal();
            loadProductFeed();
        } else {
            const data = await response.json();
            showToast(data.msg || 'Error al actualizar', 'error');
        }
    } catch (error) {
        showToast('Error de red al actualizar', 'error');
    }
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
            logout();
        }
    } catch (error) {
        logout();
    }
}

function startTokenRefreshLoop() {
    stopTokenRefreshLoop();
    refreshIntervalId = setInterval(attemptTokenRefresh, 15 * 60 * 1000);
}

function stopTokenRefreshLoop() {
    clearInterval(refreshIntervalId);
}

// --- 3. AUTENTICACIÓN (REST) ---

async function handleAuth(endpoint) {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const body = { email, password };
    if (endpoint === 'register') body.name = name;

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
            updateAuthOutput(`${endpoint.charAt(0).toUpperCase() + endpoint.slice(1)} exitoso!`);
            startTokenRefreshLoop();
            requestNotificationPermission();
            showInterface('chat-interface');
            switchTab('feed');
            connectChat();
        } else {
            updateAuthOutput(data.msg || 'Error desconocido', true);
        }
    } catch (error) {
        updateAuthOutput(`Error de conexión: ${error.message}`, true);
    }
}

function registerUser() { handleAuth('register'); }
function loginUser() { handleAuth('login'); }

function logout() {
    currentToken = '';
    localStorage.removeItem('jwtToken');
    stopTokenRefreshLoop();
    if (socket && socket.connected) socket.disconnect();
    showInterface('auth-interface');
}

// --- 4. LÓGICA DE FEED Y LISTAS ---

async function loadProductFeed() {
    const feedDiv = document.getElementById('product-feed-list');
    feedDiv.innerHTML = `<p>Cargando productos...</p>`;
    if (!currentToken) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/products`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (response.status === 401) return logout();
        const products = await response.json();
        userOwnProducts = products.filter(p => p.owner._id === currentUserId);
        feedDiv.innerHTML = '';
        products.forEach(product => {
            if (product.owner._id === currentUserId || product.exchangeStatus === 'ACTIVE') {
                localConnectedUsers[product.owner._id] = { id: product.owner._id, name: product.owner.name };
                feedDiv.appendChild(createProductCard(product));
            }
        });
    } catch (error) {
        feedDiv.innerHTML = `<p style="color:red;">Error de red al cargar el feed.</p>`;
    }
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('onclick', `openProductDetailsModal('${product._id}')`);
    const imageUrl = product.imageUrls && product.imageUrls.length > 0 
        ? `${BACKEND_URL}${product.imageUrls[0]}` 
        : 'https://via.placeholder.com/300x150?text=Sin+Imagen';
    const isOwner = product.owner._id === currentUserId;

    let actionButton = '';
    if (isOwner) {
        actionButton = `<button disabled>Es tu publicación</button>`;
    } else {
        actionButton = `<button onclick="event.stopPropagation(); handleChatInitiation('${product.owner._id}', '${product.owner.name}', '${product._id}')">Proponer Intercambio</button>`;
    }

    card.innerHTML = `
        <img src="${imageUrl}" alt="${product.title}">
        <h4>${product.title}</h4>
        <p>${product.description}</p>
        <p><small>Busca: ${product.exchangeFor}</small></p>
        <p><small>Publicado por: <strong>${isOwner ? 'Tú' : product.owner.name}</strong></small></p>
        <div class="card-actions">
            ${actionButton}
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
            li.onclick = () => selectRecipient(user.id, user.name);
            const unread = unreadMessagesCount[user.id] || 0;
            li.innerHTML = `
                <strong>${user.name}</strong>
                ${unread > 0 ? `<span class="badge">${unread}</span>` : ''}
            `;
            list.appendChild(li);
        });
}

async function loadProposalsFeed() {
    const proposalsDiv = document.getElementById('proposals-list');
    proposalsDiv.innerHTML = `<p>Cargando propuestas...</p>`;
    if (!currentToken) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/exchanges/profile`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (response.status === 401) return logout();
        const exchanges = await response.json();
        proposalsDiv.innerHTML = '';
        hasNewProposals = exchanges.some(e => e.status === 'PENDING' && e.owner._id === currentUserId);
        updateTabBadge('proposals');
        if (exchanges.length === 0) {
            proposalsDiv.innerHTML = `<p>No tienes propuestas.</p>`;
            return;
        }
        exchanges.forEach(exchange => {
            proposalsDiv.appendChild(createProposalCard(exchange));
        });
    } catch (error) {
        proposalsDiv.innerHTML = `<p style="color:red;">Error de red al cargar propuestas.</p>`;
    }
}

function createProposalCard(exchange) {
    const card = document.createElement('div');
    card.className = 'proposal-card';
    const isOwner = exchange.owner._id === currentUserId;
    const actionText = isOwner ? 'Propuesta Recibida' : 'Propuesta Enviada';
    const otherParty = isOwner ? exchange.interestedParty.name : exchange.owner.name;

    let actionButtons = '';
    if (isOwner && exchange.status === 'PENDING') {
        actionButtons = `
            <button class="btn-success" onclick="handleAcceptReject('accept', '${exchange.product._id}', '${exchange.interestedParty._id}', '${exchange.product.title}')">Aceptar</button>
            <button class="btn-danger" onclick="handleAcceptReject('reject', '${exchange.product._id}', '${exchange.interestedParty._id}', '${exchange.product.title}')">Rechazar</button>
        `;
    }

    card.innerHTML = `
        <h4>${actionText}</h4>
        <p><strong>Tu producto:</strong> ${exchange.product.title}</p>
        <p><strong>Producto ofrecido:</strong> ${exchange.offeredProduct.title}</p>
        <p><small>De: ${otherParty}</small></p>
        <p><strong>Estado:</strong> ${exchange.status}</p>
        <div class="card-actions">
            ${actionButtons}
        </div>
    `;
    return card;
}

// --- 5. LÓGICA DE PUBLICACIÓN Y CHAT ---

async function submitNewPost() {
    const title = document.getElementById('post-title').value.trim();
    const description = document.getElementById('post-description').value.trim();
    const exchangeFor = document.getElementById('post-exchange-for').value.trim();
    const imageFiles = document.getElementById('post-image-file').files;
    if (!title || !description) {
        showToast('Título y descripción son obligatorios', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('exchangeFor', exchangeFor);
    if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
            formData.append('images', imageFiles[i]);
        }
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/products`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: formData
        });
        if (response.ok) {
            showToast('Publicación creada con éxito', 'success');
            closePostModal();
            loadProductFeed();
        } else {
            const data = await response.json();
            showToast(data.msg || 'Error al publicar', 'error');
        }
    } catch (error) {
        showToast('Error de red al publicar', 'error');
    }
}

function handleChatInitiation(recipientId, recipientName, productId) {
    if (userOwnProducts.length === 0) {
        showToast("Debes tener al menos un producto para proponer un intercambio.", 'warning');
        return;
    }
    openPostModal(false);
    document.getElementById('modal-title').textContent = 'Proponer Intercambio';
    const formContent = document.getElementById('post-form-content');
    formContent.innerHTML = `
        <p>Selecciona tu producto para ofrecer a ${recipientName}:</p>
        <select id="offered-product-select">
            ${userOwnProducts.map(p => `<option value="${p._id}">${p.title}</option>`).join('')}
        </select>
        <button onclick="submitProposal('${recipientId}', '${productId}')">Enviar Propuesta</button>
    `;
}

async function submitProposal(ownerId, productId) {
    const offeredProductId = document.getElementById('offered-product-select').value;
    if (!offeredProductId) {
        showToast('Debes seleccionar un producto para ofrecer', 'error');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/exchanges/propose`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ productId, ownerId, offeredProductId })
        });
        const data = await response.json();
        if (response.ok) {
            showToast('Propuesta enviada con éxito', 'success');
            closePostModal();
            loadProposalsFeed();
        } else {
            showToast(data.msg || 'Error al enviar la propuesta', 'error');
        }
    } catch (error) {
        showToast('Error de red al enviar la propuesta', 'error');
    }
}

async function handleAcceptReject(action, productId, interestedPartyId, productName) {
    if (!confirm(`¿Estás seguro de que quieres ${action === 'accept' ? 'aceptar' : 'rechazar'} esta propuesta?`)) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/exchanges/${productId}/${interestedPartyId}/${action}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        if (response.ok) {
            showToast(`Propuesta ${action === 'accept' ? 'aceptada' : 'rechazada'}`, 'success');
            loadProposalsFeed();
            loadProductFeed();
        } else {
            showToast(data.msg || 'Error en la operación', 'error');
        }
    } catch (error) {
        showToast('Error de red', 'error');
    }
}

async function selectRecipient(userId, userName) {
    activeRecipientId = userId;
    document.querySelectorAll('#connected-users-list li').forEach(li => li.classList.remove('selected'));
    document.querySelector(`#user-${userId}`).classList.add('selected');

    if (unreadMessagesCount[userId]) {
        delete unreadMessagesCount[userId];
        updateTabBadge('contacts');
    }

    const chatView = document.getElementById('chat-view');
    document.querySelectorAll('.main-content .tab-content').forEach(c => c.style.display = 'none');
    chatView.style.display = 'flex';
    if (window.innerWidth <= 768) {
        chatView.classList.add('open');
    }

    document.getElementById('recipient-name-display').textContent = userName;
    document.getElementById('message-input').disabled = false;
    document.querySelector('.send-button').disabled = false;
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = `<p>Cargando historial con ${userName}...</p>`;

    try {
        const response = await fetch(`${BACKEND_URL}/api/chat/history/${userId}`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const history = await response.json();
        chatMessages.innerHTML = '';
        if (response.ok) {
            history.forEach(msg => addChatMessage(msg.message, msg.senderId, msg.timestamp));
        } else {
            chatMessages.innerHTML = `<p style="color:red;">Error al cargar el historial.</p>`;
        }
    } catch (error) {
        chatMessages.innerHTML = `<p style="color:red;">Error de red al cargar el historial.</p>`;
    }
}

function addChatMessage(message, senderId, timestamp) {
    const chatMessages = document.getElementById('chat-messages');
    const isSent = senderId === currentUserId;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    const time = new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div>${message}</div>
        <div class="message-info">${time}</div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function connectChat() {
    if (!currentToken) return;
    socket = io(BACKEND_URL, { query: { token: currentToken } });

    socket.on('connect', () => updateSocketStatus(true));
    socket.on('disconnect', () => updateSocketStatus(false));
    socket.on('connect_error', (err) => {
        if (err.message.includes('token')) logout();
    });

    socket.on('usersList', (users) => {
        users.forEach(user => localConnectedUsers[user.id] = user);
        renderUsersList();
    });

    socket.on('userConnected', (user) => {
        localConnectedUsers[user.id] = user;
        renderUsersList();
        showToast(`${user.name} se ha conectado.`);
    });

    socket.on('userDisconnected', (userId) => {
        const userName = localConnectedUsers[userId]?.name || 'Alguien';
        delete localConnectedUsers[userId];
        renderUsersList();
        showToast(`${userName} se ha desconectado.`);
    });

    socket.on('newMessage', (data) => {
        if (data.senderId === activeRecipientId) {
            addChatMessage(data.message, data.senderId, data.timestamp);
        } else if (data.senderId !== currentUserId) {
            unreadMessagesCount[data.senderId] = (unreadMessagesCount[data.senderId] || 0) + 1;
            updateTabBadge('contacts');
            showNotification(localConnectedUsers[data.senderId]?.name, data.message);
        }
    });
}

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    if (!message || !activeRecipientId) return;

    const messageData = { recipientId: activeRecipientId, message };
    socket.emit('sendMessage', messageData);
    addChatMessage(message, currentUserId, new Date().toISOString());
    messageInput.value = '';
}

// --- 6. SETUP INICIAL ---

document.addEventListener('DOMContentLoaded', () => {
    if (currentToken) {
        try {
            const payload = JSON.parse(atob(currentToken.split('.')[1]));
            currentUserId = payload.user.id;
            document.getElementById('current-user-id').textContent = currentUserId.substring(0, 8) + '...';
            showInterface('chat-interface');
            startTokenRefreshLoop();
            requestNotificationPermission();
            switchTab('feed');
            connectChat();
        } catch (e) {
            logout();
        }
    } else {
        showInterface('auth-interface');
    }

    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    document.getElementById('back-to-list').addEventListener('click', () => {
        document.getElementById('chat-view').classList.remove('open');
        activeRecipientId = null;
    });
});
