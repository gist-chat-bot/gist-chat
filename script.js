// script.js

// State Management
const AppState = {
    passphrase: null,
    currentGistId: null,
    currentGistSha: null,
    messages: [],
    userId: null,
    lastSentTime: 0
};

// UI Elements
const UI = {
    modal: document.getElementById('login-modal'),
    passphraseInput: document.getElementById('passphrase-input'),
    loginBtn: document.getElementById('login-btn'),
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
    myUserId: document.getElementById('my-user-id')
};

// Initialize App
async function init() {
    console.log("Gist Initializing...");
    
    // Check for existing session
    const savedId = localStorage.getItem('gist_user_id');
    if (savedId) {
        AppState.userId = savedId;
        UI.myUserId.textContent = savedId;
    }
    
    // Show login modal
    UI.modal.style.display = 'flex';
    
    // Setup Event Listeners
    UI.loginBtn.addEventListener('click', handleLogin);
    UI.sendBtn.addEventListener('click', handleSend);
    
    // Mobile menu
    setupMobileMenu();
    
    // Keyboard handling
    setupKeyboardHandling();
    
    // Render initial slots
    renderSlots();
    
    // Start Polling
    setInterval(pollMessages, CONFIG.POLL_INTERVAL);
    
    console.log("Gist Ready");
}

// Handle Login
async function handleLogin() {
    const passphrase = UI.passphraseInput.value;
    if (passphrase.length < 1) {
        alert("Passphrase required");
        return;
    }
    
    AppState.passphrase = passphrase;
    UI.modal.style.display = 'none';
    UI.messageInput.disabled = false;
    
    updateSyncStatus("Ready");
    updateSendButton(0); // ✅ Enable send button visually
    console.log("Session Unlocked");
    
    renderSlots();
}

// Handle Send Message
async function handleSend() {
    const text = UI.messageInput.value.trim();
    if (!text || !AppState.currentGistId) {
        if (!AppState.currentGistId) {
            alert("Select a chat slot first");
        }
        return;
    }
    
    // Check Cooldown
    const now = Date.now();
    const timePassed = now - AppState.lastSentTime;
    
    if (timePassed < CONFIG.COOLDOWN_MS) {
        const remaining = Math.ceil((CONFIG.COOLDOWN_MS - timePassed) / 1000);
        updateSendButton(remaining);
        return;
    }
    
    // Encrypt
    const encrypted = await CryptoModule.encrypt(text, AppState.passphrase);
    
    // Create Message Object
    const newMessage = {
        messageId: CryptoModule.generateId(),
        senderId: AppState.userId || 'Anonymous',
        content: encrypted.content,
        iv: encrypted.iv,
        salt: encrypted.salt,
        timestamp: Date.now(),
        type: "text"
    };
    
    // Update Local State
    AppState.messages.push(newMessage);
    AppState.lastSentTime = now;
    localStorage.setItem(`last_sent_${AppState.currentGistId}`, now);
    
    // Render Immediately (Optimistic)
    renderMessage(newMessage, true);
    UI.messageInput.value = '';
    
    // Push to GitHub
    updateSyncStatus("Syncing...");
    await pushMessages();
    updateSyncStatus("Synced");
    
    // Reset cooldown UI
    updateSendButton(0);
}

// Update Send Button Cooldown Visual
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

// Push Messages to Gist
async function pushMessages() {
    if (!AppState.currentGistId || !AppState.currentGistSha) return;
    
    const chatData = {
        type: "1v1",
        participants: [AppState.userId || 'Anonymous'],
        maxParticipants: 2,
        messages: AppState.messages
    };
    
    const result = await GitHubAPI.updateGist(
        AppState.currentGistId,
        'messages.json',
        chatData,
        AppState.currentGistSha
    );
    
    if (result) {
        AppState.currentGistSha = result.files['messages.json'].sha;
    } else {
        updateSyncStatus("Sync Failed");
    }
}

// Poll for New Messages
async function pollMessages() {
    if (!AppState.currentGistId || !AppState.passphrase) return;
    
    updateSyncStatus("Polling...");
    
    const gistData = await GitHubAPI.getGist(AppState.currentGistId);
    if (!gistData) {
        updateSyncStatus("Error");
        return;
    }
    
    const parsed = GitHubAPI.parseGistFile(gistData, 'messages.json');
    if (!parsed) {
        updateSyncStatus("Error");
        return;
    }
    
    AppState.currentGistSha = parsed.sha;
    
    // Decrypt and Render New Messages
    let newCount = 0;
    for (const msg of parsed.data.messages) {
        const exists = AppState.messages.find(m => m.messageId === msg.messageId);
        if (!exists) {
            AppState.messages.push(msg);
            renderMessage(msg, false);
            newCount++;
        }
    }
    
    if (newCount > 0) {
        updateSyncStatus(`+${newCount} new`);
    } else {
        updateSyncStatus("Synced");
    }
}

