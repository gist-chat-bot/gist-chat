// db.js - Supabase Database Layer (FIXED)
console.log("🚀 db.js: Starting to load...");

// Check dependencies
if (typeof window.supabase === 'undefined') {
    console.error("🔴 Supabase CDN not loaded!");
} else {
    console.log("🟢 Supabase CDN loaded");
}

if (typeof CONFIG === 'undefined') {
    console.error("🔴 CONFIG not loaded!");
} else {
    console.log("🟢 CONFIG loaded");
}

if (typeof CryptoModule === 'undefined') {
    console.error("🔴 CryptoModule not loaded!");
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

// DB Object
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
            
            // ✅ Check if private key exists
            let privateKey = localStorage.getItem('gist_private_key');
            
            if (!privateKey) {
                console.warn("⚠️ No private key found - new device or cleared storage");
                throw new Error("Private key not found. Please re-register or import your key.");
            }
            
            this.userId = userId;
            this.profileId = data.user.id;
            
            console.log("🟢 Login successful");
            return { userId, privateKey };
        } catch (error) {
            console.error("🔴 Login failed:", error);
            throw error;
        }
    },
    
    async logout() {
        console.log("🔵 DB.logout called");
        try {
            await supabaseClient.auth.signOut();
            
            // ✅ Preserve keys, clear only session data
            const privateKey = localStorage.getItem('gist_private_key');
            const userId = localStorage.getItem(CONFIG.LS_KEYS.USER_ID);
            const userPass = localStorage.getItem(CONFIG.LS_KEYS.USER_PASS);
            
            localStorage.clear();
            
            if (privateKey) localStorage.setItem('gist_private_key', privateKey);
            if (userId) localStorage.setItem(CONFIG.LS_KEYS.USER_ID, userId);
            if (userPass) localStorage.setItem(CONFIG.LS_KEYS.USER_PASS, userPass);
            
            this.userId = null;
            this.profileId = null;
            
            console.log("🟢 Logout successful - keys preserved");
        } catch (error) {
            console.error("🔴 Logout failed:", error);
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
    },
    
    async createRoom(type, participantIds) {
        console.log("🔵 DB.createRoom called:", type, participantIds);
        try {
            // Create room
            const {  room, error: roomError } = await supabaseClient
                .from('rooms')
                .insert({ type: type })
                .select()
                .single();
            
            if (roomError) {
                console.error("❌ Room creation error:", roomError);
                throw new Error("Failed to create room: " + roomError.message);
            }
            
            if (!room) {
                console.error("❌ No room returned from database");
                throw new Error("Database did not return room data");
            }
            
            console.log("🟢 Room created:", room.id);
            
            // Add participants (current user + others)
            const allParticipantIds = [this.profileId, ...participantIds];
            const participants = allParticipantIds.map(id => ({
                room_id: room.id,
                user_id: id
            }));
            
            console.log("Adding participants:", participants);
            
            const { error: partError } = await supabaseClient
                .from('participants')
                .insert(participants);
            
            if (partError) {
                console.error("❌ Participant error:", partError);
                throw new Error("Failed to add participants: " + partError.message);
            }
            
            console.log("🟢 Participants added successfully");
            
            // ✅ Make sure we return the room
            return room;
        } catch (error) {
            console.error("🔴 Create room failed:", error);
            throw error;
        }
    },
    
    async sendMessage(roomId, content, iv, salt) {
        try {
            const { data, error } = await supabaseClient
                .from('messages')
                .insert({
                    room_id: roomId,
                    sender_id: this.profileId,
                    content: content,
                    iv: iv,
                    salt: salt,
                    is_deleted: false
                })
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Send message failed:", error);
            throw error;
        }
    },
    
    async getMessages(roomId, lastSyncAt = null) {
        try {
            let query = supabaseClient
                .from('messages')
                .select(`
                    *,
                    profiles (
                        user_id
                    )
                `)
                .eq('room_id', roomId)
                .eq('is_deleted', false)
                .order('created_at', { ascending: true });
            
            if (lastSyncAt) {
                query = query.gt('created_at', lastSyncAt);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Get messages failed:", error);
            return [];
        }
    },
    
    async deleteMessage(messageId) {
        try {
            const { error } = await supabaseClient
                .from('messages')
                .update({ is_deleted: true })
                .eq('id', messageId);
            
            if (error) throw error;
        } catch (error) {
            console.error("Delete message failed:", error);
            throw error;
        }
    },
    
    subscribeToRoom(roomId, callback) {
        return supabaseClient
            .channel(`room:${roomId}`)
            .on('postgres_changes', 
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${roomId}`
                },
                callback
            )
            .subscribe();
    },
    
    saveMessagesCache(roomId, messages) {
        const key = CONFIG.LS_KEYS.MESSAGES_CACHE + roomId;
        localStorage.setItem(key, JSON.stringify({
            messages: messages,
            syncedAt: Date.now()
        }));
    },
    
    getMessagesCache(roomId) {
        const key = CONFIG.LS_KEYS.MESSAGES_CACHE + roomId;
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        return JSON.parse(cached);
    },
    
    getLastSync(roomId) {
        const key = CONFIG.LS_KEYS.LAST_SYNC + roomId;
        return localStorage.getItem(key);
    },
    
    setLastSync(roomId, timestamp) {
        const key = CONFIG.LS_KEYS.LAST_SYNC + roomId;
        localStorage.setItem(key, timestamp);
    }
};

console.log("🟢 DB object created successfully!");
console.log("🟢 DB methods:", Object.keys(DB).join(', '));
