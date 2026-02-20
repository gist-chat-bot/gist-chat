// api.js - Direct Function Call Version

const GitHubAPI = {
    
    getHeaders() {
        return {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    },

    async callProxy(method, endpoint, body = null) {
        // Call the function directly
        const response = await fetch(`${CONFIG.API_BASE}`, {
            method: 'POST', // Always POST to our proxy
            headers: this.getHeaders(),
            body: JSON.stringify({
                method: method,      // Tell proxy what method to use
                endpoint: endpoint,  // Tell proxy which GitHub endpoint
                body: body
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            console.error("Proxy Error:", error);
            return null;
        }
        
        return await response.json();
    },

    async getGist(gistId) {
        return await this.callProxy('GET', `/gists/${gistId}`);
    },

    async createGist(filename, content, description = "Gist Chat Data") {
        const payload = {
            description: description,
            public: true,
            files: {
                [filename]: { content: JSON.stringify(content) }
            }
        };
        return await this.callProxy('POST', '/gists', payload);
    },

    async updateGist(gistId, filename, content, sha) {
        const payload = {
            files: {
                [filename]: {
                    content: JSON.stringify(content),
                    sha: sha
                }
            }
        };
        return await this.callProxy('PATCH', `/gists/${gistId}`, payload);
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

console.log("✅ GitHubAPI Loaded (Direct Function Mode)");
