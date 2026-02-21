export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
};

const PROXY_BASE =
  "https://chrome-vercel-nu.vercel.app/api/cast-proxy?url=";

/*
  PRINCIPIOS NUEVOS:
  - Manifest SIEMPRE reescrito absoluto
  - Soporte KEY / MAP / BYTERANGE
  - Mantener query params (CRÍTICO Chromecast)
  - No decisiones de mime
*/

function abs(base: string, value: string) {
  if (!value) return value;
  if (value.startsWith("http")) return value;
  return base + value;
}

export default async function handler(req, res) {
  const { url, headers: headersParam } = req.query;

  if (!url) return res.status(400).send("Missing url");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Accept-Ranges, Content-Range"
  );

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const targetUrl = decodeURIComponent(url);

    let customHeaders = {};
    if (headersParam) {
      try {
        customHeaders = JSON.parse(decodeURIComponent(headersParam));
      } catch {}
    }

    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 ChromecastManifest",
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

    /*
      🔥 REWRITE UNIVERSAL
      - KEY
      - MAP
      - IFRAME playlists
      - Segments
    */

    manifest = manifest
      .split("\n")
      .map((line) => {
        const t = line.trim();
        if (!t) return line;

        // URI attributes (KEY, MAP, IFRAME etc)
        if (t.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/g, (_, uri) => {
            const absolute = abs(baseUrl, uri);
            return `URI="${PROXY_BASE}${encodeURIComponent(absolute)}"`;
          });
        }

        // Variant playlist (.m3u8 inside .m3u8)
        if (!t.startsWith("#") && t.includes(".m3u8")) {
          const absolute = abs(baseUrl, t);
          return `${PROXY_BASE}${encodeURIComponent(absolute)}`;
        }

        // Segments (.ts .m4s etc)
        if (!t.startsWith("#")) {
          const absolute = abs(baseUrl, t);
          return `${PROXY_BASE}${encodeURIComponent(absolute)}`;
        }

        return line;
      })
      .join("\n");

    res.setHeader("Content-Type", "application/x-mpegURL");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Accept-Ranges", "bytes");

    return res.status(200).send(manifest);
  } catch (e) {
    return res.status(500).send("Manifest proxy error");
  }
}
