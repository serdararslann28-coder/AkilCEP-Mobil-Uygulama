/**
 * CinematicEarth v6 — Canvas2D stylized Earth, stable Expo/WebView.
 *
 * Restored from stylized polygon system + enhanced:
 *   - Two-layer polygon fill: directional LinearGradient + radial centre-bright mound
 *   - Chaikin 2× smoothing at startup → organic coastlines from coarse skeletons
 *   - shadowBlur coastline feathering into ocean
 *   - 6-stop deep cinematic ocean with latitude depth layer
 *   - Wider, warmer terminator (amber+orange twilight band)
 *   - Softer city lights (reduced bloom, warmer amber)
 *   - Layered Rayleigh atmosphere ring with sun-side scatter
 *   - Living Earth: smooth state-blend uniforms + multi-frequency organic breathing
 *   - Voice states: idle breath | listening blue wave | speaking warm corona
 *   - Specular highlight ambient drift (subtle cloud-movement illusion)
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── Land polygons — 34 biome regions ────────────────────────────────────────
// Chaikin 2× runs at startup; these are coarse control-point skeletons.
const LAND = [
  // ── Africa — Sahara warm gold, tropical deep emerald ────────────────────────
  {c:"#c49428",p:[[-6,36],[8,37],[24,33],[34,30],[42,28],[50,22],[44,18],[36,20],[28,22],[18,22],[8,22],[-2,22],[-10,24],[-18,24],[-18,30],[-6,36]]},
  {c:"#a88c24",p:[[-18,14],[-10,16],[0,16],[8,16],[18,14],[28,14],[36,14],[42,10],[44,14],[36,20],[28,22],[18,22],[8,22],[-2,22],[-10,24],[-18,24],[-18,14]]},
  {c:"#147218",p:[[-18,4],[-18,14],[0,14],[8,14],[18,14],[28,14],[20,8],[12,4],[4,2],[-2,4],[-10,4],[-18,4]]},
  {c:"#4a6e26",p:[[36,14],[42,10],[46,6],[48,0],[44,-4],[40,-10],[36,-18],[32,-26],[28,-34],[18,-34],[14,-28],[12,-18],[14,-10],[18,-4],[24,0],[28,4],[32,8],[36,14]]},
  {c:"#2e6e22",p:[[44,-12],[48,-14],[50,-18],[50,-24],[46,-26],[44,-22],[42,-18],[44,-12]]},
  // ── Europe — richer forest greens ──────────────────────────────────────────
  {c:"#2e7228",p:[[-6,44],[-2,44],[2,44],[8,48],[12,48],[14,44],[18,44],[22,44],[24,48],[22,52],[14,56],[8,54],[4,52],[-4,52],[-6,48],[-6,44]]},
  {c:"#326426",p:[[4,56],[8,54],[14,56],[18,58],[22,58],[22,66],[18,70],[12,70],[6,62],[4,58],[4,56]]},
  {c:"#5e7228",p:[[-10,36],[-6,36],[-4,38],[-2,40],[2,40],[4,40],[4,44],[-4,44],[-6,44],[-10,44],[-10,40],[-10,36]]},
  {c:"#4e7028",p:[[12,44],[14,44],[18,44],[22,44],[24,44],[28,44],[36,42],[40,40],[36,44],[28,46],[22,48],[16,46],[12,44]]},
  // ── Turkey — warm olive ─────────────────────────────────────────────────────
  {c:"#7a7030",p:[[26,37],[27,36.8],[29,36.2],[31,36],[33,36.2],[36,36],[38,36.2],[40,36.4],[42,36.8],[44,37.2],[44,38.2],[43,39.2],[42,40.2],[41,41],[40,41.5],[38,41.8],[36,42],[32,42],[29.5,42],[27.5,41.2],[26.5,40],[26.2,38.5],[26,37]]},
  // ── Middle East — deeper amber & ochre ─────────────────────────────────────
  {c:"#9a7c38",p:[[36,32],[40,34],[44,38],[44,34],[48,30],[48,24],[44,22],[40,26],[36,28],[34,30],[36,32]]},
  {c:"#c49420",p:[[36,28],[40,26],[44,22],[48,24],[56,18],[60,14],[56,12],[52,14],[46,12],[44,14],[40,14],[36,18],[36,22],[36,28]]},
  {c:"#9a7230",p:[[44,38],[48,40],[52,40],[60,36],[66,32],[66,26],[62,22],[58,20],[56,18],[52,22],[48,24],[48,30],[44,34],[44,38]]},
  // ── Russia — deep taiga green ──────────────────────────────────────────────
  {c:"#386632",p:[[24,48],[28,52],[32,56],[36,58],[40,62],[44,68],[50,66],[56,68],[60,64],[62,58],[58,52],[50,48],[44,44],[36,42],[28,44],[24,48]]},
  {c:"#326028",p:[[60,52],[68,56],[70,64],[70,72],[80,72],[100,72],[120,72],[140,70],[150,68],[155,60],[150,52],[140,52],[130,48],[120,52],[110,50],[100,54],[90,52],[80,54],[70,52],[60,52]]},
  // ── Central + South Asia ───────────────────────────────────────────────────
  {c:"#a08030",p:[[50,48],[60,52],[68,56],[70,48],[66,40],[60,36],[52,40],[48,40],[44,44],[48,50],[50,48]]},
  {c:"#5c7428",p:[[60,36],[66,26],[66,22],[70,18],[76,8],[80,10],[84,14],[88,22],[80,28],[76,30],[70,28],[66,28],[62,26],[60,30],[60,36]]},
  {c:"#1e7018",p:[[98,20],[100,14],[102,8],[104,0],[100,-4],[96,0],[94,8],[92,18],[96,22],[98,20]]},
  {c:"#187014",p:[[100,-4],[102,-2],[104,0],[106,-2],[106,-6],[102,-6],[100,-4]]},
  {c:"#147212",p:[[108,4],[110,2],[112,0],[116,2],[116,4],[114,6],[110,6],[108,4]]},
  // ── East Asia ──────────────────────────────────────────────────────────────
  {c:"#727830",p:[[74,38],[80,50],[90,52],[100,52],[110,50],[120,52],[130,48],[128,40],[126,32],[120,24],[114,18],[108,18],[104,22],[100,18],[96,22],[92,20],[94,24],[88,22],[80,28],[76,30],[70,28],[70,36],[74,38]]},
  {c:"#306a2c",p:[[130,31],[132,33],[136,35],[137,40],[134,42],[132,42],[130,38],[128,33],[130,31]]},
  {c:"#386c2e",p:[[126,34],[128,36],[130,38],[128,38],[126,36],[124,36],[126,34]]},
  // ── North America ──────────────────────────────────────────────────────────
  {c:"#325e26",p:[[-168,60],[-156,58],[-148,58],[-136,58],[-130,54],[-132,56],[-140,58],[-152,58],[-164,58],[-168,58],[-168,60]]},
  {c:"#346a28",p:[[-136,58],[-130,54],[-124,50],[-80,44],[-72,42],[-64,44],[-60,44],[-60,50],[-66,52],[-76,58],[-84,64],[-96,68],[-100,70],[-80,72],[-60,72],[-50,70],[-36,62],[-42,58],[-52,54],[-56,50],[-66,46],[-76,46],[-90,60],[-100,58],[-120,58],[-130,54],[-136,58]]},
  {c:"#3e7028",p:[[-124,48],[-120,44],[-110,44],[-100,44],[-80,44],[-72,42],[-70,40],[-76,34],[-80,30],[-88,30],[-96,24],[-100,24],[-106,24],[-110,30],[-114,32],[-118,34],[-122,36],[-124,38],[-124,48]]},
  {c:"#6a7024",p:[[-116,28],[-100,24],[-96,22],[-88,22],[-84,18],[-80,12],[-78,10],[-84,10],[-88,16],[-92,18],[-100,22],[-106,22],[-112,28],[-116,30],[-116,28]]},
  // ── South America — Amazon deep emerald ────────────────────────────────────
  {c:"#0e7216",p:[[-78,10],[-70,12],[-60,8],[-52,4],[-50,0],[-44,-2],[-40,-4],[-44,-8],[-50,-8],[-54,-4],[-60,-4],[-66,-4],[-70,0],[-76,2],[-78,6],[-78,10]]},
  {c:"#286e1c",p:[[-40,-4],[-36,-8],[-36,-16],[-38,-22],[-44,-24],[-48,-16],[-50,-8],[-44,-8],[-40,-4]]},
  {c:"#7a6424",p:[[-78,10],[-80,4],[-80,0],[-76,0],[-68,-6],[-68,-18],[-70,-30],[-72,-44],[-70,-50],[-66,-54],[-60,-52],[-56,-38],[-54,-20],[-54,-4],[-60,-4],[-66,-4],[-70,0],[-76,2],[-78,6],[-78,10]]},
  // ── Australia — rich outback ochre + eastern green ─────────────────────────
  {c:"#c09428",p:[[114,-22],[122,-20],[128,-18],[134,-14],[136,-18],[138,-22],[136,-26],[130,-26],[126,-30],[120,-34],[116,-32],[112,-28],[114,-22]]},
  {c:"#506c26",p:[[138,-18],[140,-18],[144,-18],[148,-20],[152,-24],[152,-30],[148,-36],[142,-38],[136,-38],[132,-32],[128,-30],[126,-30],[130,-26],[136,-26],[138,-22],[136,-18],[138,-18]]},
  // ── Polar ice — crisp arctic white-blue ────────────────────────────────────
  {c:"#b4d0e4",p:[[-44,60],[-36,62],[-24,68],[-18,72],[-22,76],[-30,78],[-42,82],[-52,80],[-58,74],[-54,66],[-44,60]]},
  {c:"#cce0ee",p:[[-180,-72],[0,-72],[180,-72],[180,-90],[-180,-90],[-180,-72]]},
];

// ─── City lights [lon, lat, brightness] ──────────────────────────────────────
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
html,body{width:100%;height:100%;background:#00000c;overflow:hidden}
canvas{position:absolute;top:0;left:0;display:block}
#ui{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden}
.lb{
  position:absolute;
  font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;
  white-space:nowrap;text-transform:uppercase;
  color:rgba(205,228,255,0.82);
  text-shadow:0 0 6px rgba(120,185,255,0.36);
  transition:opacity 1.0s ease;
  pointer-events:none;
}
#lTR{font-size:7px;font-weight:700;letter-spacing:2.5px;transform:translate(-50%,-265%)}
#lIS{font-size:5px;font-weight:600;letter-spacing:1.8px;transform:translate(-118%,-168%)}
#lAN{font-size:5px;font-weight:600;letter-spacing:1.8px;transform:translate(18%,-168%)}
.dot{
  position:absolute;width:2px;height:2px;border-radius:50%;
  background:rgba(200,228,255,0.80);transform:translate(-50%,-50%);
  box-shadow:0 0 3px 1px rgba(150,205,255,0.34);
  transition:opacity 1.0s ease;pointer-events:none;
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

// ── Canvas setup ──────────────────────────────────────────────────────────────
var W  = window.innerWidth  || screen.width  || 375;
var H  = window.innerHeight || screen.height || 812;
var cv = document.getElementById('c');
cv.width = W; cv.height = H;
var ctx = cv.getContext('2d');
if(!ctx) return;
var cx = W*0.5, cy = H*0.46, R = Math.min(W,H)*0.44;

// ── Sun direction (fixed) ─────────────────────────────────────────────────────
var SUN_LON=-30, SUN_LAT=22;
var sunLatR=SUN_LAT*Math.PI/180, sunLonR=SUN_LON*Math.PI/180;
var SX=Math.cos(sunLatR)*Math.cos(sunLonR);
var SY=Math.sin(sunLatR);
var SZ=Math.cos(sunLatR)*Math.sin(sunLonR);

// ── Chaikin 2× smoothing (runs once at startup) ────────────────────────────────
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
  if(LAND[pi].p.length>5) LAND[pi].p=chaikin(chaikin(LAND[pi].p));
}

// ── Seeded starfield ──────────────────────────────────────────────────────────
var STARS=[];
(function(){
  var s=0xDEADBEEF;
  function rn(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }
  for(var i=0;i<320;i++){
    var t=rn();
    var r=t<0.62?0.10+rn()*0.14:t<0.88?0.22+rn()*0.18:t<0.97?0.40+rn()*0.18:0.58+rn()*0.20;
    STARS.push({x:rn()*W,y:rn()*H,r:r,o:0.10+rn()*0.54,tw:0.30+rn()*1.0,tp:rn()*6.28});
  }
})();

// ── State ─────────────────────────────────────────────────────────────────────
var rot=28, SPEED=3.6, vState='idle', vPhase=0, dt=0, lastT=-1;
var vListen=0, vSpeak=0, vIdle=1;

// ── Spherical projection ──────────────────────────────────────────────────────
function proj(lon,lat){
  var dlonR=(lon-rot)*Math.PI/180, latR=lat*Math.PI/180;
  var cLat=Math.cos(latR), sLat=Math.sin(latR);
  var lonR=lon*Math.PI/180;
  var nx=Math.cos(lonR)*cLat, ny=sLat, nz=Math.sin(lonR)*cLat;
  return{x:cx+R*Math.sin(dlonR)*cLat, y:cy-R*sLat, z:Math.cos(dlonR)*cLat,
         sun:nx*SX+ny*SY+nz*SZ};
}
function phash(n){ return((n*2654435769)>>>0)/4294967296; }

// ── Label helper ──────────────────────────────────────────────────────────────
function setLabel(lId,dId,lon,lat){
  var p=proj(lon,lat), op=p.z>0.14?'1':'0';
  var el=document.getElementById(lId), dt2=document.getElementById(dId);
  if(el){el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.opacity=op;}
  if(dt2){dt2.style.left=p.x+'px';dt2.style.top=p.y+'px';dt2.style.opacity=p.z>0.14?'0.78':'0';}
}
function fillArc(g,r){ctx.beginPath();ctx.arc(cx,cy,r,0,6.2832);ctx.fillStyle=g;ctx.fill();}

// ── Main draw ─────────────────────────────────────────────────────────────────
function draw(){
  var TAU=6.2832;

  var sunDlonR=(SUN_LON-rot)*Math.PI/180;
  var sdx=Math.sin(sunDlonR)*Math.cos(sunLatR);
  var sdy=-Math.sin(sunLatR);
  var sunSX=cx+R*0.76*sdx, sunSY=cy+R*0.76*sdy;

  var adlon=(((SUN_LON+180)-rot)%360+360)%360;
  if(adlon>180) adlon-=360;
  var nCX=cx+R*0.52*Math.sin(adlon*Math.PI/180);

  // ── 01. Space background — deep cinematic void ────────────────────────────
  ctx.fillStyle='#000008'; ctx.fillRect(0,0,W,H);
  // Subtle deep-space ambient gradient — slightly lighter toward the globe
  var bgG=ctx.createRadialGradient(cx,cy,R*1.4,cx,cy,Math.max(W,H));
  bgG.addColorStop(0,'rgba(10,18,52,0.28)');
  bgG.addColorStop(1,'rgba(0,0,6,0)');
  ctx.fillStyle=bgG; ctx.fillRect(0,0,W,H);

  // ── 02. Stars — calmer, smaller ───────────────────────────────────────────
  for(var si=0;si<STARS.length;si++){
    var st=STARS[si];
    var ot=st.o*(0.86+0.14*Math.sin(vPhase*st.tw+st.tp));
    ctx.beginPath(); ctx.arc(st.x,st.y,st.r,0,TAU);
    ctx.fillStyle='rgba(255,255,255,'+ot+')'; ctx.fill();
  }

  // ── 03. Ocean — rich deep cinematic blue ──────────────────────────────────
  // Sun-highlight offset makes the lit ocean gleam vs dark far-side
  var oCX=cx+R*0.32*sdx, oCY=cy+R*0.22*sdy;
  var oG=ctx.createRadialGradient(oCX,oCY,R*0.03,cx,cy,R);
  oG.addColorStop(0.00,'#2882bc');  // sun-lit highlight — richer cobalt-blue
  oG.addColorStop(0.13,'#1668a0');  // bright deep water
  oG.addColorStop(0.32,'#0e4878');  // mid-depth
  oG.addColorStop(0.52,'#072a54');  // abyssal
  oG.addColorStop(0.74,'#040e28');  // deep void
  oG.addColorStop(1.00,'#020810');  // terminator/limb black
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fillStyle=oG; ctx.fill(); ctx.restore();

  // Latitude depth layer — polar darkening, tropical saturation
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var odG=ctx.createLinearGradient(cx,cy-R,cx,cy+R);
  odG.addColorStop(0.00,'rgba(4,12,44,0.18)');
  odG.addColorStop(0.24,'rgba(4,14,46,0.06)');
  odG.addColorStop(0.46,'rgba(0,24,54,0.0)');
  odG.addColorStop(0.54,'rgba(0,24,54,0.0)');
  odG.addColorStop(0.76,'rgba(4,14,46,0.06)');
  odG.addColorStop(1.00,'rgba(4,12,44,0.18)');
  ctx.fillStyle=odG; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 04. Land polygons — two-layer technique ───────────────────────────────
  var shadowR=Math.max(1.0,R*0.010);
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R-0.5,0,TAU); ctx.clip();

  for(var i=0;i<LAND.length;i++){
    var poly=LAND[i], pts=poly.p, pn=pts.length;
    var sl=0, slt=0;
    for(var j=0;j<pn;j++){ sl+=pts[j][0]; slt+=pts[j][1]; }
    var cp=proj(sl/pn, slt/pn);
    if(cp.z<-0.14) continue;

    ctx.beginPath();
    var first=true;
    for(var k=0;k<pn;k++){
      var vp=proj(pts[k][0],pts[k][1]);
      if(vp.z<-0.22) continue;
      if(first){ctx.moveTo(vp.x,vp.y);first=false;}
      else ctx.lineTo(vp.x,vp.y);
    }
    if(first) continue;
    ctx.closePath();

    // Boost land brightness: stronger diffuse + wider gamma curve = richer saturation
    var raw=cp.sun*1.65+0.22;
    var t=Math.pow(Math.max(0,Math.min(1,raw)),0.72);
    t*=(0.92+0.08*phash(i));
    t=Math.max(0.07,t);

    var hex=poly.c;
    var r2=parseInt(hex.slice(1,3),16);
    var g2=parseInt(hex.slice(3,5),16);
    var b2=parseInt(hex.slice(5,7),16);

    // Layer 1: directional gradient (sun→shadow within polygon)
    var tH=Math.min(1.0,t*1.18), tL=Math.max(0.04,t*0.85), pR=R*0.18;
    var pLG=ctx.createLinearGradient(
      cp.x+sdx*pR, cp.y+sdy*pR, cp.x-sdx*pR, cp.y-sdy*pR
    );
    pLG.addColorStop(0,'rgb('+Math.round(r2*tH)+','+Math.round(g2*tH)+','+Math.round(b2*tH)+')');
    pLG.addColorStop(1,'rgb('+Math.round(r2*tL)+','+Math.round(g2*tL)+','+Math.round(b2*tL)+')');

    ctx.shadowColor='rgb('+Math.round(r2*t)+','+Math.round(g2*t)+','+Math.round(b2*t)+')';
    ctx.shadowBlur=shadowR;
    ctx.fillStyle=pLG; ctx.fill();
    ctx.shadowBlur=0; ctx.shadowColor='transparent';

    // Layer 2: radial centre-bright (terrain mound depth)
    var pRG=ctx.createRadialGradient(cp.x,cp.y,0,cp.x,cp.y,R*0.22);
    pRG.addColorStop(0.0,'rgba(255,255,255,0.055)');
    pRG.addColorStop(0.5,'rgba(255,255,255,0.016)');
    pRG.addColorStop(1.0,'rgba(0,0,0,0.032)');
    ctx.fillStyle=pRG; ctx.fill();
  }
  ctx.restore();

  // ── 05. Latitude climate-zone tint ────────────────────────────────────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var latG=ctx.createLinearGradient(cx,cy-R,cx,cy+R);
  latG.addColorStop(0.00,'rgba(118,152,208,0.055)');
  latG.addColorStop(0.26,'rgba(78,122,178,0.020)');
  latG.addColorStop(0.46,'rgba(36,92,36,0.038)');
  latG.addColorStop(0.54,'rgba(36,92,36,0.038)');
  latG.addColorStop(0.74,'rgba(78,122,178,0.020)');
  latG.addColorStop(1.00,'rgba(118,152,208,0.055)');
  ctx.fillStyle=latG; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 06. Inner atmosphere haze ─────────────────────────────────────────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R+0.5,0,TAU); ctx.clip();
  var ih=ctx.createRadialGradient(cx,cy,R*0.83,cx,cy,R*1.005);
  ih.addColorStop(0.0,'rgba(14,44,122,0)');
  ih.addColorStop(0.6,'rgba(20,52,148,0.065)');
  ih.addColorStop(1.0,'rgba(28,66,178,0.28)');
  ctx.fillStyle=ih; ctx.fillRect(cx-R*1.1,cy-R*1.1,R*2.2,R*2.2); ctx.restore();

  // ── 07. Terrain curvature (viewer-facing centre-bright) ───────────────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var cv2=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
  cv2.addColorStop(0.0,'rgba(255,255,255,0.034)');
  cv2.addColorStop(0.44,'rgba(255,255,255,0)');
  cv2.addColorStop(0.80,'rgba(0,0,0,0.036)');
  cv2.addColorStop(1.0,'rgba(0,0,0,0.12)');
  ctx.fillStyle=cv2; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 08. Night hemisphere + wide cinematic terminator ─────────────────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var tg=ctx.createRadialGradient(nCX,cy,0,nCX,cy,R*1.70);
  tg.addColorStop(0.00,'rgba(0,2,14,0.97)');
  tg.addColorStop(0.28,'rgba(0,2,14,0.92)');
  tg.addColorStop(0.44,'rgba(2,4,20,0.72)');
  tg.addColorStop(0.52,'rgba(34,16,6,0.50)');  // deep amber
  tg.addColorStop(0.58,'rgba(62,28,6,0.26)');  // warm orange
  tg.addColorStop(0.64,'rgba(22,10,2,0.12)');
  tg.addColorStop(0.72,'rgba(0,0,0,0)');
  ctx.fillStyle=tg; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 09. City lights — three-layer warm golden glow ────────────────────────
  var cityBoost=1.0+vSpeak*0.28*(0.5+0.5*Math.sin(vPhase*2.2));
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R-0.5,0,TAU); ctx.clip();
  for(var ci=0;ci<CITIES.length;ci++){
    var city=CITIES[ci], cp2=proj(city[0],city[1]);
    if(cp2.z<0) continue;
    if(cp2.sun>0.18) continue;
    var fade=Math.max(0,Math.min(1,(0.18-cp2.sun)/0.24));
    var br=city[2]*fade*cityBoost;
    if(br<0.05) continue;
    var cr=1.5*br+0.36;
    // Far bloom — very wide, very faint warm amber cloud
    var cg0=ctx.createRadialGradient(cp2.x,cp2.y,0,cp2.x,cp2.y,cr*4.2);
    cg0.addColorStop(0.0,'rgba(255,195,80,'+(br*0.11)+')');
    cg0.addColorStop(0.55,'rgba(255,158,50,'+(br*0.042)+')');
    cg0.addColorStop(1.0,'rgba(255,120,28,0)');
    ctx.beginPath(); ctx.arc(cp2.x,cp2.y,cr*4.2,0,TAU); ctx.fillStyle=cg0; ctx.fill();
    // Mid bloom — warm gold
    var cg1=ctx.createRadialGradient(cp2.x,cp2.y,0,cp2.x,cp2.y,cr*2.4);
    cg1.addColorStop(0.0,'rgba(255,228,148,'+(br*0.28)+')');
    cg1.addColorStop(0.5,'rgba(255,198,90,'+(br*0.12)+')');
    cg1.addColorStop(1.0,'rgba(255,165,52,0)');
    ctx.beginPath(); ctx.arc(cp2.x,cp2.y,cr*2.4,0,TAU); ctx.fillStyle=cg1; ctx.fill();
    // Inner core — warm white–gold pinpoint
    var cg2=ctx.createRadialGradient(cp2.x,cp2.y,0,cp2.x,cp2.y,cr*0.90);
    cg2.addColorStop(0.0,'rgba(255,255,224,'+(br*0.92)+')');
    cg2.addColorStop(0.45,'rgba(255,232,155,'+(br*0.44)+')');
    cg2.addColorStop(1.0,'rgba(255,200,88,0)');
    ctx.beginPath(); ctx.arc(cp2.x,cp2.y,cr*0.90,0,TAU); ctx.fillStyle=cg2; ctx.fill();
  }
  ctx.restore();

  // ── 10. Polar ice glow ────────────────────────────────────────────────────
  var poles=[[0,88],[0,-88]];
  for(var ip=0;ip<poles.length;ip++){
    var pp=proj(poles[ip][0],poles[ip][1]);
    if(pp.z<0) continue;
    var pa=0.28+0.16*Math.max(0,pp.sun);
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
    var pg2=ctx.createRadialGradient(pp.x,pp.y,0,pp.x,pp.y,R*0.28*pp.z);
    pg2.addColorStop(0.0,'rgba(215,238,255,'+(pa*0.85)+')');
    pg2.addColorStop(0.40,'rgba(185,220,250,'+(pa*0.38)+')');
    pg2.addColorStop(1.0,'rgba(155,200,242,0)');
    ctx.beginPath(); ctx.arc(pp.x,pp.y,R*0.28*pp.z,0,TAU);
    ctx.fillStyle=pg2; ctx.fill(); ctx.restore();
  }

  // ── 10b. Aurora borealis — extremely subtle animated shimmer ──────────────
  // Three overlapping patches near the north polar ring, only on the dark side.
  var auroraData=[
    {lon:0,   lat:72, col:[68,225,128]},   // emerald green
    {lon:55,  lat:68, col:[52,185,218]},   // cyan-teal
    {lon:-55, lat:70, col:[148,105,228]},  // soft violet
  ];
  for(var ai=0;ai<auroraData.length;ai++){
    var ad=auroraData[ai];
    var ap=proj(ad.lon,ad.lat);
    if(ap.z<0.04) continue;
    // Fade: only on night side (low/negative sun), and only when facing viewer
    var aFade=ap.z*Math.max(0,0.92-ap.sun*9.0);
    if(aFade<0.01) continue;
    var aAnim=0.5+0.5*Math.sin(vPhase*(0.55+ai*0.22)+ai*2.3);
    var aAlpha=aFade*aAnim*0.048;
    var ac=ad.col;
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
    var aG=ctx.createRadialGradient(ap.x,ap.y,0,ap.x,ap.y,R*0.30);
    aG.addColorStop(0.0,'rgba('+ac[0]+','+ac[1]+','+ac[2]+','+(aAlpha*1.0)+')');
    aG.addColorStop(0.38,'rgba('+ac[0]+','+ac[1]+','+ac[2]+','+(aAlpha*0.42)+')');
    aG.addColorStop(1.0,'rgba('+ac[0]+','+ac[1]+','+ac[2]+',0)');
    ctx.beginPath(); ctx.arc(ap.x,ap.y,R*0.30,0,TAU);
    ctx.fillStyle=aG; ctx.fill(); ctx.restore();
  }

  // ── 11. Limb darkening ────────────────────────────────────────────────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R+0.5,0,TAU); ctx.clip();
  var ld=ctx.createRadialGradient(cx,cy,R*0.60,cx,cy,R*1.005);
  ld.addColorStop(0.0,'rgba(0,0,0,0)');
  ld.addColorStop(0.68,'rgba(0,0,0,0.065)');
  ld.addColorStop(0.86,'rgba(0,0,0,0.26)');
  ld.addColorStop(1.0,'rgba(0,0,0,0.60)');
  ctx.fillStyle=ld; ctx.fillRect(cx-R*1.05,cy-R*1.05,R*2.1,R*2.1); ctx.restore();

  // ── 12. Outer atmosphere — layered Rayleigh ring ──────────────────────────
  // Layer A: dense bright ring right at the limb
  var ag1=ctx.createRadialGradient(cx,cy,R*0.972,cx,cy,R*1.108);
  ag1.addColorStop(0.00,'rgba(58,132,244,0)');
  ag1.addColorStop(0.12,'rgba(98,172,255,0.50)');  // bright peak
  ag1.addColorStop(0.38,'rgba(64,140,244,0.24)');
  ag1.addColorStop(0.72,'rgba(44,112,226,0.08)');
  ag1.addColorStop(1.00,'rgba(28,84,200,0)');
  fillArc(ag1,R*1.108);

  // Layer B: wider diffuse outer halo
  var ag2=ctx.createRadialGradient(cx,cy,R*1.01,cx,cy,R*1.22);
  ag2.addColorStop(0.00,'rgba(44,112,246,0)');
  ag2.addColorStop(0.28,'rgba(36,98,232,0.052)');
  ag2.addColorStop(0.70,'rgba(24,74,210,0.018)');
  ag2.addColorStop(1.00,'rgba(14,56,184,0)');
  fillArc(ag2,R*1.22);

  // Layer C: innermost thin glow band — adds blue edge depth to the globe rim
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R+1,0,TAU); ctx.clip();
  var ag3=ctx.createRadialGradient(cx,cy,R*0.88,cx,cy,R*1.002);
  ag3.addColorStop(0.0,'rgba(30,88,200,0)');
  ag3.addColorStop(0.75,'rgba(44,112,230,0.055)');
  ag3.addColorStop(1.0,'rgba(62,138,250,0.18)');
  ctx.fillStyle=ag3; ctx.fillRect(cx-R*1.05,cy-R*1.05,R*2.1,R*2.1); ctx.restore();

  // ── 13. Sun-side limb scatter — brightened ────────────────────────────────
  var slg=ctx.createRadialGradient(sunSX,sunSY,R*0.68,sunSX,sunSY,R*1.18);
  slg.addColorStop(0.0,'rgba(255,255,255,0)');
  slg.addColorStop(0.72,'rgba(220,236,255,0)');
  slg.addColorStop(0.86,'rgba(220,236,255,0.10)');
  slg.addColorStop(0.96,'rgba(255,248,230,0.04)');
  slg.addColorStop(1.0,'rgba(255,255,255,0)');
  fillArc(slg,R*1.16);

  // ── 14. Specular ocean highlight (ambient drift) ──────────────────────────
  var driftX=Math.sin(vPhase*0.10)*R*0.012;
  var driftY=Math.cos(vPhase*0.07)*R*0.008;
  var spX=cx+R*0.22*sdx+driftX, spY=cy+R*0.17*sdy+driftY;
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var sp=ctx.createRadialGradient(spX,spY,0,spX,spY,R*0.32);
  sp.addColorStop(0.0,'rgba(208,232,255,0.15)');
  sp.addColorStop(0.45,'rgba(165,208,255,0.055)');
  sp.addColorStop(1.0,'rgba(106,160,255,0)');
  ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fillStyle=sp; ctx.fill(); ctx.restore();

  // ── 15. Globe edge ────────────────────────────────────────────────────────
  ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU);
  ctx.strokeStyle='rgba(70,140,244,0.13)'; ctx.lineWidth=0.6; ctx.stroke();

  // ── 16. Living Earth — organic emotional states ───────────────────────────
  // Three overlapping breathing cycles — never feels mechanical or looped.
  var b1=0.5+0.5*Math.sin(vPhase*1.38);   // 0.22 Hz  — main breath (4.5s)
  var b2=0.5+0.5*Math.sin(vPhase*0.48);   // 0.076 Hz — tidal swell (13s)
  var b3=0.5+0.5*Math.sin(vPhase*3.60);   // 0.57 Hz  — surface shimmer (1.75s)

  // IDLE — gentle atmosphere breathing (always present)
  if(vIdle>0.008){
    var idleA=vIdle*(0.52+0.28*b1+0.20*b2);
    var ba=ctx.createRadialGradient(cx,cy,R*0.97,cx,cy,R*1.135);
    ba.addColorStop(0.0,'rgba(40,92,196,0)');
    ba.addColorStop(0.38,'rgba(44,100,202,'+(0.034*idleA)+')');
    ba.addColorStop(0.72,'rgba(28,72,168,'+(0.012*idleA)+')');
    ba.addColorStop(1.0,'rgba(20,58,148,0)');
    fillArc(ba,R*1.135);
  }

  // LISTENING — cool blue atmosphere shift + two staggered organic rings
  if(vListen>0.008){
    var lisA=vListen*(0.60+0.25*b1+0.15*b3);
    // Atmosphere colour shift — cooler, more blue during listening
    var la=ctx.createRadialGradient(cx,cy,R*0.92,cx,cy,R*1.22);
    la.addColorStop(0.00,'rgba(65,148,255,0)');
    la.addColorStop(0.15,'rgba(90,168,255,'+(lisA*0.18)+')');
    la.addColorStop(0.50,'rgba(58,134,244,'+(lisA*0.072)+')');
    la.addColorStop(0.82,'rgba(38,108,230,'+(lisA*0.022)+')');
    la.addColorStop(1.00,'rgba(30,88,210,0)');
    fillArc(la,R*1.22);
    // Ring 1 — primary heartbeat, 2.6s period
    var wp1=(vPhase*0.385)%1;
    var wA1=Math.max(0,Math.pow(1-wp1,1.8)*vListen*0.22);
    ctx.beginPath(); ctx.arc(cx,cy,R*(1.035+wp1*0.55),0,TAU);
    ctx.strokeStyle='rgba(100,178,255,'+wA1+')';
    ctx.lineWidth=0.30+(1-wp1)*1.0; ctx.stroke();
    // Ring 2 — offset 0.5 phase, slightly different period (4.1s) — avoids mechanical feel
    var wp2=((vPhase*0.385)+0.5)%1;
    var wA2=Math.max(0,Math.pow(1-wp2,1.8)*vListen*0.14);
    ctx.beginPath(); ctx.arc(cx,cy,R*(1.035+wp2*0.55),0,TAU);
    ctx.strokeStyle='rgba(80,158,248,'+wA2+')';
    ctx.lineWidth=0.22+(1-wp2)*0.65; ctx.stroke();
  }

  // SPEAKING — warm atmosphere brightens + elegant dual-ring pulse
  if(vSpeak>0.008){
    var sp1=0.5+0.5*Math.sin(vPhase*2.55);
    var sp2=0.5+0.5*Math.sin(vPhase*1.65+0.95);
    var spA=vSpeak*(0.46+0.33*sp1+0.21*sp2);
    // Warm corona — two-layer: inner amber + outer deep orange
    var co=ctx.createRadialGradient(cx,cy,R*0.90,cx,cy,R*1.35);
    co.addColorStop(0.00,'rgba(255,158,42,0)');
    co.addColorStop(0.14,'rgba(255,148,36,'+(0.16*spA)+')');
    co.addColorStop(0.38,'rgba(255,118,22,'+(0.064*spA)+')');
    co.addColorStop(0.70,'rgba(255,76,12,'+(0.020*spA)+')');
    co.addColorStop(1.00,'rgba(255,52,8,0)');
    fillArc(co,R*1.35);
    // Inner globe brightens with voice — warm tidal fill
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
    var gw=ctx.createRadialGradient(cx,cy,R*0.60,cx,cy,R);
    gw.addColorStop(0,'rgba(255,148,36,0)');
    gw.addColorStop(0.78,'rgba(255,130,28,'+(0.052*spA)+')');
    gw.addColorStop(1.0,'rgba(255,108,18,'+(0.115*spA)+')');
    ctx.fillStyle=gw; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();
    // Slow expanding pulse ring — cinematic breath of the AI
    var pp1=(vPhase*0.22)%1;
    var pA1=Math.max(0,Math.pow(1-pp1,2.2)*vSpeak*0.18);
    ctx.beginPath(); ctx.arc(cx,cy,R*(1.02+pp1*0.68),0,TAU);
    ctx.strokeStyle='rgba(255,168,68,'+pA1+')';
    ctx.lineWidth=0.28+(1-pp1)*1.10; ctx.stroke();
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
    var bs=Math.min(1,1.8*dt);
    vListen+=((vState==='listening'?1:0)-vListen)*bs;
    vSpeak +=((vState==='speaking' ?1:0)-vSpeak )*bs;
    vIdle  +=((vState==='idle'     ?1:0)-vIdle  )*bs;
  }
  lastT=t; draw(); requestAnimationFrame(frame);
}
window.addEventListener('resize',function(){
  W=window.innerWidth||W; H=window.innerHeight||H;
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
  wrap:        { flex: 1, width: "100%", backgroundColor: "#00000c", overflow: "hidden" },
  web:         { flex: 1, backgroundColor: "transparent" },
  webFallback: { flex: 1, width: "100%", backgroundColor: "#00000c" },
});
