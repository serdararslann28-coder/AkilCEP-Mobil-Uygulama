/**
 * CinematicEarth — premium cinematic Earth for Voyage / Voice Mode.
 *
 * Architecture (stable on all mobile WebGL):
 *  • View-space normals via normalMatrix (no modelMatrix in GLSL)
 *  • Per-fragment V = normalize(-viewPos)  → correct specular + rim
 *  • Sun direction pre-computed once in JS, passed as static uniform
 *  • Water mask texture drives ocean specular (cheap, huge visual uplift)
 *  • Sun-modulated atmosphere (brighter on day side, deep blue on night side)
 *  • All textures procedural Canvas2D — zero network requests
 *  • MeshPhongMaterial for clouds (Three.js built-in, universally supported)
 *  • antialias:false, precision:mediump, powerPreference:default
 *  • Shaders stored as JSON-stringified object (no nested backtick escaping)
 */
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── Shaders ──────────────────────────────────────────────────────────────────

const EARTH_VERT = [
  "precision mediump float;",
  "varying vec2  vUv;",
  "varying vec3  vVN;",  // view-space normal  (rotates with Earth via normalMatrix)
  "varying vec3  vVP;",  // view-space position (for accurate V per-fragment)
  "void main(){",
  "  vec4 vp = modelViewMatrix * vec4(position, 1.0);",
  "  vVP = vp.xyz;",
  "  vVN = normalize(normalMatrix * normal);",
  "  vUv = uv;",
  "  gl_Position = projectionMatrix * vp;",
  "}",
].join("\n");

// Three textures: day map, night (city lights), water mask for specular.
// Sun in view space → static uniform (camera + sun both fixed).
const EARTH_FRAG = [
  "precision mediump float;",
  "uniform sampler2D uDay;",
  "uniform sampler2D uNight;",
  "uniform sampler2D uWater;",
  "uniform vec3  uLight;",    // sun direction in view space
  "uniform float uGlow;",
  "varying vec2  vUv;",
  "varying vec3  vVN;",
  "varying vec3  vVP;",
  "void main(){",
  "  vec3  N  = normalize(vVN);",
  "  vec3  L  = normalize(uLight);",
  "  vec3  V  = normalize(-vVP);",   // camera is at origin in view space
  "  vec3  H  = normalize(L + V);",
  "  float d  = dot(N, L);",
  "  float t  = smoothstep(-0.20, 0.30, d);",
  // ── Day: diffuse + specular + rim
  "  vec3 dayC = texture2D(uDay, vUv).rgb * (0.06 + 0.94 * max(0.0, d));",
  "  float water = texture2D(uWater, vUv).r;",
  "  float spec  = pow(max(0.0, dot(N, H)), 95.0) * water * 0.85 * t;",
  "  dayC += vec3(0.86, 0.93, 1.00) * spec;",
  "  float rim = pow(1.0 - max(0.0, dot(N, V)), 4.5);",
  "  dayC += vec3(0.10, 0.28, 0.90) * rim * t * 0.42;",
  // ── Twilight: warm amber band at terminator
  "  float twi = smoothstep(-0.20, 0.0, d) * (1.0 - smoothstep(0.0, 0.30, d));",
  "  dayC += vec3(0.95, 0.42, 0.05) * twi * 0.42;",
  // ── Night: city lights, slightly boosted near terminator for cinematic look
  "  float nM  = (1.0 - t) + twi * 0.45;",
  "  vec3 ngtC = texture2D(uNight, vUv).rgb * 1.65 * clamp(nM, 0.0, 1.0);",
  "  gl_FragColor = vec4((dayC * t + ngtC) * uGlow, 1.0);",
  "}",
].join("\n");

// Atmosphere: proper V per-vertex, sun-modulated color + brightness.
const ATMOS_VERT = [
  "precision mediump float;",
  "uniform vec3 uLight;",
  "varying float vRim;",
  "varying float vSun;",
  "void main(){",
  "  vec3  n  = normalize(normalMatrix * normal);",
  "  vec4  vp = modelViewMatrix * vec4(position, 1.0);",
  "  vec3  V  = normalize(-vp.xyz);",
  "  vRim = pow(1.0 - max(0.0, dot(n, V)), 5.0);",
  "  vSun = 0.35 + 0.65 * max(0.0, dot(n, normalize(uLight)));",
  "  gl_Position = projectionMatrix * vp;",
  "}",
].join("\n");

