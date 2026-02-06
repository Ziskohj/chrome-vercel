export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const headersParam = searchParams.get('headers');
  
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  const targetUrl = decodeURIComponent(url);
  
  const requestHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  
  if (headersParam) {
    try {
      const customHeaders = JSON.parse(decodeURIComponent(headersParam));
      Object.assign(requestHeaders, customHeaders);
      console.log('🔑 Headers:', JSON.stringify(customHeaders));
    } catch (e) {
      console.warn('⚠️ Headers error:', e.message);
    }
  }
  
  const range = req.headers.get('range');
  if (range) {
    requestHeaders['Range'] = range;
  }

  try {
    const response = await fetch(targetUrl, { 
      headers: requestHeaders,
      redirect: 'follow'
    });

    if (!response.ok) {
      return new Response(`Upstream error: ${response.status}`, { 
        status: response.status 
      });
    }

    let contentType = response.headers.get('content-type');
    if (!contentType || contentType === 'application/octet-stream') {
      const ext = targetUrl.split('.').pop().toLowerCase().split('?')[0];
      const mimeMap = {
        'ts': 'video/mp2t',
        'm3u8': 'application/vnd.apple.mpegurl',
        'mp4': 'video/mp4',
        'mkv': 'video/x-matroska',
        'webm': 'video/webm'
      };
      contentType = mimeMap[ext] || 'video/mp2t';
    }

    const headers = new Headers({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Cache-Control': 'no-cache'
    });

    ['content-length', 'content-range', 'accept-ranges'].forEach(h => {
      const val = response.headers.get(h);
      if (val) headers.set(h, val);
    });

    return new Response(response.body, {
      status: response.status,
      headers
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return new Response('Proxy error: ' + error.message, { status: 500 });
  }
}
