// db.js - Supabase Database Layer

console.log("Loading db.js...");

// Initialize Supabase
const supabase = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
);

const DB = {
    // Current user state
    userId: null,
    profileId: null,
    
    // --- Auth & Profile ---
    
    async register(userId, passphrase) {
        // Validate ID format
        if (!/^[A-Z][0-9]+$/.test(userId)) {
            throw new Error("ID must be Letter+Number (e.g. A1)");
        }
        
        // Check if ID exists
        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', userId)
            .single();
        
        if (existing) {
            throw new Error("ID already taken");
        }
        
        // Generate RSA keys
        const keyPair = await CryptoModule.generateKeyPair();
        const publicKey = await CryptoModule.exportPublicKey(keyPair.publicKey);
        const privateKey = await CryptoModule.exportPrivateKey(keyPair.privateKey);
        
        // Sign up with Supabase Auth (using ID as email)
        const email = `${userId}@gist.local`;
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: passphrase
        });
        
        if (authError) throw authError;
        
        // Create profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authData.user.id,
                user_id: userId,
                public_key: publicKey
            });
        
        if (profileError) throw profileError;
        
        // Save locally
        localStorage.setItem(CONFIG.LS_KEYS.USER_ID, userId);
        localStorage.setItem(CONFIG.LS_KEYS.USER_PASS, passphrase);
        localStorage.setItem('gist_private_key', privateKey);
        
        this.userId = userId;
        this.profileId = authData.user.id;
        
        return { userId, publicKey, privateKey };
    },
    
    async login(userId, passphrase) {
        const email = `${userId}@gist.local`;
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: passphrase
        });
        
        if (error) throw error;
        
        // Get profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (!profile) throw new Error("Profile not found");
        
        const privateKey = localStorage.getItem('gist_private_key');
        if (!privateKey) throw new Error("Private key not found on this device");
        
        this.userId = userId;
        this.profileId = data.user.id;
        
        return { userId, privateKey };
    },
    
    async logout() {
        await supabase.auth.signOut();
        localStorage.clear();
        this.userId = null;
        this.profileId = null;
    },
    
    // --- Search ---
    
    async searchUser(searchId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('user_id, public_key, created_at')
            .eq('user_id', searchId.toUpperCase())
            .single();
        
        if (error || !data) return null;
        return data;
    },
    
    // --- Rooms ---
    
    async createRoom(type, participantIds) {
        // Create room
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .insert({ type })
            .select()
            .single();
        
        if (roomError) throw roomError;
        
        // Add participants
        const participants = [this.profileId, ...participantIds].map(id => ({
            room_id: room.id,
            user_id: id
        }));
        
        const { error: partError } = await supabase
            .from('participants')
            .insert(participants);
        
        if (partError) throw partError;
        
        return room;
    },
    
    async getRooms() {
        const { data } = await supabase
            .from('participants')
            .select(`
                room_id,
                rooms (
                    id,
                    type,
                    created_at,
                    participants (
                        user_id,
                        profiles (
                            user_id
                        )
                    )
                )
            `)
            .eq('user_id', this.profileId);
        
        return data || [];
    },
    
    // --- Messages ---
    
    async sendMessage(roomId, content, iv, salt) {
        const { data, error } = await supabase
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
    },
    
    async getMessages(roomId, lastSyncAt = null) {
        let query = supabase
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
    },
    
    async deleteMessage(messageId) {
        const { error } = await supabase
            .from('messages')
            .update({ is_deleted: true })
            .eq('id', messageId);
        
        if (error) throw error;
    },
    
    // --- Realtime Subscription ---
    
    subscribeToRoom(roomId, callback) {
        return supabase
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
    
    // --- LocalStorage Sync Helpers ---
    
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

console.log("✅ DB Loaded (Supabase Mode)");