const ATMOS_FRAG = [
  "precision mediump float;",
  "varying float vRim;",
  "varying float vSun;",
  "void main(){",
  "  vec3 col = mix(vec3(0.08, 0.18, 0.78), vec3(0.20, 0.46, 1.0), vSun);",
  "  gl_FragColor = vec4(col, vRim * 0.62);",
  "}",
].join("\n");

// ─── HTML ─────────────────────────────────────────────────────────────────────

const EARTH_HTML = (() => {
  const S = JSON.stringify({
    ev: EARTH_VERT, ef: EARTH_FRAG,
    av: ATMOS_VERT, af: ATMOS_FRAG,
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
  font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;
  white-space:nowrap;text-transform:uppercase;letter-spacing:3.5px;
  color:rgba(210,230,255,0.94);
  text-shadow:0 0 12px rgba(110,175,255,0.9),0 0 24px rgba(70,140,255,0.40);
  transform:translate(-50%,-160%);transition:opacity 0.8s ease;
}
.lb.big{font-size:11px;font-weight:700;letter-spacing:4.5px}
.lb.sm {font-size: 8px;font-weight:600;letter-spacing:3px}
.dt{
  position:absolute;width:5px;height:5px;border-radius:50%;
  background:rgba(215,235,255,0.95);transform:translate(-50%,-50%);
  box-shadow:0 0 8px 2px rgba(150,205,255,0.65);transition:opacity 0.8s ease;
}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="ui">
  <div class="lb big" id="lTR" style="opacity:0">TÜRKİYE</div><div class="dt" id="dTR" style="opacity:0"></div>
  <div class="lb sm"  id="lIS" style="opacity:0">İstanbul</div><div class="dt" id="dIS" style="opacity:0"></div>
  <div class="lb sm"  id="lAN" style="opacity:0">Ankara</div>  <div class="dt" id="dAN" style="opacity:0"></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js"></script>
<script>
(function(){
'use strict';
var S=${S};

// ── Texture dimensions (power-of-2) ────────────────────────────────────────
var DW=512,DH=256;    // day + water mask
var NW=256,NH=128;    // night / city lights
var CW=256,CH=128;    // clouds

// ── Canvas helpers ─────────────────────────────────────────────────────────
function pt(lon,lat,w,h){ return {x:(lon+180)/360*w, y:(90-lat)/180*h}; }

function poly(ctx,pts,col,w,h){
  if(!pts||pts.length<3)return;
  var p0=pt(pts[0][0],pts[0][1],w,h);
  ctx.beginPath(); ctx.moveTo(p0.x,p0.y);
  for(var i=1;i<pts.length;i++){var p=pt(pts[i][0],pts[i][1],w,h);ctx.lineTo(p.x,p.y);}
  ctx.closePath(); ctx.fillStyle=col; ctx.fill();
}

// ── Continent data ─────────────────────────────────────────────────────────
// 24 polygons: realistic geography, visible Europe / Africa / Asia / Turkey.
var LAND=[
  // ─ AFRICA (main green base)
  {c:'#3c6e3a',p:[[-18,16],[-15,10],[-8,5],[-2,2],[8,0],[12,-5],[15,-12],[18,-18],[20,-24],[24,-28],[28,-30],[32,-26],[36,-20],[40,-12],[46,-8],[50,11],[46,12],[44,8],[42,12],[40,16],[38,22],[34,26],[28,30],[20,33],[15,37],[8,38],[0,37],[-5,35],[-14,35],[-18,35],[-18,16]]},
  // Sahara + Sahel overlay
  {c:'#c2a04c',p:[[-18,16],[-15,22],[-10,27],[-5,30],[0,30],[8,26],[15,24],[18,22],[20,18],[18,14],[10,14],[4,18],[-4,20],[-10,20],[-15,20],[-18,16]]},
  // East African Rift (darker green, fertile)
  {c:'#2e6030',p:[[34,4],[36,-2],[38,-8],[40,-12],[38,-14],[36,-10],[32,-6],[30,0],[34,4]]},
  // Southern Africa
  {c:'#4e7232',p:[[14,-18],[18,-18],[20,-24],[24,-28],[28,-30],[32,-26],[36,-20],[34,-14],[28,-14],[22,-14],[18,-16],[14,-18]]},

  // ─ EUROPE
  {c:'#487838',p:[[-10,36],[0,37],[10,38],[20,37],[28,37],[30,42],[36,42],[32,48],[35,54],[28,62],[20,60],[18,72],[8,70],[0,68],[-5,60],[-8,54],[-5,50],[-10,44],[-10,36]]},
  // Iberia (slightly drier)
  {c:'#6e7e3c',p:[[-10,36],[0,37],[-2,43],[-8,44],[-10,42],[-10,36]]},
  // British Isles
  {c:'#487838',p:[[-6,50],[-5,58],[-3,60],[0,61],[2,51],[-6,50]]},
  // Scandinavia
  {c:'#487838',p:[[5,58],[8,62],[10,70],[18,72],[24,72],[28,70],[28,62],[22,60],[18,58],[14,56],[10,56],[5,58]]},

  // ─ RUSSIA + SIBERIA
  {c:'#3a6830',p:[[30,50],[40,58],[60,60],[80,62],[100,66],[120,68],[140,70],[160,62],[168,58],[165,54],[155,50],[140,46],[130,42],[120,40],[100,46],[80,52],[60,56],[40,58],[30,55],[30,50]]},
  // Western Russia / Ukraine steppe
  {c:'#7a9440',p:[[30,50],[40,54],[50,52],[60,52],[60,56],[40,58],[30,55],[30,50]]},

  // ─ TURKEY (carefully shaped — recognizable Anatolia)
  {c:'#527c3c',p:[[26,36],[28,38],[30,40],[32,42],[36,42],[40,40],[44,40],[46,38],[44,36],[42,34],[40,34],[36,36],[32,36],[28,36],[26,36]]},
  // ─ CAUCASUS + IRAN
  {c:'#4a7238',p:[[36,42],[44,40],[50,38],[56,34],[62,28],[68,24],[72,22],[68,28],[60,28],[54,36],[48,38],[42,40],[36,42]]},

  // ─ ARABIAN PENINSULA
  {c:'#c8a855',p:[[36,30],[44,30],[52,24],[58,22],[56,14],[50,14],[44,12],[42,12],[40,16],[36,22],[36,30]]},
  // ─ MESOPOTAMIA / FERTILE CRESCENT
  {c:'#5e8040',p:[[36,36],[44,36],[48,34],[52,34],[54,32],[50,26],[44,28],[40,30],[36,32],[36,36]]},

  // ─ INDIA
  {c:'#487838',p:[[60,28],[66,26],[70,24],[72,22],[76,8],[80,8],[82,10],[86,12],[88,22],[86,26],[80,28],[74,28],[68,28],[60,28]]},
  // Thar Desert
  {c:'#c09840',p:[[68,28],[72,28],[72,24],[68,24],[66,26],[68,28]]},

  // ─ SE ASIA + INDOCHINA
  {c:'#3a7030',p:[[98,22],[102,22],[106,20],[110,18],[114,10],[116,4],[104,2],[100,2],[98,8],[98,16],[98,22]]},
  // Malay Peninsula + Sumatra
  {c:'#2e6828',p:[[100,6],[104,4],[106,2],[106,-2],[100,-2],[98,2],[98,6],[100,6]]},

  // ─ EAST ASIA (China, Manchuria, Korea)
  {c:'#3c6e3a',p:[[75,40],[80,44],[88,44],[100,50],[110,48],[120,52],[128,50],[130,44],[128,38],[124,32],[120,26],[114,18],[110,16],[106,18],[100,18],[96,22],[88,24],[80,30],[76,34],[75,40]]},
  // Gobi Desert
  {c:'#b09448',p:[[90,44],[100,50],[110,48],[118,46],[114,38],[108,38],[100,40],[90,44]]},
  // Tibet / Himalayas
  {c:'#8a7858',p:[[76,28],[80,30],[86,30],[92,28],[98,28],[100,34],[96,36],[88,36],[82,34],[76,30],[76,28]]},
  // Japan
  {c:'#487838',p:[[131,32],[133,34],[136,36],[138,40],[141,42],[141,44],[137,46],[134,44],[130,40],[130,36],[131,32]]},

  // ─ NORTH AMERICA
  {c:'#3c6e3a',p:[[-168,72],[-140,70],[-110,70],[-80,75],[-60,64],[-55,50],[-64,44],[-76,42],[-80,38],[-84,30],[-88,28],[-95,22],[-90,16],[-85,12],[-82,8],[-78,10],[-80,14],[-88,16],[-95,18],[-104,22],[-110,28],[-118,34],[-122,38],[-124,46],[-132,54],[-140,56],[-152,58],[-165,64],[-168,72]]},
  // Great Plains (yellower)
  {c:'#8aaa3e',p:[[-98,50],[-90,46],[-88,40],[-95,36],[-100,36],[-104,42],[-100,50],[-98,50]]},
  // Rockies
  {c:'#7a6a52',p:[[-110,48],[-104,40],[-110,34],[-118,36],[-120,44],[-110,48]]},

  // ─ SOUTH AMERICA
  {c:'#3c6e3a',p:[[-80,12],[-70,12],[-62,10],[-52,4],[-50,0],[-48,-5],[-42,-10],[-36,-10],[-36,-14],[-40,-18],[-44,-22],[-46,-28],[-52,-32],[-56,-36],[-62,-40],[-66,-48],[-70,-54],[-72,-56],[-70,-52],[-68,-44],[-70,-38],[-68,-30],[-70,-22],[-68,-14],[-72,-10],[-80,0],[-80,10],[-80,12]]},
  // Amazon (deep green)
  {c:'#1c5e26',p:[[-70,6],[-60,6],[-50,4],[-48,-2],[-52,-8],[-62,-12],[-70,-4],[-70,6]]},
  // Andes
  {c:'#786850',p:[[-76,4],[-70,-4],[-68,-14],[-70,-22],[-68,-30],[-70,-38],[-72,-44],[-72,-34],[-70,-26],[-72,-18],[-72,-10],[-74,-4],[-76,4]]},

  // ─ AUSTRALIA
  {c:'#8a7848',p:[[114,-22],[118,-20],[122,-18],[126,-14],[130,-12],[136,-12],[138,-14],[142,-14],[146,-18],[150,-22],[152,-26],[152,-30],[150,-34],[146,-38],[142,-38],[138,-36],[134,-36],[128,-34],[122,-34],[116,-30],[112,-24],[112,-22],[114,-22]]},
  // East coast green belt
  {c:'#547a36',p:[[148,-22],[152,-26],[152,-30],[150,-34],[148,-38],[144,-36],[140,-34],[140,-14],[142,-14],[146,-18],[148,-22]]},
  // Outback red center
  {c:'#b04520',p:[[120,-22],[126,-18],[132,-18],[136,-20],[136,-26],[130,-28],[124,-28],[120,-26],[120,-22]]},

  // ─ GREENLAND
  {c:'#c4d4e6',p:[[-40,82],[-20,82],[-20,76],[-26,68],[-34,64],[-50,64],[-56,70],[-62,74],[-60,80],[-40,82]]},

  // ─ ANTARCTICA
  {c:'#ccdaee',p:[[-180,-72],[-140,-70],[-100,-72],[-60,-74],[-20,-72],[20,-70],[60,-74],[100,-70],[140,-72],[180,-72],[180,-90],[-180,-90],[-180,-72]]},
];

// ── City lights: [lon, lat, brightness 0-1] ────────────────────────────────
var CITIES=[
  // Turkey ★★★
  [29.0,41.0,1.00],[32.9,39.9,0.92],[27.1,38.4,0.80],[29.1,40.2,0.72],
  [30.7,36.9,0.70],[35.3,37.0,0.70],[37.4,37.1,0.66],[36.2,37.0,0.65],
  [34.0,36.9,0.62],[43.1,38.4,0.62],[38.3,38.4,0.60],[26.6,38.5,0.60],
  // W. Europe
  [-0.1,51.5,0.92],[2.3,48.9,0.92],[13.4,52.5,0.88],[12.5,41.9,0.82],
  [4.9,52.4,0.82],[18.1,59.3,0.74],[14.4,50.1,0.82],[16.4,48.2,0.80],
  [23.7,37.9,0.82],[10.0,53.6,0.74],[2.2,41.4,0.82],[-3.7,40.4,0.88],
  [24.9,60.2,0.72],[21.0,52.2,0.80],[26.1,44.4,0.80],[19.0,47.5,0.74],
  [-8.6,41.1,0.72],[3.0,50.6,0.74],[4.4,51.0,0.78],[8.7,50.1,0.76],
  [11.6,48.1,0.80],[14.1,50.1,0.76],[9.2,45.5,0.76],[-9.1,38.7,0.78],
  [23.3,42.7,0.72],[22.0,50.1,0.70],[23.3,53.1,0.70],
  // Russia / E. Europe
  [37.6,55.7,1.0],[30.3,59.9,0.92],[49.1,55.8,0.78],[60.6,56.8,0.74],
  [82.9,54.9,0.72],[73.4,54.9,0.72],[30.5,50.5,0.85],[44.0,56.3,0.70],
  // Middle East (Turkey neighbors)
  [35.2,31.8,0.82],[35.5,33.9,0.76],[44.4,33.3,0.82],[51.5,25.3,0.92],
  [55.3,25.3,0.92],[46.7,24.7,0.92],[31.2,30.1,0.92],[36.3,33.5,0.74],
  [39.2,21.5,0.82],[44.4,15.4,0.72],[36.8,36.9,0.68],[51.4,35.7,0.90],
  [57.6,23.6,0.72],[58.6,23.6,0.72],
  // S. Asia
  [77.2,28.6,1.0],[72.9,19.1,1.0],[80.3,13.1,0.92],[88.4,22.6,1.0],
  [77.6,12.9,0.92],[67.0,24.9,0.88],[74.3,31.5,0.88],[73.1,33.7,0.84],
  [78.0,27.2,0.80],[72.6,23.0,0.82],[76.6,8.5,0.75],[90.4,23.8,0.88],
  // E. Asia / SE. Asia
  [116.4,39.9,1.0],[121.5,31.2,1.0],[113.3,23.1,1.0],[114.1,22.5,0.92],
  [106.8,10.8,0.92],[103.8,1.4,0.92],[100.5,13.8,0.92],[104.9,11.6,0.82],
  [139.7,35.7,1.0],[135.5,34.7,0.92],[126.9,37.5,0.92],[121.6,25.0,0.92],
  [120.3,36.1,0.82],[128.6,35.9,0.82],[120.2,30.3,0.88],[106.5,29.6,0.88],
  [104.1,30.7,0.85],[113.2,28.2,0.82],[117.0,36.7,0.80],[118.8,32.1,0.84],
  // Africa
  [36.8,-1.3,0.80],[18.6,-33.9,0.82],[28.0,-26.2,0.90],[38.7,9.0,0.80],
  [32.6,0.3,0.74],[15.3,-4.3,0.72],[7.5,9.1,0.82],[3.4,6.5,0.80],[-17.4,14.7,0.72],
  [32.5,15.6,0.72],[2.3,6.4,0.72],[28.2,-15.4,0.70],[36.0,-3.4,0.70],
  // N. America
  [-74.0,40.7,1.0],[-87.6,41.8,1.0],[-118.2,34.1,1.0],[-122.4,37.8,0.92],
  [-75.1,39.9,0.92],[-80.2,25.8,0.92],[-77.0,38.9,0.92],[-83.0,42.3,0.84],
  [-79.4,43.7,0.90],[-73.6,45.5,0.90],[-123.1,49.3,0.82],[-99.1,19.4,1.0],
  [-90.5,14.6,0.80],[-84.1,9.9,0.74],[-64.0,18.4,0.66],[-66.9,10.5,0.80],
  [-157.8,21.3,0.82],[-80.0,43.7,0.84],[-71.0,42.4,0.88],[-93.3,44.9,0.80],
  // S. America
  [-74.1,4.7,0.82],[-77.0,-12.0,0.88],[-43.2,-22.9,1.0],[-46.6,-23.5,1.0],
  [-58.4,-34.6,0.90],[-70.7,-33.5,0.88],[-56.2,-34.9,0.82],[-68.1,-16.5,0.72],
  [-74.8,-10.7,0.72],[-38.5,-12.9,0.80],
  // Australia / Pacific
  [151.2,-33.9,0.92],[144.9,-37.8,0.92],[153.0,-27.5,0.82],[115.9,-32.0,0.82],
  [174.8,-36.9,0.80],[172.6,-43.5,0.70],[153.0,-27.5,0.80],
];

// ── Value noise for cloud texture ──────────────────────────────────────────
function nh(x,y){var s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}
function ni(x,y){
  var ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  var ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  return nh(ix,iy)*(1-ux)*(1-uy)+nh(ix+1,iy)*ux*(1-uy)+nh(ix,iy+1)*(1-ux)*uy+nh(ix+1,iy+1)*ux*uy;
}
function fbm(x,y){return 0.5*ni(x,y)+0.25*ni(2*x,2*y)+0.125*ni(4*x,4*y)+0.0625*ni(8*x,8*y);}

// ── Texture builders ───────────────────────────────────────────────────────
function makeDayTex(){
  var cv=document.createElement('canvas'); cv.width=DW; cv.height=DH;
  var ctx=cv.getContext('2d');
  // Deep ocean gradient
  var g=ctx.createLinearGradient(0,0,0,DH);
  g.addColorStop(0.00,'#07172e'); g.addColorStop(0.15,'#0b2440');
  g.addColorStop(0.50,'#153c5c'); g.addColorStop(0.85,'#0b2440');
  g.addColorStop(1.00,'#07172e');
  ctx.fillStyle=g; ctx.fillRect(0,0,DW,DH);
  // Tropical water (lighter)
  var g2=ctx.createLinearGradient(0,DH*0.28,0,DH*0.72);
  g2.addColorStop(0,'rgba(24,68,118,0)'); g2.addColorStop(0.5,'rgba(24,68,118,0.18)');
  g2.addColorStop(1,'rgba(24,68,118,0)');
  ctx.fillStyle=g2; ctx.fillRect(0,0,DW,DH);
  // Land masses
  LAND.forEach(function(L){poly(ctx,L.p,L.c,DW,DH);});
  // North polar ice cap
  var pg1=ctx.createRadialGradient(DW/2,0,0,DW/2,0,DH*0.14);
  pg1.addColorStop(0,'rgba(215,232,248,1)'); pg1.addColorStop(1,'rgba(215,232,248,0)');
  ctx.fillStyle=pg1; ctx.fillRect(0,0,DW,DH*0.16);
  // South polar ice cap
  var pg2=ctx.createRadialGradient(DW/2,DH,0,DW/2,DH,DH*0.10);
  pg2.addColorStop(0,'rgba(205,226,244,1)'); pg2.addColorStop(1,'rgba(205,226,244,0)');
  ctx.fillStyle=pg2; ctx.fillRect(0,DH*0.88,DW,DH*0.12);
  return new THREE.CanvasTexture(cv);
}

function makeWaterTex(){
  // White = water (gets specular), Black = land (no specular)
  var cv=document.createElement('canvas'); cv.width=DW; cv.height=DH;
  var ctx=cv.getContext('2d');
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,DW,DH);
  LAND.forEach(function(L){poly(ctx,L.p,'#000',DW,DH);});
  return new THREE.CanvasTexture(cv);
}

function makeNightTex(){
  var cv=document.createElement('canvas'); cv.width=NW; cv.height=NH;
  var ctx=cv.getContext('2d');
  ctx.fillStyle='#000'; ctx.fillRect(0,0,NW,NH);
  CITIES.forEach(function(c){
    var p=pt(c[0],c[1],NW,NH);
    var br=c[2], r=2.6*br;
    var grd=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*3.2);
    grd.addColorStop(0,'rgba(255,245,175,'+(br*0.96)+')');
    grd.addColorStop(0.28,'rgba(255,218,128,'+(br*0.48)+')');
    grd.addColorStop(0.65,'rgba(255,192,90,'+(br*0.13)+')');
    grd.addColorStop(1,'rgba(255,170,68,0)');
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(p.x,p.y,r*3.2,0,Math.PI*2); ctx.fill();
  });
  return new THREE.CanvasTexture(cv);
}

function makeCloudTex(){
  var cv=document.createElement('canvas'); cv.width=CW; cv.height=CH;
  var ctx=cv.getContext('2d');
  var id=ctx.createImageData(CW,CH);
  for(var yy=0;yy<CH;yy++){
    var lat=(0.5-yy/CH)*180;
    var pf=Math.cos(lat*Math.PI/180);
    for(var xx=0;xx<CW;xx++){
      var v=fbm(xx/CW*9.2, yy/CH*4.6);
      var a=Math.max(0,(v-0.50)*3.9*pf);
      var i=(yy*CW+xx)*4;
      id.data[i]=255;id.data[i+1]=255;id.data[i+2]=255;
      id.data[i+3]=Math.min(255,Math.round(a*198));
    }
  }
  ctx.putImageData(id,0,0);
  return new THREE.CanvasTexture(cv);
}

// ── WebGL Renderer ─────────────────────────────────────────────────────────
var canvas=document.getElementById('c');
var renderer;
try{
  renderer=new THREE.WebGLRenderer({
    canvas:canvas, antialias:false, alpha:false,
    precision:'mediump', powerPreference:'default', preserveDrawingBuffer:false
  });
}catch(e){return;}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(window.innerWidth,window.innerHeight);

// ── Scene ──────────────────────────────────────────────────────────────────
var scene=new THREE.Scene();
var camera=new THREE.PerspectiveCamera(42,window.innerWidth/window.innerHeight,0.01,200);
camera.position.set(0,0.1,2.7);
camera.updateMatrixWorld(true);

// ── Stars ──────────────────────────────────────────────────────────────────
(function(){
  var N=2200, pos=new Float32Array(N*3), sz=new Float32Array(N);
  for(var i=0;i<N;i++){
    var r=58+Math.random()*42, th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
    pos[i*3]=r*Math.sin(ph)*Math.cos(th); pos[i*3+1]=r*Math.sin(ph)*Math.sin(th); pos[i*3+2]=r*Math.cos(ph);
    sz[i]=0.04+Math.random()*0.06;
  }
  var geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('size',new THREE.BufferAttribute(sz,1));
  scene.add(new THREE.Points(geo,new THREE.PointsMaterial({
    color:0xffffff, size:0.06, sizeAttenuation:true, transparent:true, opacity:0.82
  })));
})();

// ── Sun direction converted to view space (computed once — camera never moves) ──
var sunWorld=new THREE.Vector3(1.5,0.5,1.0).normalize();
var sunView=sunWorld.clone().transformDirection(camera.matrixWorldInverse);

// ── Lights (for MeshPhong cloud material) ─────────────────────────────────
var sunLight=new THREE.DirectionalLight(0xfff6e8,1.7);
sunLight.position.copy(sunWorld); scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x09162c,0.55));

// ── Voice glow state ───────────────────────────────────────────────────────
var tGlow=1.0, cGlow=1.0;
window.onVoiceState=function(s){
  tGlow=s==='speaking'?1.44:s==='listening'?1.14:1.0;
};

// ── Earth group ────────────────────────────────────────────────────────────
var earthGroup=new THREE.Group(); scene.add(earthGroup);
var earthMat=null, cloudMesh=null;

earthMat=new THREE.ShaderMaterial({
  uniforms:{
    uDay:  {value:makeDayTex()},
    uNight:{value:makeNightTex()},
    uWater:{value:makeWaterTex()},
    uLight:{value:sunView},
    uGlow: {value:1.0}
  },
  vertexShader:S.ev, fragmentShader:S.ef
});
earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1,54,54), earthMat));

