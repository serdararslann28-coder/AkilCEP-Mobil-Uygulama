/**
 * CinematicEarth – fully self-contained Three.js Earth rendered in a WebView.
 *
 * Zero external texture requests: all maps are generated at runtime via Canvas2D.
 * Shaders transported as JSON (no nested backtick escaping → Metro-safe).
 * Mobile-first WebGL: mediump precision, antialias off, explicit uniforms.
 */
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── Shader source strings ────────────────────────────────────────────────────
// Stored as string arrays joined with \n so there are ZERO nested backticks
// inside the TypeScript template literal that produces EARTH_HTML.

const EARTH_VERT = [
  "precision mediump float;",
  "varying vec3 vWorldNormal;",
  "varying vec3 vWorldPos;",
  "varying vec2 vUv;",
  "void main() {",
  "  vec4 wp = modelMatrix * vec4(position, 1.0);",
  "  vWorldPos    = wp.xyz;",
  "  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);",
  "  vUv = uv;",
  "  gl_Position  = projectionMatrix * viewMatrix * wp;",
  "}",
].join("\n");

const EARTH_FRAG = [
  "precision mediump float;",
  "uniform sampler2D uDay;",
  "uniform sampler2D uNight;",
  "uniform sampler2D uWater;",
  "uniform vec3  uSun;",
  "uniform vec3  uCam;",
  "uniform float uGlow;",
  "varying vec3 vWorldNormal;",
  "varying vec3 vWorldPos;",
  "varying vec2 vUv;",
  "void main() {",
  "  vec3 N = normalize(vWorldNormal);",
  "  vec3 V = normalize(uCam - vWorldPos);",
  "  vec3 L = normalize(uSun);",
  "  float nDL  = dot(N, L);",
  "  float day  = smoothstep(-0.15, 0.28, nDL);",
  "  vec3 dayCol   = texture2D(uDay,   vUv).rgb;",
  "  vec3 nightCol = texture2D(uNight, vUv).rgb;",
  "  float water   = texture2D(uWater, vUv).r;",
  // diffuse
  "  vec3 lit = dayCol * (0.07 + 0.93 * max(0.0, nDL));",
  // ocean specular
  "  vec3 H   = normalize(L + V);",
  "  float sp = pow(max(0.0, dot(N, H)), 110.0) * water * 0.85 * day;",
  "  lit += vec3(0.92, 0.96, 1.0) * sp;",
  // atmospheric blue rim
  "  float rim = pow(1.0 - max(0.0, dot(N, V)), 4.0);",
  "  lit += vec3(0.18, 0.4, 0.92) * rim * day * 0.45;",
  // golden twilight band
  "  float twi = smoothstep(-0.15, 0.0, nDL) * (1.0 - smoothstep(0.0, 0.28, nDL));",
  "  lit += vec3(0.9, 0.45, 0.07) * twi * 0.35;",
  // city lights
  "  vec3 city = nightCol * 1.7 * (1.0 - day);",
  "  vec3 col  = lit * day + city;",
  "  col *= uGlow;",
  "  gl_FragColor = vec4(col, 1.0);",
  "}",
].join("\n");

const ATMOS_VERT = [
  "precision mediump float;",
  "varying vec3 vWN;",
  "void main() {",
  "  vWN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);",
  "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
  "}",
].join("\n");

const ATMOS_INNER_FRAG = [
  "precision mediump float;",
  "uniform vec3  uSun;",
  "uniform vec3  uCam;",
  "varying vec3 vWN;",
  "void main() {",
  "  vec3 N = normalize(vWN);",
  "  vec3 V = normalize(uCam);",
  "  float sd  = max(0.0, dot(N, normalize(uSun)));",
  "  float rim = pow(1.0 - max(0.0, dot(N, V)), 5.0);",
  "  vec3 day  = mix(vec3(0.1, 0.3, 0.92), vec3(0.25, 0.5, 1.0), sd);",
  "  float a   = rim * 0.68 * (0.28 + 0.72 * (0.3 + 0.7 * sd));",
  "  gl_FragColor = vec4(day, a);",
  "}",
].join("\n");

