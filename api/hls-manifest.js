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
      console.log('🔑 Manifest headers:', JSON.stringify(customHeaders));
    } catch (e) {
      console.warn('⚠️ Headers error:', e.message);
    }
  }

  try {
    const response = await fetch(targetUrl, { headers: requestHeaders });

    if (!response.ok) {
      return new Response(`Manifest error: ${response.status}`, { 
        status: response.status 
      });
    }

    let manifestContent = await response.text();
    
    const urlObj = new URL(targetUrl);
    const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
    const baseUrl = `${urlObj.origin}${basePath}`;
    
    manifestContent = manifestContent.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      
      let segmentUrl = trimmed;
      
      if (segmentUrl.startsWith('http://') || segmentUrl.startsWith('https://')) {
        // Already absolute
      } else if (segmentUrl.startsWith('/')) {
        segmentUrl = `${urlObj.origin}${segmentUrl}`;
      } else {
        segmentUrl = baseUrl + segmentUrl;
      }
      
      let proxyUrl = `https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=${encodeURIComponent(segmentUrl)}`;
      
      if (headersParam) {
        proxyUrl += `&headers=${headersParam}`;
      }
      
      return proxyUrl;
    }).join('\n');
    
    return new Response(manifestContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('❌ Manifest error:', error.message);
    return new Response('Error: ' + error.message, { status: 500 });
  }
}
