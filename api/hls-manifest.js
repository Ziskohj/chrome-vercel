export default async function handler(req, res) {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).send("Missing url parameter");
    }
    
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    try {
        const targetUrl = decodeURIComponent(url);
        
        // --- CAMBIO IMPORTANTE: Eliminado el replace .ts -> .m3u8 ---
        // Usamos la URL tal cual nos la envía la app.
        const m3u8Url = targetUrl; 
        
        const response = await fetch(m3u8Url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', // User agent más completo
                'Referer': 'http://98sdfnjjjsi21.online/'
            }
        });
        
        if (!response.ok) {
            return res.status(response.status).send("Failed to fetch manifest");
        }
        
        let manifestContent = await response.text();
        const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
        
        manifestContent = manifestContent.split('\n').map(line => {
            // Ignoramos comentarios y líneas vacías
            if (line && !line.startsWith('#')) {
                let segmentUrl = line.trim();
                
                // Si la URL del segmento es relativa, la hacemos absoluta
                if (!segmentUrl.startsWith('http')) {
                    segmentUrl = baseUrl + segmentUrl;
                }
                
                // Redirigimos cada trocito de video (ts) a nuestro otro proxy
                // Asegúrate de que esta URL coincida EXACTAMENTE con la tuya
                return `https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=${encodeURIComponent(segmentUrl)}`;
            }
            return line;
        }).join('\n');
        
        // Tipo correcto para HLS
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl"); // O application/x-mpegurl
        res.status(200).send(manifestContent);
        
    } catch (error) {
        res.status(500).send("Manifest error: " + error.message);
    }
}
