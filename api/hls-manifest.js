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
        
        // Referer selectivo
        if (targetUrl.includes("98sdfnjjjsi21") || targetUrl.includes("tu-proveedor-iptv")) {
            headers['Referer'] = 'http://98sdfnjjjsi21.online/';
        }
        
        const response = await fetch(targetUrl, { headers });
        
        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch manifest: ${response.status}`);
        }
        
        let manifestContent = await response.text();
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        
        // Procesamiento inteligente línea a línea
        manifestContent = manifestContent.split('\n').map(line => {
            const trimmed = line.trim();
            
            // Ignorar líneas vacías y metadatos (#)
            if (!trimmed || trimmed.startsWith('#')) {
                return line;
            }
            
            // Construir URL absoluta
            let segmentUrl = trimmed;
            if (!segmentUrl.startsWith('http')) {
                segmentUrl = baseUrl + segmentUrl;
            }
            
            // LOGICA CRÍTICA: ¿Necesitamos proxy para este segmento?
            // Solo usamos proxy si el segmento viene del servidor protegido.
            // Esto evita bucles infinitos y reduce carga.
            if (segmentUrl.includes("98sdfnjjjsi21") || segmentUrl.includes("tu-proveedor-iptv")) {
                return `https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=${encodeURIComponent(segmentUrl)}`;
            } else {
                // Si es un enlace externo (ej: intro.mp4 público), lo dejamos directo
                return segmentUrl;
            }
        }).join('\n');
        
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        // Importante: No cachear el manifest para Live TV
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        
        res.status(200).send(manifestContent);
        
    } catch (error) {
        console.error("Manifest error:", error);
        res.status(500).send("Manifest error: " + error.message);
    }
}
