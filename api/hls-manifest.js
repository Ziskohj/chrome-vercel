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
    
    const proxyURL = `https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=${encodeURIComponent(url)}`;
    
    // Generar manifest HLS simple
    const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
${proxyURL}
#EXT-X-ENDLIST`;
    
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.status(200).send(manifest);
}