const ATMOS_OUTER_FRAG = [
  "precision mediump float;",
  "uniform vec3  uSun;",
  "uniform vec3  uCam;",
  "varying vec3 vWN;",
  "void main() {",
  "  vec3 N = normalize(vWN);",
  "  vec3 V = normalize(uCam);",
  "  float sd  = max(0.0, dot(N, normalize(uSun)));",
  "  float rim = pow(0.53 - max(0.0, dot(N, V)), 5.0);",
  "  float a   = max(0.0, rim) * 0.38 * (0.35 + 0.65 * sd);",
  "  gl_FragColor = vec4(0.18, 0.44, 1.0, a);",
  "}",
].join("\n");

// ─── Build the complete self-contained HTML ───────────────────────────────────

const EARTH_HTML = (() => {
  // Transport shaders safely through JSON — no string escaping issues.
  const S = JSON.stringify({
    ev: EARTH_VERT,
    ef: EARTH_FRAG,
    av: ATMOS_VERT,
    af: ATMOS_INNER_FRAG,
    of: ATMOS_OUTER_FRAG,
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000;overflow:hidden}
canvas{position:absolute;inset:0;width:100%;height:100%}
#ui{position:absolute;inset:0;pointer-events:none}
.lb{
  position:absolute;
  font-family:-apple-system,'Helvetica Neue',sans-serif;
  font-size:9px;letter-spacing:3px;font-weight:600;
  text-transform:uppercase;white-space:nowrap;
  color:rgba(200,225,255,0.9);
  text-shadow:0 0 10px rgba(120,180,255,0.9),0 0 20px rgba(80,140,255,0.4);
  transform:translate(-50%,-150%);
  transition:opacity 0.7s;
}
.lb.big{font-size:11px;letter-spacing:4px}
.dt{
  position:absolute;width:4px;height:4px;border-radius:50%;
  background:rgba(200,225,255,0.95);
  transform:translate(-50%,-50%);
  box-shadow:0 0 7px 2px rgba(160,210,255,0.65);
  transition:opacity 0.7s;
}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="ui">
  <div class="lb big" id="lTR" style="opacity:0">TÜRKİYE</div><div class="dt" id="dTR" style="opacity:0"></div>
  <div class="lb"     id="lIS" style="opacity:0">İstanbul</div><div class="dt" id="dIS" style="opacity:0"></div>
  <div class="lb"     id="lAN" style="opacity:0">Ankara</div>  <div class="dt" id="dAN" style="opacity:0"></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js"></script>
<script>
(function(){
'use strict';
var S = ${S};

// ── Canvas texture helpers ─────────────────────────────────────────────────
var TW = 512, TH = 256; // earth / water texture size
var CW = 256, CH = 128; // cloud texture size

function ll2xy(lon, lat, w, h) {
  return { x: (lon + 180) / 360 * w, y: (90 - lat) / 180 * h };
}

function fillPoly(ctx, pts, color, w, h) {
  if (!pts || pts.length < 3) return;
  var p0 = ll2xy(pts[0][0], pts[0][1], w, h);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  for (var i = 1; i < pts.length; i++) {
    var p = ll2xy(pts[i][0], pts[i][1], w, h);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ── Continent data ─────────────────────────────────────────────────────────
// Each entry: { pts: [[lon,lat],...], c: 'color' }
// Painted in order (later = on top). All longitudes −180…180, latitudes −90…90.
var LAND = [
  // ── AFRICA
  { c:'#3d7040', pts:[[-18,16],[-15,10],[-8,5],[-2,2],[8,0],[12,-5],[15,-12],[18,-18],[20,-24],[24,-28],[28,-30],[32,-26],[36,-20],[40,-14],[42,-9],[46,-8],[50,11],[46,12],[44,8],[42,12],[40,16],[38,22],[34,26],[28,30],[20,33],[15,37],[8,38],[0,37],[-5,35],[-14,35],[-18,35],[-18,16]] },
  // Sahara
  { c:'#c8a455', pts:[[-18,16],[-15,22],[-10,27],[-5,30],[0,30],[8,26],[15,24],[18,22],[20,18],[18,14],[12,14],[8,18],[2,18],[-5,20],[-10,20],[-15,20],[-18,16]] },
  // Horn of Africa
  { c:'#b89040', pts:[[40,14],[46,10],[50,12],[46,12],[44,8],[42,10],[40,14]] },
  // Southern Africa (savanna)
  { c:'#5a7835', pts:[[14,-18],[18,-18],[20,-24],[24,-28],[28,-30],[32,-26],[36,-20],[34,-14],[28,-14],[22,-14],[18,-16],[14,-18]] },
  // Madagascar
  { c:'#4a7838', pts:[[44,-12],[48,-12],[50,-18],[48,-26],[44,-26],[44,-20],[44,-12]] },

  // ── EUROPE
  { c:'#4a7a38', pts:[[-10,36],[0,37],[10,38],[20,37],[28,37],[30,42],[36,42],[32,48],[35,54],[24,58],[20,60],[18,72],[8,70],[0,68],[-5,60],[-8,54],[-5,50],[-10,44],[-10,36]] },
  // Iberian Peninsula (slightly dryer)
  { c:'#7a8840', pts:[[-10,36],[0,37],[-2,43],[-8,44],[-10,42],[-10,36]] },
  // Britain + Ireland
  { c:'#4a7a38', pts:[[-6,50],[-5,58],[-3,60],[0,61],[2,51],[-6,50]] },
  { c:'#4a7a38', pts:[[-10,52],[-6,55],[-8,54],[-10,52]] },
  // Scandinavia
  { c:'#4a7a38', pts:[[5,58],[8,62],[10,70],[18,72],[24,72],[28,70],[28,62],[22,60],[18,58],[14,56],[10,56],[5,58]] },
  // Alps highlight
  { c:'#8a7a58', pts:[[6,44],[10,48],[14,48],[16,46],[14,44],[10,44],[6,44]] },

  // ── RUSSIA + SIBERIA
  { c:'#3a6830', pts:[[30,50],[40,58],[60,60],[80,62],[100,66],[120,68],[140,70],[160,62],[168,58],[165,54],[155,50],[140,46],[130,42],[120,40],[100,46],[80,52],[60,56],[40,58],[30,55],[30,50]] },

  // ── TURKEY + CAUCASUS + IRAN
  { c:'#5a7838', pts:[[26,36],[30,40],[36,42],[42,40],[48,38],[54,36],[60,28],[56,22],[50,14],[44,12],[42,12],[44,10],[52,14],[58,22],[64,24],[68,22],[72,20],[68,22],[64,24],[60,28],[54,36],[48,38],[42,40],[36,42],[30,40],[26,36]] },
  // Arabian Peninsula
  { c:'#c8a455', pts:[[36,30],[44,30],[52,24],[58,22],[56,14],[50,14],[44,12],[42,12],[40,16],[36,22],[36,30]] },
  // Mesopotamia / Iraq green strip
  { c:'#6a8838', pts:[[44,30],[48,34],[52,34],[54,32],[54,28],[50,24],[44,30]] },

  // ── SOUTH ASIA (India)
  { c:'#4a7838', pts:[[60,28],[66,26],[70,24],[72,22],[76,8],[80,8],[82,10],[86,12],[88,22],[86,26],[80,28],[76,28],[70,30],[66,30],[60,28]] },
  // Thar Desert
  { c:'#c0944a', pts:[[68,28],[72,28],[72,24],[68,24],[66,26],[68,28]] },
  // Sri Lanka
  { c:'#4a7838', pts:[[80,8],[82,6],[82,8],[80,8]] },

  // ── SOUTHEAST ASIA
  { c:'#3a7030', pts:[[98,22],[102,22],[106,20],[110,18],[114,10],[116,4],[104,2],[100,2],[98,8],[98,16],[98,22]] },
  // Sumatra
  { c:'#3a7030', pts:[[96,6],[100,2],[106,0],[106,-2],[100,-2],[96,0],[96,6]] },
  // Borneo
  { c:'#3a7030', pts:[[108,8],[116,8],[118,4],[116,0],[112,0],[108,2],[108,8]] },
  // Java (small)
  { c:'#3a7030', pts:[[106,-6],[110,-6],[112,-8],[108,-8],[106,-6]] },

  // ── EAST ASIA (China + Korea + Manchuria)
  { c:'#3d7040', pts:[[75,40],[80,44],[86,44],[90,48],[100,50],[110,48],[120,52],[128,50],[130,44],[128,38],[124,32],[120,26],[114,18],[110,16],[106,18],[100,18],[96,22],[88,24],[80,30],[76,34],[75,40]] },
  // Gobi Desert
  { c:'#b0944a', pts:[[90,44],[100,50],[110,48],[118,46],[114,38],[108,38],[100,40],[90,44]] },
  // Tibetan Plateau
  { c:'#9a8860', pts:[[80,30],[86,30],[92,28],[98,28],[100,34],[96,36],[88,36],[82,34],[80,30]] },
  // Himalayas
  { c:'#8a7858', pts:[[76,28],[80,28],[86,28],[92,28],[96,28],[96,30],[88,32],[82,32],[76,30],[76,28]] },
  // Korean Peninsula
  { c:'#4a7838', pts:[[126,38],[128,38],[130,36],[128,34],[126,34],[126,38]] },
  // Japan
  { c:'#4a7838', pts:[[131,32],[133,34],[136,36],[138,40],[141,42],[141,44],[137,46],[134,44],[130,40],[130,36],[131,32]] },
  // Hokkaido
  { c:'#4a7838', pts:[[140,42],[145,44],[145,42],[141,42],[140,42]] },

  // ── NORTH AMERICA
  { c:'#3d7040', pts:[[-168,72],[-140,70],[-110,70],[-80,75],[-60,64],[-55,50],[-64,44],[-76,42],[-80,38],[-84,30],[-88,28],[-95,22],[-90,16],[-85,12],[-82,8],[-78,10],[-80,14],[-88,16],[-95,18],[-104,22],[-110,28],[-118,34],[-122,38],[-124,46],[-132,54],[-140,56],[-152,58],[-165,64],[-168,72]] },
  // Great Plains
  { c:'#8aaa40', pts:[[-98,50],[-90,46],[-88,40],[-95,36],[-100,36],[-104,42],[-100,50],[-98,50]] },
  // Rocky Mountains
  { c:'#8a7858', pts:[[-110,48],[-104,40],[-110,34],[-118,36],[-120,44],[-110,48]] },
  // Appalachians
  { c:'#6a8850', pts:[[-80,40],[-76,42],[-80,38],[-84,36],[-82,34],[-80,36],[-80,40]] },
  // Central America
  { c:'#3d7040', pts:[[-85,12],[-82,8],[-80,8],[-78,12],[-80,16],[-85,14],[-85,12]] },
  // Cuba
  { c:'#3d7040', pts:[[-75,22],[-82,22],[-84,20],[-78,20],[-75,22]] },

  // ── SOUTH AMERICA
  { c:'#3d7040', pts:[[-80,12],[-70,12],[-62,10],[-52,4],[-50,0],[-48,-5],[-42,-10],[-36,-10],[-36,-14],[-40,-18],[-44,-22],[-46,-28],[-52,-32],[-56,-36],[-62,-40],[-66,-48],[-70,-54],[-72,-56],[-70,-52],[-68,-44],[-70,-38],[-68,-30],[-70,-22],[-68,-14],[-72,-10],[-80,0],[-80,10],[-80,12]] },
  // Amazon forest (darker green)
  { c:'#1e6028', pts:[[-70,6],[-60,6],[-50,4],[-48,-2],[-52,-8],[-62,-12],[-70,-4],[-70,6]] },
  // Andes
  { c:'#7a6a52', pts:[[-76,4],[-70,-4],[-68,-14],[-70,-22],[-68,-30],[-70,-38],[-68,-44],[-72,-44],[-72,-34],[-70,-26],[-72,-18],[-72,-10],[-74,-4],[-76,4]] },
  // Patagonia (scrubland)
  { c:'#8a8850', pts:[[-70,-38],[-66,-40],[-62,-44],[-66,-48],[-70,-48],[-72,-44],[-70,-38]] },

  // ── AUSTRALIA
  { c:'#8a7848', pts:[[114,-22],[118,-20],[122,-18],[126,-14],[130,-12],[132,-12],[136,-12],[138,-14],[142,-14],[146,-18],[150,-22],[152,-26],[152,-30],[150,-34],[146,-38],[142,-38],[138,-36],[134,-36],[128,-34],[122,-34],[116,-30],[112,-24],[112,-22],[114,-22]] },
  // Coastal green belt
  { c:'#5a7838', pts:[[150,-22],[152,-26],[152,-30],[150,-34],[148,-38],[144,-36],[140,-34],[140,-14],[142,-14],[146,-18],[150,-22]] },
  // Outback (red center)
  { c:'#b84822', pts:[[120,-22],[126,-18],[132,-18],[136,-20],[136,-26],[130,-28],[124,-28],[120,-26],[120,-22]] },
  // New Zealand (north island)
  { c:'#4a7838', pts:[[172,-34],[176,-36],[178,-38],[176,-40],[172,-38],[170,-36],[172,-34]] },

  // ── GREENLAND
  { c:'#ccd8e8', pts:[[-40,82],[-20,82],[-20,76],[-26,68],[-34,64],[-50,64],[-56,70],[-62,74],[-60,80],[-40,82]] },

  // ── ANTARCTICA
  { c:'#d0dff0', pts:[[-180,-72],[-140,-70],[-100,-72],[-60,-74],[-20,-72],[20,-70],[60,-74],[100,-70],[140,-72],[180,-72],[180,-90],[-180,-90],[-180,-72]] },
];

// ── City lights [lon, lat, brightness] ────────────────────────────────────
var CITIES = [
  // Turkey ★
  [29.0,41.0,1.0],[32.9,39.9,0.9],
  // W. Europe
  [-0.1,51.5,1.0],[2.3,48.9,1.0],[13.4,52.5,0.9],[12.5,41.9,0.8],[4.9,52.4,0.8],
  [18.1,59.3,0.7],[14.4,50.1,0.8],[16.4,48.2,0.8],[23.7,37.9,0.8],
  [10.0,53.6,0.7],[2.2,41.4,0.8],[-3.7,40.4,0.9],[24.9,60.2,0.7],[21.0,52.2,0.8],
  [26.1,44.4,0.8],[19.0,47.5,0.7],[-8.6,41.1,0.7],[3.0,50.6,0.7],
  // Russia / E. Europe
  [37.6,55.7,1.0],[30.3,59.9,0.9],[49.1,55.8,0.8],[60.6,56.8,0.7],
  [82.9,54.9,0.7],[73.4,54.9,0.7],[55.0,53.2,0.7],
  // Middle East
  [35.2,31.8,0.8],[35.5,33.9,0.7],[44.4,33.3,0.8],[51.5,25.3,0.9],
  [55.3,25.3,0.9],[46.7,24.7,0.9],[31.2,30.1,0.9],[36.3,33.5,0.7],
  [39.2,21.5,0.8],[44.4,15.4,0.7],[58.6,23.6,0.7],
  // South Asia
  [77.2,28.6,1.0],[72.9,19.1,1.0],[80.3,13.1,0.9],[88.4,22.6,1.0],
  [77.6,12.9,0.9],[67.0,24.9,0.9],[74.3,31.5,0.9],[73.1,33.7,0.9],
  // E. / SE. Asia
  [116.4,39.9,1.0],[121.5,31.2,1.0],[113.3,23.1,1.0],[114.1,22.5,0.9],
  [106.8,10.8,0.9],[103.8,1.4,0.9],[100.5,13.8,0.9],[104.9,11.6,0.8],
  [139.7,35.7,1.0],[135.5,34.7,0.9],[126.9,37.5,0.9],[121.6,25.0,0.9],
  [120.3,36.1,0.8],[128.6,35.9,0.8],
  // Africa
  [36.8,-1.3,0.8],[18.6,-33.9,0.8],[28.0,-26.2,0.9],[38.7,9.0,0.8],
  [32.6,0.3,0.7],[15.3,-4.3,0.7],[7.5,9.1,0.8],[3.4,6.5,0.8],
  [-17.4,14.7,0.7],[32.5,15.6,0.7],[-1.2,5.6,0.7],
  // North America
  [-74.0,40.7,1.0],[-87.6,41.8,1.0],[-118.2,34.1,1.0],[-122.4,37.8,0.9],
  [-75.1,39.9,0.9],[-80.2,25.8,0.9],[-77.0,38.9,0.9],[-83.0,42.3,0.8],
  [-79.4,43.7,0.9],[-73.6,45.5,0.9],[-123.1,49.3,0.8],[-99.1,19.4,1.0],
  [-90.5,14.6,0.8],[-84.1,9.9,0.7],[-79.5,9.0,0.7],[-66.9,10.5,0.8],
  [-63.1,18.0,0.6],[-157.8,21.3,0.8],
  // South America
  [-74.1,4.7,0.8],[-77.0,-12.0,0.9],[-43.2,-22.9,1.0],[-46.6,-23.5,1.0],
  [-58.4,-34.6,0.9],[-70.7,-33.5,0.9],[-56.2,-34.9,0.8],[-68.1,-16.5,0.7],
  // Australia / Pacific
  [151.2,-33.9,0.9],[144.9,-37.8,0.9],[153.0,-27.5,0.8],[115.9,-32.0,0.8],
  [174.8,-36.9,0.8],
];

// ── Noise for clouds ───────────────────────────────────────────────────────
function nh(x, y) {
  var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function ni(x, y) {
  var ix = Math.floor(x), iy = Math.floor(y);
  var fx = x - ix, fy = y - iy;
  var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return nh(ix,iy)*(1-ux)*(1-uy) + nh(ix+1,iy)*ux*(1-uy) +
         nh(ix,iy+1)*(1-ux)*uy   + nh(ix+1,iy+1)*ux*uy;
}
function fbm(x, y) {
  return 0.5*ni(x,y) + 0.25*ni(x*2,y*2) + 0.125*ni(x*4,y*4) + 0.0625*ni(x*8,y*8);
}

// ── Generate textures ──────────────────────────────────────────────────────
function makeDayTex() {
  var cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
  var ctx = cv.getContext('2d');

  // Ocean gradient
  var g = ctx.createLinearGradient(0, 0, 0, TH);
  g.addColorStop(0.00, '#081830'); g.addColorStop(0.15, '#0c2848');
  g.addColorStop(0.50, '#184060'); g.addColorStop(0.85, '#0c2848');
  g.addColorStop(1.00, '#081830');
  ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH);

  // Ocean shallow-water fringe (lighter near coasts) — simple horizontal band
  var g2 = ctx.createLinearGradient(0, TH*0.28, 0, TH*0.72);
  g2.addColorStop(0, 'rgba(30,80,130,0.0)');
  g2.addColorStop(0.4, 'rgba(30,80,130,0.18)');
  g2.addColorStop(0.6, 'rgba(30,80,130,0.18)');
  g2.addColorStop(1, 'rgba(30,80,130,0.0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, TW, TH);

  // Continents
  LAND.forEach(function(L) { fillPoly(ctx, L.pts, L.c, TW, TH); });

  // Polar ice caps (overlay circles)
  var pg1 = ctx.createRadialGradient(TW/2, 0, 0, TW/2, 0, TH*0.12);
  pg1.addColorStop(0, 'rgba(220,235,248,1)'); pg1.addColorStop(1, 'rgba(220,235,248,0)');
  ctx.fillStyle = pg1; ctx.fillRect(0, 0, TW, TH*0.14);

  var pg2 = ctx.createRadialGradient(TW/2, TH, 0, TW/2, TH, TH*0.08);
  pg2.addColorStop(0, 'rgba(210,228,245,1)'); pg2.addColorStop(1, 'rgba(210,228,245,0)');
  ctx.fillStyle = pg2; ctx.fillRect(0, TH*0.9, TW, TH*0.1);

  return new THREE.CanvasTexture(cv);
}

function makeWaterTex() {
  var cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, TW, TH); // all water = white (specular on)
  LAND.forEach(function(L) { fillPoly(ctx, L.pts, '#000', TW, TH); }); // land = black
  return new THREE.CanvasTexture(cv);
}

function makeNightTex() {
  var cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TW, TH);

  CITIES.forEach(function(c) {
    var p = ll2xy(c[0], c[1], TW, TH);
    var br = c[2]; var r = 3.0 * br;
    var grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
    grd.addColorStop(0.0, 'rgba(255,240,170,' + (br * 0.95) + ')');
    grd.addColorStop(0.3, 'rgba(255,220,130,' + (br * 0.5)  + ')');
    grd.addColorStop(0.7, 'rgba(255,200,100,' + (br * 0.15) + ')');
    grd.addColorStop(1.0, 'rgba(255,180, 80,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2); ctx.fill();
  });

  return new THREE.CanvasTexture(cv);
}

function makeCloudTex() {
  var cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  var ctx = cv.getContext('2d');
  var id = ctx.createImageData(CW, CH);
  for (var yy = 0; yy < CH; yy++) {
    var lat = (0.5 - yy / CH) * 180;
    var pf  = Math.cos(lat * Math.PI / 180); // fewer clouds at poles
    for (var xx = 0; xx < CW; xx++) {
      var v = fbm(xx / CW * 9, yy / CH * 4.5);
      var a = Math.max(0, (v - 0.50) * 3.8 * pf);
      var i = (yy * CW + xx) * 4;
      id.data[i] = 255; id.data[i+1] = 255; id.data[i+2] = 255;
      id.data[i+3] = Math.min(255, Math.round(a * 200));
    }
  }
  ctx.putImageData(id, 0, 0);
  return new THREE.CanvasTexture(cv);
}

// ── WebGL Renderer ─────────────────────────────────────────────────────────
var canvas = document.getElementById('c');
var renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: false, alpha: false,
    precision: 'mediump', powerPreference: 'default',
    preserveDrawingBuffer: false
  });
} catch(e) { return; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// ── Scene / Camera ─────────────────────────────────────────────────────────
var scene  = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(0, 0.1, 2.7);

// ── Stars ──────────────────────────────────────────────────────────────────
(function() {
  var N = 2000, pos = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) {
    var r = 55 + Math.random() * 40;
    var th = Math.random() * Math.PI * 2;
    var ph = Math.acos(2 * Math.random() - 1);
    pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
    pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
    pos[i*3+2] = r * Math.cos(ph);
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.07, sizeAttenuation: true,
    transparent: true, opacity: 0.82
  })));
})();

// ── Sun + lighting ─────────────────────────────────────────────────────────
var SUN = new THREE.Vector3(1.5, 0.5, 1.0).normalize();
var CAM = camera.position.clone();
var sunLight = new THREE.DirectionalLight(0xfff8e8, 1.8);
sunLight.position.copy(SUN); scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x0a1a2e, 0.55));

