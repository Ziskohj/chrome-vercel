export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  const { url, headers: headersParam } = req.query;

  if (!url) {
    return res.status(400).send("Missing url parameter");
  }

  // CORS robusto para Chromecast
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const targetUrl = decodeURIComponent(url);

    // Parsear headers custom enviados desde Swift
    let customHeaders = {};
    if (headersParam) {
      try {
        customHeaders = JSON.parse(decodeURIComponent(headersParam));
      } catch {}
    }

    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ...customHeaders,
      },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .send("Failed to fetch manifest");
    }

    let manifest = await upstream.text();
    const baseUrl =
      targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

    const proxyBase = "https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=";

    manifest = manifest
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();

        if (!trimmed) return line;

        // 🔐 EXT-X-KEY (DRM keys)
        if (trimmed.startsWith("#EXT-X-KEY")) {
          return line.replace(/URI="([^"]+)"/, (match, uri) => {
            const absolute =
              uri.startsWith("http") ? uri : baseUrl + uri;
            return `URI="${proxyBase}${encodeURIComponent(
              absolute
            )}"`;
          });
        }

        // 🧱 EXT-X-MAP (init segments)
        if (trimmed.startsWith("#EXT-X-MAP")) {
          return line.replace(/URI="([^"]+)"/, (match, uri) => {
            const absolute =
              uri.startsWith("http") ? uri : baseUrl + uri;
            return `URI="${proxyBase}${encodeURIComponent(
              absolute
            )}"`;
          });
        }

        // 📦 Segmentos normales
        if (!trimmed.startsWith("#")) {
          const absolute =
            trimmed.startsWith("http")
              ? trimmed
              : baseUrl + trimmed;

          return `${proxyBase}${encodeURIComponent(absolute)}`;
        }

        return line;
      })
      .join("\n");

    res.setHeader(
      "Content-Type",
      "application/vnd.apple.mpegurl"
    );

    return res.status(200).send(manifest);
  } catch (error) {
    return res.status(500).send("Manifest error");
  }
}
