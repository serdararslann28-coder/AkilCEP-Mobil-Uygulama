/**
 * Replit Expo development proxy.
 *
 * Problem: Replit only exposes the container externally on port 443 (HTTPS)
 * via $REPLIT_EXPO_DEV_DOMAIN. Metro runs on PORT+1 internally and embeds
 * raw port numbers (e.g. :18116) into every manifest URL it generates —
 * making those URLs unreachable from a physical device.
 *
 * Solution:
 *   1. This proxy listens on PORT (18115) — what Replit's expo-domain router
 *      forwards to.
 *   2. All requests are forwarded to Metro on PORT+1 (18116).
 *   3. For Expo manifest responses (multipart/mixed or application/expo+json),
 *      every ":PORT" occurrence is stripped from URLs so Expo Go resolves them
 *      through Replit's HTTPS proxy (port 443) instead of the internal port.
 *   4. GET /__expo serves an HTML page showing the correct QR code so the user
 *      can scan the right URL (exps://domain, not exp://domain:PORT).
 */

"use strict";

const http = require("http");
const net = require("net");

const PROXY_PORT = parseInt(process.env.PORT || "18115", 10);
const METRO_PORT = parseInt(process.env.METRO_PORT || String(PROXY_PORT + 1), 10);
const EXPO_DOMAIN = process.env.REPLIT_EXPO_DEV_DOMAIN;

// The correct URL Expo Go must use — exps:// so it connects via HTTPS (port 443)
const EXPO_GO_URL = EXPO_DOMAIN ? `exps://${EXPO_DOMAIN}` : null;

// ─── URL rewriting ────────────────────────────────────────────────────────────

function rewriteManifest(body) {
  if (!EXPO_DOMAIN) return body;

  const escaped = EXPO_DOMAIN.replace(/[.]/g, "\\.");

  // 1. Full HTTPS/HTTP URLs containing the Replit expo domain with a port
  //    e.g. "http://xxx.expo.sisko.replit.dev:18116/bundle" → "https://xxx.../bundle"
  body = body.replace(
    new RegExp(`https?://${escaped}:\\d+`, "g"),
    `https://${EXPO_DOMAIN}`
  );

  // 2. Full HTTPS/HTTP URLs on private / loopback hosts
  //    e.g. "http://127.0.0.1:18116/assets/..." → "https://xxx..."
  body = body.replace(
    /https?:\/\/(?:127\.0\.0\.1|localhost|172\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+/g,
    `https://${EXPO_DOMAIN}`
  );

  // 3. Bare "host:port" JSON string values — hostUri and debuggerHost fields
  //    e.g. "hostUri":"xxx.replit.dev:18116" → "hostUri":"xxx..."
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

// ─── QR code landing page ─────────────────────────────────────────────────────

function serveQrPage(res) {
  const url = EXPO_GO_URL || "REPLIT_EXPO_DEV_DOMAIN not set";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Expo Go — Scan to Connect</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#0f0f0f;color:#f0f0f0;min-height:100vh;
         display:flex;flex-direction:column;align-items:center;
         justify-content:center;padding:32px 16px;gap:24px}
    h1{font-size:22px;font-weight:600;letter-spacing:-0.3px}
    .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;
          padding:32px;display:flex;flex-direction:column;align-items:center;gap:20px;
          max-width:380px;width:100%}
    #qr{width:240px;height:240px;border-radius:8px;background:#fff;padding:8px}
    .url{font-family:monospace;font-size:12px;color:#888;word-break:break-all;text-align:center}
    .badge{background:#1c3a1c;color:#4ade80;padding:6px 14px;border-radius:20px;
           font-size:13px;font-weight:500}
    p{font-size:14px;color:#aaa;text-align:center;line-height:1.5}
    .note{font-size:12px;color:#555;text-align:center;max-width:340px;line-height:1.6}
  </style>
</head>
<body>
  <h1>AkılCEP AI — Expo Go</h1>
  <div class="card">
    <div class="badge">Scan with Expo Go</div>
    <div id="qr"></div>
    <p>Point your phone camera at this QR code while Expo Go is open</p>
    <div class="url">${url}</div>
  </div>
  <div class="note">
    <strong>Important:</strong> Only scan <em>this</em> QR code.<br/>
    The QR code in the workflow console shows an internal port<br/>
    that is unreachable from your device.
  </div>
  <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  <script>
    new QRCode(document.getElementById("qr"), {
      text: ${JSON.stringify(url)},
      width: 224, height: 224,
      colorDark: "#000000", colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  </script>
</body>
</html>`;
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": String(Buffer.byteLength(html, "utf8")),
    "cache-control": "no-store",
  });
  res.end(html);
}

// ─── HTTP proxy ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // Serve QR landing page for the /__expo route (browser opens this)
  if (req.url === "/__expo" || req.url === "/__expo/") {
    return serveQrPage(res);
  }

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

    // Collect the full manifest body, rewrite all port-bearing URLs, forward
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

// ─── WebSocket proxy — Metro HMR / fast-refresh ───────────────────────────────

server.on("upgrade", (req, socket, head) => {
  const target = net.connect(METRO_PORT, "localhost", () => {
    // Replay the HTTP upgrade request to Metro's WebSocket server
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

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PROXY_PORT, () => {
  const border = "═".repeat(60);
  console.log(`\n╔${border}╗`);
  console.log(`║  EXPO GO CONNECTION INFO                                   ║`);
  console.log(`╠${border}╣`);
  if (EXPO_GO_URL) {
    console.log(`║                                                            ║`);
    console.log(`║  Scan QR from:  https://${EXPO_DOMAIN.slice(0, 35)}`);
    console.log(`║                 /__expo`);
    console.log(`║                                                            ║`);
    console.log(`║  Expo Go URL:   ${EXPO_GO_URL}`);
    console.log(`║                                                            ║`);
    console.log(`║  ⚠  Do NOT scan the QR code from the Metro console —     ║`);
    console.log(`║     it shows an internal port that devices cannot reach.  ║`);
    console.log(`║                                                            ║`);
  } else {
    console.log(`║  REPLIT_EXPO_DEV_DOMAIN not set — Expo Go won't work.    ║`);
  }
  console.log(`╚${border}╝\n`);
  console.log(`[metro-proxy] :${PROXY_PORT} → Metro :${METRO_PORT}`);
});
