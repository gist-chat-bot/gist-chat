// script.js

const AppState = {
    passphrase: null,
    currentGistId: null,
    currentGistSha: null,
    messages: [],
    userId: null,
    lastSentTime: 0,
    isRegistering: false
};

const UI = {
    authModal: document.getElementById('auth-modal'),
    authTitle: document.getElementById('auth-title'),
    authIdInput: document.getElementById('auth-id-input'),
    authPassInput: document.getElementById('auth-pass-input'),
    authActionBtn: document.getElementById('auth-action-btn'),
    authToggle: document.getElementById('auth-toggle'),
    searchModal: document.getElementById('search-modal'),
    searchInput: document.getElementById('search-input'),
    searchActionBtn: document.getElementById('search-action-btn'),
    searchCloseBtn: document.getElementById('search-close-btn'),
    searchResult: document.getElementById('search-result'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    messageList: document.getElementById('message-list'),
    syncStatus: document.getElementById('sync-status'),
    menuToggle: document.getElementById('menu-toggle'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    chatHeader: document.getElementById('chat-header'),
    dmSlots: document.getElementById('dm-slots'),
    gcSlots: document.getElementById('gc-slots'),
    addDmBtn: document.getElementById('add-dm-btn'),
    addGcBtn: document.getElementById('add-gc-btn'),
    myUserId: document.getElementById('my-user-id'),
    searchBtn: document.getElementById('search-btn'),
    logoutBtn: document.getElementById('logout-btn')
};

async function init() {
    console.log("Gist Initializing...");
    
    // Check existing session
    const savedId = localStorage.getItem('gist_user_id');
    if (savedId) {
        AppState.userId = savedId;
        UI.myUserId.textContent = savedId;
        showAuthModal(false); // Login mode
    } else {
        showAuthModal(true); // Register mode
    }

    // Event Listeners
    UI.authActionBtn.addEventListener('click', handleAuth);
    UI.authToggle.addEventListener('click', toggleAuthMode);
    UI.sendBtn.addEventListener('click', handleSend);
    UI.searchBtn.addEventListener('click', () => UI.searchModal.style.display = 'flex');
    UI.searchCloseBtn.addEventListener('click', () => UI.searchModal.style.display = 'none');
    UI.searchActionBtn.addEventListener('click', handleSearch);
    UI.logoutBtn.addEventListener('click', handleLogout);
    
    setupMobileMenu();
    setupKeyboardHandling();
    renderSlots();
    
    // ✅ Cooldown Loop Fix
    setInterval(updateCooldownVisual, 1000);
    setInterval(pollMessages, CONFIG.POLL_INTERVAL);
    
    console.log("Gist Ready");
}

// --- Auth Flow ---

function showAuthMode(isRegister) {
    AppState.isRegistering = isRegister;
    UI.authTitle.textContent = isRegister ? "Register ID" : "Decrypt Session";
    UI.authIdInput.style.display = isRegister ? "block" : "none";
    UI.authActionBtn.textContent = isRegister ? "Register" : "Unlock";
    UI.authToggle.textContent = isRegister ? "Have an ID? Login" : "Need an ID? Register";
}

function toggleAuthMode() {
    showAuthMode(!AppState.isRegistering);
}

function showAuthModal(show) {
    UI.authModal.style.display = show ? 'flex' : 'none';
}

async function handleAuth() {
    const passphrase = UI.authPassInput.value;
    const userId = UI.authIdInput.value.trim();

    if (!passphrase) { alert("Passphrase required"); return; }

    UI.authActionBtn.disabled = true;
    UI.authActionBtn.textContent = "Processing...";

    try {
        if (AppState.isRegistering) {
            if (!userId) { alert("User ID required"); return; }
            await Identity.register(userId, passphrase);
            AppState.userId = userId;
            UI.myUserId.textContent = userId;
        } else {
            if (!userId) { 
                // Auto-login if ID saved
                const savedId = localStorage.getItem('gist_user_id');
                if(savedId) AppState.userId = savedId;
            } else {
                AppState.userId = userId;
            }
            await Identity.login(AppState.userId, passphrase);
        }
        
        AppState.passphrase = passphrase;
        showAuthModal(false);
        UI.messageInput.disabled = false;
        updateSyncStatus("Ready");
        updateSendButton(0);
        renderSlots();
    } catch (e) {
        alert(e.message);
        UI.authActionBtn.disabled = false;
        UI.authActionBtn.textContent = AppState.isRegistering ? "Register" : "Unlock";
    }
}

// --- Search Flow ---

async function handleSearch() {
    const query = UI.searchInput.value.trim();
    if (!query) return;

    UI.searchActionBtn.disabled = true;
    UI.searchActionBtn.textContent = "Searching...";

    try {
        const result = await Identity.searchId(query);
        if (result) {
            UI.searchResult.textContent = `Found: ${query}\nProfile Gist: ${result.profileGistId}`;
            UI.searchResult.style.color = "#0f0";
        } else {
            UI.searchResult.textContent = "ID not found";
            UI.searchResult.style.color = "#f00";
        }
    } catch (e) {
        UI.searchResult.textContent = "Error: " + e.message;
    }

    UI.searchActionBtn.disabled = false;
    UI.searchActionBtn.textContent = "Search";
}

// --- Chat Flow ---

async function handleSend() {
    const text = UI.messageInput.value.trim();
    if (!text || !AppState.currentGistId) {
        if (!AppState.currentGistId) alert("Select a chat slot first");
        return;
    }
    
    const now = Date.now();
    const timePassed = now - AppState.lastSentTime;
    
    if (timePassed < CONFIG.COOLDOWN_MS) {
        const remaining = Math.ceil((CONFIG.COOLDOWN_MS - timePassed) / 1000);
        updateSendButton(remaining);
        return;
    }
    
    const encrypted = await CryptoModule.encrypt(text, AppState.passphrase);
    
    const newMessage = {
        messageId: CryptoModule.generateId(),
        senderId: AppState.userId || 'Anonymous',
        content: encrypted.content,
        iv: encrypted.iv,
        salt: encrypted.salt,
        timestamp: Date.now(),
        type: "text"
    };
    
    AppState.messages.push(newMessage);
    AppState.lastSentTime = now;
    localStorage.setItem(`last_sent_${AppState.currentGistId}`, now);
    
    renderMessage(newMessage, true);
    UI.messageInput.value = '';
    
    updateSyncStatus("Syncing...");
    await pushMessages();
    updateSyncStatus("Synced");
    updateSendButton(0);
}

// ✅ Cooldown Visual Loop
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
    const circle = UI.sendBtn.querySelector('.circle');
    const maxTime = CONFIG.COOLDOWN_MS / 1000;
    
    if (remainingSeconds > 0) {
        UI.sendBtn.disabled = true;
        const progress = (remainingSeconds / maxTime) * 100;
        circle.style.strokeDasharray = `${progress}, 100`;
        UI.sendBtn.querySelector('.send-icon').textContent = `${remainingSeconds}s`;
    } else {
        UI.sendBtn.disabled = false;
        circle.style.strokeDasharray = `100, 100`;
        UI.sendBtn.querySelector('.send-icon').textContent = '➤';
    }
}

async function pushMessages() {
    if (!AppState.currentGistId || !AppState.currentGistSha) return;
    
    const chatData = {
        type: "1v1",
        participants: [AppState.userId || 'Anonymous'],
        maxParticipants: 2,
        messages: AppState.messages
    };
    
    const result = await GitHubAPI.updateGist(AppState.currentGistId, 'messages.json', chatData, AppState.currentGistSha);
    if (result) AppState.currentGistSha = result.files['messages.json'].sha;
    else updateSyncStatus("Sync Failed");
}

async function pollMessages() {
    if (!AppState.currentGistId || !AppState.passphrase) return;
    
    const gistData = await GitHubAPI.getGist(AppState.currentGistId);
    if (!gistData) { updateSyncStatus("Error"); return; }
    
    const parsed = GitHubAPI.parseGistFile(gistData, 'messages.json');
    if (!parsed) { updateSyncStatus("Error"); return; }
    
    AppState.currentGistSha = parsed.sha;
    
    let newCount = 0;
    for (const msg of parsed.data.messages) {
        const exists = AppState.messages.find(m => m.messageId === msg.messageId);
        if (!exists) {
            AppState.messages.push(msg);
            renderMessage(msg, false);
            newCount++;
        }
    }
    
    updateSyncStatus(newCount > 0 ? `+${newCount} new` : "Synced");
}

function renderMessage(msg, isLocal) {
    const packet = document.createElement('div');
    packet.className = 'message-packet';
    const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const sender = msg.senderId || 'Unknown';
    
    packet.innerHTML = `
        <div class="packet-header"><span>[ID: ${sender}]</span><span>[${time}]</span></div>
        <div class="packet-content blurred">${isLocal ? '[Encrypted - Sent]' : '[Encrypted - Received]'}</div>
    `;
    
    const contentEl = packet.querySelector('.packet-content');
    contentEl.dataset.content = msg.content;
    contentEl.dataset.iv = msg.iv;
    contentEl.dataset.salt = msg.salt;
    
    contentEl.addEventListener('click', async function() {
        if (this.classList.contains('blurred') && AppState.passphrase) {
            const decrypted = await CryptoModule.decrypt({
                content: this.dataset.content,
                iv: this.dataset.iv,
                salt: this.dataset.salt
            }, AppState.passphrase);
            this.textContent = decrypted;
            this.classList.remove('blurred');
        }
    });
    
    UI.messageList.appendChild(packet);
    setTimeout(() => UI.messageList.scrollTo({ top: UI.messageList.scrollHeight, behavior: 'smooth' }), 50);
}

function renderSlots() {
    const activeDMs = JSON.parse(localStorage.getItem('active_contacts') || '[]');
    const activeGCs = JSON.parse(localStorage.getItem('active_groups') || '[]');
    
    UI.dmSlots.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot-box';
        if (activeDMs[i]) {
            slot.textContent = activeDMs[i].substr(0, 10);
            slot.classList.add('active');
            setupSlotEvents(slot, activeDMs[i], 'dm');
        } else {
            slot.textContent = '+';
            slot.onclick = () => promptNewChat('dm');
        }
        UI.dmSlots.appendChild(slot);
    }
    
    UI.gcSlots.innerHTML = '';
    for (let i = 0; i < 2; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot-box';
        if (activeGCs[i]) {
            slot.textContent = activeGCs[i].substr(0, 10);
            slot.classList.add('active');
            setupSlotEvents(slot, activeGCs[i], 'gc');
        } else {
            slot.textContent = '+';
            slot.onclick = () => promptNewChat('gc');
        }
        UI.gcSlots.appendChild(slot);
    }
}

