// api.js

const GitHubAPI = {
    
    // ✅ No token in headers! Netlify adds it.
    getHeaders() {
        return {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    },

    async getGist(gistId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/${gistId}`, {
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                console.error(`Gist fetch failed: ${response.status}`);
                throw new Error(`Gist fetch failed: ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            console.error("API Get Error:", e);
            return null;
        }
    },

    async createGist(filename, content, description = "Gist Chat Data") {
        try {
            console.log("Creating Gist...", filename);
            
            const body = JSON.stringify({
                description: description,
                public: true,
                files: {
                    [filename]: {
                        content: JSON.stringify(content)
                    }
                }
            });
            
            const response = await fetch(`${CONFIG.API_BASE}`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: body
            });
            
            console.log("Response status:", response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gist create failed: ${response.status} - ${errorText}`);
            }
            
            return await response.json();
        } catch (e) {
            console.error("API Create Error:", e);
            alert("Create Error: " + e.message);
            return null;
        }
    },

    async updateGist(gistId, filename, content, sha) {
        try {
            console.log("Updating Gist...", gistId);
            
            const response = await fetch(`${CONFIG.API_BASE}/${gistId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    files: {
                        [filename]: {
                            content: JSON.stringify(content),
                            sha: sha
                        }
                    }
                })
            });
            
            console.log("Update Response:", response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Gist update failed: ${response.status}`, errorText);
                throw new Error(`Gist update failed: ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            console.error("API Update Error:", e);
            return null;
        }
    },

    parseGistFile(gistData, filename) {
        if (!gistData || !gistData.files || !gistData.files[filename]) {
            return null;
        }
        const rawContent = gistData.files[filename].content;
        const sha = gistData.files[filename].sha;
        
        try {
            return {
                 JSON.parse(rawContent),
                sha: sha
            };
        } catch (e) {
            console.error("JSON Parse Error:", e);
            return null;
        }
    }
};

console.log("GitHubAPI Loaded (Netlify Proxy)");
