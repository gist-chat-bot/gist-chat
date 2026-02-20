// api.js - Netlify Proxy Version

const GitHubAPI = {
    
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
                return null;
            }
            return await response.json();
        } catch (e) {
            console.error("API Get Error:", e);
            return null;
        }
    },

    async createGist(filename, content, description = "Gist Chat Data") {
        try {
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
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Create failed: ${response.status}`, errorText);
                return null;
            }
            
            return await response.json();
        } catch (e) {
            console.error("API Create Error:", e);
            return null;
        }
    },

    async updateGist(gistId, filename, content, sha) {
        try {
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
            
            if (!response.ok) {
                console.error(`Update failed: ${response.status}`);
                return null;
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
                data: JSON.parse(rawContent),
                sha: sha
            };
        } catch (e) {
            console.error("JSON Parse Error:", e);
            return null;
        }
    }
};

console.log("✅ GitHubAPI Loaded (Netlify Mode)");
