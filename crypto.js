// crypto.js

const CryptoModule = {
    
    // Derive AES Key from Passphrase using PBKDF2
    async deriveKey(passphrase, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(passphrase),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );
        
        return await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    // Generate Random Salt (16 bytes)
    generateSalt() {
        return window.crypto.getRandomValues(new Uint8Array(16));
    },

    // Generate Random IV (12 bytes for AES-GCM)
    generateIV() {
        return window.crypto.getRandomValues(new Uint8Array(12));
    },

    // Encrypt Message
    async encrypt(text, passphrase) {
        const salt = this.generateSalt();
        const iv = this.generateIV();
        const key = await this.deriveKey(passphrase, salt);
        
        const enc = new TextEncoder();
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            enc.encode(text)
        );

        return {
            content: this.arrayBufferToBase64(encrypted),
            salt: this.arrayBufferToBase64(salt),
            iv: this.arrayBufferToBase64(iv)
        };
    },

    // Decrypt Message
    async decrypt(encryptedData, passphrase) {
        try {
            const salt = this.base64ToArrayBuffer(encryptedData.salt);
            const iv = this.base64ToArrayBuffer(encryptedData.iv);
            const content = this.base64ToArrayBuffer(encryptedData.content);
            
            const key = await this.deriveKey(passphrase, salt);
            
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                content
            );

            const dec = new TextDecoder();
            return dec.decode(decrypted);
        } catch (e) {
            console.error("Decryption failed:", e);
            return "[Decryption Failed]";
        }
    },

    // Utility: ArrayBuffer to Base64
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    },

    // Utility: Base64 to ArrayBuffer
    base64ToArrayBuffer(base64) {
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    },

    // Generate Unique ID (UUID)
    generateId() {
        return 'msg_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
};

console.log("CryptoModule Loaded");
