/**
 * CinematicEarth v2 — Pure Canvas2D, zero network deps.
 *
 * Rendering pipeline (back → front):
 *   01. Deep space + tiered starfield
 *   02. Multi-stop ocean depth gradient
 *   03. Land polygons (34, batch-clipped once, sun-shaded + micro-variation)
 *   04. Coastline outline pass (subtle stroke on day-side polys)
 *   05. Inner atmosphere haze (inside limb)
 *   06. Cinematic terminator + penumbra (5-stop)
 *   07. Night hemisphere (deep blue-black)
 *   08. City lights (85 cities, warm 2-layer glow)
 *   09. Polar ice glow (north + south)
 *   10. Limb darkening (sphere-edge vignette)
 *   11. Outer atmosphere primary ring (Rayleigh)
 *   12. Outer atmosphere diffuse halo
 *   13. Sun-side limb scatter (warm white)
 *   14. Specular ocean highlight
 *   15. Globe edge ring
 *   16. Voice reactions (organic atmosphere layers)
 *   17. DOM labels: TÜRKIYE, Istanbul, Ankara
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── Land polygons [lon, lat] pairs — 34 regions ──────────────────────────────
const LAND = [
  // ── Africa ─────────────────────────────────────────────────────────────────
  // North Africa desert
  {c:"#a88020",p:[[-6,36],[8,37],[24,33],[34,30],[42,28],[50,22],[44,18],[36,20],[28,22],[18,22],[8,22],[-2,22],[-10,24],[-18,24],[-18,30],[-6,36]]},
  // Sahel transition belt
  {c:"#7a7828",p:[[-18,14],[-10,16],[0,16],[8,16],[18,14],[28,14],[36,14],[42,10],[44,14],[36,20],[28,22],[18,22],[8,22],[-2,22],[-10,24],[-18,24],[-18,14]]},
  // West Africa + Congo basin (tropical)
  {c:"#286624",p:[[-18,4],[-18,14],[0,14],[8,14],[18,14],[28,14],[20,8],[12,4],[4,2],[-2,4],[-10,4],[-18,4]]},
  // East + Southern Africa
  {c:"#5a7030",p:[[36,14],[42,10],[46,6],[48,0],[44,-4],[40,-10],[36,-18],[32,-26],[28,-34],[18,-34],[14,-28],[12,-18],[14,-10],[18,-4],[24,0],[28,4],[32,8],[36,14]]},
  // Madagascar
  {c:"#3a6428",p:[[44,-12],[48,-14],[50,-18],[50,-24],[46,-26],[44,-22],[42,-18],[44,-12]]},
  // ── Europe ─────────────────────────────────────────────────────────────────
  // Western + Central Europe
  {c:"#3a6e30",p:[[-6,44],[-2,44],[2,44],[8,48],[12,48],[14,44],[18,44],[22,44],[24,48],[22,52],[14,56],[8,54],[4,52],[-4,52],[-6,48],[-6,44]]},
  // Scandinavia
  {c:"#486434",p:[[4,56],[8,54],[14,56],[18,58],[22,58],[22,66],[18,70],[12,70],[6,62],[4,58],[4,56]]},
  // Iberian Peninsula
  {c:"#5e7830",p:[[-10,36],[-6,36],[-4,38],[-2,40],[2,40],[4,40],[4,44],[-4,44],[-6,44],[-10,44],[-10,40],[-10,36]]},
  // Italy + Balkans
  {c:"#5a7430",p:[[12,44],[14,44],[18,44],[22,44],[24,44],[28,44],[36,42],[40,40],[36,44],[28,46],[22,48],[16,46],[12,44]]},
  // ── Turkey ─────────────────────────────────────────────────────────────────
  {c:"#7a7440",p:[[26,37],[28,36.5],[30,36],[34,36],[36,36.5],[40,36],[44,37],[44,38],[42,40],[40,41.5],[36,42],[30,42],[27.5,41],[26,39.5],[26,37]]},
  // ── Middle East ────────────────────────────────────────────────────────────
  // Levant + Syria + Iraq
  {c:"#907840",p:[[36,32],[40,34],[44,38],[44,34],[48,30],[48,24],[44,22],[40,26],[36,28],[34,30],[36,32]]},
  // Arabian Peninsula
  {c:"#b09028",p:[[36,28],[40,26],[44,22],[48,24],[56,18],[60,14],[56,12],[52,14],[46,12],[44,14],[40,14],[36,18],[36,22],[36,28]]},
  // Iran + Afghanistan
  {c:"#9a8038",p:[[44,38],[48,40],[52,40],[60,36],[66,32],[66,26],[62,22],[58,20],[56,18],[52,22],[48,24],[48,30],[44,34],[44,38]]},
  // ── Russia ─────────────────────────────────────────────────────────────────
  // European Russia
  {c:"#466838",p:[[24,48],[28,52],[32,56],[36,58],[40,62],[44,68],[50,66],[56,68],[60,64],[62,58],[58,52],[50,48],[44,44],[36,42],[28,44],[24,48]]},
  // Siberia
  {c:"#406030",p:[[60,52],[68,56],[70,64],[70,72],[80,72],[100,72],[120,72],[140,70],[150,68],[155,60],[150,52],[140,52],[130,48],[120,52],[110,50],[100,54],[90,52],[80,54],[70,52],[60,52]]},
  // ── Central + South Asia ───────────────────────────────────────────────────
  // Central Asia steppe
  {c:"#907840",p:[[50,48],[60,52],[68,56],[70,48],[66,40],[60,36],[52,40],[48,40],[44,44],[48,50],[50,48]]},
  // India + Pakistan
  {c:"#6e7430",p:[[60,36],[66,26],[66,22],[70,18],[76,8],[80,10],[84,14],[88,22],[80,28],[76,30],[70,28],[66,28],[62,26],[60,30],[60,36]]},
  // SE Asia peninsula
  {c:"#2e6426",p:[[98,20],[100,14],[102,8],[104,0],[100,-4],[96,0],[94,8],[92,18],[96,22],[98,20]]},
  // SE Asia islands (Malay/Sumatra)
  {c:"#286820",p:[[100,-4],[102,-2],[104,0],[106,-2],[106,-6],[102,-6],[100,-4]]},
  // Borneo
  {c:"#286820",p:[[108,4],[110,2],[112,0],[116,2],[116,4],[114,6],[110,6],[108,4]]},
  // ── East Asia ──────────────────────────────────────────────────────────────
  // China + Mongolia
  {c:"#7e7c38",p:[[74,38],[80,50],[90,52],[100,52],[110,50],[120,52],[130,48],[128,40],[126,32],[120,24],[114,18],[108,18],[104,22],[100,18],[96,22],[92,20],[94,24],[88,22],[80,28],[76,30],[70,28],[70,36],[74,38]]},
  // Japan
  {c:"#3a6830",p:[[130,31],[132,33],[136,35],[137,40],[134,42],[132,42],[130,38],[128,33],[130,31]]},
  // Korean Peninsula
  {c:"#446830",p:[[126,34],[128,36],[130,38],[128,38],[126,36],[124,36],[126,34]]},
  // ── North America ──────────────────────────────────────────────────────────
  // Alaska + Pacific NW
  {c:"#3a5c28",p:[[-168,60],[-156,58],[-148,58],[-136,58],[-130,54],[-132,56],[-140,58],[-152,58],[-164,58],[-168,58],[-168,60]]},
  // Canada + NE USA
  {c:"#426830",p:[[-136,58],[-130,54],[-124,50],[-80,44],[-72,42],[-64,44],[-60,44],[-60,50],[-66,52],[-76,58],[-84,64],[-96,68],[-100,70],[-80,72],[-60,72],[-50,70],[-36,62],[-42,58],[-52,54],[-56,50],[-66,46],[-76,46],[-90,60],[-100,58],[-120,58],[-130,54],[-136,58]]},
  // Eastern + Central USA
  {c:"#4e7030",p:[[-124,48],[-120,44],[-110,44],[-100,44],[-80,44],[-72,42],[-70,40],[-76,34],[-80,30],[-88,30],[-96,24],[-100,24],[-106,24],[-110,30],[-114,32],[-118,34],[-122,36],[-124,38],[-124,48]]},
  // Mexico + Central America
  {c:"#6a7830",p:[[-116,28],[-100,24],[-96,22],[-88,22],[-84,18],[-80,12],[-78,10],[-84,10],[-88,16],[-92,18],[-100,22],[-106,22],[-112,28],[-116,30],[-116,28]]},
  // ── South America ──────────────────────────────────────────────────────────
  // Amazon + Guiana (tropical)
  {c:"#226018",p:[[-78,10],[-70,12],[-60,8],[-52,4],[-50,0],[-44,-2],[-40,-4],[-44,-8],[-50,-8],[-54,-4],[-60,-4],[-66,-4],[-70,0],[-76,2],[-78,6],[-78,10]]},
  // Eastern Brazil
  {c:"#3a6426",p:[[-40,-4],[-36,-8],[-36,-16],[-38,-22],[-44,-24],[-48,-16],[-50,-8],[-44,-8],[-40,-4]]},
  // Andes + Western S. America
  {c:"#7a6c38",p:[[-78,10],[-80,4],[-80,0],[-76,0],[-68,-6],[-68,-18],[-70,-30],[-72,-44],[-70,-50],[-66,-54],[-60,-52],[-56,-38],[-54,-20],[-54,-4],[-60,-4],[-66,-4],[-70,0],[-76,2],[-78,6],[-78,10]]},
  // ── Australia ──────────────────────────────────────────────────────────────
  // Interior (desert)
  {c:"#b09030",p:[[114,-22],[122,-20],[128,-18],[134,-14],[136,-18],[138,-22],[136,-26],[130,-26],[126,-30],[120,-34],[116,-32],[112,-28],[114,-22]]},
  // Eastern + southern coastal
  {c:"#5e7030",p:[[138,-18],[140,-18],[144,-18],[148,-20],[152,-24],[152,-30],[148,-36],[142,-38],[136,-38],[132,-32],[128,-30],[126,-30],[130,-26],[136,-26],[138,-22],[136,-18],[138,-18]]},
  // ── Polar ──────────────────────────────────────────────────────────────────
  // Greenland
  {c:"#b0c8d8",p:[[-44,60],[-36,62],[-24,68],[-18,72],[-22,76],[-30,78],[-42,82],[-52,80],[-58,74],[-54,66],[-44,60]]},
  // Antarctica
  {c:"#c0d0e2",p:[[-180,-72],[0,-72],[180,-72],[180,-90],[-180,-90],[-180,-72]]},
];

// ─── City lights [lon, lat, brightness 0-1] — 85 global cities ───────────────
const CITIES = [
  // Turkey
  [29.0,41.0,1.0],[32.9,39.9,0.9],[27.1,38.4,0.72],
  // Western Europe
  [-0.1,51.5,0.85],[2.3,48.9,0.85],[13.4,52.5,0.82],[12.5,41.9,0.78],
  [4.9,52.4,0.78],[18.1,59.3,0.70],[2.1,41.4,0.72],[-3.7,40.4,0.72],
  [16.4,48.2,0.70],[14.5,50.1,0.70],[21.0,52.2,0.72],[30.5,50.4,0.78],
  [23.7,37.9,0.68],[4.4,50.8,0.68],[-6.2,53.3,0.65],[-8.6,41.1,0.65],
  [10.8,59.9,0.65],[24.9,60.2,0.65],[25.0,35.3,0.62],
  // Russia
  [37.6,55.7,0.95],[30.3,59.9,0.88],[82.9,55.0,0.72],[56.8,60.6,0.68],
  [73.4,54.9,0.65],[49.1,55.8,0.62],
  // Middle East + N Africa
  [51.5,25.3,0.88],[55.3,25.3,0.88],[46.7,24.7,0.88],[39.9,21.4,0.82],
  [31.2,30.1,0.88],[36.3,33.5,0.72],[44.4,33.3,0.78],[53.2,29.4,0.72],
  [67.0,24.9,0.85],[74.3,31.5,0.80],[-7.6,33.6,0.70],[10.2,36.8,0.68],
  [2.0,36.8,0.68],[21.2,32.9,0.70],[47.5,11.6,0.68],[3.4,6.5,0.72],
  // Sub-Saharan Africa
  [36.8,-1.3,0.75],[28.0,-26.2,0.88],[18.4,-33.9,0.82],[32.5,15.6,0.68],
  [38.7,9.0,0.70],[-17.4,14.7,0.68],[15.3,4.4,0.68],[3.4,6.5,0.72],
  // South Asia
  [77.2,28.6,0.95],[72.9,19.1,0.95],[88.4,22.6,0.95],[80.3,13.1,0.82],
  [85.3,23.8,0.78],[78.5,17.4,0.80],[72.6,23.0,0.78],[67.1,24.8,0.85],
  // SE Asia
  [103.8,1.4,0.88],[100.5,13.8,0.85],[106.8,10.8,0.82],[101.7,3.1,0.82],
  [107.0,-6.2,0.82],[114.1,22.5,0.88],[121.0,14.6,0.80],[104.9,11.6,0.72],
  [96.2,16.8,0.72],[105.8,21.0,0.78],
  // East Asia
  [116.4,39.9,0.95],[121.5,31.2,0.95],[113.3,23.1,0.95],[104.1,30.6,0.88],
  [120.2,30.3,0.88],[114.3,30.6,0.85],[139.7,35.7,0.95],[135.5,34.7,0.90],
  [130.4,33.6,0.85],[141.4,43.1,0.80],[126.9,37.5,0.88],[121.5,25.0,0.85],
  // North America
  [-74.0,40.7,0.95],[-87.6,41.8,0.95],[-118.2,34.1,0.95],[-99.1,19.4,0.95],
  [-122.4,37.8,0.88],[-95.4,29.8,0.88],[-96.8,32.8,0.88],[-80.2,25.8,0.85],
  [-79.4,43.7,0.82],[-73.6,45.5,0.80],[-123.1,49.3,0.80],[-77.0,38.9,0.90],
  [-71.1,42.4,0.88],[-104.9,39.7,0.80],[-84.4,33.7,0.85],
  // South America
  [-43.2,-22.9,0.95],[-46.6,-23.5,0.88],[-58.4,-34.6,0.85],[-70.7,-33.5,0.80],
  [-74.1,4.7,0.78],[-77.0,-12.0,0.78],[-66.9,10.5,0.75],[-57.5,-25.3,0.72],
  [-56.2,-34.9,0.72],
  // Oceania
  [151.2,-33.9,0.88],[144.9,-37.8,0.85],[153.0,-27.5,0.75],[115.9,-32.0,0.72],
  [174.8,-36.9,0.70],[172.6,-43.5,0.65],
];

const LAND_JSON   = JSON.stringify(LAND);
const CITIES_JSON = JSON.stringify(CITIES);

// ─── HTML blob — entire renderer baked at build time ──────────────────────────
// No backtick chars inside. All inner JS uses single quotes.
const EARTH_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#00000e;overflow:hidden}
canvas{position:absolute;top:0;left:0;display:block}
#ui{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden}
.lb{
  position:absolute;
  font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;
  white-space:nowrap;text-transform:uppercase;letter-spacing:3.5px;
  color:rgba(210,232,255,0.90);
  text-shadow:0 0 12px rgba(120,190,255,0.75),0 0 4px rgba(180,220,255,0.50);
  transform:translate(-50%,-185%);
  transition:opacity 0.9s ease;pointer-events:none;
}
.lb.big{font-size:8px;font-weight:700;letter-spacing:4.5px}
.lb.sm{font-size:6.5px;font-weight:600;letter-spacing:3px}
.dot{
  position:absolute;width:2.5px;height:2.5px;border-radius:50%;
  background:rgba(210,235,255,0.90);transform:translate(-50%,-50%);
  box-shadow:0 0 5px 2px rgba(160,215,255,0.50);
  transition:opacity 0.9s ease;pointer-events:none;
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

var LAND   = ${LAND_JSON};
var CITIES = ${CITIES_JSON};

// ── Canvas setup ─────────────────────────────────────────────────────────────
var W  = window.innerWidth  || screen.width  || 375;
var H  = window.innerHeight || screen.height || 812;
var cv = document.getElementById('c');
cv.width = W; cv.height = H;
var ctx = cv.getContext('2d');
if(!ctx) return;

var cx = W * 0.5;
var cy = H * 0.46;
var R  = Math.min(W, H) * 0.44;

// ── Sun direction (world-space normal) ────────────────────────────────────────
var SUN_LON = -30;
var SUN_LAT =  22;
var sunLatR = SUN_LAT * Math.PI / 180;
var sunLonR = SUN_LON * Math.PI / 180;
var SX = Math.cos(sunLatR) * Math.cos(sunLonR);
var SY = Math.sin(sunLatR);
var SZ = Math.cos(sunLatR) * Math.sin(sunLonR);

// ── Tiered starfield (seeded random, 3 size tiers) ────────────────────────────
var STARS = [];
(function(){
  var s = 0xDEADBEEF;
  function rn(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
  var n = 380;
  for(var i = 0; i < n; i++){
    var t = rn();
    var r = t < 0.60 ? 0.18 + rn()*0.24 :   // tiny
            t < 0.88 ? 0.40 + rn()*0.40 :   // small
            t < 0.97 ? 0.75 + rn()*0.45 :   // medium
                       1.15 + rn()*0.60;     // bright
    STARS.push({
      x: rn()*W, y: rn()*H, r: r,
      o: 0.15 + rn()*0.78,
      tw: 0.5 + rn()*1.5,   // twinkle speed
      tp: rn()*6.28         // twinkle phase offset
    });
  }
})();

// ── Animation state ───────────────────────────────────────────────────────────
var rot    = 28.0;
var SPEED  = 3.6;
var vState = 'idle';
var vPhase = 0.0;
var dt     = 0.0;
var lastT  = -1;

// ── Spherical orthographic projection ─────────────────────────────────────────
// Returns {x,y,z,sun}: z>0 = front hemisphere; sun = n·L dot product
function proj(lon, lat){
  var dlonR = (lon - rot) * Math.PI / 180;
  var latR  = lat  * Math.PI / 180;
  var cLat  = Math.cos(latR), sLat = Math.sin(latR);
  var cDl   = Math.cos(dlonR), sDl = Math.sin(dlonR);
  var z     = cDl * cLat;
  var lonR  = lon * Math.PI / 180;
  var nx    = Math.cos(lonR) * cLat;
  var ny    = sLat;
  var nz    = Math.sin(lonR) * cLat;
  return {
    x: cx + R * sDl * cLat,
    y: cy - R * sLat,
    z: z,
    sun: nx * SX + ny * SY + nz * SZ
  };
}

// ── Hash for deterministic per-polygon micro-variation ────────────────────────
function phash(n){ return ((n * 2654435769) >>> 0) / 4294967296; }

// ── DOM label helper ──────────────────────────────────────────────────────────
function setLabel(lId, dId, lon, lat){
  var p  = proj(lon, lat);
  var op = p.z > 0.12 ? '1' : '0';
  var el = document.getElementById(lId), dt2 = document.getElementById(dId);
  if(el){  el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.style.opacity = op; }
  if(dt2){ dt2.style.left = p.x + 'px'; dt2.style.top = p.y + 'px'; dt2.style.opacity = p.z > 0.12 ? '0.85' : '0'; }
}

// ── Utility: fill radial gradient arc ─────────────────────────────────────────
function fillArc(g, r){ ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fillStyle = g; ctx.fill(); }

// ─────────────────────────────────────────────────────────────────────────────
function draw(){

  var TAU = 6.2832;
  var PI  = Math.PI;

  // pre-compute sun screen position
  var sunDlonR = (SUN_LON - rot) * PI / 180;
  var sdx = Math.sin(sunDlonR) * Math.cos(sunLatR);
  var sdy = -Math.sin(sunLatR);
  var sunSX = cx + R * 0.80 * sdx;
  var sunSY = cy + R * 0.80 * sdy;

  // anti-sun for night overlay center
  var adlon = (((SUN_LON + 180) - rot) % 360 + 360) % 360;
  if(adlon > 180) adlon -= 360;
  var adR  = adlon * PI / 180;
  var nCX  = cx + R * 0.50 * Math.sin(adR);
  var nCY  = cy;

  // ── 01. Space background ──────────────────────────────────────────────────
  ctx.fillStyle = '#00000e';
  ctx.fillRect(0, 0, W, H);

  // ── 02. Stars ─────────────────────────────────────────────────────────────
  for(var si = 0; si < STARS.length; si++){
    var st = STARS[si];
    var tw = st.o * (0.82 + 0.18 * Math.sin(vPhase * st.tw + st.tp));
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,' + tw + ')'; ctx.fill();
  }

  // ── 03. Ocean base ────────────────────────────────────────────────────────
  // Day-side illuminated center → deep poles + night
  var oGrad = ctx.createRadialGradient(
    cx + R * 0.38 * sdx, cy + R * 0.30 * sdy, R * 0.04,
    cx, cy, R * 1.02
  );
  oGrad.addColorStop(0.00, '#1e6898');
  oGrad.addColorStop(0.25, '#165888');
  oGrad.addColorStop(0.55, '#0e3a68');
  oGrad.addColorStop(0.80, '#091e3e');
  oGrad.addColorStop(1.00, '#050e22');
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
  ctx.fillStyle = oGrad; ctx.fill();
  ctx.restore();

  // ── 04. Land polygons (single sphere clip for performance) ────────────────
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R - 0.5, 0, TAU); ctx.clip();

  for(var pi = 0; pi < LAND.length; pi++){
    var poly = LAND[pi];
    var pts  = poly.p;
    var n    = pts.length;
    // centroid visibility test
    var sl = 0, slt = 0;
    for(var j = 0; j < n; j++){ sl += pts[j][0]; slt += pts[j][1]; }
    var cp = proj(sl/n, slt/n);
    if(cp.z < -0.14) continue;

    // build projected path
    ctx.beginPath();
    var first = true;
    for(var k = 0; k < n; k++){
      var vp = proj(pts[k][0], pts[k][1]);
      if(vp.z < -0.22) continue;
      if(first){ ctx.moveTo(vp.x, vp.y); first = false; }
      else ctx.lineTo(vp.x, vp.y);
    }
    if(first) continue;
    ctx.closePath();

    // shading: pow curve gives softer roll-off, micro-variation breaks flatness
    var raw = cp.sun * 1.55 + 0.22;
    var t   = Math.max(0.0, Math.min(1.0, raw));
    t = Math.pow(t, 0.78);                          // gamma-like soften
    t *= (0.92 + 0.08 * phash(pi));                 // micro-variation
    t = Math.max(0.05, t);

    var hex = poly.c;
    var r   = parseInt(hex.slice(1,3), 16);
    var g   = parseInt(hex.slice(3,5), 16);
    var b   = parseInt(hex.slice(5,7), 16);
    ctx.fillStyle = 'rgb(' + Math.round(r*t) + ',' + Math.round(g*t) + ',' + Math.round(b*t) + ')';
    ctx.fill();

    // coastline stroke — subtle darkening on day side only
    if(cp.sun > 0.08){
      ctx.strokeStyle = 'rgba(0,0,0,' + Math.min(0.14, cp.sun * 0.13) + ')';
      ctx.lineWidth   = 0.35;
      ctx.stroke();
    }
  }
  ctx.restore();

  // ── 05. Inner atmosphere haze (inside limb, blue vignette) ────────────────
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R + 0.5, 0, TAU); ctx.clip();
  var ih = ctx.createRadialGradient(cx, cy, R * 0.80, cx, cy, R * 1.005);
  ih.addColorStop(0.0, 'rgba(20,55,140,0)');
  ih.addColorStop(0.6, 'rgba(28,65,168,0.10)');
  ih.addColorStop(0.9, 'rgba(36,80,200,0.28)');
  ih.addColorStop(1.0, 'rgba(44,95,220,0.42)');
  ctx.fillStyle = ih; ctx.fillRect(cx-R*1.1, cy-R*1.1, R*2.2, R*2.2);
  ctx.restore();

  // ── 06. Terminator + wide cinematic penumbra (5-stop) ─────────────────────
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  var tg = ctx.createRadialGradient(nCX, nCY, 0, nCX, nCY, R * 1.62);
  tg.addColorStop(0.00, 'rgba(0,2,14,0.97)');    // deep night
  tg.addColorStop(0.28, 'rgba(0,2,14,0.92)');    // mid night
  tg.addColorStop(0.46, 'rgba(2,5,22,0.74)');    // approaching terminator
  tg.addColorStop(0.54, 'rgba(35,18,6,0.56)');   // terminator — deep amber
  tg.addColorStop(0.60, 'rgba(65,34,10,0.32)');  // twilight — warm orange
  tg.addColorStop(0.68, 'rgba(22,12,4,0.14)');   // transitioning to day
  tg.addColorStop(0.76, 'rgba(0,0,0,0)');        // full day
  ctx.fillStyle = tg; ctx.fillRect(cx-R, cy-R, R*2, R*2);
  ctx.restore();

  // ── 07. City lights (2-layer warm glow, night-side only) ──────────────────
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R - 0.5, 0, TAU); ctx.clip();
  for(var ci = 0; ci < CITIES.length; ci++){
    var city = CITIES[ci];
    var cp2  = proj(city[0], city[1]);
    if(cp2.z < 0.0)   continue;
    if(cp2.sun > 0.18) continue;
    var fade = Math.max(0, Math.min(1, (0.18 - cp2.sun) / 0.26));
    var br   = city[2] * fade;
    if(br < 0.05) continue;
    var cr = 2.2 * br + 0.5;
    // outer bloom — amber
    var cg1 = ctx.createRadialGradient(cp2.x, cp2.y, 0, cp2.x, cp2.y, cr * 4.5);
    cg1.addColorStop(0.0, 'rgba(255,230,150,' + (br * 0.32) + ')');
    cg1.addColorStop(0.4, 'rgba(255,195,85,'  + (br * 0.15) + ')');
    cg1.addColorStop(1.0, 'rgba(255,160,50,0)');
    ctx.beginPath(); ctx.arc(cp2.x, cp2.y, cr * 4.5, 0, TAU);
    ctx.fillStyle = cg1; ctx.fill();
    // hot core — white-yellow
    var cg2 = ctx.createRadialGradient(cp2.x, cp2.y, 0, cp2.x, cp2.y, cr * 1.4);
    cg2.addColorStop(0.0, 'rgba(255,252,220,' + (br * 0.92) + ')');
    cg2.addColorStop(0.5, 'rgba(255,230,140,' + (br * 0.45) + ')');
    cg2.addColorStop(1.0, 'rgba(255,200,80,0)');
    ctx.beginPath(); ctx.arc(cp2.x, cp2.y, cr * 1.4, 0, TAU);
    ctx.fillStyle = cg2; ctx.fill();
  }
  ctx.restore();

  // ── 08. Polar ice glow ────────────────────────────────────────────────────
  var polePts = [[0, 88], [0, -88]];
  for(var ip = 0; ip < polePts.length; ip++){
    var pp = proj(polePts[ip][0], polePts[ip][1]);
    if(pp.z < 0.0) continue;
    var pSun = Math.max(0, pp.sun);
    var pAlpha = 0.30 + 0.25 * pSun;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    var pg = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, R * 0.30 * pp.z);
    pg.addColorStop(0.0, 'rgba(210,235,255,' + (pAlpha * 0.85) + ')');
    pg.addColorStop(0.4, 'rgba(185,220,248,' + (pAlpha * 0.40) + ')');
    pg.addColorStop(0.75,'rgba(160,205,240,' + (pAlpha * 0.14) + ')');
    pg.addColorStop(1.0, 'rgba(140,190,230,0)');
    ctx.beginPath(); ctx.arc(pp.x, pp.y, R * 0.30 * pp.z, 0, TAU);
    ctx.fillStyle = pg; ctx.fill();
    ctx.restore();
  }

  // ── 09. Limb darkening (sphere depth vignette) ────────────────────────────
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R + 0.5, 0, TAU); ctx.clip();
  var ld = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.005);
  ld.addColorStop(0.0,  'rgba(0,0,0,0)');
  ld.addColorStop(0.68, 'rgba(0,0,0,0.10)');
  ld.addColorStop(0.88, 'rgba(0,0,0,0.36)');
  ld.addColorStop(1.0,  'rgba(0,0,0,0.72)');
  ctx.fillStyle = ld; ctx.fillRect(cx-R*1.05, cy-R*1.05, R*2.1, R*2.1);
  ctx.restore();

  // ── 10. Outer atmosphere — primary Rayleigh ring ──────────────────────────
  var ag1 = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.12);
  ag1.addColorStop(0.00, 'rgba(80,160,255,0)');
  ag1.addColorStop(0.12, 'rgba(105,178,255,0.58)');
  ag1.addColorStop(0.40, 'rgba(75,148,252,0.30)');
  ag1.addColorStop(0.70, 'rgba(55,122,238,0.12)');
  ag1.addColorStop(1.00, 'rgba(35,95,210,0)');
  fillArc(ag1, R * 1.12);

  // ── 11. Outer atmosphere — diffuse halo ──────────────────────────────────
  var ag2 = ctx.createRadialGradient(cx, cy, R * 1.03, cx, cy, R * 1.24);
  ag2.addColorStop(0.0, 'rgba(50,120,255,0)');
  ag2.addColorStop(0.3, 'rgba(42,110,242,0.07)');
  ag2.addColorStop(0.7, 'rgba(32,92,215,0.03)');
  ag2.addColorStop(1.0, 'rgba(22,72,185,0)');
  fillArc(ag2, R * 1.24);

  // ── 12. Sun-side limb scatter (warm white brightening on sun arc) ─────────
  var slg = ctx.createRadialGradient(sunSX, sunSY, R * 0.65, sunSX, sunSY, R * 1.22);
  slg.addColorStop(0.0, 'rgba(255,255,255,0)');
  slg.addColorStop(0.72,'rgba(230,242,255,0)');
  slg.addColorStop(0.84,'rgba(230,242,255,0.14)');
  slg.addColorStop(0.93,'rgba(255,255,255,0.06)');
  slg.addColorStop(1.0, 'rgba(255,255,255,0)');
  fillArc(slg, R * 1.20);

  // ── 13. Specular ocean highlight (sun reflection) ─────────────────────────
  var spX = cx + R * 0.26 * sdx;
  var spY = cy + R * 0.20 * sdy;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  var sp = ctx.createRadialGradient(spX, spY, 0, spX, spY, R * 0.42);
  sp.addColorStop(0.0, 'rgba(220,240,255,0.24)');
  sp.addColorStop(0.4, 'rgba(180,215,255,0.10)');
  sp.addColorStop(1.0, 'rgba(120,175,255,0)');
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
  ctx.fillStyle = sp; ctx.fill();
  ctx.restore();

  // ── 14. Globe edge (crisp bright rim) ─────────────────────────────────────
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
  ctx.strokeStyle = 'rgba(90,160,255,0.22)';
  ctx.lineWidth   = 0.8;
  ctx.stroke();

  // ── 15. Voice reactions ───────────────────────────────────────────────────

  if(vState === 'listening'){
    // Atmosphere rim brightens — electric blue-white
    var la = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.20);
    la.addColorStop(0.0, 'rgba(80,160,255,0)');
    la.addColorStop(0.2, 'rgba(100,178,255,0.22)');
    la.addColorStop(0.6, 'rgba(70,148,252,0.10)');
    la.addColorStop(1.0, 'rgba(50,120,240,0)');
    fillArc(la, R * 1.20);

    // 3 expanding concentric rings — thin, translucent
    for(var ri = 0; ri < 3; ri++){
      var rp = ((vPhase * 0.48 + ri * 0.333) % 1 + 1) % 1;
      var rr = R * (1.05 + rp * 0.52);
      var ra = Math.max(0, (1 - rp) * 0.26);
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU);
      ctx.strokeStyle = 'rgba(120,195,255,' + ra + ')';
      ctx.lineWidth   = 0.8 + (1 - rp) * 0.8;
      ctx.stroke();
    }
  }

  if(vState === 'speaking'){
    // Warm amber corona — organic pulse, no hard rings
    var pulse   = 0.5 + 0.5 * Math.sin(vPhase * 3.4);
    var pulseB  = 0.5 + 0.5 * Math.sin(vPhase * 2.1 + 1.2);

    // Outer corona
    var co = ctx.createRadialGradient(cx, cy, R * 0.90, cx, cy, R * 1.36);
    co.addColorStop(0.0,  'rgba(255,165,45,0)');
    co.addColorStop(0.18, 'rgba(255,152,38,' + (0.22 + 0.14 * pulse)   + ')');
    co.addColorStop(0.45, 'rgba(255,122,24,' + (0.09 * pulseB)         + ')');
    co.addColorStop(1.0,  'rgba(255,80,14,0)');
    fillArc(co, R * 1.36);

    // Inner warm globe brightening
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    var gw = ctx.createRadialGradient(cx, cy, R * 0.65, cx, cy, R);
    gw.addColorStop(0,   'rgba(255,145,35,0)');
    gw.addColorStop(0.8, 'rgba(255,135,30,' + (0.07 * pulse) + ')');
    gw.addColorStop(1.0, 'rgba(255,115,25,' + (0.16 * pulse) + ')');
    ctx.fillStyle = gw; ctx.fillRect(cx-R, cy-R, R*2, R*2);
    ctx.restore();
  }

  if(vState === 'idle'){
    // Very slow atmospheric breathe — barely perceptible
    var br2 = 0.5 + 0.5 * Math.sin(vPhase * 0.55);
    var ba  = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.15);
    ba.addColorStop(0.0, 'rgba(50,105,210,0)');
    ba.addColorStop(0.4, 'rgba(55,112,218,' + (0.05 * br2) + ')');
    ba.addColorStop(1.0, 'rgba(32,75,168,0)');
    fillArc(ba, R * 1.15);
  }

  // ── 16. Labels ────────────────────────────────────────────────────────────
  setLabel('lTR', 'dTR', 35.5, 39.2);
  setLabel('lIS', 'dIS', 29.0, 41.0);
  setLabel('lAN', 'dAN', 32.9, 39.9);
}

// ── Frame loop ────────────────────────────────────────────────────────────────
function frame(t){
  if(lastT >= 0){
    dt = (t - lastT) / 1000;
    if(dt > 0.12) dt = 0.12;
    rot    = (rot + SPEED * dt) % 360;
    vPhase += dt;
  }
  lastT = t;
  draw();
  requestAnimationFrame(frame);
}

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', function(){
  W = window.innerWidth  || screen.width  || W;
  H = window.innerHeight || screen.height || H;
  cx = W * 0.5; cy = H * 0.46; R = Math.min(W, H) * 0.44;
  cv.width = W; cv.height = H;
});

// ── Voice state API ───────────────────────────────────────────────────────────
window.onVoiceState = function(state){
  vState = state;
  SPEED  = state === 'speaking' ? 10.0 : state === 'listening' ? 6.8 : 3.6;
};

requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;

// ─── React component ──────────────────────────────────────────────────────────
export default function CinematicEarth({ voiceState }: Props) {
  const webRef = useRef<any>(null);

  useEffect(() => {
    webRef.current?.injectJavaScript(
      "if(window.onVoiceState)window.onVoiceState('" + voiceState + "');true;"
    );
  }, [voiceState]);

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
        onError={(e) => console.warn("Earth error:", e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { flex: 1, width: "100%", backgroundColor: "#00000e", overflow: "hidden" },
  web:         { flex: 1, backgroundColor: "transparent" },
  webFallback: { flex: 1, width: "100%", backgroundColor: "#00000e" },
});
