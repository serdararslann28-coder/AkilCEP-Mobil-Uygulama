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
 *   4. GET /__expo serves an HTML page showing the correct QR code.
 *
 * Fallback:
 *   After Metro and the bundle are ready, a self-diagnostic verifies that the
 *   proxy is correctly rewriting manifests. If the proxy cannot reach Metro or
 *   the manifest is malformed, it logs a clear warning with the direct URL so
 *   the developer can investigate. The proxy never prevents Metro from running
 *   — Metro always starts independently in the background.
 *
 *   To bypass the proxy entirely (e.g. for debugging), set:
 *     EXPO_NO_PROXY=1
 *   in the environment. Metro will then bind directly on $PORT and Expo Go
 *   must be reached via exp:// (not exps://) over the internal network only.
 */

"use strict";

const http = require("http");
const net = require("net");
const QRCode = require("qrcode");

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

// Only rewrite actual Expo manifest responses.
//
// CRITICAL: Do NOT match on the presence of the `Expo-Platform` header alone.
// Every request Expo Go sends (bundle, assets, HMR) includes that header.
// Matching on it causes the proxy to buffer and UTF-8-decode binary Hermes
// bytecode bundles, which corrupts them and makes Expo Go see HTTP 000.
//
// The real manifest request is uniquely identified by its Accept header
// requesting multipart/mixed or application/expo+json, AND its path not
// ending in .bundle / .map / asset paths.
function isManifestRequest(req) {
  const accept = req.headers["accept"] || "";
  const urlPath = (req.url || "").split("?")[0];

  // Bundles, source maps, and assets must pass through unmodified
  if (
    urlPath.endsWith(".bundle") ||
    urlPath.endsWith(".map") ||
    urlPath.startsWith("/assets/") ||
    urlPath.startsWith("/static/")
  ) {
    return false;
  }

  return (
    accept.includes("application/expo+json") ||
    accept.includes("multipart/mixed")
  );
}

// ─── QR code landing page ─────────────────────────────────────────────────────