// ── Voice glow ─────────────────────────────────────────────────────────────
var tGlow = 1.0, cGlow = 1.0;
window.onVoiceState = function(s) {
  tGlow = s === 'speaking' ? 1.45 : s === 'listening' ? 1.15 : 1.0;
};

// ── Shared uniforms ────────────────────────────────────────────────────────
var uSun = { value: SUN };
var uCam = { value: CAM };

// ── Atmosphere ─────────────────────────────────────────────────────────────
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1.026, 48, 48),
  new THREE.ShaderMaterial({
    uniforms: { uSun: uSun, uCam: uCam },
    vertexShader: S.av, fragmentShader: S.af,
    side: THREE.FrontSide, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false
  })
));
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1.20, 36, 36),
  new THREE.ShaderMaterial({
    uniforms: { uSun: uSun, uCam: uCam },
    vertexShader: S.av, fragmentShader: S.of,
    side: THREE.BackSide, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false
  })
));

// ── Orbit rings ────────────────────────────────────────────────────────────
[[1.40, Math.PI/2, 0.09],[1.62, Math.PI/2 + 0.2, 0.05]].forEach(function(r) {
  var m = new THREE.Mesh(
    new THREE.TorusGeometry(r[0], 0.0006, 2, 160),
    new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: r[2] })
  );
  m.rotation.x = r[1]; scene.add(m);
});

