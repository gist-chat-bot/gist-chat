// identity.js

const Identity = {
    
    // Register New User ID
    async register(userId, passphrase) {
        // 1. Validate ID
        if (!/^[A-Z][0-9]+$/.test(userId)) {
            throw new Error("ID must be Letter+Number (e.g. A1)");
        }

        // 2. Check Directory
        const directory = await this.getDirectory();
        if (directory[userId]) {
            throw new Error("ID already taken");
        }

        // 3. Generate Keys
        const keyPair = await CryptoModule.generateKeyPair();
        const publicKey = await CryptoModule.exportPublicKey(keyPair.publicKey);
        const privateKey = await CryptoModule.exportPrivateKey(keyPair.privateKey);

        // 4. Create Profile Gist
        const profileData = {
            userId: userId,
            publicKey: publicKey,
            createdAt: Date.now(),
            incoming_requests: [],
            outgoing_responses: []
        };

        const gistResult = await GitHubAPI.createGist('profile.json', profileData, `Profile: ${userId}`);
        if (!gistResult) throw new Error("Failed to create profile");

        // 5. Update Directory
        const newDir = { ...directory, [userId]: { profileGistId: gistResult.id, registeredAt: Date.now(), status: "active" } };
        const dirResult = await GitHubAPI.updateGist(CONFIG.DIRECTORY_GIST_ID, 'directory.json', newDir, this.dirSha);
        
        if (!dirResult) throw new Error("Failed to update directory");

        // 6. Save Locally
        localStorage.setItem('gist_user_id', userId);
        localStorage.setItem('gist_private_key', privateKey);
        localStorage.setItem('gist_passphrase', passphrase); // Warning: Insecure but convenient for Phase 3

        return { userId, publicKey, privateKey };
    },

    // Login Existing User
    async login(userId, passphrase) {
        const directory = await this.getDirectory();
        if (!directory[userId]) {
            throw new Error("ID not found");
        }

        // Fetch Profile to verify
        const profileGist = await GitHubAPI.getGist(directory[userId].profileGistId);
        if (!profileGist) throw new Error("Profile missing");

        // Load Private Key from Storage
        const storedKey = localStorage.getItem('gist_private_key');
        if (!storedKey) {
            throw new Error("Private key not found on this device");
        }

        return { userId, privateKey: storedKey };
    },

    // Search Directory
    async searchId(userId) {
        const directory = await this.getDirectory();
        return directory[userId] || null;
    },

    // Get Directory (Cached)
    dirSha: null,
    dirCache: null,
    dirCacheTime: 0,

    async getDirectory() {
        const now = Date.now();
        if (this.dirCache && (now - this.dirCacheTime) < 30000) {
            return this.dirCache;
        }

        const gist = await GitHubAPI.getGist(CONFIG.DIRECTORY_GIST_ID);
        if (!gist) return {};
        
        const parsed = GitHubAPI.parseGistFile(gist, 'directory.json');
        if (parsed) {
            this.dirCache = parsed.data;
            this.dirSha = parsed.sha;
            this.dirCacheTime = now;
        }
        return this.dirCache || {};
    },

    // Export Keys (Backup)
    exportKeys() {
        const userId = localStorage.getItem('gist_user_id');
        const privateKey = localStorage.getItem('gist_private_key');
        if (!userId || !privateKey) return null;
        return { userId, privateKey };
    }
};

console.log("IdentityModule Loaded");