function setupSlotEvents(slot, gistId, type) {
    let pressTimer;
    slot.onclick = (e) => { loadChat(gistId); };
    slot.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
            if (confirm(`Remove ${gistId}?`)) removeSlot(gistId, type);
        }, 800);
    });
    slot.addEventListener('touchend', () => clearTimeout(pressTimer));
    slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm(`Remove ${gistId}?`)) removeSlot(gistId, type);
    });
}

function removeSlot(gistId, type) {
    const key = type === 'dm' ? 'active_contacts' : 'active_groups';
    let current = JSON.parse(localStorage.getItem(key) || '[]');
    current = current.filter(id => id !== gistId);
    localStorage.setItem(key, JSON.stringify(current));
    if (AppState.currentGistId === gistId) {
        AppState.currentGistId = null;
        UI.messageList.innerHTML = '<div class="system-msg">Select a slot</div>';
        UI.chatHeader.textContent = 'Select a Slot';
        UI.messageInput.disabled = true;
    }
    renderSlots();
}

function promptNewChat(type) {
    const gistId = prompt(`Enter ${type === 'dm' ? 'Gist ID' : 'GC Gist ID'}:`);
    if (gistId) {
        const key = type === 'dm' ? 'active_contacts' : 'active_groups';
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        if (!current.includes(gistId)) {
            current.push(gistId);
            localStorage.setItem(key, JSON.stringify(current));
            renderSlots();
            loadChat(gistId);
        }
    }
}

