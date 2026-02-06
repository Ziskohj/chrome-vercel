import { Readable } from 'stream';

export default async function handler(req, res) {
    const { url, headers: headersParam } = req.query;
    
    if (!url) return res.status(400).send("Missing url parameter");
    
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    
    if (req.method === "OPTIONS") return res.status(200).end();
    
    let headersSent = false;
    
    try {
        const targetUrl = decodeURIComponent(url);
        
        let requestHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        };
        
        if (headersParam) {
            try {
                const customHeaders = JSON.parse(decodeURIComponent(headersParam));
                requestHeaders = { ...requestHeaders, ...customHeaders };
                console.log("🔑 Custom headers:", JSON.stringify(customHeaders));
            } catch (e) {
                console.warn("⚠️ Headers parse error:", e.message);
            }
        }
        
        if (req.headers.range) {
            requestHeaders['Range'] = req.headers.range;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(targetUrl, { 
            headers: requestHeaders,
            redirect: 'follow',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            return res.status(response.status).send(`Upstream error: ${response.status}`);
        }
        
        // Determinar Content-Type
        let contentType = response.headers.get("content-type");
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
        
        // Copiar headers importantes
        res.setHeader("Content-Type", contentType);
        
        const headersToProxy = ['content-length', 'content-range', 'accept-ranges', 'cache-control'];
        headersToProxy.forEach(h => {
            const val = response.headers.get(h);
            if (val) res.setHeader(h, val);
        });
        
        res.status(response.status);
        headersSent = true;
        
        // ✅ STREAMING CON NODEJS STREAM API (Compatible con Vercel)
        if (response.body) {
            const nodeStream = Readable.fromWeb(response.body);
            
            nodeStream.on('error', (err) => {
                console.error("❌ Stream error:", err.message);
                if (!res.writableEnded) res.end();
            });
            
            req.on('close', () => {
                nodeStream.destroy();
            });
            
            nodeStream.pipe(res);
        } else {
            // Fallback si no hay body
            res.end();
        }
        
    } catch (error) {
        console.error("❌ Proxy error:", error.message);
        
        if (!headersSent && !res.headersSent && !res.writableEnded) {
            res.status(500).send("Proxy error: " + error.message);
        } else if (!res.writableEnded) {
            res.end();
        }
    }
}
