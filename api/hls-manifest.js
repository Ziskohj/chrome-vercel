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
        const m3u8Url = targetUrl.replace(/\.ts$/, '.m3u8');
        
        const response = await fetch(m3u8Url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'http://98sdfnjjjsi21.online/'
            }
        });
        
        if (!response.ok) {
            return res.status(response.status).send("Failed to fetch manifest");
        }
        
        let manifestContent = await response.text();
        const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
        
        manifestContent = manifestContent.split('\n').map(line => {
            if (line && !line.startsWith('#')) {
                let segmentUrl = line.trim();
                if (!segmentUrl.startsWith('http')) {
                    segmentUrl = baseUrl + segmentUrl;
                }
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