async function loadChat(gistId) {
    AppState.currentGistId = gistId;
    AppState.messages = [];
    AppState.currentGistSha = null;
    UI.messageList.innerHTML = '<div class="system-msg">Loading...</div>';
    UI.chatHeader.textContent = `Chat: ${gistId.substr(0, 10)}...`;
    UI.messageInput.disabled = false;
    updateSyncStatus("Loading...");
    await pollMessages();
    UI.sidebar.classList.remove('open');
    UI.sidebarOverlay.classList.remove('show');
}

function handleLogout() {
    if(confirm("Logout?")) {
        localStorage.clear();
        location.reload();
    }
}

function setupMobileMenu() {
    if (!UI.menuToggle) return;
    UI.menuToggle.addEventListener('click', () => {
        UI.sidebar.classList.toggle('open');
        UI.sidebarOverlay.classList.toggle('show');
    });
    UI.sidebarOverlay.addEventListener('click', () => {
        UI.sidebar.classList.remove('open');
        UI.sidebarOverlay.classList.remove('show');
    });
}

function setupKeyboardHandling() {
    UI.messageInput.addEventListener('focus', () => {
        setTimeout(() => {
            UI.messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            UI.messageList.scrollTop = UI.messageList.scrollHeight;
        }, 300);
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const keyboardHeight = window.innerHeight - window.visualViewport.height;
            UI.messageList.style.paddingBottom = keyboardHeight > 100 ? `${keyboardHeight + 70}px` : '70px';
        });
    }
}

function updateSyncStatus(status) {
    if (UI.syncStatus) UI.syncStatus.textContent = status;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
