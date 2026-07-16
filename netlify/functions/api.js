const BACKEND_URL = 'http://137.158.61.235';

export const handler = async (event, context) => {
  try {
    const path = event.queryStringParameters?.path || '/';
    const method = event.httpMethod;
    
    // Construct the backend URL
    const backendUrl = `${BACKEND_URL}${path}`;

    // Prepare fetch options
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Handle request body for POST/PUT
    if (method === 'POST' || method === 'PUT') {
      if (event.body) {
        // If body is already a string (from API Gateway), use it directly
        // Otherwise stringify it
        fetchOptions.body = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
      }
    }

    // Make the request to the backend
    const response = await fetch(backendUrl, fetchOptions);
    const responseText = await response.text();

    // Try to parse response as JSON
    let responseBody;
    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      // If not JSON, return as text
      responseBody = responseText;
    }

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

