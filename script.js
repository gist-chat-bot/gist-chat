console.log("Gist System Initialized");

// Basic UI Check
const input = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const loginModal = document.getElementById('login-modal');

// Mock Login Logic (Just to hide modal for now)
document.getElementById('login-btn').addEventListener('click', () => {
    const pass = document.getElementById('passphrase-input').value;
    if(pass.length > 0) {
        loginModal.style.display = 'none';
        input.disabled = false;
        console.log("Session Unlocked (Mock)");
    }
});

// Click to Reveal Blur
document.addEventListener('click', (e) => {
    if(e.target.classList.contains('blurred')) {
        e.target.classList.remove('blurred');
    }
});
