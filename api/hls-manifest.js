export default async function handler(req, res) {
    const { url } = req.query;
    
    if (!url) return res.status(400).send("Missing url parameter");
    
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    
    if (req.method === "OPTIONS") return res.status(200).end();
    
    try {
        const targetUrl = decodeURIComponent(url);
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        };
        
        if (targetUrl.includes("98sdfnjjjsi21") || targetUrl.includes("tu-proveedor-iptv")) {
            headers['Referer'] = 'http://98sdfnjjjsi21.online/';
        }
        
        const response = await fetch(targetUrl, { headers });
        
        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch manifest: ${response.status}`);
        }
        
        let manifestContent = await response.text();
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        
        // ✅ FIX: Reescribir URLs sin crear loop infinito
        manifestContent = manifestContent.split('\n').map(line => {
            const trimmed = line.trim();
            
            // Ignorar líneas vacías y comentarios
            if (!trimmed || trimmed.startsWith('#')) {
                return line;
            }
            
            // Construir URL absoluta si es relativa
            let segmentUrl = trimmed;
            if (!segmentUrl.startsWith('http')) {
                segmentUrl = baseUrl + segmentUrl;
            }
            
            // ✅ IMPORTANTE: Solo proxear si necesita headers especiales
            // Si no, dejar URL directa (Chromecast puede acceder directamente)
            if (segmentUrl.includes("98sdfnjjjsi21") || segmentUrl.includes("tu-proveedor-iptv")) {
                return `https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=${encodeURIComponent(segmentUrl)}`;
            } else {
                // URLs públicas accesibles directamente
                return segmentUrl;
            }
        }).join('\n');
        
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-cache"); // HLS manifests deben ser frescos
        res.status(200).send(manifestContent);
        
    } catch (error) {
        console.error("Manifest error:", error);
        res.status(500).send("Manifest error: " + error.message);
    }
}