async function serveQrPage(res) {
  const url = EXPO_GO_URL || "REPLIT_EXPO_DEV_DOMAIN not set";

  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(url, {
      width: 240,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    qrDataUrl = "";
  }

  const qrImg = qrDataUrl
    ? `<img src="${qrDataUrl}" width="240" height="240" alt="Expo Go QR Code" style="border-radius:8px;display:block"/>`
    : `<div style="width:240px;height:240px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#888;font-size:13px">QR unavailable</div>`;

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
    .url{font-family:monospace;font-size:11px;color:#666;word-break:break-all;
         text-align:center;background:#111;padding:10px 12px;border-radius:8px;
         border:1px solid #222;width:100%}
    .badge{background:#1c3a1c;color:#4ade80;padding:6px 14px;border-radius:20px;
           font-size:13px;font-weight:500}
    .warn{background:#3a1c1c;color:#f87171;padding:6px 14px;border-radius:20px;
          font-size:13px;font-weight:500}
    p{font-size:14px;color:#aaa;text-align:center;line-height:1.5}
    .note{font-size:12px;color:#555;text-align:center;max-width:340px;line-height:1.6;
          border-top:1px solid #1a1a1a;padding-top:16px}
  </style>
</head>
<body>
  <h1>AkılCEP AI — Expo Go</h1>
  <div class="card">
    <div class="badge">Scan with Expo Go</div>
    ${qrImg}
    <p>Open Expo Go on your phone, then scan this QR code</p>
    <div class="url">${url}</div>
  </div>
  <p class="note">
    <strong>Do not</strong> scan the QR from the Metro/workflow console —<br/>
    it points to an internal port unreachable from your device.
  </p>
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
  // ── Diagnostic: log every incoming request path so we can trace what the
  // device sends (bundle requests, asset fetches, log POSTs, etc.)
  const shortUrl = (req.url || "").split("?")[0].slice(0, 80);
  if (process.env.EXPO_DEBUG === "1") {
    process.stdout.write(`[proxy] ${req.method} ${shortUrl}\n`);
  }

  // ── Capture POST /logs bodies — this is where Expo Go sends console.log /
  // console.error messages and JS runtime crash reports back to Metro.
  // Printing them here guarantees they appear in the workflow log even when
  // Metro's own log reporter is slow to flush.
  if (req.method === "POST" && /^\/logs(\/|$|\?)/.test(req.url || "")) {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(body);
        const entries = Array.isArray(parsed) ? parsed : (parsed.logs || [parsed]);
        for (const entry of entries) {
          const level = (entry.level || "log").toUpperCase();
          const msg   = Array.isArray(entry.body)
            ? entry.body.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")
            : JSON.stringify(entry);
          process.stdout.write(`[device:${level}] ${msg}\n`);
        }
      } catch (_) {
        // non-JSON body — print raw
        const raw = Buffer.concat(chunks).toString("utf8").slice(0, 2000);
        process.stdout.write(`[device:POST/logs] ${raw}\n`);
      }
      // Still forward the request to Metro — reconstruct from buffered body
      const bodyBuf = Buffer.concat(chunks);
      const fwdHeaders = {
        ...req.headers,
        host: `localhost:${METRO_PORT}`,
        "content-length": String(bodyBuf.length),
      };
      delete fwdHeaders["origin"];
      delete fwdHeaders["x-forwarded-for"];
      delete fwdHeaders["x-forwarded-host"];
      delete fwdHeaders["x-forwarded-proto"];
      delete fwdHeaders["x-replit-user-id"];
      delete fwdHeaders["x-replit-user-name"];
      const fwdReq = http.request(
        { hostname: "localhost", port: METRO_PORT, path: req.url, method: "POST", headers: fwdHeaders },
        (fwdRes) => { res.writeHead(fwdRes.statusCode, fwdRes.headers); fwdRes.pipe(res, { end: true }); }
      );
      fwdReq.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      fwdReq.end(bodyBuf);
    });
    return;
  }

  // Serve QR landing page for the /__expo route (browser opens this)
  if (req.url === "/__expo" || req.url === "/__expo/") {
    return serveQrPage(res);
  }

  // Build forwarded headers. We must rewrite `host` so Metro doesn't reject
  // the request as coming from an unknown host. We also strip `origin` and
  // Replit's proxy-injected headers — without this, Metro's CorsMiddleware
  // sees `Origin: https://[replit-domain]`, fails the localhost+allowlist
  // check, and returns a 500 that Expo Go interprets as "Packager not running".
  const forwardHeaders = {
    ...req.headers,
    host: `localhost:${METRO_PORT}`,
  };
  // Strip headers that trigger Metro's CORS rejection
  delete forwardHeaders["origin"];
  delete forwardHeaders["x-forwarded-for"];
  delete forwardHeaders["x-forwarded-host"];
  delete forwardHeaders["x-forwarded-proto"];
  delete forwardHeaders["x-replit-user-id"];
  delete forwardHeaders["x-replit-user-name"];

  const proxyOpts = {
    hostname: "localhost",
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: forwardHeaders,
  };

  const proxyReq = http.request(proxyOpts, (proxyRes) => {
    if (!isManifestRequest(req)) {
      // Pass non-manifest responses straight through (includes binary bundles)
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
    // Strip the same headers as the HTTP handler so Metro's CorsMiddleware
    // does not reject the WebSocket upgrade (it runs on upgrade requests too).
    const skipWsHeaders = new Set([
      "origin",
      "x-forwarded-for",
      "x-forwarded-host",
      "x-forwarded-proto",
      "x-replit-user-id",
      "x-replit-user-name",
    ]);
    const headerLines = [
      `${req.method} ${req.url} HTTP/1.1`,
      `host: localhost:${METRO_PORT}`,
      ...Object.entries(req.headers)
        .filter(([k]) => k !== "host" && !skipWsHeaders.has(k.toLowerCase()))
        .map(([k, v]) => `${k}: ${v}`),
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

// ─── iOS bundle pre-warmer + self-diagnostic ─────────────────────────────────
//
// Metro builds the iOS bundle on the FIRST request, which takes 1-3 minutes
// on a cold start. Expo Go has a connection timeout; if the bundle isn't ready
// in time it shows "Packager is not running". We fire a background bundle
// request as soon as Metro is up so the bundle is cached before Expo Go asks.
//
// After the bundle is warm we run a self-diagnostic: fetch the manifest through
// the proxy itself (not directly to Metro) and verify that the URL rewriting
// worked correctly. If it didn't, we log a clear warning with the raw Metro URL
// so the developer has a fallback.

function prewarmAndDiagnose() {
  let attempts = 0;

  // Step 1: wait for Metro to be ready on its internal port
  function waitForMetro(resolve, reject) {
    const req = http.get(
      {
        hostname: "localhost",
        port: METRO_PORT,
        path: "/status",
        headers: { host: `localhost:${METRO_PORT}` },
      },
      (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        if (++attempts < 60) return setTimeout(() => waitForMetro(resolve, reject), 3000);
        reject(new Error("Metro did not become ready after 3 min"));
      }
    );
    req.on("error", () => {
      if (++attempts < 60) setTimeout(() => waitForMetro(resolve, reject), 3000);
      else reject(new Error("Metro did not become ready after 3 min"));
    });
  }

  new Promise(waitForMetro)
    // Step 2: fetch the manifest from Metro directly to find the bundle URL
    .then(() => {
      return new Promise((resolve) => {
        const mReq = http.get(
          {
            hostname: "localhost",
            port: METRO_PORT,
            path: "/",
            headers: {
              host: `localhost:${METRO_PORT}`,
              accept: "multipart/mixed,application/json",
              "expo-platform": "ios",
              "expo-api-version": "1",
              "expo-runtime-version": "exposdk:54.0.0",
            },
          },
          (res) => {
            let buf = "";
            res.on("data", (d) => (buf += d));
            res.on("end", () => resolve(buf));
          }
        );
        mReq.on("error", () => resolve(""));
      });
    })
    // Step 3: pre-warm iOS and Android bundles in Metro's cache in parallel.
    // Both platforms are warmed so the first device connection (regardless of
    // platform) is instant instead of waiting 1-2 min for a cold bundle build.
    .then((manifestText) => {
      const m = manifestText.match(/"url":"([^"]+entry\.bundle[^"]+)"/);
      if (!m) {
        console.log("[metro-proxy] pre-warm: bundle URL not found in manifest");
        return null;
      }

      // The manifest URL always contains platform=ios from the warm-up fetch.
      // Replace it with platform=android to get the Android bundle path.
      const iosBundlePath = m[1].replace(/^https?:\/\/[^/]+/, "");
      const androidBundlePath = iosBundlePath.replace(
        "platform=ios",
        "platform=android"
      );

      console.log("[metro-proxy] pre-warming iOS + Android bundles in parallel …");

      function warmBundle(platform, bundlePath) {
        return new Promise((resolve) => {
          const bReq = http.get(
            {
              hostname: "localhost",
              port: METRO_PORT,
              path: bundlePath,
              headers: {
                host: `localhost:${METRO_PORT}`,
                "expo-platform": platform,
              },
            },
            (res) => {
              res.resume();
              res.on("end", () => {
                console.log(`[metro-proxy] ${platform} bundle pre-warm complete ✓`);
                resolve(iosBundlePath);
              });
            }
          );
          bReq.setTimeout(300_000, () => {
            console.log(`[metro-proxy] ${platform} pre-warm timed out after 5 min`);
            bReq.destroy();
            resolve(null);
          });
          bReq.on("error", (e) => {
            console.log(`[metro-proxy] ${platform} pre-warm error:`, e.message);
            resolve(null);
          });
        });
      }

      // Run both platform builds in parallel; return when iOS finishes
      // (Android may still be building, but that's fine — it's in Metro's queue)
      return Promise.all([
        warmBundle("ios", iosBundlePath),
        warmBundle("android", androidBundlePath),
      ]).then(([iosPath]) => iosPath);
    })
    // Step 4: self-diagnostic — fetch the manifest through the proxy and
    // verify that URL rewriting is working (no internal ports leak through)
    .then((bundlePath) => {
      if (!EXPO_DOMAIN) {
        console.log(
          "[metro-proxy] WARN: REPLIT_EXPO_DEV_DOMAIN is not set — " +
          "Expo Go cannot connect from a physical device."
        );
        return;
      }

      return new Promise((resolve) => {
        const diagReq = http.get(
          {
            hostname: "localhost",
            port: PROXY_PORT,
            path: "/",
            headers: {
              host: `localhost:${PROXY_PORT}`,
              accept: "multipart/mixed,application/json",
              "expo-platform": "ios",
              "expo-api-version": "1",
            },
          },
          (res) => {
            let buf = "";
            res.on("data", (d) => (buf += d));
            res.on("end", () => {
              const portLeak = buf.match(/:\d{4,5}/g);
              const hasInternalPort =
                portLeak && portLeak.some((p) => p !== ":443");

              if (res.statusCode !== 200) {
                // Proxy is not forwarding manifests — fatal for Expo Go
                console.log(
                  `[metro-proxy] DIAGNOSTIC FAILED: manifest returned HTTP ${res.statusCode}\n` +
                  `  Expo Go will not be able to connect through the proxy.\n` +
                  `  Fallback: set EXPO_NO_PROXY=1 and restart, then scan:\n` +
                  `    exp://localhost:${METRO_PORT} (LAN only, dev machine only)`
                );
              } else if (hasInternalPort) {
                // URL rewriting missed some port references
                console.log(
                  `[metro-proxy] DIAGNOSTIC WARNING: manifest still contains internal ports\n` +
                  `  Leaked port references: ${portLeak.join(", ")}\n` +
                  `  Expo Go may fail. Check rewriteManifest() in server/metro-proxy.js.`
                );
              } else {
                // Everything looks correct
                console.log(
                  `[metro-proxy] self-diagnostic OK — manifest is clean, Expo Go ready ✓\n` +
                  `  Scan QR from: https://${EXPO_DOMAIN}/__expo`
                );
              }
              resolve();
            });
          }
        );
        diagReq.on("error", (e) => {
          // The proxy itself is unreachable — Metro is still running on METRO_PORT
          console.log(
            `[metro-proxy] DIAGNOSTIC FAILED: proxy not reachable (${e.message})\n` +
            `  Metro is still running on internal port ${METRO_PORT}.\n` +
            `  Expo Go cannot connect from a physical device through this proxy.\n` +
            `  Fallback: set EXPO_NO_PROXY=1 and restart to expose Metro directly.`
          );
          resolve();
        });
        diagReq.setTimeout(10_000, () => {
          diagReq.destroy();
          resolve();
        });
      });
    })
    .catch((e) => console.log("[metro-proxy] startup error:", e.message));
}

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

  // Start background pre-warm + diagnostic 8 seconds after Metro begins its
  // own startup sequence (Metro takes a few seconds to begin accepting requests)
  setTimeout(prewarmAndDiagnose, 8000);
});
