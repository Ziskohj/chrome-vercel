export default async function handler(req, res) {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).send("Missing url parameter");
    }
    
    // CORS para Chromecast
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    try {
        const targetUrl = decodeURIComponent(url);
        const headers = {};
        
        // Pasar Range header si existe
        if (req.headers.range) {
            headers.Range = req.headers.range;
        }
        
        const response = await fetch(targetUrl, { headers });
        
        if (!response.ok) {
            return res.status(response.status).send("Upstream error");
        }
        
        // Copiar headers relevantes
        res.setHeader("Content-Type", "video/mp2t");
        
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
        
        // Stream del contenido
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
