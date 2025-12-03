export default async function handler(req, res) {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).send("Missing url parameter");
    }
    
    // CORS completo
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Expose-Headers", "*");
    
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    try {
        const targetUrl = decodeURIComponent(url);
        const m3u8Url = targetUrl.replace(/\.ts$/, '.m3u8');
        
        const response = await fetch(m3u8Url);
        
        if (!response.ok) {
            return res.status(response.status).send("Failed to fetch manifest");
        }
        
        const manifestContent = await response.text();
        
        // NO reescribir URLs - pasar manifest original con CORS
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.status(200).send(manifestContent);
        
    } catch (error) {
        res.status(500).send("Manifest error: " + error.message);
    }
}
