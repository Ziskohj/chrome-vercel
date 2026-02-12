export default async function handler(req, res) {
    const { url, headers } = req.query;

    if (!url) {
        return res.status(400).send("Missing url");
    }

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        const targetUrl = decodeURIComponent(url);
        
        let fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        if (headers) {
            try {
                const parsed = JSON.parse(headers);
                fetchHeaders = { ...fetchHeaders, ...parsed };
            } catch (e) {}
        }

        const response = await fetch(targetUrl, { headers: fetchHeaders });
        
        if (!response.ok) {
            return res.status(response.status).send("Manifest error");
        }

        const originalText = await response.text();
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        
        // 🔥 CAMBIO CLAVE: TU URL A FUEGO (HARDCODED)
        // Esto asegura que el Chromecast reciba siempre HTTPS correcto
        const proxyBase = "https://chrome-vercel-nu.vercel.app/api/cast-proxy";

        const newLines = originalText.split('\n').map(line => {
            const l = line.trim();
            if (!l || l.startsWith('#')) return l;

            let segmentUrl = l;
            if (!l.startsWith('http')) {
                segmentUrl = baseUrl + l;
            }

            // Codificamos la URL del segmento
            const encodedSegment = encodeURIComponent(segmentUrl);
            
            // Construimos la nueva línea apuntando a tu proxy
            let finalLine = `${proxyBase}?url=${encodedSegment}`;
            
            // Arrastramos los headers también a los segmentos
            if (headers) {
                finalLine += `&headers=${encodeURIComponent(headers)}`;
            }
            
            return finalLine;
        });

        const newManifest = newLines.join('\n');

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.status(200).send(newManifest);

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
}
