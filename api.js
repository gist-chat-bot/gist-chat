// api.js

const GitHubAPI = {
    
    // Base Headers with Auth
    getHeaders() {
        return {
            'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    },

    // Fetch a Gist by ID
    async getGist(gistId) {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: this.getHeaders()
            });
            
            if (!response.ok) throw new Error(`Gist fetch failed: ${response.status}`);
            return await response.json();
        } catch (e) {
            console.error("API Get Error:", e);
            return null;
        }
    },

    // Create a New Gist
    async createGist(filename, content, description = "Gist Chat Data") {
        try {
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    description: description,
                    public: true,
                    files: {
                        [filename]: {
                            content: JSON.stringify(content)
                        }
                    }
                })
            });
            
            if (!response.ok) throw new Error(`Gist create failed: ${response.status}`);
            return await response.json();
        } catch (e) {
            console.error("API Create Error:", e);
            return null;
        }
    },

    // Update Existing Gist (PATCH)
    async updateGist(gistId, filename, content, sha) {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
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
            
            if (!response.ok) throw new Error(`Gist update failed: ${response.status}`);
            return await response.json();
        } catch (e) {
            console.error("API Update Error:", e);
            return null;
        }
    },

    // Read File Content from Gist Object
    parseGistFile(gistData, filename) {
        if (!gistData || !gistData.files || !gistData.files[filename]) {
            return null;
        }
        const rawContent = gistData.files[filename].content;
        const sha = gistData.files[filename].sha;
        
        try {
            // ✅ FIXED: Added 'data:' key
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

console.log("GitHubAPI Loaded");
