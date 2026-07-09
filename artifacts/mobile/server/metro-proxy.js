/**
 * Replit Expo development proxy.
 *
 * Replit exposes $REPLIT_EXPO_DEV_DOMAIN → container:PORT (18115) via HTTPS.
 * Direct access to :18115 from the internet is connection-refused.
 *
 * This proxy runs on PORT and forwards to Metro on PORT+1 (18116).
 * For Expo manifest responses it strips the ":PORT+1" from every URL so
 * all bundle/asset requests resolve through Replit's HTTPS proxy (port 443).
 */

"use strict";

const http = require("http");
const net = require("net");

const PROXY_PORT = parseInt(process.env.PORT || "18115", 10);
const METRO_PORT = parseInt(process.env.METRO_PORT || String(PROXY_PORT + 1), 10);
const EXPO_DOMAIN = process.env.REPLIT_EXPO_DEV_DOMAIN;

function rewriteManifest(body) {
  if (!EXPO_DOMAIN) return body;

  const escaped = EXPO_DOMAIN.replace(/[.]/g, "\\.");

  // 1. Strip :PORT from full URLs using the Replit expo domain
  //    e.g. "https://xxx.expo.sisko.replit.dev:18116/bundle" → "https://xxx.../bundle"
  body = body.replace(
    new RegExp(`https?://${escaped}:\\d+`, "g"),
    `https://${EXPO_DOMAIN}`
  );

  // 2. Strip :PORT from full URLs using private / loopback hosts
  //    e.g. "http://127.0.0.1:18116/assets/..." → "https://xxx..."
  body = body.replace(
    /https?:\/\/(?:127\.0\.0\.1|localhost|172\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+/g,
    `https://${EXPO_DOMAIN}`
  );

  // 3. Strip :PORT from bare "host:port" JSON string values (hostUri, debuggerHost)
  //    These fields have no URL scheme prefix, e.g. "hostUri":"xxx.replit.dev:18116"
  body = body.replace(
    new RegExp(`"${escaped}:\\d+"`, "g"),
    `"${EXPO_DOMAIN}"`
  );
  body = body.replace(
    /"(?:127\.0\.0\.1|localhost|172\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+"/g,
    `"${EXPO_DOMAIN}"`
  );

  return body;
}

function isManifestRequest(req) {
  const accept = req.headers["accept"] || "";
  return (
    req.headers["expo-platform"] !== undefined ||
    accept.includes("application/expo+json") ||
    accept.includes("multipart/mixed")
  );
}

const server = http.createServer((req, res) => {
  const proxyOpts = {
    hostname: "localhost",
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${METRO_PORT}` },
  };

  const proxyReq = http.request(proxyOpts, (proxyRes) => {
    if (!isManifestRequest(req)) {
      // Pass non-manifest responses straight through
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
      return;
    }

    // Collect the full manifest body, rewrite, then forward
    const chunks = [];
    proxyRes.on("data", (c) => chunks.push(c));
    proxyRes.on("end", () => {
      let body = Buffer.concat(chunks).toString("utf8");
      body = rewriteManifest(body);

      const headers = { ...proxyRes.headers };
      headers["content-length"] = String(Buffer.byteLength(body, "utf8"));
      delete headers["transfer-encoding"]; // incompatible with known content-length

      res.writeHead(proxyRes.statusCode, headers);
      res.end(body);
    });
  });

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain" });
    }
    res.end("Metro proxy error: " + err.message);
  });

  req.pipe(proxyReq, { end: true });
});

// WebSocket upgrade proxy — needed for Metro HMR / fast refresh
server.on("upgrade", (req, socket, head) => {
  const target = net.connect(METRO_PORT, "localhost", () => {
    // Replay the HTTP upgrade request to Metro
    const headerLines = [
      `${req.method} ${req.url} HTTP/1.1`,
      ...Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`),
      "",
      "",
    ].join("\r\n");
    target.write(headerLines);
    if (head && head.length > 0) target.write(head);
  });

  target.pipe(socket, { end: true });
  socket.pipe(target, { end: true });

  socket.on("error", () => target.destroy());
  target.on("error", () => socket.destroy());
});

server.listen(PROXY_PORT, () => {
  console.log(
    `[metro-proxy] Listening on :${PROXY_PORT}  →  Metro :${METRO_PORT}`
  );
  if (EXPO_DOMAIN) {
    console.log(`[metro-proxy] Rewriting URLs to https://${EXPO_DOMAIN}`);
  }
});
