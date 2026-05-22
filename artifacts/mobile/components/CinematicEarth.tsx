/**
 * CinematicEarth — Pure Canvas2D Earth, zero network dependencies.
 *
 * Root cause of previous failures: Three.js CDN blocked/slow in Expo Go WebView.
 * Fix: orthographic spherical projection drawn entirely with Canvas2D.
 *
 * Layers (back → front):
 *  1. Black starfield
 *  2. Ocean radial gradient (brighter on sun side)
 *  3. Land polygons — spherical projection + sun shading
 *  4. Night-side dark radial overlay
 *  5. City lights (night side only, fade near terminator)
 *  6. Twilight orange band at terminator
 *  7. Limb darkening ring
 *  8. Atmospheric glow ring
 *  9. Specular highlight
 * 10. DOM labels for Turkey / İstanbul / Ankara
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── Land polygon data ─────────────────────────────────────────────────────────
// Each entry: { c: hexColor, p: [[lon,lat], …] }
const LAND = [
  { c: "#3a6c38", p: [[-18,16],[-8,5],[8,0],[15,-12],[20,-24],[28,-30],[36,-20],[46,-8],[50,11],[40,16],[34,26],[20,33],[8,38],[0,37],[-10,36],[-18,16]] },
  { c: "#c09840", p: [[-18,16],[-10,27],[8,26],[18,22],[20,18],[10,14],[-4,18],[-10,20],[-18,16]] },
  { c: "#466e36", p: [[-10,36],[0,37],[20,37],[28,37],[30,42],[35,54],[18,72],[0,68],[-8,54],[-10,44],[-10,36]] },
  { c: "#466e36", p: [[5,58],[18,72],[28,70],[28,62],[18,58],[5,58]] },
  { c: "#386230", p: [[30,50],[60,60],[100,66],[140,70],[168,58],[155,50],[130,42],[100,46],[60,56],[30,50]] },
  { c: "#4e7838", p: [[26,36],[28,38],[30,40],[32,42],[36,42],[40,40],[44,40],[46,38],[44,36],[42,34],[38,34],[36,36],[30,36],[26,36]] },
  { c: "#4a6e36", p: [[36,42],[50,38],[62,28],[72,22],[60,28],[48,38],[36,42]] },
  { c: "#c8a050", p: [[36,30],[44,30],[56,14],[44,12],[40,16],[36,22],[36,30]] },
  { c: "#466e36", p: [[60,28],[70,24],[76,8],[86,12],[88,22],[80,28],[60,28]] },
  { c: "#386830", p: [[98,22],[110,18],[116,4],[100,2],[98,16],[98,22]] },
  { c: "#3a6c38", p: [[75,40],[100,50],[120,52],[130,44],[124,32],[114,18],[100,18],[80,30],[75,40]] },
  { c: "#a88c40", p: [[90,44],[100,50],[110,48],[118,46],[114,38],[100,40],[90,44]] },
  { c: "#466e36", p: [[131,32],[138,40],[141,44],[134,44],[130,36],[131,32]] },
  { c: "#3a6c38", p: [[-168,72],[-80,75],[-55,50],[-76,42],[-88,28],[-95,22],[-85,12],[-104,22],[-122,38],[-132,54],[-165,64],[-168,72]] },
  { c: "#3a6c38", p: [[-80,12],[-52,4],[-50,0],[-42,-10],[-52,-32],[-66,-48],[-72,-56],[-70,-38],[-68,-14],[-80,0],[-80,12]] },
  { c: "#1c5c24", p: [[-70,6],[-50,4],[-52,-8],[-62,-12],[-70,-4],[-70,6]] },
  { c: "#887040", p: [[114,-22],[130,-12],[142,-14],[152,-26],[150,-34],[138,-36],[122,-34],[114,-22]] },
  { c: "#c0d0e0", p: [[-40,82],[-20,76],[-34,64],[-56,70],[-60,80],[-40,82]] },
  { c: "#c8d8ec", p: [[-180,-72],[-60,-74],[60,-74],[180,-72],[180,-90],[-180,-90],[-180,-72]] },
];

const CITIES = [
  [29.0,41.0,1.0],[32.9,39.9,0.9],[27.1,38.4,0.7],
  [-0.1,51.5,0.85],[2.3,48.9,0.85],[13.4,52.5,0.82],[12.5,41.9,0.78],
  [4.9,52.4,0.78],[18.1,59.3,0.70],[37.6,55.7,0.95],[30.3,59.9,0.88],
  [51.5,25.3,0.88],[55.3,25.3,0.88],[46.7,24.7,0.88],[39.9,21.4,0.82],
  [31.2,30.1,0.88],[77.2,28.6,0.95],[72.9,19.1,0.95],[88.4,22.6,0.95],
  [116.4,39.9,0.95],[121.5,31.2,0.95],[113.3,23.1,0.95],[139.7,35.7,0.95],
  [126.9,37.5,0.88],[103.8,1.4,0.88],
  [-74.0,40.7,0.95],[-87.6,41.8,0.95],[-118.2,34.1,0.95],[-99.1,19.4,0.95],
  [-43.2,-22.9,0.95],[-58.4,-34.6,0.85],
  [151.2,-33.9,0.88],[144.9,-37.8,0.85],[28.0,-26.2,0.85],
];

// Inject data at build time so the WebView HTML is self-contained
const LAND_JSON   = JSON.stringify(LAND);
const CITIES_JSON = JSON.stringify(CITIES);

// ─── Self-contained HTML ───────────────────────────────────────────────────────
// IMPORTANT: no backtick characters inside this template literal.
// All JS strings inside <script> use single quotes.
const EARTH_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000010;overflow:hidden}
canvas{position:absolute;top:0;left:0;display:block}
#ui{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden}
.lb{
  position:absolute;font-family:-apple-system,'Helvetica Neue',sans-serif;
  white-space:nowrap;text-transform:uppercase;letter-spacing:3px;
  color:rgba(200,225,255,0.92);text-shadow:0 0 8px rgba(100,180,255,0.85);
  transform:translate(-50%,-170%);transition:opacity 0.6s;pointer-events:none;
}
.lb.big{font-size:10px;font-weight:700}
.lb.sm {font-size:8px;font-weight:600}
.dot{
  position:absolute;width:3px;height:3px;border-radius:50%;
  background:rgba(200,230,255,0.9);transform:translate(-50%,-50%);
  box-shadow:0 0 5px 1px rgba(140,200,255,0.6);transition:opacity 0.6s;pointer-events:none;
}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="ui">
  <div class="lb big" id="lTR" style="opacity:0">TURKIYE</div>
  <div class="dot"    id="dTR" style="opacity:0"></div>
  <div class="lb sm"  id="lIS" style="opacity:0">Istanbul</div>
  <div class="dot"    id="dIS" style="opacity:0"></div>
  <div class="lb sm"  id="lAN" style="opacity:0">Ankara</div>
  <div class="dot"    id="dAN" style="opacity:0"></div>
</div>
<script>
(function(){
'use strict';

// ── Injected data ─────────────────────────────────────────────────────────
var LAND   = ${LAND_JSON};
var CITIES = ${CITIES_JSON};

// ── Canvas / context ──────────────────────────────────────────────────────
var W  = window.innerWidth  || screen.width  || 375;
var H  = window.innerHeight || screen.height || 812;
var cv = document.getElementById('c');
cv.width  = W;
cv.height = H;
var ctx = cv.getContext('2d');
if(!ctx){ return; }

// Earth center and radius (slightly above viewport center for aesthetics)
var cx = W * 0.5;
var cy = H * 0.44;
var R  = Math.min(W, H) * 0.40;

// ── Sun direction (world space) ───────────────────────────────────────────
// Fixed sun: lon=-30 (over Atlantic), lat=20
var SUN_LON  = -30;
var SUN_LAT  =  20;
var sunLatR  = SUN_LAT * Math.PI / 180;
var sunLonR  = SUN_LON * Math.PI / 180;
var SX = Math.cos(sunLatR) * Math.cos(sunLonR);
var SY = Math.sin(sunLatR);
var SZ = Math.cos(sunLatR) * Math.sin(sunLonR);

// ── Static starfield ──────────────────────────────────────────────────────
var STARS = [];
(function(){
  var s = 0xDEADBEEF;
  function rn(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
  for(var i = 0; i < 200; i++){
    STARS.push({ x: rn()*W, y: rn()*H, r: 0.25 + rn()*1.1, o: 0.25 + rn()*0.65 });
  }
})();

// ── Rotation state ────────────────────────────────────────────────────────
var rot   = 25;    // starting lon facing viewer: Europe/Turkey centered
var SPEED = 7.2;   // degrees/sec = 50 s full rotation
var lastT = -1;

// ── Orthographic spherical projection ─────────────────────────────────────
// Given world (lon, lat) and current viewer-facing longitude (rot),
// return screen (x, y), depth z (positive = visible front hemisphere),
// and sun dot product.
function proj(lon, lat){
  var dlonR = (lon - rot) * Math.PI / 180;
  var latR  = lat * Math.PI / 180;
  var cLat  = Math.cos(latR);
  var sLat  = Math.sin(latR);
  var cDl   = Math.cos(dlonR);
  var sDl   = Math.sin(dlonR);
  // Depth: front hemisphere has z > 0
  var z  = cDl * cLat;
  var sx = cx + R * sDl * cLat;
  var sy = cy - R * sLat;
  // Sun lighting via world-space normal
  var lonR = lon * Math.PI / 180;
  var nx = Math.cos(lonR) * cLat;
  var ny = sLat;
  var nz = Math.sin(lonR) * cLat;
  var sun = nx * SX + ny * SY + nz * SZ;
  return { x: sx, y: sy, z: z, sun: sun };
}

// ── Land polygon renderer ─────────────────────────────────────────────────
function drawPoly(pts, hexColor){
  if(!pts || pts.length < 3){ return; }

  // Centroid check: skip if polygon center is behind the sphere
  var sumLon = 0, sumLat = 0;
  for(var i = 0; i < pts.length; i++){ sumLon += pts[i][0]; sumLat += pts[i][1]; }
  var cp = proj(sumLon / pts.length, sumLat / pts.length);
  if(cp.z < -0.12){ return; }

  // Collect projected vertices that are not deeply behind the limb
  var verts = [];
  for(var j = 0; j < pts.length; j++){
    var p = proj(pts[j][0], pts[j][1]);
    if(p.z > -0.18){ verts.push(p); }
  }
  if(verts.length < 3){ return; }

  ctx.save();
  // Clip drawing to the Earth circle so nothing bleeds outside
  ctx.beginPath();
  ctx.arc(cx, cy, R - 0.5, 0, 6.2832);
  ctx.clip();

  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for(var k = 1; k < verts.length; k++){ ctx.lineTo(verts[k].x, verts[k].y); }
  ctx.closePath();

  // Sun shading: darker on night side, full color on day side
  var t = Math.max(0.08, Math.min(1.0, cp.sun * 1.3 + 0.32));
  var r = parseInt(hexColor.slice(1,3), 16);
  var g = parseInt(hexColor.slice(3,5), 16);
  var b = parseInt(hexColor.slice(5,7), 16);
  ctx.fillStyle = 'rgb(' + Math.round(r*t) + ',' + Math.round(g*t) + ',' + Math.round(b*t) + ')';
  ctx.fill();
  ctx.restore();
}

// ── DOM label helper ──────────────────────────────────────────────────────
function setLabel(lblId, dotId, lon, lat){
  var p   = proj(lon, lat);
  var vis = p.z > 0.10 ? '1' : '0';
  var el  = document.getElementById(lblId);
  var dt  = document.getElementById(dotId);
  if(el){
    el.style.left    = p.x + 'px';
    el.style.top     = p.y + 'px';
    el.style.opacity = vis;
  }
  if(dt){
    dt.style.left    = p.x + 'px';
    dt.style.top     = p.y + 'px';
    dt.style.opacity = p.z > 0.10 ? '0.85' : '0';
  }
}

// ── Main draw ─────────────────────────────────────────────────────────────
function draw(){

  // 1. Background
  ctx.fillStyle = '#000010';
  ctx.fillRect(0, 0, W, H);

  // 2. Stars
  for(var s = 0; s < STARS.length; s++){
    var st = STARS[s];
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, 6.2832);
    ctx.fillStyle = 'rgba(255,255,255,' + st.o + ')';
    ctx.fill();
  }

  // 3. Ocean gradient (brighter near sun position on sphere surface)
  var sunDlonR = (SUN_LON - rot) * Math.PI / 180;
  var ogX = cx + R * 0.5 * Math.sin(sunDlonR) * Math.cos(sunLatR);
  var ogY = cy - R * 0.4 * Math.sin(sunLatR);
  var og = ctx.createRadialGradient(ogX, ogY, R * 0.05, cx, cy, R);
  og.addColorStop(0.0, '#1a5a8c');
  og.addColorStop(0.5, '#0e3666');
  og.addColorStop(1.0, '#071428');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 6.2832);
  ctx.fillStyle = og;
  ctx.fill();
  ctx.restore();

  // 4. Land polygons
  for(var i = 0; i < LAND.length; i++){
    drawPoly(LAND[i].p, LAND[i].c);
  }

  // 5. Night overlay — centered on the anti-sun point
  var antiDlon = (((SUN_LON + 180) - rot) % 360 + 360) % 360;
  if(antiDlon > 180){ antiDlon -= 360; }
  var nCX = cx + R * 0.5 * Math.sin(antiDlon * Math.PI / 180);
  var nCY = cy;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 6.2832);
  ctx.clip();
  var ng = ctx.createRadialGradient(nCX, nCY, 0, nCX, nCY, R * 1.55);
  ng.addColorStop(0.00, 'rgba(0,2,15,0.95)');
  ng.addColorStop(0.30, 'rgba(0,2,15,0.82)');
  ng.addColorStop(0.52, 'rgba(0,2,15,0.30)');
  ng.addColorStop(0.68, 'rgba(0,2,15,0.0)');
  ctx.fillStyle = ng;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();

  // 6. City lights (visible + night side only)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R - 0.5, 0, 6.2832);
  ctx.clip();
  for(var ci = 0; ci < CITIES.length; ci++){
    var city = CITIES[ci];
    var cp   = proj(city[0], city[1]);
    if(cp.z < 0){ continue; }
    if(cp.sun > 0.20){ continue; }
    var fade = Math.max(0, Math.min(1, (0.20 - cp.sun) / 0.28));
    var br   = city[2] * fade;
    if(br < 0.06){ continue; }
    var cr  = 2.5 * br;
    var cg2 = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, cr * 3.5);
    cg2.addColorStop(0,   'rgba(255,240,160,' + (br * 0.95) + ')');
    cg2.addColorStop(0.3, 'rgba(255,200,100,' + (br * 0.45) + ')');
    cg2.addColorStop(1,   'rgba(255,160,60,0)');
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, cr * 3.5, 0, 6.2832);
    ctx.fillStyle = cg2;
    ctx.fill();
  }
  ctx.restore();

  // 7. Twilight orange band at terminator
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 6.2832);
  ctx.clip();
  var tg = ctx.createRadialGradient(nCX, nCY, R * 0.78, nCX, nCY, R * 1.04);
  tg.addColorStop(0.0, 'rgba(255,120,40,0.0)');
  tg.addColorStop(0.4, 'rgba(255,100,30,0.16)');
  tg.addColorStop(0.7, 'rgba(255,75,20,0.07)');
  tg.addColorStop(1.0, 'rgba(255,60,10,0.0)');
  ctx.fillStyle = tg;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();

  // 8. Limb darkening
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 6.2832);
  ctx.clip();
  var ld = ctx.createRadialGradient(cx, cy, R * 0.60, cx, cy, R);
  ld.addColorStop(0.0,  'rgba(0,0,0,0)');
  ld.addColorStop(0.75, 'rgba(0,0,0,0.18)');
  ld.addColorStop(1.0,  'rgba(0,0,0,0.62)');
  ctx.fillStyle = ld;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();

  // 9. Atmospheric glow ring
  var ag = ctx.createRadialGradient(cx, cy, R * 0.94, cx, cy, R * 1.15);
  ag.addColorStop(0.0, 'rgba(60,130,255,0.0)');
  ag.addColorStop(0.2, 'rgba(70,155,255,0.38)');
  ag.addColorStop(0.6, 'rgba(50,120,240,0.14)');
  ag.addColorStop(1.0, 'rgba(30,80,200,0.0)');
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.15, 0, 6.2832);
  ctx.fillStyle = ag;
  ctx.fill();

  // 10. Specular highlight on ocean
  var spX = cx + R * 0.30 * Math.sin(sunDlonR) * Math.cos(sunLatR);
  var spY = cy - R * 0.24 * Math.sin(sunLatR);
  var sp = ctx.createRadialGradient(spX, spY, 0, spX, spY, R * 0.36);
  sp.addColorStop(0.0, 'rgba(210,235,255,0.22)');
  sp.addColorStop(0.5, 'rgba(160,205,255,0.08)');
  sp.addColorStop(1.0, 'rgba(100,165,255,0.0)');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 6.2832);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 6.2832);
  ctx.fillStyle = sp;
  ctx.fill();
  ctx.restore();

  // 11. Turkey / city labels
  setLabel('lTR', 'dTR', 35.5, 39.0);
  setLabel('lIS', 'dIS', 29.0, 41.0);
  setLabel('lAN', 'dAN', 32.9, 39.9);
}

// ── Animation loop ─────────────────────────────────────────────────────────
function frame(t){
  if(lastT >= 0){
    var dt = (t - lastT) / 1000;
    if(dt > 0.1){ dt = 0.1; } // cap delta to avoid big jumps after tab hide
    rot = (rot + SPEED * dt) % 360;
  }
  lastT = t;
  draw();
  requestAnimationFrame(frame);
}

// ── Resize handler ─────────────────────────────────────────────────────────
window.addEventListener('resize', function(){
  W = window.innerWidth  || screen.width  || W;
  H = window.innerHeight || screen.height || H;
  cx = W * 0.5;
  cy = H * 0.44;
  R  = Math.min(W, H) * 0.40;
  cv.width  = W;
  cv.height = H;
});

// ── Voice state speed hook ─────────────────────────────────────────────────
window.onVoiceState = function(state){
  SPEED = state === 'speaking' ? 12.0 : state === 'idle' ? 3.6 : 7.2;
};

// ── Kick off ──────────────────────────────────────────────────────────────
requestAnimationFrame(frame);

})();
</script>
</body>
</html>`;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CinematicEarth({ voiceState }: Props) {
  const webRef = useRef<any>(null);

  useEffect(() => {
    webRef.current?.injectJavaScript(
      "if(window.onVoiceState)window.onVoiceState('" + voiceState + "');true;"
    );
  }, [voiceState]);

  // react-native-webview is native-only
  if (Platform.OS === "web") {
    return <View style={styles.webFallback} />;
  }

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        source={{ html: EARTH_HTML }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={["*"]}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        domStorageEnabled
        allowFileAccess
        onError={(e) => console.warn("Earth WebView error:", e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { flex: 1, width: "100%", backgroundColor: "#000010", overflow: "hidden" },
  web:         { flex: 1, backgroundColor: "transparent" },
  webFallback: { flex: 1, width: "100%", backgroundColor: "#000010" },
});
