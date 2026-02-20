const CONFIG = {
    // ✅ No token needed! Netlify handles it.
    
    GITHUB_USERNAME: 'gist-chat-bot',
    
    // ⚠️ Your Directory Gist ID (still needed)
    DIRECTORY_GIST_ID: 'e0515b010d3dd22bbe6b69b482395aa4',
    
    // API Base (points to Netlify)
    API_BASE: '/api/gists',
    
    COOLDOWN_MS: 120000,
    POLL_INTERVAL: 60000
};

console.log("Config Loaded - Netlify Mode");
