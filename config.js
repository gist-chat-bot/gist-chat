const CONFIG = {
    // ⚠️ REPLACE WITH YOUR SUPABASE CREDENTIALS
    SUPABASE_URL: 'https://zemretrtkvfvnomqclmx.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbXJldHJ0a3Zmdm5vbXFjbG14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDI0ODgsImV4cCI6MjA4NzE3ODQ4OH0.p7Hp0bOhHuJNIm0YXMrrj5l6YS8s42ikZ20onB4dPAU',
    
    // App Settings
    COOLDOWN_MS: 120000,  // 2 minutes
    POLL_INTERVAL: 30000, // 30 seconds (for fallback)
    
    // Limits
    MAX_DM_SLOTS: 5,
    MAX_GC_SLOTS: 2,
    MAX_GC_PARTICIPANTS: 5,
    
    // Local Storage Keys
    LS_KEYS: {
        USER_ID: 'gist_user_id',
        USER_PASS: 'gist_user_pass',
        ACTIVE_DMS: 'gist_active_dms',
        ACTIVE_GCS: 'gist_active_gcs',
        LAST_SYNC: 'gist_last_sync_',
        MESSAGES_CACHE: 'gist_messages_'
    }
};

console.log("✅ Config Loaded (Supabase Mode)");
