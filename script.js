// script.js - Main Application Logic (Device Auth Mode)

console.log("Loading script.js...");

// --- App State ---
const AppState = {
    userId: null,
    profileId: null,
    passphrase: null,
    currentRoomId: null,
    currentRoomType: null,
    messages: [],
    lastSentTime: 0,
    isRegistering: true,
    realtimeChannel: null
};

// --- UI Elements ---
const UI = {
    // Auth
    authModal: document.getElementById('auth-modal'),
    authTitle: document.getElementById('auth-title'),
    authIdInput: document.getElementById('auth-id-input'),
    authPassInput: document.getElementById('auth-pass-input'),
    authActionBtn: document.getElementById('auth-action-btn'),
    authToggle: document.getElementById('auth-toggle'),
    
    // Search
    searchModal: document.getElementById('search-modal'),
    searchInput: document.getElementById('search-input'),
    searchActionBtn: document.getElementById('search-action-btn'),
    searchCloseBtn: document.getElementById('search-close-btn'),
    searchResult: document.getElementById('search-result'),
    
    // Settings
    settingsModal: document.getElementById('settings-modal'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsCloseBtn: document.getElementById('settings-close-btn'),
    clearMessagesBtn: document.getElementById('clear-messages-btn'),
    exportKeysBtn: document.getElementById('export-keys-btn'),
    
    // Sidebar
    menuBtn: document.getElementById('menu-btn'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    logoutBtn: document.getElementById('logout-btn'),
    userName: document.getElementById('user-name'),
    userAvatar: document.getElementById('user-avatar'),
    dmSlots: document.getElementById('dm-slots'),
    gcSlots: document.getElementById('gc-slots'),
    addDmBtn: document.getElementById('add-dm-btn'),
    addGcBtn: document.getElementById('add-gc-btn'),
    dmCount: document.getElementById('dm-count'),
    gcCount: document.getElementById('gc-count'),
    searchBtn: document.getElementById('search-btn'),
    
    // Chat
    chatHeader: document.getElementById('chat-header'),
    chatName: document.getElementById('chat-name'),
    chatStatus: document.getElementById('chat-status'),
    chatAvatar: document.getElementById('chat-avatar'),
    messageList: document.getElementById('message-list'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    cooldownTimer: document.getElementById('cooldown-timer'),
    syncStatus: document.getElementById('sync-status'),
    chatOptions: document.getElementById('chat-options')
};

// --- Initialize App ---
async function init() {
    console.log("🚀 Gist v2.0 Initializing (Device Auth)...");
    
    // Check existing session
    const savedUserId = localStorage.getItem(CONFIG.LS_KEYS.USER_ID);
    const savedPass = localStorage.getItem(CONFIG.LS_KEYS.USER_PASS);
    
    if (savedUserId && savedPass) {
        // Auto-login with device auth
        AppState.userId = savedUserId;
        AppState.passphrase = savedPass;
        await loadSession();
    } else {
        // Show auth modal
        showAuthModal();
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Start cooldown timer loop
    setInterval(updateCooldownVisual, 1000);
    
    console.log("✅ Gist Ready");
}

// --- Auth Flow ---
function showAuthModal() {
    UI.authModal.style.display = 'flex';
    updateAuthMode();
}

function updateAuthMode() {
    UI.authTitle.textContent = AppState.isRegistering ? "Create Account" : "Welcome Back";
    UI.authIdInput.style.display = AppState.isRegistering ? 'block' : 'none';
    UI.authActionBtn.textContent = AppState.isRegistering ? "Register" : "Login";
    UI.authToggle.textContent = AppState.isRegistering ? "Have an account? Login" : "Need an account? Register";
}

UI.authToggle.addEventListener('click', () => {
    AppState.isRegistering = !AppState.isRegistering;
    updateAuthMode();
});

UI.authActionBtn.addEventListener('click', async () => {
    const userId = UI.authIdInput.value.trim().toUpperCase();
    const passphrase = UI.authPassInput.value;
    
    if (!passphrase) {
        alert("Passphrase required");
        return;
    }
    
    if (AppState.isRegistering && !userId) {
        alert("User ID required");
        return;
    }
    
    UI.authActionBtn.disabled = true;
    UI.authActionBtn.textContent = "Processing...";
    
    try {
        if (AppState.isRegistering) {
            await DB.register(userId, passphrase);
        } else {
            await DB.login(userId, passphrase);
        }
        
        AppState.userId = userId || AppState.userId;
        AppState.passphrase = passphrase;
        
        UI.authModal.style.display = 'none';
        await loadSession();
    } catch (error) {
        alert(error.message);
        UI.authActionBtn.disabled = false;
        UI.authActionBtn.textContent = AppState.isRegistering ? "Register" : "Login";
    }
});

async function loadSession() {
    // Update UI with user info
    UI.userName.textContent = AppState.userId;
    UI.userAvatar.textContent = AppState.userId.charAt(0);
    
    // Load active slots
    renderSlots();
    
    // Update sync status
    updateSyncStatus('online');
    
    // Enable input
    UI.messageInput.disabled = false;
    updateSendButton(0);
}

// --- Event Listeners ---
function setupEventListeners() {
    // Mobile menu
    UI.menuBtn.addEventListener('click', toggleSidebar);
    UI.sidebarOverlay.addEventListener('click', toggleSidebar);
    
    // Logout
    UI.logoutBtn.addEventListener('click', async () => {
        if (confirm("Logout? This will clear local data but keep your keys.")) {
            await DB.logout();
            location.reload();
        }
    });
    
    // Add slots
    UI.addDmBtn.addEventListener('click', () => promptNewSlot('dm'));
    UI.addGcBtn.addEventListener('click', () => promptNewSlot('gc'));
    
    // Search
    UI.searchBtn.addEventListener('click', () => {
        UI.searchModal.style.display = 'flex';
        toggleSidebar(false);
    });
    
    UI.searchCloseBtn.addEventListener('click', () => {
        UI.searchModal.style.display = 'none';
        UI.searchResult.textContent = '';
    });
    
    UI.searchActionBtn.addEventListener('click', handleSearch);
    
    // Settings
    UI.settingsBtn.addEventListener('click', () => {
        UI.settingsModal.style.display = 'flex';
        toggleSidebar(false);
    });
    
    UI.settingsCloseBtn.addEventListener('click', () => {
        UI.settingsModal.style.display = 'none';
    });
    
    UI.clearMessagesBtn.addEventListener('click', () => {
        if (confirm("Clear all local messages? This won't delete from server.")) {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(CONFIG.LS_KEYS.MESSAGES_CACHE)) {
                    localStorage.removeItem(key);
                }
            });
            alert("Local cache cleared");
        }
    });
    
    UI.exportKeysBtn.addEventListener('click', () => {
        const privateKey = localStorage.getItem('gist_private_key');
        if (privateKey) {
            const blob = new Blob([JSON.stringify({
                userId: AppState.userId,
                privateKey: privateKey
            }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gist-keys-${AppState.userId}.json`;
            a.click();
        } else {
            alert("No keys found");
        }
    });
    
    // Send message
    UI.sendBtn.addEventListener('click', handleSend);
    UI.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !UI.sendBtn.disabled) {
            handleSend();
        }
    });
    
    // Chat options (delete for everyone)
    UI.chatOptions.addEventListener('click', () => {
        if (AppState.currentRoomId && confirm("Delete all messages in this chat?")) {
            deleteAllMessages();
        }
    });
    
    // Keyboard handling for mobile
    setupKeyboardHandling();
}

// --- Sidebar ---
function toggleSidebar(forceOpen) {
    const isOpen = UI.sidebar.classList.contains('open');
    const shouldOpen = forceOpen !== undefined ? forceOpen : !isOpen;
    
    if (shouldOpen) {
        UI.sidebar.classList.add('open');
        UI.sidebarOverlay.classList.add('show');
    } else {
        UI.sidebar.classList.remove('open');
        UI.sidebarOverlay.classList.remove('show');
    }
}

// --- Slots ---
function renderSlots() {
    const activeDms = JSON.parse(localStorage.getItem(CONFIG.LS_KEYS.ACTIVE_DMS) || '[]');
    const activeGcs = JSON.parse(localStorage.getItem(CONFIG.LS_KEYS.ACTIVE_GCS) || '[]');
    
    // Update counts
    UI.dmCount.textContent = `${activeDms.length}/${CONFIG.MAX_DM_SLOTS}`;
    UI.gcCount.textContent = `${activeGcs.length}/${CONFIG.MAX_GC_SLOTS}`;
    
    // Render DM slots
    UI.dmSlots.innerHTML = '';
    activeDms.forEach((room, index) => {
        const slot = createSlotElement(room, 'dm', index);
        UI.dmSlots.appendChild(slot);
    });
    
    // Render GC slots
    UI.gcSlots.innerHTML = '';
    activeGcs.forEach((room, index) => {
        const slot = createSlotElement(room, 'gc', index);
        UI.gcSlots.appendChild(slot);
    });
}

function createSlotElement(room, type, index) {
    const slot = document.createElement('div');
    slot.className = 'slot-item';
    if (AppState.currentRoomId === room.id) slot.classList.add('active');
    
    const name = room.name || `Chat ${index + 1}`;
    const avatar = name.charAt(0).toUpperCase();
    
    slot.innerHTML = `
        <div class="slot-avatar">${avatar}</div>
        <div class="slot-info">
            <div class="slot-name">${name}</div>
            <div class="slot-preview">Tap to open</div>
        </div>
        <button class="slot-remove" data-index="${index}" data-type="${type}">×</button>
    `;
    
    slot.addEventListener('click', (e) => {
        if (!e.target.classList.contains('slot-remove')) {
            loadRoom(room);
        }
    });
    
    slot.querySelector('.slot-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeSlot(room.id, type, index);
    });
    
    return slot;
}

async function promptNewSlot(type) {
    const max = type === 'dm' ? CONFIG.MAX_DM_SLOTS : CONFIG.MAX_GC_SLOTS;
    const active = JSON.parse(localStorage.getItem(
        type === 'dm' ? CONFIG.LS_KEYS.ACTIVE_DMS : CONFIG.LS_KEYS.ACTIVE_GCS
    ) || '[]');
    
    if (active.length >= max) {
        alert(`Maximum ${max} ${type === 'dm' ? 'direct messages' : 'groups'} allowed`);
        return;
    }
    
    const searchId = prompt(`Enter User ID to ${type === 'dm' ? 'chat with' : 'invite'}:`);
    if (!searchId) return;
    
    const targetUserId = searchId.trim().toUpperCase();
    
    // Validate ID format
    if (!/^[A-Z][0-9]+$/.test(targetUserId)) {
        alert("Invalid User ID format. Must be Letter+Number (e.g. A1)");
        return;
    }
    
    // Can't chat with yourself
    if (targetUserId === AppState.userId) {
        alert("You can't chat with yourself!");
        return;
    }
    
    // Check if already in slots
    const exists = active.find(slot => slot.name === targetUserId);
    if (exists) {
        alert("Already in your chat list!");
        return;
    }
    
    // Show loading
    alert("Searching for user and creating room...");
    
    try {
        // Search for the user
        const targetProfile = await DB.searchUser(targetUserId);
        
        if (!targetProfile) {
            alert(`User ${targetUserId} not found!`);
            return;
        }
        
        // Convert 'dm' to '1v1' for database
        const room = await DB.createRoom(type === 'dm' ? '1v1' : 'gc', [targetProfile.id]);
        
        // Add to local storage
        const roomData = {
            id: room.id,
            name: targetUserId,
            type: type === 'dm' ? '1v1' : 'gc',
            participantId: targetProfile.id
        };
        
        active.push(roomData);
        localStorage.setItem(
            type === 'dm' ? CONFIG.LS_KEYS.ACTIVE_DMS : CONFIG.LS_KEYS.ACTIVE_GCS,
            JSON.stringify(active)
        );
        
        // Refresh slots and open chat
        renderSlots();
        loadRoom(roomData);
        
        alert(`✅ Chat created with ${targetUserId}!`);
        
    } catch (error) {
        console.error("Failed to create room:", error);
        alert("Failed to create chat: " + error.message);
    }
    
    toggleSidebar(false);
}

function removeSlot(roomId, type, index) {
    if (!confirm("Remove this chat?")) return;
    
    const key = type === 'dm' ? CONFIG.LS_KEYS.ACTIVE_DMS : CONFIG.LS_KEYS.ACTIVE_GCS;
    const active = JSON.parse(localStorage.getItem(key) || '[]');
    active.splice(index, 1);
    localStorage.setItem(key, JSON.stringify(active));
    
    if (AppState.currentRoomId === roomId) {
        AppState.currentRoomId = null;
        UI.messageList.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">💬</div>
                <h2>Welcome to Gist</h2>
                <p>Encrypted. Private. Yours.</p>
            </div>
        `;
        UI.chatName.textContent = 'Select a chat';
        UI.chatStatus.textContent = '--';
        UI.messageInput.disabled = true;
        updateSendButton(0);
    }
    
    renderSlots();
}

// --- Search ---
async function handleSearch() {
    const searchId = UI.searchInput.value.trim().toUpperCase();
    if (!searchId) return;
    
    UI.searchActionBtn.disabled = true;
    UI.searchActionBtn.textContent = "Searching...";
    
    try {
        const result = await DB.searchUser(searchId);
        
        if (result) {
            UI.searchResult.innerHTML = `
                <div class="search-result found">
                    <strong>✅ Found:</strong> ${result.user_id}<br>
                    <small>Joined: ${new Date(result.created_at).toLocaleDateString()}</small>
                </div>
            `;
        } else {
            UI.searchResult.innerHTML = `
                <div class="search-result not-found">
                    <strong>❌ Not Found:</strong> ${searchId}
                </div>
            `;
        }
    } catch (error) {
        UI.searchResult.innerHTML = `
            <div class="search-result not-found">
                <strong>❌ Error:</strong> ${error.message}
            </div>
        `;
    }
    
    UI.searchActionBtn.disabled = false;
    UI.searchActionBtn.textContent = "Search";
}

// --- Room Loading ---
async function loadRoom(room) {
    AppState.currentRoomId = room.id;
    AppState.currentRoomType = room.type;
    AppState.messages = [];
    
    // Update header
    UI.chatName.textContent = room.name || 'Chat';
    UI.chatStatus.textContent = room.type === 'gc' ? 'Group Chat' : 'Direct Message';
    UI.chatAvatar.textContent = (room.name || 'C').charAt(0).toUpperCase();
    UI.messageInput.disabled = false;
    updateSendButton(0);
    
    // Clear message list
    UI.messageList.innerHTML = '<div class="system-msg">Loading messages...</div>';
    
    // Load from cache first (instant)
    const cached = DB.getMessagesCache(room.id);
    if (cached) {
        AppState.messages = cached.messages;
        renderMessages(cached.messages, false);
        updateSyncStatus('cached');
    }
    
    // Fetch new messages from Supabase
    const lastSync = DB.getLastSync(room.id);
    try {
        const newMessages = await DB.getMessages(room.id, lastSync);
        
        // Merge with existing
        const existingIds = new Set(AppState.messages.map(m => m.id));
        const messagesToRender = newMessages.filter(m => !existingIds.has(m.id));
        
        AppState.messages = [...AppState.messages, ...newMessages];
        
        if (messagesToRender.length > 0) {
            renderMessages(messagesToRender, true);
        }
        
        // Update cache
        DB.saveMessagesCache(room.id, AppState.messages);
        DB.setLastSync(room.id, Date.now().toString());
        
        updateSyncStatus('online');
    } catch (error) {
        console.error("Failed to fetch messages:", error);
        updateSyncStatus('error');
    }
    
    // Setup realtime subscription
    if (AppState.realtimeChannel) {
        AppState.realtimeChannel.unsubscribe();
    }
    
    AppState.realtimeChannel = DB.subscribeToRoom(room.id, (payload) => {
        handleRealtimeMessage(payload);
    });
    
    // Close sidebar on mobile
    toggleSidebar(false);
}

// --- Realtime Messages ---
function handleRealtimeMessage(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'INSERT' && newRecord.room_id === AppState.currentRoomId) {
        const message = {
            id: newRecord.id,
            content: newRecord.content,
            iv: newRecord.iv,
            salt: newRecord.salt,
            sender_id: newRecord.sender_id,
            created_at: newRecord.created_at,
            profiles: { user_id: 'Unknown' }
        };
        
        AppState.messages.push(message);
        renderMessages([message], true);
        DB.saveMessagesCache(AppState.currentRoomId, AppState.messages);
    }
    
    if (eventType === 'UPDATE' && newRecord.is_deleted) {
        const msgElement = document.querySelector(`[data-message-id="${newRecord.id}"]`);
        if (msgElement) {
            msgElement.remove();
        }
    }
}

// --- Message Rendering ---
function renderMessages(messages, isNew) {
    if (isNew) {
        UI.messageList.querySelector('.welcome-message')?.remove();
        UI.messageList.querySelector('.system-msg')?.remove();
    } else {
        UI.messageList.innerHTML = '';
    }
    
    messages.forEach(msg => {
        const messageEl = createMessageElement(msg);
        UI.messageList.appendChild(messageEl);
    });
    
    scrollToBottom();
}

function createMessageElement(msg) {
    const isMe = msg.sender_id === DB.profileId;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const el = document.createElement('div');
    el.className = `message ${isMe ? 'me' : 'other'}`;
    el.dataset.messageId = msg.id;
    
    el.innerHTML = `
        <div class="message-bubble blurred">${isMe ? '[Sent]' : '[Received]'}</div>
        <div class="message-meta">
            <span class="message-time">${time}</span>
            ${isMe ? `<button class="message-delete" data-id="${msg.id}">Delete</button>` : ''}
        </div>
    `;
    
    // Click to decrypt
    const bubble = el.querySelector('.message-bubble');
    bubble.addEventListener('click', async () => {
        if (bubble.classList.contains('blurred')) {
            const decrypted = await CryptoModule.decrypt({
                content: msg.content,
                iv: msg.iv,
                salt: msg.salt
            }, AppState.passphrase);
            bubble.textContent = decrypted;
            bubble.classList.remove('blurred');
        }
    });
    
    // Delete button - COMPLETED VERSION
    const deleteBtn = el.querySelector('.message-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm("Delete for everyone?")) {
                try {
                    await DB.deleteMessage(msg.id);
                    el.remove();
                } catch (error) {
                    alert("Failed to delete: " + error.message);
                }
            }
        });
    }
    
    return el;
}

function scrollToBottom() {
    setTimeout(() => {
        UI.messageList.scrollTo({
            top: UI.messageList.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}

// --- Send Message ---
async function handleSend() {
    const text = UI.messageInput.value.trim();
    if (!text || !AppState.currentRoomId) {
        if (!AppState.currentRoomId) {
            alert("Select a chat first");
        }
        return;
    }
    
    // Check cooldown
    const now = Date.now();
    const timePassed = now - AppState.lastSentTime;
    
    if (timePassed < CONFIG.COOLDOWN_MS) {
        const remaining = Math.ceil((CONFIG.COOLDOWN_MS - timePassed) / 1000);
        updateSendButton(remaining);
        return;
    }
    
    // Encrypt
    const encrypted = await CryptoModule.encrypt(text, AppState.passphrase);
    
    // Send to Supabase
    UI.sendBtn.disabled = true;
    updateSyncStatus('sending...');
    
    try {
        const message = await DB.sendMessage(
            AppState.currentRoomId,
            encrypted.content,
            encrypted.iv,
            encrypted.salt
        );
        
        // Add to local state
        message.profiles = { user_id: AppState.userId };
        AppState.messages.push(message);
        AppState.lastSentTime = now;
        
        // Render
        renderMessages([message], true);
        DB.saveMessagesCache(AppState.currentRoomId, AppState.messages);
        
        // Clear input
        UI.messageInput.value = '';
        updateSyncStatus('online');
        updateSendButton(0);
    } catch (error) {
        alert("Failed to send: " + error.message);
        updateSyncStatus('error');
        updateSendButton(0);
    }
}

// --- Cooldown Timer ---
function updateCooldownVisual() {
    if (AppState.lastSentTime === 0) return;
    
    const now = Date.now();
    const timePassed = now - AppState.lastSentTime;
    
    if (timePassed < CONFIG.COOLDOWN_MS) {
        const remaining = Math.ceil((CONFIG.COOLDOWN_MS - timePassed) / 1000);
        updateSendButton(remaining);
    } else {
        updateSendButton(0);
    }
}

function updateSendButton(remainingSeconds) {
    const canSend = AppState.currentRoomId && remainingSeconds <= 0;
    
    UI.sendBtn.disabled = !canSend;
    
    if (remainingSeconds > 0) {
        UI.cooldownTimer.textContent = `${remainingSeconds}s`;
        UI.sendBtn.querySelector('svg').style.opacity = '0.5';
    } else {
        UI.cooldownTimer.textContent = '';
        UI.sendBtn.querySelector('svg').style.opacity = canSend ? '1' : '0.5';
    }
}

// --- Sync Status ---
function updateSyncStatus(status) {
    const dot = UI.syncStatus.querySelector('.status-dot');
    const text = UI.syncStatus.querySelector('.status-text');
    
    UI.syncStatus.classList.remove('online');
    
    switch (status) {
        case 'online':
            UI.syncStatus.classList.add('online');
            text.textContent = 'Online';
            dot.style.background = 'var(--success)';
            break;
        case 'cached':
            text.textContent = 'Cached';
            dot.style.background = 'var(--warning)';
            break;
        case 'sending...':
            text.textContent = 'Sending...';
            dot.style.background = 'var(--accent)';
            break;
        case 'error':
            text.textContent = 'Error';
            dot.style.background = 'var(--danger)';
            break;
        default:
            text.textContent = 'Offline';
            dot.style.background = 'var(--text-muted)';
    }
}

// --- Keyboard Handling (Mobile) ---
function setupKeyboardHandling() {
    UI.messageInput.addEventListener('focus', () => {
        setTimeout(() => {
            UI.messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            scrollToBottom();
        }, 300);
    });
    
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const keyboardHeight = window.innerHeight - window.visualViewport.height;
            if (keyboardHeight > 100) {
                UI.messageList.style.paddingBottom = `${keyboardHeight + 80}px`;
            } else {
                UI.messageList.style.paddingBottom = '80px';
            }
        });
    }
}

// --- Delete All Messages (Room) ---
async function deleteAllMessages() {
    if (!AppState.currentRoomId) return;
    
    try {
        AppState.messages = [];
        UI.messageList.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">🗑️</div>
                <h2>Chat Cleared</h2>
                <p>All local messages deleted</p>
            </div>
        `;
        DB.saveMessagesCache(AppState.currentRoomId, []);
    } catch (error) {
        alert("Failed to clear: " + error.message);
    }
}

// --- Start App ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log("✅ script.js Loaded (Device Auth Mode)");
