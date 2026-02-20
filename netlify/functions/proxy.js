// netlify/functions/proxy.js

exports.handler = async (event, context) => {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Token not configured' })
    };
  }

  const { httpMethod, path, body, headers } = event;
  const githubUrl = `https://api.github.com${path}`;

  try {
    const response = await fetch(githubUrl, {
      method: httpMethod,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...headers
      },
      body: body || undefined
    });

    const data = await response.json();

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
