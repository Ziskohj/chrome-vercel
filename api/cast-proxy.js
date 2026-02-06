export default async function handler(req, res) {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).send("Missing url parameter");
    }
    
    // CORS: Usamos * en Headers para evitar problemas con reproductores estrictos
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*"); 
    
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    try {
        const targetUrl = decodeURIComponent(url);
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            // 'Referer': 'http://98sdfnjjjsi21.online/'  <-- COMENTADO PARA QUE FUNCIONE CON TODO
        };
        
        if (req.headers.range) {
            headers.Range = req.headers.range;
        }
        
        const response = await fetch(targetUrl, { headers });
        
        if (!response.ok) {
            return res.status(response.status).send("Upstream error");
        }
        
        // Detección automática del formato (MP4, MKV, TS, etc.)
        const contentType = response.headers.get("content-type");
        if (contentType) {
             res.setHeader("Content-Type", contentType);
        } else {
             res.setHeader("Content-Type", "video/mp2t"); // Fallback seguro
        }
        
        // Copiamos headers vitales para el streaming
        if (response.headers.get("content-length")) {
            res.setHeader("Content-Length", response.headers.get("content-length"));
        }
        if (response.headers.get("content-range")) {
            res.setHeader("Content-Range", response.headers.get("content-range"));
        }
        if (response.headers.get("accept-ranges")) {
            res.setHeader("Accept-Ranges", response.headers.get("accept-ranges"));
        }
        
        res.status(response.status);
        
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();
        
    } catch (error) {
        res.status(500).send("Proxy error: " + error.message);
    }
}
