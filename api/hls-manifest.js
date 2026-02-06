export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const headersParam = searchParams.get('headers');
  
  if (!url) {
    return new Response('Missing url', { status: 400 });
  }

  const targetUrl = decodeURIComponent(url);
  
  const requestHeaders = {
    'User-Agent': 'Mozilla/5.0',
  };
  
  if (headersParam) {
    try {
      const custom = JSON.parse(decodeURIComponent(headersParam));
      Object.assign(requestHeaders, custom);
    } catch (e) {}
  }

  try {
    const response = await fetch(targetUrl, { headers: requestHeaders });

    if (!response.ok) {
      return new Response(`Error ${response.status}`, { status: response.status });
    }

    let manifest = await response.text();
    
    const urlObj = new URL(targetUrl);
    const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
    const baseUrl = `${urlObj.origin}${basePath}`;
    
    manifest = manifest.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      
      let segmentUrl = trimmed;
      
      if (!segmentUrl.startsWith('http')) {
        if (segmentUrl.startsWith('/')) {
          segmentUrl = `${urlObj.origin}${segmentUrl}`;
        } else {
          segmentUrl = baseUrl + segmentUrl;
        }
      }
      
      let proxyUrl = `https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=${encodeURIComponent(segmentUrl)}`;
      
      if (headersParam) {
        proxyUrl += `&headers=${headersParam}`;
      }
      
      return proxyUrl;
    }).join('\n');
    
    return new Response(manifest, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}
