export default async function handler(req, res) {
    const { url, headers: headersParam } = req.query;
    
    if (!url) return res.status(400).send("Missing url parameter");
    
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    
    if (req.method === "OPTIONS") return res.status(200).end();
    
    try {
        const targetUrl = decodeURIComponent(url);
        
        let requestHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        };
        
        if (headersParam) {
            try {
                const customHeaders = JSON.parse(decodeURIComponent(headersParam));
                requestHeaders = { ...requestHeaders, ...customHeaders };
                console.log("🔑 Manifest using headers:", JSON.stringify(customHeaders));
            } catch (e) { 
                console.warn("⚠️ Error parsing headers:", e.message); 
            }
        }
        
        const response = await fetch(targetUrl, { headers: requestHeaders });
        
        if (!response.ok) {
            return res.status(response.status).send(`Manifest Error: ${response.status}`);
        }
        
        let manifestContent = await response.text();
        
        const urlObj = new URL(targetUrl);
        const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
        const baseUrl = `${urlObj.origin}${basePath}`;
        
        manifestContent = manifestContent.split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;
            
            let segmentUrl = trimmed;
            
            if (segmentUrl.startsWith('http://') || segmentUrl.startsWith('https://')) {
                // Ya es absoluta
            } else if (segmentUrl.startsWith('/')) {
                segmentUrl = `${urlObj.origin}${segmentUrl}`;
            } else {
                segmentUrl = baseUrl + segmentUrl;
            }
            
            let proxyUrl = `https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=${encodeURIComponent(segmentUrl)}`;
            
            if (headersParam) {
                proxyUrl += `&headers=${headersParam}`;
            }
            
            return proxyUrl;
        }).join('\n');
        
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.status(200).send(manifestContent);
        
    } catch (error) {
        console.error("❌ Manifest error:", error.message);
        if (!res.headersSent) {
            res.status(500).send("Error: " + error.message);
        }
    }
}
