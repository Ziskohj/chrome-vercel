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

const MAX_RETRIES = 3;
const INITIAL_TIMEOUT = 60000;

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function detectMime(ext) {
  const map = {
    mp4: "video/mp4",
    mkv: "video/x-matroska",
    m3u8: "application/vnd.apple.mpegurl",
    ts: "video/mp2t",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mpd: "application/dash+xml",
    webm: "video/webm",
  };
  return map[ext] || "video/mp4";
}

async function fetchWithRetry(url, headers, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    INITIAL_TIMEOUT
  );

  try {
    const response = await fetch(url, {
      headers,
      redirect: "follow", // 🔥 seguimos el 302 INTERNAMENTE
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok && response.status !== 206) {
      throw new Error("Upstream error");
    }

    return response;
  } catch (err) {
    clearTimeout(timeout);

    if (attempt < MAX_RETRIES) {
      return fetchWithRetry(url, headers, attempt + 1);
    }

    throw err;
  }
}

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).send("Missing url");

  const decodedUrl = decodeURIComponent(url);

  if (!isValidUrl(decodedUrl))
    return res.status(400).send("Invalid URL");

  // 🔥 Chromecast CORS Safe
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Range, Content-Type, Accept"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Range, Content-Length, Accept-Ranges"
  );

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
      Accept: "*/*",
      Connection: "keep-alive",
    };

    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const upstream = await fetchWithRetry(decodedUrl, headers);

    // 🔥 URL FINAL REAL (después del 302)
    const finalUrl = upstream.url;

    const cleanUrl = finalUrl.split("?")[0];
    const ext = cleanUrl.split(".").pop().toLowerCase();

    let contentType = upstream.headers.get("content-type");

    if (
      !contentType ||
      contentType.includes("octet-stream") ||
      contentType.includes("text/plain")
    ) {
      contentType = detectMime(ext);
    }

    if (ext === "ts") contentType = "video/mp2t";

    // 🔥 HEAD probe
    if (req.method === "HEAD") {
      res.setHeader("Content-Type", contentType);
      res.setHeader("Accept-Ranges", "bytes");
      if (upstream.headers.get("content-length")) {
        res.setHeader(
          "Content-Length",
          upstream.headers.get("content-length")
        );
      }
      return res.status(upstream.status).end();
    }

    // 🔥 HLS Rewrite con URL FINAL REAL
    if (ext === "m3u8" || contentType.includes("mpegurl")) {
      const text = await upstream.text();

      const baseUrl =
        finalUrl.substring(0, finalUrl.lastIndexOf("/") + 1);

      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          if (trimmed.startsWith("#EXT-X-KEY")) {
            return line.replace(/URI="([^"]+)"/, (_, uri) => {
              const absolute = uri.startsWith("http")
                ? uri
                : baseUrl + uri;

              return `URI="${PROXY_BASE}${encodeURIComponent(
                absolute
              )}"`;
            });
          }

          if (!trimmed.startsWith("#")) {
            const absolute = trimmed.startsWith("http")
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

    // 🔥 Streaming normal robusto
    res.setHeader("Content-Type", contentType);
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
