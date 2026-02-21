// db.js - Supabase Database Layer (DEVICE AUTH - NO SUPABASE AUTH)
console.log("🚀 db.js: Starting to load (Device Auth Mode)...");

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

// Initialize Supabase Client (NO AUTH - just for data operations)
let supabaseClient;
try {
    if (window.supabase && CONFIG) {
        supabaseClient = window.supabase.createClient(
            CONFIG.SUPABASE_URL,
            CONFIG.SUPABASE_ANON_KEY
        );
        console.log("🟢 Supabase client created (data-only mode)");
    }
} catch (error) {
    console.error("🔴 Failed to create Supabase client:", error);
}

// DB Object - Device-Based Authentication
const DB = {
    userId: null,
    profileId: null,
    
    async hashPassphrase(passphrase) {
        const encoder = new TextEncoder();
        const data = encoder.encode(passphrase);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    // ✅ FIXED: Two-step register (Insert → Then Fetch)
    async register(userId, passphrase) {
        console.log("🔵 DB.register called with:", userId);
        try {
            if (!/^[A-Z][0-9]+$/.test(userId)) {
                throw new Error("ID must be Letter+Number (e.g. A1)");
            }
            
            // Check if user already exists
            const {  existing } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();
            
            if (existing) {
                throw new Error("User already registered. Please login instead.");
            }
            
            // Generate RSA key pair
            const keyPair = await CryptoModule.generateKeyPair();
            const publicKey = await CryptoModule.exportPublicKey(keyPair.publicKey);
            const privateKey = await CryptoModule.exportPrivateKey(keyPair.privateKey);
            
            // Hash passphrase locally
            const passphraseHash = await this.hashPassphrase(passphrase);
            
            console.log("🔵 Step 1: Inserting profile...");
            
            // ✅ STEP 1: Insert only (no select chained)
            const { error: insertError } = await supabaseClient
                .from('profiles')
                .insert({
                    user_id: userId,
                    public_key: publicKey
                });
            
            if (insertError) {
                console.error("❌ Profile insert error:", insertError);
                // Duplicate key error code
                if (insertError.code === '23505') {
                    throw new Error("User already registered. Please login instead.");
                }
                throw new Error("Failed to create profile: " + insertError.message);
            }
            
            console.log("🟢 Profile inserted, Step 2: Fetching...");
            
            // ✅ STEP 2: Fetch the created profile (separate query)
            const {  profile, error: selectError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (selectError || !profile) {
                console.error("❌ Profile select error:", selectError);
                throw new Error("Database did not return profile data");
            }
            
            if (!profile.id) {
                throw new Error("Profile has no ID");
            }
            
            console.log("🟢 Profile fetched:", profile.id);
            
            // Store private data locally
            localStorage.setItem(CONFIG.LS_KEYS.USER_ID, userId);
            localStorage.setItem('gist_private_key', privateKey);
            localStorage.setItem('gist_passphrase_hash', passphraseHash);
            
            // Set session state
            this.userId = userId;
            this.profileId = profile.id;
            
            console.log("🟢 Device registration successful");
            return { 
                userId, 
                publicKey, 
                privateKey,
                profileId: profile.id
            };
        } catch (error) {
            console.error("🔴 Registration failed:", error);
            throw error;
        }
    },
    
    async login(userId, passphrase) {
        console.log("🔵 DB.login called with:", userId);
        try {
            const {  profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error || !profile) {
                throw new Error("Profile not found. Please register first.");
            }
            
            const privateKey = localStorage.getItem('gist_private_key');
            const storedHash = localStorage.getItem('gist_passphrase_hash');
            
            if (!privateKey) {
                console.warn("⚠️ No private key found - new device or cleared storage");
                throw new Error("Private key not found on this device.");
            }
            
            const inputHash = await this.hashPassphrase(passphrase);
            if (inputHash !== storedHash) {
                throw new Error("Incorrect passphrase");
            }
            
            this.userId = userId;
            this.profileId = profile.id;
            
            console.log("🟢 Device login successful");
            return { userId, privateKey, profileId: profile.id };
        } catch (error) {
            console.error("🔴 Login failed:", error);
            throw error;
        }
    },
    
    async logout() {
        console.log("🔵 DB.logout called");
        try {
            const privateKey = localStorage.getItem('gist_private_key');
            const userId = localStorage.getItem(CONFIG.LS_KEYS.USER_ID);
            const passphraseHash = localStorage.getItem('gist_passphrase_hash');
            
            localStorage.clear();
            
            if (privateKey) localStorage.setItem('gist_private_key', privateKey);
            if (userId) localStorage.setItem(CONFIG.LS_KEYS.USER_ID, userId);
            if (passphraseHash) localStorage.setItem('gist_passphrase_hash', passphraseHash);
            
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
                .select('id, user_id, public_key, created_at')
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
        console.log("🔵 DB.createRoom called:", { type, participantIds, profileId: this.profileId });
        try {
            if (!this.profileId) {
                throw new Error("User not authenticated - profileId is null");
            }
            if (!type || !['1v1', 'gc'].includes(type)) {
                throw new Error(`Invalid room type: ${type}. Must be '1v1' or 'gc'`);
            }
            
            console.log("Creating room with type:", type);
            
            const {  room, error: roomError } = await supabaseClient
                .from('rooms')
                .insert({ type: type })
                .select()
                .single();
            
            console.log("Room insert result:", { room, roomError });
            
            if (roomError) {
                console.error("❌ Room creation error:", roomError);
                throw new Error("Failed to create room: " + roomError.message);
            }
            
            if (!room || !room.id) {
                console.error("❌ No room returned from database");
                throw new Error("Database did not return room data. Check RLS policies.");
            }
            
            console.log("🟢 Room created:", room.id);
            
            const allParticipantIds = [this.profileId, ...participantIds];
            console.log("Adding participants:", allParticipantIds);
            
            const participants = allParticipantIds.map(id => ({
                room_id: room.id,
                user_id: id
            }));
            
            const { error: partError } = await supabaseClient
                .from('participants')
                .insert(participants);
            
            if (partError) {
                console.error("❌ Participant error:", partError);
                await supabaseClient.from('rooms').delete().eq('id', room.id);
                throw new Error("Failed to add participants: " + partError.message);
            }
            
            console.log("🟢 Participants added successfully");
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

console.log("🟢 DB object created successfully (Device Auth Mode)!");
console.log("🟢 DB methods:", Object.keys(DB).join(', '));
