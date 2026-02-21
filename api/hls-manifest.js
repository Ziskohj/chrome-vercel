export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
};

const PROXY_BASE =
  "https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=";

export default async function handler(req, res) {
  const { url, headers: headersParam } = req.query;

  if (!url) return res.status(400).send("Missing url parameter");

  // 🔥 CORS Chromecast SAFE
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Accept-Ranges");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const targetUrl = decodeURIComponent(url);

    // headers opcionales desde Swift
    let customHeaders = {};
    if (headersParam) {
      try {
        customHeaders = JSON.parse(decodeURIComponent(headersParam));
      } catch {}
    }

    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
        Accept: "*/*",
        Connection: "keep-alive",
        ...customHeaders,
      },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send("Manifest fetch error");
    }

    let manifest = await upstream.text();

    const baseUrl =
      targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

    // 🔥 rewrite completo Chromecast safe
    manifest = manifest
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // KEY
        if (trimmed.startsWith("#EXT-X-KEY")) {
          return line.replace(/URI="([^"]+)"/, (_, uri) => {
            const absolute =
              uri.startsWith("http") ? uri : baseUrl + uri;
            return `URI="${PROXY_BASE}${encodeURIComponent(absolute)}"`;
          });
        }

        // MAP (init segment)
        if (trimmed.startsWith("#EXT-X-MAP")) {
          return line.replace(/URI="([^"]+)"/, (_, uri) => {
            const absolute =
              uri.startsWith("http") ? uri : baseUrl + uri;
            return `URI="${PROXY_BASE}${encodeURIComponent(absolute)}"`;
          });
        }

        // segment
        if (!trimmed.startsWith("#")) {
          const absolute =
            trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;
          return `${PROXY_BASE}${encodeURIComponent(absolute)}`;
        }

        return line;
      })
      .join("\n");

    // 🔥 headers CRÍTICOS Chromecast
    res.setHeader("Content-Type", "application/x-mpegURL");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Accept-Ranges", "bytes");

    return res.status(200).send(manifest);
  } catch (e) {
    return res.status(500).send("Manifest proxy error");
  }
}
