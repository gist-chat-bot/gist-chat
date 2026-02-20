// netlify/functions/proxy.js

exports.handler = async (event, context) => {
  console.log("=== PROXY CALLED ===");
  
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No token' }) };
  }

  // Parse incoming request
  const { method, endpoint, body } = JSON.parse(event.body);
  
  console.log(`Method: ${method}, Endpoint: ${endpoint}`);

  try {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      method: method,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Gist-Chat-App'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    console.log("GitHub Status:", response.status);
    
    return {
      statusCode: response.status,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