// ── Earth group ────────────────────────────────────────────────────────────
var earthGroup = new THREE.Group(); scene.add(earthGroup);
var earthMat = null;
var cloudMesh = null;

// Generate all textures immediately (no network)
var dayTex   = makeDayTex();
var waterTex = makeWaterTex();
var nightTex = makeNightTex();
var cloudTex = makeCloudTex();

earthMat = new THREE.ShaderMaterial({
  uniforms: {
    uDay:   { value: dayTex },
    uNight: { value: nightTex },
    uWater: { value: waterTex },
    uSun:   uSun, uCam: uCam,
    uGlow:  { value: 1.0 }
  },
  vertexShader: S.ev, fragmentShader: S.ef
});
earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1, 56, 56), earthMat));

cloudMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.013, 40, 40),
  new THREE.MeshPhongMaterial({
    map: cloudTex, transparent: true, opacity: 0.38,
    depthWrite: false, blending: THREE.NormalBlending
  })
);
earthGroup.add(cloudMesh);

// ── Geographic labels ──────────────────────────────────────────────────────
function ll(lat, lon) {
  var phi = (90 - lat) * Math.PI / 180, theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-Math.sin(phi)*Math.cos(theta), Math.cos(phi), Math.sin(phi)*Math.sin(theta));
}
var GEO = [
  { lb:'lTR', dt:'dTR', p: ll(39.0,  35.0)  },
  { lb:'lIS', dt:'dIS', p: ll(41.01, 28.98) },
  { lb:'lAN', dt:'dAN', p: ll(39.93, 32.86) },
];