// Cloud layer — Three.js MeshPhongMaterial (stable on all devices)
cloudMesh=new THREE.Mesh(
  new THREE.SphereGeometry(1.012,40,40),
  new THREE.MeshPhongMaterial({
    map:makeCloudTex(), transparent:true, opacity:0.34,
    depthWrite:false, blending:THREE.NormalBlending, shininess:0
  })
);
earthGroup.add(cloudMesh);

// ── Atmosphere — sun-modulated inner glow ─────────────────────────────────
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1.065,46,46),
  new THREE.ShaderMaterial({
    uniforms:{ uLight:{value:sunView} },
    vertexShader:S.av, fragmentShader:S.af,
    side:THREE.FrontSide, blending:THREE.AdditiveBlending,
    transparent:true, depthWrite:false
  })
));

// Outer halo (wider, diffuse backside)
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1.24,34,34),
  new THREE.ShaderMaterial({
    uniforms:{},
    vertexShader:[
      'precision mediump float;',
      'varying float vRim;',
      'void main(){',
      '  vec3 n=normalize(normalMatrix*normal);',
      '  vec4 vp=modelViewMatrix*vec4(position,1.0);',
      '  vec3 V=normalize(-vp.xyz);',
      '  vRim=pow(0.54-max(0.0,dot(n,V)),5.0);',
      '  gl_Position=projectionMatrix*vp;',
      '}'
    ].join('\n'),
    fragmentShader:[
      'precision mediump float;',
      'varying float vRim;',
      'void main(){',
      '  gl_FragColor=vec4(0.15,0.40,1.0,max(0.0,vRim)*0.36);',
      '}'
    ].join('\n'),
    side:THREE.BackSide, blending:THREE.AdditiveBlending,
    transparent:true, depthWrite:false
  })
));

