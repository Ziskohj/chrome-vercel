export default async function handler(req, res) {
    // 1. Leemos también el parámetro 'headers' que envía Swift
    const { url, headers: customHeaders } = req.query;
    
    if (!url) {
        return res.status(400).send("Missing url parameter");
    }
    
    // CORS (Vital para Chromecast)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    try {
        const targetUrl = decodeURIComponent(url);
        
        // 2. Preparamos las cabeceras por defecto
        let fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        // 3. 🔥 MAGIA AQUÍ: Inyectamos las cabeceras que vienen de la App (Swift)
        // Esto permite que el User-Agent sea "IPTVSmartersPlayer" cuando lo pide la app.
        if (customHeaders) {
            try {
                const parsedHeaders = JSON.parse(customHeaders);
                fetchHeaders = { ...fetchHeaders, ...parsedHeaders };
            } catch (e) {
                console.error("Error parsing custom headers:", e);
            }
        }
        
        // Pasamos el rango si el Chromecast lo pide (seek)
        if (req.headers.range) {
            fetchHeaders.Range = req.headers.range;
        }
        
        const response = await fetch(targetUrl, { headers: fetchHeaders });
        
        if (!response.ok) {
            return res.status(response.status).send("Upstream error");
        }
        
        // 4. Gestión del Content-Type
        const contentType = response.headers.get("content-type");
        if (contentType) {
             res.setHeader("Content-Type", contentType);
        } else {
             // Si el servidor original no dice qué es, miramos la extensión
             if (targetUrl.includes('.m3u8')) {
                 res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
             } else {
                 res.setHeader("Content-Type", "video/mp2t");
             }
        }
        
        // Copiamos cabeceras útiles
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
        
        // Streaming de datos (Pipe)
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();
        
    } catch (error) {
        console.error(error);
        res.status(500).send("Proxy error: " + error.message);
    }
}