// Render Message to UI
function renderMessage(msg, isLocal) {
    const packet = document.createElement('div');
    packet.className = 'message-packet';
    
    const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const sender = msg.senderId || 'Unknown';
    
    packet.innerHTML = `
        <div class="packet-header">
            <span>[ID: ${sender}]</span>
            <span>[${time}]</span>
        </div>
        <div class="packet-content blurred" data-encrypted="true">
            ${isLocal ? '[Encrypted - Sent]' : '[Encrypted - Received]'}
        </div>
    `;
    
    // Store for decryption on click
    const contentEl = packet.querySelector('.packet-content');
    contentEl.dataset.content = msg.content;
    contentEl.dataset.iv = msg.iv;
    contentEl.dataset.salt = msg.salt;
    
    // Add click to decrypt
    contentEl.addEventListener('click', async function() {
        if (this.classList.contains('blurred') && AppState.passphrase) {
            const encryptedData = {
                content: this.dataset.content,
                iv: this.dataset.iv,
                salt: this.dataset.salt
            };
            const decrypted = await CryptoModule.decrypt(encryptedData, AppState.passphrase);
            this.textContent = decrypted;
            this.classList.remove('blurred');
            this.style.cursor = 'text';
        }
    });
    
    UI.messageList.appendChild(packet);
    
    // Smooth scroll to bottom
    setTimeout(() => {
        UI.messageList.scrollTo({
            top: UI.messageList.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}

// Render Slots
function renderSlots() {
    const activeDMs = JSON.parse(localStorage.getItem('active_contacts') || '[]');
    const activeGCs = JSON.parse(localStorage.getItem('active_groups') || '[]');
    
    // Render DM Slots (5 max)
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
    
    // Render GC Slots (2 max)
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

// Setup Slot Events (Tap + Long-Press Remove)
function setupSlotEvents(slot, gistId, type) {
    let pressTimer;
    
    // Tap to open
    slot.onclick = (e) => {
        loadChat(gistId);
    };
    
    // Long-press to remove (mobile)
    slot.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
            if (confirm(`Remove ${gistId} from slots?`)) {
                removeSlot(gistId, type);
            }
        }, 800);
    });
    
    slot.addEventListener('touchend', () => clearTimeout(pressTimer));
    slot.addEventListener('touchcancel', () => clearTimeout(pressTimer));
    
    // Desktop: right-click to remove
    slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm(`Remove ${gistId} from slots?`)) {
            removeSlot(gistId, type);
        }
    });
}

// Remove Contact from Slot
function removeSlot(gistId, type) {
    const key = type === 'dm' ? 'active_contacts' : 'active_groups';
    let current = JSON.parse(localStorage.getItem(key) || '[]');
    
    current = current.filter(id => id !== gistId);
    localStorage.setItem(key, JSON.stringify(current));
    
    if (AppState.currentGistId === gistId) {
        AppState.currentGistId = null;
        AppState.messages = [];
        UI.messageList.innerHTML = '<div class="system-msg">Select a slot to chat</div>';
        UI.chatHeader.textContent = 'Select a Slot';
        UI.messageInput.disabled = true;
    }
    
    renderSlots();
    console.log(`Removed ${gistId} from ${type}`);
}

// Prompt for New Chat/GC
function promptNewChat(type) {
    const gistId = prompt(`Enter ${type === 'dm' ? 'User ID or Gist ID' : 'GC Gist ID'}:`);
    if (gistId) {
        const key = type === 'dm' ? 'active_contacts' : 'active_groups';
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        if (!current.includes(gistId)) {
            current.push(gistId);
            localStorage.setItem(key, JSON.stringify(current));
            renderSlots();
            loadChat(gistId);
        } else {
            alert("Already in slots");
        }
    }
}

// Load Chat by Gist ID
async function loadChat(gistId) {
    AppState.currentGistId = gistId;
    AppState.messages = [];
    AppState.currentGistSha = null;
    UI.messageList.innerHTML = '<div class="system-msg">Loading messages...</div>';
    UI.chatHeader.textContent = `Chat: ${gistId.substr(0, 10)}...`;
    UI.messageInput.disabled = false;
    
    updateSyncStatus("Loading...");
    await pollMessages();
    
    // Close mobile sidebar if open
    UI.sidebar.classList.remove('open');
    UI.sidebarOverlay.classList.remove('show');
}

// Mobile Menu Toggle
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

// Keyboard Handling
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
            if (keyboardHeight > 100) {
                UI.messageList.style.paddingBottom = `${keyboardHeight + 70}px`;
            } else {
                UI.messageList.style.paddingBottom = '70px';
            }
        });
    }
}

// Update Sync Status
function updateSyncStatus(status) {
    if (UI.syncStatus) {
        UI.syncStatus.textContent = status;
    }
}

// Start App
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
