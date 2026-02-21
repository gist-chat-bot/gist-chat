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
    profileId: null, // Now stores the profiles.id (UUID), not auth user ID
    
    // ✅ NEW: Hash passphrase locally (never sent to server)
    async hashPassphrase(passphrase) {
        const encoder = new TextEncoder();
        const data = encoder.encode(passphrase);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    // ✅ DEVICE-BASED REGISTER (No Supabase Auth)
    async register(userId, passphrase) {
        console.log("🔵 DB.register called with:", userId);
        try {
            // Validate ID format
            if (!/^[A-Z][0-9]+$/.test(userId)) {
                throw new Error("ID must be Letter+Number (e.g. A1)");
            }
            
            // Check if user already exists in profiles
            const {  existing } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();
            
            if (existing) {
                throw new Error("User already registered. Please login instead.");
            }
            
            // Generate RSA key pair (device-only)
            const keyPair = await CryptoModule.generateKeyPair();
            const publicKey = await CryptoModule.exportPublicKey(keyPair.publicKey);
            const privateKey = await CryptoModule.exportPrivateKey(keyPair.privateKey);
            
            // Hash passphrase locally (NEVER sent to server)
            const passphraseHash = await this.hashPassphrase(passphrase);
            
            // Insert profile into Supabase (ONLY public data)
            const {  profile, error: profileError } = await supabaseClient
                .from('profiles')
                .insert({
                    // Let Supabase auto-generate UUID for id
                    user_id: userId,
                    public_key: publicKey
                    // NO auth user ID - device is the source of truth
                })
                .select()
                .single();
            
            if (profileError) {
                console.error("❌ Profile creation error:", profileError);
                throw new Error("Failed to create profile: " + profileError.message);
            }
            
            if (!profile || !profile.id) {
                throw new Error("Database did not return profile data");
            }
            
            // ✅ Store PRIVATE data LOCALLY ONLY (never sent to server)
            localStorage.setItem(CONFIG.LS_KEYS.USER_ID, userId);
            localStorage.setItem('gist_private_key', privateKey);
            localStorage.setItem('gist_passphrase_hash', passphraseHash);
            
            // Set session state
            this.userId = userId;
            this.profileId = profile.id; // Store the profiles.id (UUID)
            
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
    
    // ✅ SIMPLIFIED DEVICE-BASED LOGIN (No challenge-response for now)
    async login(userId, passphrase) {
        console.log("🔵 DB.login called with:", userId);
        try {
            // Fetch public profile from server
            const {  profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error || !profile) {
                throw new Error("Profile not found. Please register first.");
            }
            
            // ✅ Get PRIVATE key from LOCAL storage (never from server)
            const privateKey = localStorage.getItem('gist_private_key');
            const storedHash = localStorage.getItem('gist_passphrase_hash');
            
            if (!privateKey) {
                console.warn("⚠️ No private key found - new device or cleared storage");
                throw new Error("Private key not found on this device. This device has never logged in before, or keys were cleared.");
            }
            
            // ✅ Verify passphrase LOCALLY (never sent to server)
            const inputHash = await this.hashPassphrase(passphrase);
            if (inputHash !== storedHash) {
                throw new Error("Incorrect passphrase");
            }
            
            // ✅ Skip challenge-response for now (RSA-OAEP keys can't sign)
            // Passphrase hash verification is sufficient for local device auth
            // We can add proper RSA-PSS signing keys later if needed
            
            // Set session state
            this.userId = userId;
            this.profileId = profile.id;
            
            console.log("🟢 Device login successful");
            return { 
                userId, 
                privateKey,
                profileId: profile.id
            };
        } catch (error) {
            console.error("🔴 Login failed:", error);
            throw error;
        }
    },
    
    // ✅ LOGOUT - Clear session but KEEP keys
    async logout() {
        console.log("🔵 DB.logout called");
        try {
            // ✅ Preserve keys, clear only session state
            const privateKey = localStorage.getItem('gist_private_key');
            const userId = localStorage.getItem(CONFIG.LS_KEYS.USER_ID);
            const passphraseHash = localStorage.getItem('gist_passphrase_hash');
            
            // Clear session data only
            localStorage.clear();
            
            // Restore keys for next login
            if (privateKey) localStorage.setItem('gist_private_key', privateKey);
            if (userId) localStorage.setItem(CONFIG.LS_KEYS.USER_ID, userId);
            if (passphraseHash) localStorage.setItem('gist_passphrase_hash', passphraseHash);
            
            // Clear session state
            this.userId = null;
            this.profileId = null;
            
            console.log("🟢 Logout successful - keys preserved");
        } catch (error) {
            console.error("🔴 Logout failed:", error);
            throw error;
        }
    },
    
    // Search user by ID (unchanged)
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
    
    // ✅ UPDATED: createRoom uses profileId (not auth user ID)
    async createRoom(type, participantIds) {
        console.log("🔵 DB.createRoom called:", { type, participantIds, profileId: this.profileId });
        try {
            // Validate inputs
            if (!this.profileId) {
                throw new Error("User not authenticated - profileId is null");
            }
            if (!type || !['1v1', 'gc'].includes(type)) {
                throw new Error(`Invalid room type: ${type}. Must be '1v1' or 'gc'`);
            }
            
            // Step 1: Create the room
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
            
            // Step 2: Add participants
            // ✅ Use profile IDs (UUIDs from profiles table), not auth user IDs
            const allParticipantIds = [this.profileId, ...participantIds];
            console.log("Adding participants:", allParticipantIds);
            
            const participants = allParticipantIds.map(id => ({
                room_id: room.id,
                user_id: id  // This is now profiles.id (UUID)
            }));
            
            const { error: partError } = await supabaseClient
                .from('participants')
                .insert(participants);
            
            if (partError) {
                console.error("❌ Participant error:", partError);
                // Clean up: delete room if participants failed
                await supabaseClient.from('rooms').delete().eq('id', room.id);
                throw new Error("Failed to add participants: " + partError.message);
            }
            
            console.log("🟢 Participants added successfully");
            
            // Return the complete room object
            return room;
            
        } catch (error) {
            console.error("🔴 Create room failed:", error);
            throw error;
        }
    },
    
    // sendMessage (unchanged, but uses profileId)
    async sendMessage(roomId, content, iv, salt) {
        try {
            const { data, error } = await supabaseClient
                .from('messages')
                .insert({
                    room_id: roomId,
                    sender_id: this.profileId, // ✅ Now uses profileId (UUID)
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
    
    // getMessages (unchanged)
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
    
    // deleteMessage (unchanged)
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
    
    // subscribeToRoom (unchanged)
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
    
    // LocalStorage cache helpers (unchanged)
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
