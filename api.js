// api.js

const GitHubAPI = {
    
    getHeaders() {
        return {
            'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    },

    async getGist(gistId) {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                console.error(`Gist fetch failed: ${response.status}`, await response.text());
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
            console.log("Creating Gist...", filename, content);
            
            const body = JSON.stringify({
                description: description,
                public: true,
                files: {
                    [filename]: {
                        content: JSON.stringify(content)
                    }
                }
            });
            
            console.log("Request body:", body);
            
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: this.getHeaders(),
                body: body
            });
            
            console.log("Response status:", response.status);
            const responseText = await response.text();
            console.log("Response:", responseText);
            
            if (!response.ok) {
                throw new Error(`Gist create failed: ${response.status} - ${responseText}`);
            }
            
            return JSON.parse(responseText);
        } catch (e) {
            console.error("API Create Error:", e);
            alert("Create Error: " + e.message); // Show error to user
            return null;
        }
    },

    async updateGist(gistId, filename, content, sha) {
        try {
            console.log("Updating Gist...", gistId, sha);
            
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
console.log("Token configured:", CONFIG.GITHUB_TOKEN ? 'Yes' : 'No');
console.log("Directory ID:", CONFIG.DIRECTORY_GIST_ID || 'Not set');
