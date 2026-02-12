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

const ALLOWED_PROTOCOLS = ["http:", "https:"];

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const { url, headers: customHeadersParam } = req.query;

  if (!url) {
    return res.status(400).send("Missing url parameter");
  }

  const decodedUrl = decodeURIComponent(url);

  if (!isValidUrl(decodedUrl)) {
    return res.status(400).send("Invalid URL");
  }

  // 🔥 CORS Chromecast-safe
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Range, Content-Type, Accept, User-Agent, Referer"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Range, Content-Length, Accept-Ranges"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 🔹 Headers dinámicos opcionales (Referer etc)
    let dynamicHeaders = {};
    if (customHeadersParam) {
      try {
        dynamicHeaders = JSON.parse(decodeURIComponent(customHeadersParam));
      } catch {}
    }

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "*/*",
      Connection: "keep-alive",
      ...dynamicHeaders,
    };

    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    // 🔹 Timeout conexión inicial (30s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const upstream = await fetch(decodedUrl, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!upstream.ok && upstream.status !== 206) {
      return res
        .status(upstream.status)
        .send(`Upstream error: ${upstream.statusText}`);
    }

    const cleanUrl = decodedUrl.split("?")[0];
    const ext = cleanUrl.split(".").pop().toLowerCase();

    const mimeMap = {
      mp4: "video/mp4",
      mkv: "video/x-matroska",
      m3u8: "application/vnd.apple.mpegurl",
      ts: "video/mp2t",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mpd: "application/dash+xml",
    };

    let contentType = upstream.headers.get("content-type");

    if (
      !contentType ||
      contentType === "application/octet-stream" ||
      contentType.includes("text/plain")
    ) {
      contentType = mimeMap[ext] || "video/mp4";
    }

    // 🔹 HEAD probe (Chromecast lo usa constantemente)
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

    // 🔥 HLS Rewrite CORREGIDO
    if (ext === "m3u8" || contentType.includes("mpegurl")) {
      const text = await upstream.text();
      const baseUrl =
        decodedUrl.substring(0, decodedUrl.lastIndexOf("/") + 1);

      const rewritten = text.replace(/^(?!#)(.+)$/gm, (line) => {
        const absoluteUrl = line.startsWith("http")
          ? line
          : baseUrl + line;

        return `/api/cast-proxy?url=${encodeURIComponent(
          absoluteUrl
        )}`;
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.apple.mpegurl"
      );

      return res.status(200).send(rewritten);
    }

    // 🔹 Streaming normal (MP4/MKV/TS/etc)
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");

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
