// db.js - Supabase Database Layer (DEBUG VERSION)
console.log(" db.js: Starting to load...");

// Check if Supabase is available
if (typeof window.supabase === 'undefined') {
    console.error("🔴 Supabase CDN not loaded!");
    alert("Error: Supabase not loaded. Check internet connection.");
} else {
    console.log("🟢 Supabase CDN loaded successfully");
}

// Check if CONFIG is available
if (typeof CONFIG === 'undefined') {
    console.error("🔴 CONFIG not loaded!");
    alert("Error: Config not loaded. Check config.js");
} else {
    console.log("🟢 CONFIG loaded:", CONFIG.SUPABASE_URL ? "URL present" : "URL missing");
}

// Check if CryptoModule is available
if (typeof CryptoModule === 'undefined') {
    console.error("🔴 CryptoModule not loaded!");
    alert("Error: CryptoModule not loaded. Check crypto.js");
} else {
    console.log("🟢 CryptoModule loaded");
}

// Initialize Supabase Client
let supabaseClient;
try {
    if (window.supabase && CONFIG) {
        supabaseClient = window.supabase.createClient(
            CONFIG.SUPABASE_URL,
            CONFIG.SUPABASE_ANON_KEY
        );
        console.log("🟢 Supabase client created");
    }
} catch (error) {
    console.error("🔴 Failed to create Supabase client:", error);
}

// Create DB object
const DB = {
    userId: null,
    profileId: null,
    
    async register(userId, passphrase) {
        console.log("🔵 DB.register called with:", userId);
        try {
            if (!/^[A-Z][0-9]+$/.test(userId)) {
                throw new Error("ID must be Letter+Number (e.g. A1)");
            }
            
            const { data: existing } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('user_id', userId)
                .single();
            
            if (existing) {
                throw new Error("ID already taken");
            }
            
            const keyPair = await CryptoModule.generateKeyPair();
            const publicKey = await CryptoModule.exportPublicKey(keyPair.publicKey);
            const privateKey = await CryptoModule.exportPrivateKey(keyPair.privateKey);
            
            const email = `${userId}@gist.local`;
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: email,
                password: passphrase
            });
            
            if (authError) throw authError;
            
            const { error: profileError } = await supabaseClient
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    user_id: userId,
                    public_key: publicKey
                });
            
            if (profileError) throw profileError;
            
            localStorage.setItem(CONFIG.LS_KEYS.USER_ID, userId);
            localStorage.setItem(CONFIG.LS_KEYS.USER_PASS, passphrase);
            localStorage.setItem('gist_private_key', privateKey);
            
            this.userId = userId;
            this.profileId = authData.user.id;
            
            console.log("🟢 Registration successful");
            return { userId, publicKey, privateKey };
        } catch (error) {
            console.error("🔴 Registration failed:", error);
            throw error;
        }
    },
    
    async login(userId, passphrase) {
        console.log("🔵 DB.login called with:", userId);
        try {
            const email = `${userId}@gist.local`;
            
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: passphrase
            });
            
            if (error) throw error;
            
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (!profile) throw new Error("Profile not found");
            
            const privateKey = localStorage.getItem('gist_private_key');
            if (!privateKey) throw new Error("Private key not found");
            
            this.userId = userId;
            this.profileId = data.user.id;
            
            console.log("🟢 Login successful");
            return { userId, privateKey };
        } catch (error) {
            console.error("🔴 Login failed:", error);
            throw error;
        }
    },
    
    async searchUser(searchId) {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('user_id, public_key, created_at')
                .eq('user_id', searchId.toUpperCase())
                .single();
            
            if (error || !data) return null;
            return data;
        } catch (error) {
            console.error("Search failed:", error);
            return null;
        }
    }
};

console.log("🟢 DB object created successfully!");
console.log("🟢 DB methods:", Object.keys(DB).join(', '));
