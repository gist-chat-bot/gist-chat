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

// DOM Elements
const UI = {
    modal: document.getElementById('login-modal'),
    passphraseInput: document.getElementById('passphrase-input'),
    loginBtn: document.getElementById('login-btn'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    messageList: document.getElementById('message-list'),
    syncStatus: document.getElementById('sync-status'),
    micBtn: document.getElementById('mic-btn')
};

// Initialize App
async function init() {
    console.log("Gist Initializing...");
    
    // Check for existing session
    const savedId = localStorage.getItem('gist_user_id');
    if (savedId) {
        AppState.userId = savedId;
        document.getElementById('my-user-id').textContent = savedId;
    }
    
    // Show login modal
    UI.modal.style.display = 'flex';
    
    // Setup Event Listeners
    UI.loginBtn.addEventListener('click', handleLogin);
    UI.sendBtn.addEventListener('click', handleSend);
    UI.micBtn.addEventListener('click', handleVoiceInput);
    
    // Start Polling (will activate after chat selected)
    setInterval(pollMessages, CONFIG.POLL_INTERVAL);
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
    console.log("Session Unlocked");
    
    // Load saved slots
    renderSlots();
}

// Handle Send Message
async function handleSend() {
    const text = UI.messageInput.value.trim();
    if (!text || !AppState.currentGistId) return;
    
    // Check Cooldown
    const now = Date.now();
    const timePassed = now - AppState.lastSentTime;
    
    if (timePassed < CONFIG.COOLDOWN_MS) {
        const remaining = Math.ceil((CONFIG.COOLDOWN_MS - timePassed) / 1000);
        alert(`Wait ${remaining}s`);
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
    for (const msg of parsed.data.messages) {
        const exists = AppState.messages.find(m => m.messageId === msg.messageId);
        if (!exists) {
            AppState.messages.push(msg);
            renderMessage(msg, false);
        }
    }
    
    updateSyncStatus("Synced");
}

// Render Message to UI
function renderMessage(msg, isLocal) {
    const packet = document.createElement('div');
    packet.className = 'message-packet';
    
    const time = new Date(msg.timestamp).toLocaleTimeString();
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
    packet.querySelector('.packet-content').dataset.content = msg.content;
    packet.querySelector('.packet-content').dataset.iv = msg.iv;
    packet.querySelector('.packet-content').dataset.salt = msg.salt;
    
    // Add click to decrypt
    packet.querySelector('.packet-content').addEventListener('click', async function() {
        if (this.classList.contains('blurred')) {
            const encryptedData = {
                content: this.dataset.content,
                iv: this.dataset.iv,
                salt: this.dataset.salt
            };
            const decrypted = await CryptoModule.decrypt(encryptedData, AppState.passphrase);
            this.textContent = decrypted;
            this.classList.remove('blurred');
        }
    });
    
    UI.messageList.appendChild(packet);
    UI.messageList.scrollTop = UI.messageList.scrollHeight;
}

// Render Slots (Placeholder)
function renderSlots() {
    const dmSlots = document.getElementById('dm-slots');
    const gcSlots = document.getElementById('gc-slots');
    
    // Load from LocalStorage
    const activeDMs = JSON.parse(localStorage.getItem('active_contacts') || '[]');
    const activeGCs = JSON.parse(localStorage.getItem('active_groups') || '[]');
    
    // Render DM Slots (5 max)
    dmSlots.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot-box';
        slot.textContent = activeDMs[i] ? activeDMs[i].substr(0, 8) + '...' : '+';
        if (activeDMs[i]) {
            slot.onclick = () => loadChat(activeDMs[i]);
        }
        dmSlots.appendChild(slot);
    }
    
    // Render GC Slots (2 max)
    gcSlots.innerHTML = '';
    for (let i = 0; i < 2; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot-box';
        slot.textContent = activeGCs[i] ? activeGCs[i].substr(0, 8) + '...' : '+';
        if (activeGCs[i]) {
            slot.onclick = () => loadChat(activeGCs[i]);
        }
        gcSlots.appendChild(slot);
    }
}

// Load Chat by Gist ID
async function loadChat(gistId) {
    AppState.currentGistId = gistId;
    AppState.messages = [];
    UI.messageList.innerHTML = '';
    document.getElementById('chat-header').textContent = `Chat: ${gistId.substr(0, 8)}...`;
    
    updateSyncStatus("Loading...");
    await pollMessages();
}

// Voice Input (Speech to Text)
function handleVoiceInput() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Speech API not supported");
        return;
    }
    
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();
    
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        UI.messageInput.value = text;
    };
    
    recognition.onerror = () => {
        alert("Voice input failed");
    };
}

// Update Sync Status
function updateSyncStatus(status) {
    UI.syncStatus.textContent = status;
}

// Start App
init();
