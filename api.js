// api.js
console.log("Loading api.js...");

const GitHubAPI = {
    getHeaders: function() {
        return {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    },

    callProxy: async function(method, endpoint, body) {
        console.log("Calling proxy:", method, endpoint);
        
        try {
            const response = await fetch(CONFIG.API_BASE, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    method: method,
                    endpoint: endpoint,
                    body: body
                })
            });
            
            console.log("Proxy response:", response.status);
            
            if (!response.ok) {
                console.error("Proxy failed:", response.status);
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error("Proxy error:", error);
            return null;
        }
    },

    getGist: async function(gistId) {
        console.log("Getting gist:", gistId);
        return await this.callProxy('GET', '/gists/' + gistId, null);
    },

    createGist: async function(filename, content, description) {
        console.log("Creating gist:", filename);
        var payload = {
            description: description || "Gist Chat Data",
            public: true,
            files: {}
        };
        payload.files[filename] = { content: JSON.stringify(content) };
        
        return await this.callProxy('POST', '/gists', payload);
    },

    updateGist: async function(gistId, filename, content, sha) {
        console.log("Updating gist:", gistId);
        var payload = { files: {} };
        payload.files[filename] = {
            content: JSON.stringify(content),
            sha: sha
        };
        
        return await this.callProxy('PATCH', '/gists/' + gistId, payload);
    },

    parseGistFile: function(gistData, filename) {
        if (!gistData || !gistData.files || !gistData.files[filename]) {
            return null;
        }
        try {
            return {
                 JSON.parse(gistData.files[filename].content),
                sha: gistData.files[filename].sha
            };
        } catch (e) {
            console.error("Parse error:", e);
            return null;
        }
    }
};

console.log("✅ GitHubAPI loaded successfully!");
