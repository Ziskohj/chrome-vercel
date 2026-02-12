export default async function handler(req, res) {
    const { url, headers } = req.query;

    if (!url) {
        return res.status(400).send("Missing url");
    }

    // Cabeceras CORS vitales para Chromecast
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        const targetUrl = decodeURIComponent(url);
        
        // Preparamos cabeceras para engañar al IPTV
        let fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        // Si la app nos envía headers (ej: IPTVSmartersPlayer), los usamos
        if (headers) {
            try {
                const parsed = JSON.parse(headers);
                fetchHeaders = { ...fetchHeaders, ...parsed };
            } catch (e) {}
        }

        // Descargamos el m3u8 original
        const response = await fetch(targetUrl, { headers: fetchHeaders });
        
        if (!response.ok) {
            return res.status(response.status).send("Manifest error");
        }

        const originalText = await response.text();
        
        // --- LA MAGIA: REESCRITURA DE URLs ---
        // Calculamos la base para URLs relativas
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        
        // Construimos la URL de ESTE proxy (dinámicamente o fija)
        // 🔥 IMPORTANTE: Asegúrate de que esto apunta a TU `cast-proxy`
        const myHost = req.headers.host; 
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const proxyBase = `${protocol}://${myHost}/api/cast-proxy`;

        // Procesamos línea a línea
        const newLines = originalText.split('\n').map(line => {
            const l = line.trim();
            if (!l || l.startsWith('#')) return l; // Dejar comentarios igual

            // Es una URL de video (segmento)
            let segmentUrl = l;
            
            // Si es relativa, la hacemos absoluta
            if (!l.startsWith('http')) {
                segmentUrl = baseUrl + l;
            }

            // Envolvemos la URL del segmento en nuestro proxy
            // Pasamos también los headers para que el segmento se baje con el User-Agent correcto
            const encodedSegment = encodeURIComponent(segmentUrl);
            let finalLine = `${proxyBase}?url=${encodedSegment}`;
            
            if (headers) {
                finalLine += `&headers=${encodeURIComponent(headers)}`;
            }
            
            return finalLine;
        });

        const newManifest = newLines.join('\n');

        // Devolvemos el m3u8 modificado como HLS oficial
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.status(200).send(newManifest);

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
}
