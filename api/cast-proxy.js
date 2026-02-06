export default async function handler(req, res) {
    const { url } = req.query;
    
    if (!url) return res.status(400).send("Missing url parameter");
    
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    
    if (req.method === "OPTIONS") return res.status(200).end();
    
    try {
        const targetUrl = decodeURIComponent(url);
        
        // Headers base
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        
        // LOGICA INTELIGENTE: Inyectar Referer solo para tu proveedor específico
        if (targetUrl.includes("98sdfnjjjsi21") || targetUrl.includes("tu-proveedor-iptv")) {
            headers['Referer'] = 'http://98sdfnjjjsi21.online/';
        }
        
        // Soportar Range Requests (crucial para poder adelantar/atrasar video)
        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }
        
        const response = await fetch(targetUrl, { 
            headers,
            redirect: 'follow' 
        });
        
        if (!response.ok) {
            return res.status(response.status).send(`Upstream error: ${response.status}`);
        }
        
        // Detección robusta de Content-Type
        let contentType = response.headers.get("content-type");
        
        if (!contentType || contentType === 'application/octet-stream') {
            // Intentar detectar por extensión de URL si el servidor no nos lo dice
            const ext = targetUrl.split('.').pop().toLowerCase().split('?')[0];
            const mimeMap = {
                'ts': 'video/mp2t',
                'mp4': 'video/mp4',
                'mkv': 'video/x-matroska',
                'webm': 'video/webm',
                'm3u8': 'application/vnd.apple.mpegurl',
                'mpd': 'application/dash+xml'
            };
            contentType = mimeMap[ext] || 'video/mp2t'; // Fallback a TS si todo falla
        }
        
        res.setHeader("Content-Type", contentType);
        
        // Copiar headers críticos de streaming
        ['content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag'].forEach(h => {
            const value = response.headers.get(h);
            if (value) res.setHeader(h, value);
        });
        
        res.status(response.status);
        
        // Stream eficiente usando Pipe
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();
        
    } catch (error) {
        console.error("Proxy error:", error);
        res.status(500).send("Proxy error: " + error.message);
    }
}
