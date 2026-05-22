/**
 * CinematicEarth v4 — Pure Canvas2D, zero network deps.
 *
 * Core rendering upgrades over v3:
 *   - Two-layer polygon fill:
 *       Layer 1 = directional LinearGradient along sun→shadow axis per polygon
 *       Layer 2 = radial center-bright overlay → terrain-mound depth feeling
 *   - Richer biome colour palette (distinct desert / jungle / boreal / savanna)
 *   - Latitude climate-zone tint overlay (polar cool ↔ equatorial green)
 *   - Deeper ocean: 5-stop gradient + N-S latitude depth layer
 *   - Wider cinematic terminator (orange-amber sunset band)
 *   - shadowBlur coastline feathering kept from v3
 *   - Chaikin 2× smoothing kept from v3
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── Land polygons — 34 biome regions ────────────────────────────────────────
// Colours chosen to match real Earth biomes.
// Chaikin 2× smoothing runs at startup, so these are control-point skeletons.
const LAND = [
  // ── Africa ─────────────────────────────────────────────────────────────────
  // Sahara + North Africa coast
  {c:"#b09a30",p:[[-6,36],[8,37],[24,33],[34,30],[42,28],[50,22],[44,18],[36,20],[28,22],[18,22],[8,22],[-2,22],[-10,24],[-18,24],[-18,30],[-6,36]]},
  // Sahel dry-grassland transition
  {c:"#8a7e2c",p:[[-18,14],[-10,16],[0,16],[8,16],[18,14],[28,14],[36,14],[42,10],[44,14],[36,20],[28,22],[18,22],[8,22],[-2,22],[-10,24],[-18,24],[-18,14]]},
  // West Africa / Congo tropical forest
  {c:"#22681c",p:[[-18,4],[-18,14],[0,14],[8,14],[18,14],[28,14],[20,8],[12,4],[4,2],[-2,4],[-10,4],[-18,4]]},
  // East + Southern Africa savanna
  {c:"#567030",p:[[36,14],[42,10],[46,6],[48,0],[44,-4],[40,-10],[36,-18],[32,-26],[28,-34],[18,-34],[14,-28],[12,-18],[14,-10],[18,-4],[24,0],[28,4],[32,8],[36,14]]},
  // Madagascar
  {c:"#38662a",p:[[44,-12],[48,-14],[50,-18],[50,-24],[46,-26],[44,-22],[42,-18],[44,-12]]},
  // ── Europe ─────────────────────────────────────────────────────────────────
  // Western + Central Europe — temperate deciduous
  {c:"#346a2c",p:[[-6,44],[-2,44],[2,44],[8,48],[12,48],[14,44],[18,44],[22,44],[24,48],[22,52],[14,56],[8,54],[4,52],[-4,52],[-6,48],[-6,44]]},
  // Scandinavia — boreal
  {c:"#3c5e2e",p:[[4,56],[8,54],[14,56],[18,58],[22,58],[22,66],[18,70],[12,70],[6,62],[4,58],[4,56]]},
  // Iberian Peninsula — Mediterranean scrub
  {c:"#5e7632",p:[[-10,36],[-6,36],[-4,38],[-2,40],[2,40],[4,40],[4,44],[-4,44],[-6,44],[-10,44],[-10,40],[-10,36]]},
  // Italy + Balkans
  {c:"#547232",p:[[12,44],[14,44],[18,44],[22,44],[24,44],[28,44],[36,42],[40,40],[36,44],[28,46],[22,48],[16,46],[12,44]]},
  // ── Turkey ─────────────────────────────────────────────────────────────────
  // Anatolian plateau — dry olive steppe
  {c:"#70703c",p:[[26,37],[27,36.8],[29,36.2],[31,36],[33,36.2],[36,36],[38,36.2],[40,36.4],[42,36.8],[44,37.2],[44,38.2],[43,39.2],[42,40.2],[41,41],[40,41.5],[38,41.8],[36,42],[32,42],[29.5,42],[27.5,41.2],[26.5,40],[26.2,38.5],[26,37]]},
  // ── Middle East ────────────────────────────────────────────────────────────
  // Levant + Syria + Iraq — semi-arid
  {c:"#8c7840",p:[[36,32],[40,34],[44,38],[44,34],[48,30],[48,24],[44,22],[40,26],[36,28],[34,30],[36,32]]},
  // Arabian Peninsula — hot desert
  {c:"#b09028",p:[[36,28],[40,26],[44,22],[48,24],[56,18],[60,14],[56,12],[52,14],[46,12],[44,14],[40,14],[36,18],[36,22],[36,28]]},
  // Iran + Afghanistan — highland steppe
  {c:"#907038",p:[[44,38],[48,40],[52,40],[60,36],[66,32],[66,26],[62,22],[58,20],[56,18],[52,22],[48,24],[48,30],[44,34],[44,38]]},
  // ── Russia ─────────────────────────────────────────────────────────────────
  // European Russia — mixed forest
  {c:"#406034",p:[[24,48],[28,52],[32,56],[36,58],[40,62],[44,68],[50,66],[56,68],[60,64],[62,58],[58,52],[50,48],[44,44],[36,42],[28,44],[24,48]]},
  // Siberia — dark taiga
  {c:"#3a5c2c",p:[[60,52],[68,56],[70,64],[70,72],[80,72],[100,72],[120,72],[140,70],[150,68],[155,60],[150,52],[140,52],[130,48],[120,52],[110,50],[100,54],[90,52],[80,54],[70,52],[60,52]]},
  // ── Central + South Asia ───────────────────────────────────────────────────
  // Central Asia — dry steppe
  {c:"#8c7c36",p:[[50,48],[60,52],[68,56],[70,48],[66,40],[60,36],[52,40],[48,40],[44,44],[48,50],[50,48]]},
  // Indian subcontinent — mixed tropical
  {c:"#687232",p:[[60,36],[66,26],[66,22],[70,18],[76,8],[80,10],[84,14],[88,22],[80,28],[76,30],[70,28],[66,28],[62,26],[60,30],[60,36]]},
  // SE Asia peninsula — lush tropical
  {c:"#286a1e",p:[[98,20],[100,14],[102,8],[104,0],[100,-4],[96,0],[94,8],[92,18],[96,22],[98,20]]},
  // Malay Peninsula / Sumatra
  {c:"#226818",p:[[100,-4],[102,-2],[104,0],[106,-2],[106,-6],[102,-6],[100,-4]]},
  // Borneo / Java — jungle
  {c:"#1e6616",p:[[108,4],[110,2],[112,0],[116,2],[116,4],[114,6],[110,6],[108,4]]},
  // ── East Asia ──────────────────────────────────────────────────────────────
  // China + Mongolia — mixed steppe & forest
  {c:"#7a7a36",p:[[74,38],[80,50],[90,52],[100,52],[110,50],[120,52],[130,48],[128,40],[126,32],[120,24],[114,18],[108,18],[104,22],[100,18],[96,22],[92,20],[94,24],[88,22],[80,28],[76,30],[70,28],[70,36],[74,38]]},
  // Japan — temperate forest
  {c:"#3a6630",p:[[130,31],[132,33],[136,35],[137,40],[134,42],[132,42],[130,38],[128,33],[130,31]]},
  // Korean Peninsula
  {c:"#426632",p:[[126,34],[128,36],[130,38],[128,38],[126,36],[124,36],[126,34]]},
  // ── North America ──────────────────────────────────────────────────────────
  // Alaska + Pacific NW — boreal
  {c:"#3a5a2a",p:[[-168,60],[-156,58],[-148,58],[-136,58],[-130,54],[-132,56],[-140,58],[-152,58],[-164,58],[-168,58],[-168,60]]},
  // Canada + NE USA — boreal & temperate
  {c:"#3e642c",p:[[-136,58],[-130,54],[-124,50],[-80,44],[-72,42],[-64,44],[-60,44],[-60,50],[-66,52],[-76,58],[-84,64],[-96,68],[-100,70],[-80,72],[-60,72],[-50,70],[-36,62],[-42,58],[-52,54],[-56,50],[-66,46],[-76,46],[-90,60],[-100,58],[-120,58],[-130,54],[-136,58]]},
  // Eastern + Central USA — temperate
  {c:"#4a6e30",p:[[-124,48],[-120,44],[-110,44],[-100,44],[-80,44],[-72,42],[-70,40],[-76,34],[-80,30],[-88,30],[-96,24],[-100,24],[-106,24],[-110,30],[-114,32],[-118,34],[-122,36],[-124,38],[-124,48]]},
  // Mexico + Central America — subtropical dry
  {c:"#66742e",p:[[-116,28],[-100,24],[-96,22],[-88,22],[-84,18],[-80,12],[-78,10],[-84,10],[-88,16],[-92,18],[-100,22],[-106,22],[-112,28],[-116,30],[-116,28]]},
  // ── South America ──────────────────────────────────────────────────────────
  // Amazon basin — tropical rainforest (deepest green on Earth)
  {c:"#1e5e18",p:[[-78,10],[-70,12],[-60,8],[-52,4],[-50,0],[-44,-2],[-40,-4],[-44,-8],[-50,-8],[-54,-4],[-60,-4],[-66,-4],[-70,0],[-76,2],[-78,6],[-78,10]]},
  // Eastern Brazil — cerrado / savanna
  {c:"#3a6222",p:[[-40,-4],[-36,-8],[-36,-16],[-38,-22],[-44,-24],[-48,-16],[-50,-8],[-44,-8],[-40,-4]]},
  // Andes + western S. America — highland
  {c:"#78682e",p:[[-78,10],[-80,4],[-80,0],[-76,0],[-68,-6],[-68,-18],[-70,-30],[-72,-44],[-70,-50],[-66,-54],[-60,-52],[-56,-38],[-54,-20],[-54,-4],[-60,-4],[-66,-4],[-70,0],[-76,2],[-78,6],[-78,10]]},
  // ── Australia ──────────────────────────────────────────────────────────────
  // Interior — red ochre outback
  {c:"#ac8e28",p:[[114,-22],[122,-20],[128,-18],[134,-14],[136,-18],[138,-22],[136,-26],[130,-26],[126,-30],[120,-34],[116,-32],[112,-28],[114,-22]]},
  // Eastern / coastal — eucalyptus
  {c:"#5c6c2e",p:[[138,-18],[140,-18],[144,-18],[148,-20],[152,-24],[152,-30],[148,-36],[142,-38],[136,-38],[132,-32],[128,-30],[126,-30],[130,-26],[136,-26],[138,-22],[136,-18],[138,-18]]},
  // ── Polar ──────────────────────────────────────────────────────────────────
  // Greenland ice sheet
  {c:"#aac2d4",p:[[-44,60],[-36,62],[-24,68],[-18,72],[-22,76],[-30,78],[-42,82],[-52,80],[-58,74],[-54,66],[-44,60]]},
  // Antarctica
  {c:"#bccede",p:[[-180,-72],[0,-72],[180,-72],[180,-90],[-180,-90],[-180,-72]]},
];

// ─── City lights [lon, lat, brightness] — 85 global cities ───────────────────
const CITIES = [
  [29.0,41.0,1.0],[32.9,39.9,0.9],[27.1,38.4,0.7],
  [-0.1,51.5,0.82],[2.3,48.9,0.82],[13.4,52.5,0.80],[12.5,41.9,0.76],
  [4.9,52.4,0.76],[18.1,59.3,0.68],[2.1,41.4,0.70],[-3.7,40.4,0.70],
  [16.4,48.2,0.68],[14.5,50.1,0.68],[21.0,52.2,0.70],[30.5,50.4,0.76],
  [23.7,37.9,0.66],[4.4,50.8,0.66],[-6.2,53.3,0.62],[-8.6,41.1,0.62],
  [10.8,59.9,0.62],[24.9,60.2,0.62],
  [37.6,55.7,0.94],[30.3,59.9,0.86],[82.9,55.0,0.70],[56.8,60.6,0.66],
  [51.5,25.3,0.86],[55.3,25.3,0.86],[46.7,24.7,0.86],[39.9,21.4,0.80],
  [31.2,30.1,0.86],[36.3,33.5,0.70],[44.4,33.3,0.76],[53.2,29.4,0.70],
  [67.0,24.9,0.84],[74.3,31.5,0.78],[-7.6,33.6,0.68],[10.2,36.8,0.66],
  [3.4,6.5,0.70],[36.8,-1.3,0.72],[28.0,-26.2,0.86],[18.4,-33.9,0.80],
  [38.7,9.0,0.68],[32.5,15.6,0.66],
  [77.2,28.6,0.94],[72.9,19.1,0.94],[88.4,22.6,0.94],[80.3,13.1,0.80],
  [78.5,17.4,0.78],[72.6,23.0,0.76],[67.1,24.8,0.84],
  [103.8,1.4,0.86],[100.5,13.8,0.82],[106.8,10.8,0.80],[101.7,3.1,0.80],
  [107.0,-6.2,0.80],[114.1,22.5,0.86],[121.0,14.6,0.78],
  [116.4,39.9,0.94],[121.5,31.2,0.94],[113.3,23.1,0.94],[104.1,30.6,0.86],
  [120.2,30.3,0.86],[139.7,35.7,0.94],[135.5,34.7,0.88],[126.9,37.5,0.86],
  [121.5,25.0,0.84],
  [-74.0,40.7,0.94],[-87.6,41.8,0.94],[-118.2,34.1,0.94],[-99.1,19.4,0.94],
  [-122.4,37.8,0.86],[-95.4,29.8,0.86],[-96.8,32.8,0.86],[-80.2,25.8,0.82],
  [-79.4,43.7,0.80],[-73.6,45.5,0.78],[-123.1,49.3,0.78],[-77.0,38.9,0.88],
  [-71.1,42.4,0.86],
  [-43.2,-22.9,0.94],[-46.6,-23.5,0.86],[-58.4,-34.6,0.82],[-70.7,-33.5,0.78],
  [-74.1,4.7,0.76],[-77.0,-12.0,0.76],
  [151.2,-33.9,0.86],[144.9,-37.8,0.82],[153.0,-27.5,0.72],[115.9,-32.0,0.70],
  [174.8,-36.9,0.68],
];

const LAND_JSON   = JSON.stringify(LAND);
const CITIES_JSON = JSON.stringify(CITIES);

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
  white-space:nowrap;text-transform:uppercase;
  color:rgba(205,228,255,0.80);
  text-shadow:0 0 6px rgba(120,185,255,0.35);
  transition:opacity 1.1s ease;
  pointer-events:none;
}
#lTR{font-size:7px;font-weight:700;letter-spacing:2.5px;transform:translate(-50%,-265%)}
#lIS{font-size:5px;font-weight:600;letter-spacing:1.8px;transform:translate(-118%,-168%)}
#lAN{font-size:5px;font-weight:600;letter-spacing:1.8px;transform:translate(18%,-168%)}
.dot{
  position:absolute;width:2px;height:2px;border-radius:50%;
  background:rgba(200,228,255,0.78);transform:translate(-50%,-50%);
  box-shadow:0 0 3px 1px rgba(150,205,255,0.32);
  transition:opacity 1.1s ease;pointer-events:none;
}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="ui">
  <div class="lb" id="lTR" style="opacity:0">TURKIYE</div>
  <div class="dot" id="dTR" style="opacity:0"></div>
  <div class="lb" id="lIS" style="opacity:0">Istanbul</div>
  <div class="dot" id="dIS" style="opacity:0"></div>
  <div class="lb" id="lAN" style="opacity:0">Ankara</div>
  <div class="dot" id="dAN" style="opacity:0"></div>
</div>
<script>
(function(){
'use strict';

var LAND   = ${LAND_JSON};
var CITIES = ${CITIES_JSON};

// ── Canvas ────────────────────────────────────────────────────────────────────
var W  = window.innerWidth  || screen.width  || 375;
var H  = window.innerHeight || screen.height || 812;
var cv = document.getElementById('c');
cv.width = W; cv.height = H;
var ctx = cv.getContext('2d');
if(!ctx) return;
var cx = W*0.5, cy = H*0.46, R = Math.min(W,H)*0.44;

// ── Sun direction ─────────────────────────────────────────────────────────────
var SUN_LON = -30, SUN_LAT = 22;
var sunLatR = SUN_LAT * Math.PI/180;
var sunLonR = SUN_LON * Math.PI/180;
var SX = Math.cos(sunLatR)*Math.cos(sunLonR);
var SY = Math.sin(sunLatR);
var SZ = Math.cos(sunLatR)*Math.sin(sunLonR);

// ── Chaikin corner-cutting (2 passes at startup) ──────────────────────────────
// Turns angular control-point skeletons into smooth organic outlines.
function chaikin(pts){
  var out=[], n=pts.length;
  for(var i=0;i<n;i++){
    var a=pts[i], b=pts[(i+1)%n];
    out.push([a[0]*0.75+b[0]*0.25, a[1]*0.75+b[1]*0.25]);
    out.push([a[0]*0.25+b[0]*0.75, a[1]*0.25+b[1]*0.75]);
  }
  return out;
}
for(var pi=0;pi<LAND.length;pi++){
  if(LAND[pi].p.length > 5){
    LAND[pi].p = chaikin(chaikin(LAND[pi].p));
  }
}

// ── Starfield ─────────────────────────────────────────────────────────────────
var STARS=[];
(function(){
  var s=0xDEADBEEF;
  function rn(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }
  for(var i=0;i<340;i++){
    var t=rn();
    var r=t<0.60?0.10+rn()*0.16:t<0.88?0.24+rn()*0.20:t<0.97?0.44+rn()*0.20:0.62+rn()*0.24;
    STARS.push({x:rn()*W,y:rn()*H,r:r,o:0.10+rn()*0.58,tw:0.35+rn()*1.1,tp:rn()*6.28});
  }
})();

// ── State ─────────────────────────────────────────────────────────────────────
var rot=28, SPEED=3.6, vState='idle', vPhase=0, dt=0, lastT=-1;

// ── Spherical projection ──────────────────────────────────────────────────────
function proj(lon,lat){
  var dlonR=(lon-rot)*Math.PI/180, latR=lat*Math.PI/180;
  var cLat=Math.cos(latR), sLat=Math.sin(latR);
  var lonR=lon*Math.PI/180;
  var nx=Math.cos(lonR)*cLat, ny=sLat, nz=Math.sin(lonR)*cLat;
  return{x:cx+R*Math.sin(dlonR)*cLat, y:cy-R*sLat, z:Math.cos(dlonR)*cLat, sun:nx*SX+ny*SY+nz*SZ};
}
function phash(n){ return((n*2654435769)>>>0)/4294967296; }

// ── Label helper ──────────────────────────────────────────────────────────────
function setLabel(lId,dId,lon,lat){
  var p=proj(lon,lat), op=p.z>0.14?'1':'0';
  var el=document.getElementById(lId), dt2=document.getElementById(dId);
  if(el){ el.style.left=p.x+'px'; el.style.top=p.y+'px'; el.style.opacity=op; }
  if(dt2){ dt2.style.left=p.x+'px'; dt2.style.top=p.y+'px'; dt2.style.opacity=p.z>0.14?'0.78':'0'; }
}
function fillArc(g,r){ ctx.beginPath(); ctx.arc(cx,cy,r,0,6.2832); ctx.fillStyle=g; ctx.fill(); }

// ─────────────────────────────────────────────────────────────────────────────
function draw(){
  var TAU=6.2832;

  var sunDlonR=(SUN_LON-rot)*Math.PI/180;
  var sdx=Math.sin(sunDlonR)*Math.cos(sunLatR);
  var sdy=-Math.sin(sunLatR);
  var sunSX=cx+R*0.76*sdx, sunSY=cy+R*0.76*sdy;

  var adlon=(((SUN_LON+180)-rot)%360+360)%360;
  if(adlon>180) adlon-=360;
  var nCX=cx+R*0.50*Math.sin(adlon*Math.PI/180), nCY=cy;

  // ── 01. Space ─────────────────────────────────────────────────────────────
  ctx.fillStyle='#00000e'; ctx.fillRect(0,0,W,H);

  // ── 02. Stars ─────────────────────────────────────────────────────────────
  for(var si=0;si<STARS.length;si++){
    var st=STARS[si];
    var ot=st.o*(0.85+0.15*Math.sin(vPhase*st.tw+st.tp));
    ctx.beginPath(); ctx.arc(st.x,st.y,st.r,0,TAU);
    ctx.fillStyle='rgba(255,255,255,'+ot+')'; ctx.fill();
  }

  // ── 03. Ocean base — deep rich blue ───────────────────────────────────────
  var oCX=cx+R*0.30*sdx, oCY=cy+R*0.22*sdy;
  var oG=ctx.createRadialGradient(oCX,oCY,R*0.04,cx,cy,R);
  oG.addColorStop(0.00,'#186090');   // bright tropical day-side
  oG.addColorStop(0.20,'#104c78');
  oG.addColorStop(0.46,'#0a3260');
  oG.addColorStop(0.72,'#061a36');
  oG.addColorStop(1.00,'#030a1c');   // abyssal deep
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fillStyle=oG; ctx.fill(); ctx.restore();

  // Ocean latitude depth: poles slightly darker, tropics slightly more vibrant
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var odG=ctx.createLinearGradient(cx,cy-R,cx,cy+R);
  odG.addColorStop(0.00,'rgba(8,20,55,0.12)');   // polar darkening N
  odG.addColorStop(0.28,'rgba(8,20,55,0.04)');
  odG.addColorStop(0.50,'rgba(0,30,60,0)');       // equatorial: no tint
  odG.addColorStop(0.72,'rgba(8,20,55,0.04)');
  odG.addColorStop(1.00,'rgba(8,20,55,0.12)');   // polar darkening S
  ctx.fillStyle=odG; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 04. Land polygons — two-layer technique ───────────────────────────────
  // Single sphere clip for the entire land batch (performance)
  var shadowR=Math.max(1.0,R*0.010);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,R-0.5,0,TAU); ctx.clip();

  for(var i=0;i<LAND.length;i++){
    var poly=LAND[i], pts=poly.p, n=pts.length;
    var sl=0, slt=0;
    for(var j=0;j<n;j++){ sl+=pts[j][0]; slt+=pts[j][1]; }
    var cp=proj(sl/n,slt/n);
    if(cp.z<-0.14) continue;

    ctx.beginPath();
    var first=true;
    for(var k=0;k<n;k++){
      var vp=proj(pts[k][0],pts[k][1]);
      if(vp.z<-0.22) continue;
      if(first){ ctx.moveTo(vp.x,vp.y); first=false; }
      else ctx.lineTo(vp.x,vp.y);
    }
    if(first) continue;
    ctx.closePath();

    // --- Shading scalar (hemisphere lighting) ---
    var raw=cp.sun*1.52+0.20;
    var t=Math.pow(Math.max(0,Math.min(1,raw)),0.78);
    t*=(0.93+0.07*phash(i));
    t=Math.max(0.06,t);

    var hex=poly.c;
    var r2=parseInt(hex.slice(1,3),16);
    var g2=parseInt(hex.slice(3,5),16);
    var b2=parseInt(hex.slice(5,7),16);

    // --- Layer 1: Directional linear gradient (sun→shadow within polygon) ---
    // Gives each landmass directional light variation — breaks the flat look.
    var tH=Math.min(1.0,t*1.14);   // sun-facing: brighter
    var tL=Math.max(0.04,t*0.86);  // shadow side: darker
    var pR=R*0.18;
    var pLG=ctx.createLinearGradient(
      cp.x+sdx*pR, cp.y+sdy*pR,
      cp.x-sdx*pR, cp.y-sdy*pR
    );
    pLG.addColorStop(0,'rgb('+Math.round(r2*tH)+','+Math.round(g2*tH)+','+Math.round(b2*tH)+')');
    pLG.addColorStop(1,'rgb('+Math.round(r2*tL)+','+Math.round(g2*tL)+','+Math.round(b2*tL)+')');

    // shadowBlur feathers coastlines into the ocean
    ctx.shadowColor='rgb('+Math.round(r2*t)+','+Math.round(g2*t)+','+Math.round(b2*t)+')';
    ctx.shadowBlur=shadowR;
    ctx.fillStyle=pLG;
    ctx.fill();
    ctx.shadowBlur=0; ctx.shadowColor='transparent';

    // --- Layer 2: Radial centre-bright overlay (terrain mound depth) ---
    // Makes each continent feel convex / 3-dimensional.
    var pRG=ctx.createRadialGradient(cp.x,cp.y,0,cp.x,cp.y,R*0.22);
    pRG.addColorStop(0.0,'rgba(255,255,255,0.055)');
    pRG.addColorStop(0.5,'rgba(255,255,255,0.016)');
    pRG.addColorStop(1.0,'rgba(0,0,0,0.032)');
    ctx.fillStyle=pRG;
    ctx.fill();
  }
  ctx.restore();

  // ── 05. Latitude climate-zone tint ────────────────────────────────────────
  // Very subtle: cools poles (blue) and adds a trace equatorial green warmth.
  // Affects land + ocean equally for atmospheric believability.
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var latG=ctx.createLinearGradient(cx,cy-R,cx,cy+R);
  latG.addColorStop(0.00,'rgba(120,155,210,0.055)');   // polar N — blue-grey
  latG.addColorStop(0.26,'rgba(80,125,180,0.020)');
  latG.addColorStop(0.46,'rgba(38,95,38,0.038)');      // equatorial — green
  latG.addColorStop(0.54,'rgba(38,95,38,0.038)');
  latG.addColorStop(0.74,'rgba(80,125,180,0.020)');
  latG.addColorStop(1.00,'rgba(120,155,210,0.055)');   // polar S — blue-grey
  ctx.fillStyle=latG; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 06. Inner atmosphere haze (inside limb, soft blue vignette) ──────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R+0.5,0,TAU); ctx.clip();
  var ih=ctx.createRadialGradient(cx,cy,R*0.82,cx,cy,R*1.005);
  ih.addColorStop(0.0,'rgba(16,48,125,0)');
  ih.addColorStop(0.6,'rgba(22,56,150,0.07)');
  ih.addColorStop(1.0,'rgba(30,70,180,0.30)');
  ctx.fillStyle=ih; ctx.fillRect(cx-R*1.1,cy-R*1.1,R*2.2,R*2.2); ctx.restore();

  // ── 07. Terrain curvature overlay (viewer-facing centre-bright) ───────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var cv2=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
  cv2.addColorStop(0.0,'rgba(255,255,255,0.036)');
  cv2.addColorStop(0.45,'rgba(255,255,255,0)');
  cv2.addColorStop(0.82,'rgba(0,0,0,0.038)');
  cv2.addColorStop(1.0,'rgba(0,0,0,0.13)');
  ctx.fillStyle=cv2; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 08. Night hemisphere + cinematic terminator ───────────────────────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var tg=ctx.createRadialGradient(nCX,nCY,0,nCX,nCY,R*1.65);
  tg.addColorStop(0.00,'rgba(0,2,14,0.97)');
  tg.addColorStop(0.28,'rgba(0,2,14,0.92)');
  tg.addColorStop(0.44,'rgba(2,4,20,0.74)');
  tg.addColorStop(0.52,'rgba(32,16,6,0.50)');    // deep amber terminator
  tg.addColorStop(0.58,'rgba(60,30,8,0.26)');    // orange twilight
  tg.addColorStop(0.65,'rgba(18,9,2,0.12)');
  tg.addColorStop(0.73,'rgba(0,0,0,0)');
  ctx.fillStyle=tg; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 09. City lights (smaller, warmer, softer) ─────────────────────────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R-0.5,0,TAU); ctx.clip();
  for(var ci=0;ci<CITIES.length;ci++){
    var city=CITIES[ci], cp2=proj(city[0],city[1]);
    if(cp2.z<0) continue;
    if(cp2.sun>0.15) continue;
    var fade=Math.max(0,Math.min(1,(0.15-cp2.sun)/0.22));
    var br=city[2]*fade;
    if(br<0.05) continue;
    var cr=1.7*br+0.4;
    var cg1=ctx.createRadialGradient(cp2.x,cp2.y,0,cp2.x,cp2.y,cr*3.2);
    cg1.addColorStop(0.0,'rgba(255,225,140,'+(br*0.26)+')');
    cg1.addColorStop(0.5,'rgba(255,188,72,'+(br*0.11)+')');
    cg1.addColorStop(1.0,'rgba(255,150,42,0)');
    ctx.beginPath(); ctx.arc(cp2.x,cp2.y,cr*3.2,0,TAU); ctx.fillStyle=cg1; ctx.fill();
    var cg2=ctx.createRadialGradient(cp2.x,cp2.y,0,cp2.x,cp2.y,cr*1.1);
    cg2.addColorStop(0.0,'rgba(255,250,210,'+(br*0.86)+')');
    cg2.addColorStop(0.5,'rgba(255,220,125,'+(br*0.38)+')');
    cg2.addColorStop(1.0,'rgba(255,190,65,0)');
    ctx.beginPath(); ctx.arc(cp2.x,cp2.y,cr*1.1,0,TAU); ctx.fillStyle=cg2; ctx.fill();
  }
  ctx.restore();

  // ── 10. Polar ice glow ────────────────────────────────────────────────────
  var poles=[[0,88],[0,-88]];
  for(var ip=0;ip<poles.length;ip++){
    var pp=proj(poles[ip][0],poles[ip][1]);
    if(pp.z<0) continue;
    var pa=0.26+0.16*Math.max(0,pp.sun);
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
    var pg2=ctx.createRadialGradient(pp.x,pp.y,0,pp.x,pp.y,R*0.26*pp.z);
    pg2.addColorStop(0.0,'rgba(202,230,252,'+(pa*0.80)+')');
    pg2.addColorStop(0.45,'rgba(178,215,246,'+(pa*0.36)+')');
    pg2.addColorStop(1.0,'rgba(152,198,240,0)');
    ctx.beginPath(); ctx.arc(pp.x,pp.y,R*0.26*pp.z,0,TAU);
    ctx.fillStyle=pg2; ctx.fill(); ctx.restore();
  }

  // ── 11. Limb darkening ────────────────────────────────────────────────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R+0.5,0,TAU); ctx.clip();
  var ld=ctx.createRadialGradient(cx,cy,R*0.58,cx,cy,R*1.005);
  ld.addColorStop(0.0,'rgba(0,0,0,0)');
  ld.addColorStop(0.70,'rgba(0,0,0,0.07)');
  ld.addColorStop(0.88,'rgba(0,0,0,0.28)');
  ld.addColorStop(1.0,'rgba(0,0,0,0.62)');
  ctx.fillStyle=ld; ctx.fillRect(cx-R*1.05,cy-R*1.05,R*2.1,R*2.1); ctx.restore();

  // ── 12. Outer atmosphere — Rayleigh ring ──────────────────────────────────
  var ag1=ctx.createRadialGradient(cx,cy,R*0.97,cx,cy,R*1.10);
  ag1.addColorStop(0.00,'rgba(65,145,245,0)');
  ag1.addColorStop(0.14,'rgba(88,160,250,0.40)');
  ag1.addColorStop(0.42,'rgba(60,132,238,0.20)');
  ag1.addColorStop(0.72,'rgba(45,110,222,0.07)');
  ag1.addColorStop(1.00,'rgba(30,85,200,0)');
  fillArc(ag1,R*1.10);

  // Diffuse outer halo — barely visible, just for depth
  var ag2=ctx.createRadialGradient(cx,cy,R*1.02,cx,cy,R*1.19);
  ag2.addColorStop(0.0,'rgba(42,108,245,0)');
  ag2.addColorStop(0.3,'rgba(36,98,232,0.04)');
  ag2.addColorStop(1.0,'rgba(18,65,182,0)');
  fillArc(ag2,R*1.19);

  // ── 13. Sun-side limb scatter ─────────────────────────────────────────────
  var slg=ctx.createRadialGradient(sunSX,sunSY,R*0.68,sunSX,sunSY,R*1.16);
  slg.addColorStop(0.0,'rgba(255,255,255,0)');
  slg.addColorStop(0.75,'rgba(225,240,255,0)');
  slg.addColorStop(0.87,'rgba(225,240,255,0.09)');
  slg.addColorStop(1.0,'rgba(255,255,255,0)');
  fillArc(slg,R*1.14);

  // ── 14. Specular ocean highlight ──────────────────────────────────────────
  var spX=cx+R*0.22*sdx, spY=cy+R*0.17*sdy;
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var sp=ctx.createRadialGradient(spX,spY,0,spX,spY,R*0.34);
  sp.addColorStop(0.0,'rgba(210,234,255,0.16)');
  sp.addColorStop(0.45,'rgba(170,210,255,0.06)');
  sp.addColorStop(1.0,'rgba(110,165,255,0)');
  ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fillStyle=sp; ctx.fill(); ctx.restore();

  // ── 15. Globe edge ────────────────────────────────────────────────────────
  ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU);
  ctx.strokeStyle='rgba(75,145,245,0.14)'; ctx.lineWidth=0.6; ctx.stroke();

  // ── 16. Voice reactions ───────────────────────────────────────────────────

  if(vState==='listening'){
    var la=ctx.createRadialGradient(cx,cy,R*0.93,cx,cy,R*1.17);
    la.addColorStop(0.0,'rgba(72,150,252,0)');
    la.addColorStop(0.2,'rgba(92,165,252,0.17)');
    la.addColorStop(0.6,'rgba(62,136,245,0.07)');
    la.addColorStop(1.0,'rgba(42,112,232,0)');
    fillArc(la,R*1.17);
    for(var ri=0;ri<3;ri++){
      var rp=((vPhase*0.44+ri*0.333)%1+1)%1;
      ctx.beginPath(); ctx.arc(cx,cy,R*(1.06+rp*0.46),0,TAU);
      ctx.strokeStyle='rgba(110,185,252,'+Math.max(0,(1-rp)*0.20)+')';
      ctx.lineWidth=0.5+(1-rp)*0.65; ctx.stroke();
    }
  }

  if(vState==='speaking'){
    var pulse=0.5+0.5*Math.sin(vPhase*3.2);
    var pulse2=0.5+0.5*Math.sin(vPhase*2.0+1.1);
    var co=ctx.createRadialGradient(cx,cy,R*0.90,cx,cy,R*1.30);
    co.addColorStop(0.0,'rgba(255,158,40,0)');
    co.addColorStop(0.20,'rgba(255,148,35,'+(0.17+0.11*pulse)+')');
    co.addColorStop(0.48,'rgba(255,115,20,'+(0.065*pulse2)+')');
    co.addColorStop(1.0,'rgba(255,74,12,0)');
    fillArc(co,R*1.30);
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
    var gw=ctx.createRadialGradient(cx,cy,R*0.70,cx,cy,R);
    gw.addColorStop(0,'rgba(255,138,30,0)');
    gw.addColorStop(0.84,'rgba(255,128,26,'+(0.055*pulse)+')');
    gw.addColorStop(1.0,'rgba(255,108,20,'+(0.13*pulse)+')');
    ctx.fillStyle=gw; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();
  }

  if(vState==='idle'){
    var br2=0.5+0.5*Math.sin(vPhase*0.50);
    var ba=ctx.createRadialGradient(cx,cy,R*0.97,cx,cy,R*1.12);
    ba.addColorStop(0.0,'rgba(46,98,202,0)');
    ba.addColorStop(0.4,'rgba(50,105,208,'+(0.038*br2)+')');
    ba.addColorStop(1.0,'rgba(28,70,158,0)');
    fillArc(ba,R*1.12);
  }

  // ── 17. Labels ────────────────────────────────────────────────────────────
  setLabel('lTR','dTR',35.5,39.2);
  setLabel('lIS','dIS',29.0,41.0);
  setLabel('lAN','dAN',32.9,39.9);
}

// ── Frame loop ────────────────────────────────────────────────────────────────
function frame(t){
  if(lastT>=0){
    dt=(t-lastT)/1000; if(dt>0.12) dt=0.12;
    rot=(rot+SPEED*dt)%360; vPhase+=dt;
  }
  lastT=t; draw(); requestAnimationFrame(frame);
}
window.addEventListener('resize',function(){
  W=window.innerWidth||screen.width||W; H=window.innerHeight||screen.height||H;
  cx=W*0.5; cy=H*0.46; R=Math.min(W,H)*0.44; cv.width=W; cv.height=H;
});
window.onVoiceState=function(state){
  vState=state; SPEED=state==='speaking'?10.0:state==='listening'?6.8:3.6;
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