// ── Subtle orbit ring ──────────────────────────────────────────────────────
var ring=new THREE.Mesh(
  new THREE.TorusGeometry(1.44,0.0007,2,160),
  new THREE.MeshBasicMaterial({color:0x4488ff,transparent:true,opacity:0.08})
);
ring.rotation.x=Math.PI/2; scene.add(ring);

// ── Geographic label positions ─────────────────────────────────────────────
// ll(lat, lon) → unit-sphere vector (Three.js sphere UV convention)
function ll(lat,lon){
  var phi=(90-lat)*Math.PI/180, th=(lon+180)*Math.PI/180;
  return new THREE.Vector3(-Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th));
}
var GEO=[
  {lb:'lTR',dt:'dTR', p:ll(39.0, 35.0)},    // Turkey centroid
  {lb:'lIS',dt:'dIS', p:ll(41.01,28.98)},    // Istanbul
  {lb:'lAN',dt:'dAN', p:ll(39.93,32.86)},    // Ankara
];

// ── Animation ──────────────────────────────────────────────────────────────
var SPIN=Math.PI*2/50;  // one revolution / 50 s
var clock=new THREE.Clock();
var _v=new THREE.Vector3();
var _fwd=new THREE.Vector3(0,0,1);

function tick(){
  requestAnimationFrame(tick);
  var dt=Math.min(clock.getDelta(),0.05);  // cap dt → no jumps after tab switch

  earthGroup.rotation.y += SPIN*dt;
  if(cloudMesh) cloudMesh.rotation.y += SPIN*dt*1.06;  // clouds drift slightly faster

  cGlow += (tGlow-cGlow)*0.04;
  if(earthMat) earthMat.uniforms.uGlow.value=cGlow;

  // ── Labels: project to screen, fade by camera-facing dot product
  var W=window.innerWidth, H=window.innerHeight;
  GEO.forEach(function(g){
    _v.copy(g.p).applyMatrix4(earthGroup.matrixWorld);
    var facing=_v.clone().normalize().dot(_fwd);
    var op=facing>0.12?Math.min(1,(facing-0.12)/0.32).toFixed(2):'0';
    _v.project(camera);
    var sx=(_v.x*0.5+0.5)*W, sy=(-_v.y*0.5+0.5)*H;
    var le=document.getElementById(g.lb), de=document.getElementById(g.dt);
    if(le){le.style.left=sx+'px'; le.style.top=sy+'px'; le.style.opacity=op;}
    if(de){de.style.left=sx+'px'; de.style.top=(sy+14)+'px'; de.style.opacity=op;}
  });

  renderer.render(scene,camera);
}
tick();

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize',function(){
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});

// ── WebGL context loss (graceful recovery) ─────────────────────────────────
canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();},false);

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
        onError={(e) => console.warn("Earth error:", e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, width: "100%", backgroundColor: "#000008", overflow: "hidden" },
  web:  { flex: 1, backgroundColor: "transparent" },
});
