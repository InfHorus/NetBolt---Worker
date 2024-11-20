export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.split('/');
      path.shift(); // Remove empty first element
      
      if (path[0] !== 'v1') {
        return new Response('Invalid API version', { status: 400 });
      }

      // CORS headers for Garry's Mod HTTP requests
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Content-Length, Accept, X-Auth-Token, X-Data-Hash'
      };

      // Handle OPTIONS preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
      
      const action = path[1];
      
      switch (action) {
        case 'register':
          return handleRegister(corsHeaders);
          
        case 'write':
          return handleWrite(request, env.gmod_netbolt, corsHeaders);
          
        case 'read':
          return handleRead(path[2], env.gmod_netbolt, corsHeaders);
          
        case 'size':
          return handleSize(path[2], env.gmod_netbolt, corsHeaders);
          
        case 'revision':
          return new Response(JSON.stringify({ revision: 1 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        default:
          return new Response('Invalid action', { status: 400 });
      }
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  }
};

async function handleRegister(corsHeaders) {
  // Generate unique tokens for server and client
  const serverToken = crypto.randomUUID();
  const clientToken = crypto.randomUUID();
  
  return new Response(JSON.stringify({
    server: serverToken,
    client: clientToken
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleWrite(request, kv, corsHeaders) {
  // Check for auth token
  const authToken = request.headers.get('X-Auth-Token');
  if (!authToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const data = await request.arrayBuffer();
  if (data.byteLength > 25 * 1024 * 1024) { // 25MB limit
    return new Response('Data too large', { status: 413 });
  }

  const id = crypto.randomUUID();
  
  await kv.put(id, data, {
    expirationTtl: 86400 // 24 hours
  });
  
  return new Response(JSON.stringify({ id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleRead(id, kv, corsHeaders) {
  if (!id) {
    return new Response('Missing ID', { status: 400 });
  }

  const data = await kv.get(id, 'arrayBuffer');
  if (!data) {
    return new Response('Not found', { status: 404 });
  }
  
  return new Response(data, {
    headers: { ...corsHeaders, 'Content-Type': 'application/octet-stream' }
  });
}

async function handleSize(id, kv, corsHeaders) {
  if (!id) {
    return new Response('Missing ID', { status: 400 });
  }

  const data = await kv.get(id, 'arrayBuffer');
  if (!data) {
    return new Response('Not found', { status: 404 });
  }
  
  return new Response(JSON.stringify({
    size: data.byteLength
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}