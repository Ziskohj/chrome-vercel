import { pipeline } from "stream";
import { promisify } from "util";
import { Readable } from "stream";

const streamPipeline = promisify(pipeline);

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
   PRINCIPIO:
   - NO detectar mime
   - NO decidir nada
   - SOLO reenviar
*/

function isValidUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).send("Missing url");

  const decoded = decodeURIComponent(url);

  if (!isValidUrl(decoded)) {
    return res.status(400).send("Invalid URL");
  }

  /* CORS Chromecast */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    /* PASSTHROUGH HEADERS */
    const headers: any = {
      "User-Agent": "Mozilla/5.0 ChromecastProxy",
      Accept: "*/*",
      Connection: "keep-alive",
    };

    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const upstream = await fetch(decoded, {
      headers,
      redirect: "follow",
    });

    /* HEAD passthrough */
    if (req.method === "HEAD") {
      res.setHeader(
        "Content-Type",
        upstream.headers.get("content-type") || "application/octet-stream"
      );

      if (upstream.headers.get("content-length")) {
        res.setHeader(
          "Content-Length",
          upstream.headers.get("content-length")
        );
      }

      res.setHeader("Accept-Ranges", "bytes");

      return res.status(upstream.status).end();
    }

    const cleanUrl = decoded.split("?")[0];
    const ext = cleanUrl.split(".").pop()?.toLowerCase();

    /* ================================
       HLS REWRITE (UNIVERSAL)
    ================================= */

    const contentType = upstream.headers.get("content-type") || "";

    if (ext === "m3u8" || contentType.includes("mpegurl")) {
      const text = await upstream.text();

      const baseUrl =
        decoded.substring(0, decoded.lastIndexOf("/") + 1);

      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          /* KEY */
          if (trimmed.includes("URI=")) {
            return line.replace(/URI="([^"]+)"/, (_, uri) => {
              const absolute =
                uri.startsWith("http") ? uri : baseUrl + uri;
              return `URI="${PROXY_BASE}${encodeURIComponent(absolute)}"`;
            });
          }

          /* segment */
          if (!trimmed.startsWith("#")) {
            const absolute =
              trimmed.startsWith("http")
                ? trimmed
                : baseUrl + trimmed;

            return `${PROXY_BASE}${encodeURIComponent(absolute)}`;
          }

          return line;
        })
        .join("\n");

      res.setHeader(
        "Content-Type",
        "application/vnd.apple.mpegurl"
      );
      res.setHeader("Cache-Control", "no-store");

      return res.status(200).send(rewritten);
    }

    /* ================================
       STREAM PASSTHROUGH (DUMB)
    ================================= */

    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/octet-stream"
    );

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-store");

    if (upstream.headers.get("content-length")) {
      res.setHeader(
        "Content-Length",
        upstream.headers.get("content-length")
      );
    }

    if (upstream.headers.get("content-range")) {
      res.setHeader(
        "Content-Range",
        upstream.headers.get("content-range")
      );
    }

    res.status(upstream.status);

    const nodeStream = Readable.fromWeb(upstream.body);

    nodeStream.on("error", () => {
      if (!res.headersSent) res.status(500).end();
    });

    await streamPipeline(nodeStream, res);
  } catch {
    if (!res.headersSent) {
      res.status(500).send("Proxy error");
    }
  }
}