// ── Animation ──────────────────────────────────────────────────────────────
var SPIN = Math.PI * 2 / 50; // one revolution / 50 s
var clock = new THREE.Clock();
var _v = new THREE.Vector3();
var _fwd = new THREE.Vector3(0, 0, 1);

function tick() {
  requestAnimationFrame(tick);
  var dt = clock.getDelta();

  earthGroup.rotation.y += SPIN * dt;
  if (cloudMesh) cloudMesh.rotation.y += SPIN * dt * 1.07;

  cGlow += (tGlow - cGlow) * 0.04;
  if (earthMat) earthMat.uniforms.uGlow.value = cGlow;

  var W = window.innerWidth, H = window.innerHeight;
  GEO.forEach(function(g) {
    _v.copy(g.p).applyMatrix4(earthGroup.matrixWorld);
    var facing = _v.clone().normalize().dot(_fwd);
    var op = facing > 0.12 ? Math.min(1, (facing - 0.12) / 0.32).toFixed(2) : '0';
    _v.project(camera);
    var sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
    var le = document.getElementById(g.lb), de = document.getElementById(g.dt);
    if (le) { le.style.left = sx+'px'; le.style.top = sy+'px'; le.style.opacity = op; }
    if (de) { de.style.left = sx+'px'; de.style.top = (sy+12)+'px'; de.style.opacity = op; }
  });

  renderer.render(scene, camera);
}
tick();

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── WebGL context loss ─────────────────────────────────────────────────────
canvas.addEventListener('webglcontextlost', function(e) { e.preventDefault(); }, false);

})();
</script>
</body>
</html>`;
})();

// ─── React Native component ───────────────────────────────────────────────────

export default function CinematicEarth({ voiceState }: Props) {
  const webRef = useRef<any>(null);

  useEffect(() => {
    webRef.current?.injectJavaScript(
      "if(window.onVoiceState)window.onVoiceState('" + voiceState + "');true;"
    );
  }, [voiceState]);

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
        onError={(e) => console.warn("CinematicEarth error:", e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, width: "100%", backgroundColor: "#000008", overflow: "hidden" },
  web:  { flex: 1, backgroundColor: "transparent" },
});
