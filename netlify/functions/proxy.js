exports.handler = async (event, context) => {
  console.log("=== PROXY FUNCTION CALLED ===");
  console.log("Path:", event.path);
  console.log("Method:", event.httpMethod);
  
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    console.error("❌ TOKEN NOT FOUND!");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Token not configured' })
    };
  }
  
  console.log("✅ Token found (length:", token.length, ")");

  const { httpMethod, path, body } = event;
  
  // Fix the path - remove /api prefix if present
  const githubPath = path.replace(/^\/api/, '');
  const githubUrl = `https://api.github.com${githubPath}`;
  
  console.log("GitHub URL:", githubUrl);

  try {
    const response = await fetch(githubUrl, {
      method: httpMethod,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Gist-Chat-App'
      },
      body: body || undefined
    });

    console.log("GitHub Response Status:", response.status);
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error("❌ GitHub Error:", data);
    }

    return {
      statusCode: response.status,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("❌ Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
