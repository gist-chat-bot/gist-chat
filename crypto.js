// crypto.js - Fixed for RSA-OAEP (Encryption Only)

const CryptoModule = {
    
    // --- AES Functions (Chat Encryption) ---
    
    async deriveKey(passphrase, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw", enc.encode(passphrase), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        return await window.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
    },

    generateSalt() { return window.crypto.getRandomValues(new Uint8Array(16)); },
    generateIV() { return window.crypto.getRandomValues(new Uint8Array(12)); },

    async encrypt(text, passphrase) {
        const salt = this.generateSalt();
        const iv = this.generateIV();
        const key = await this.deriveKey(passphrase, salt);
        const enc = new TextEncoder();
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, key, enc.encode(text)
        );
        return {
            content: this.arrayBufferToBase64(encrypted),
            salt: this.arrayBufferToBase64(salt),
            iv: this.arrayBufferToBase64(iv)
        };
    },

    async decrypt(encryptedData, passphrase) {
        try {
            const salt = this.base64ToArrayBuffer(encryptedData.salt);
            const iv = this.base64ToArrayBuffer(encryptedData.iv);
            const content = this.base64ToArrayBuffer(encryptedData.content);
            const key = await this.deriveKey(passphrase, salt);
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv }, key, content
            );
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error("Decryption failed:", e);
            return "[Decryption Failed]";
        }
    },

    // --- RSA Functions (Identity/Handshake) ---
    // ✅ FIXED: RSA-OAEP is for encryption ONLY, not signing

    async generateKeyPair() {
        return await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256"
            },
            true,
            ["encrypt", "decrypt"] // ✅ RSA-OAEP: encrypt/decrypt ONLY
        );
    },

    async exportPublicKey(key) {
        const exported = await window.crypto.subtle.exportKey("spki", key);
        return this.arrayBufferToBase64(exported);
    },

    async importPublicKey(base64Key) {
        const binary = window.atob(base64Key);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return await window.crypto.subtle.importKey(
            "spki", bytes, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"] // ✅ encrypt ONLY
        );
    },

    async exportPrivateKey(key) {
        const exported = await window.crypto.subtle.exportKey("pkcs8", key);
        return this.arrayBufferToBase64(exported);
    },

    async importPrivateKey(base64Key) {
        const binary = window.atob(base64Key);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return await window.crypto.subtle.importKey(
            "pkcs8", bytes, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"] // ✅ decrypt ONLY
        );
    },

    // --- Utilities ---

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return window.btoa(binary);
    },

    base64ToArrayBuffer(base64) {
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    },

    generateId() {
        return 'msg_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
};

console.log("✅ CryptoModule Loaded (RSA-OAEP Fixed)");
