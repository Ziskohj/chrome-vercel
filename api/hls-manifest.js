export default async function handler(req, res) {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).send("Missing url parameter");
    }
    
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    try {
        const targetUrl = decodeURIComponent(url);
        
        // Usamos la URL original sin modificar extensiones
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // 'Referer': 'http://98sdfnjjjsi21.online/' <-- COMENTADO PARA QUE FUNCIONE CON TODO
            }
        });
        
        if (!response.ok) {
            return res.status(response.status).send("Failed to fetch manifest");
        }
        
        let manifestContent = await response.text();
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        
        manifestContent = manifestContent.split('\n').map(line => {
            if (line && !line.startsWith('#')) {
                let segmentUrl = line.trim();
                
                // Resolver rutas relativas
                if (!segmentUrl.startsWith('http')) {
                    segmentUrl = baseUrl + segmentUrl;
                }
                
                // Redirigir al proxy universal
                // IMPORTANTE: encodeURIComponent es vital
                return `https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=${encodeURIComponent(segmentUrl)}`;
            }
            return line;
        }).join('\n');
        
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.status(200).send(manifestContent);
        
    } catch (error) {
        res.status(500).send("Manifest error: " + error.message);
    }
}
