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
  // ── Africa ─────────────────────────────────────────────────────────────────
  {c:"#b09a30",p:[[-6,36],[8,37],[24,33],[34,30],[42,28],[50,22],[44,18],[36,20],[28,22],[18,22],[8,22],[-2,22],[-10,24],[-18,24],[-18,30],[-6,36]]},
  {c:"#8a7e2c",p:[[-18,14],[-10,16],[0,16],[8,16],[18,14],[28,14],[36,14],[42,10],[44,14],[36,20],[28,22],[18,22],[8,22],[-2,22],[-10,24],[-18,24],[-18,14]]},
  {c:"#22681c",p:[[-18,4],[-18,14],[0,14],[8,14],[18,14],[28,14],[20,8],[12,4],[4,2],[-2,4],[-10,4],[-18,4]]},
  {c:"#567030",p:[[36,14],[42,10],[46,6],[48,0],[44,-4],[40,-10],[36,-18],[32,-26],[28,-34],[18,-34],[14,-28],[12,-18],[14,-10],[18,-4],[24,0],[28,4],[32,8],[36,14]]},
  {c:"#38662a",p:[[44,-12],[48,-14],[50,-18],[50,-24],[46,-26],[44,-22],[42,-18],[44,-12]]},
  // ── Europe ─────────────────────────────────────────────────────────────────
  {c:"#346a2c",p:[[-6,44],[-2,44],[2,44],[8,48],[12,48],[14,44],[18,44],[22,44],[24,48],[22,52],[14,56],[8,54],[4,52],[-4,52],[-6,48],[-6,44]]},
  {c:"#3c5e2e",p:[[4,56],[8,54],[14,56],[18,58],[22,58],[22,66],[18,70],[12,70],[6,62],[4,58],[4,56]]},
  {c:"#5e7632",p:[[-10,36],[-6,36],[-4,38],[-2,40],[2,40],[4,40],[4,44],[-4,44],[-6,44],[-10,44],[-10,40],[-10,36]]},
  {c:"#547232",p:[[12,44],[14,44],[18,44],[22,44],[24,44],[28,44],[36,42],[40,40],[36,44],[28,46],[22,48],[16,46],[12,44]]},
  // ── Turkey ─────────────────────────────────────────────────────────────────
  {c:"#70703c",p:[[26,37],[27,36.8],[29,36.2],[31,36],[33,36.2],[36,36],[38,36.2],[40,36.4],[42,36.8],[44,37.2],[44,38.2],[43,39.2],[42,40.2],[41,41],[40,41.5],[38,41.8],[36,42],[32,42],[29.5,42],[27.5,41.2],[26.5,40],[26.2,38.5],[26,37]]},
  // ── Middle East ────────────────────────────────────────────────────────────
  {c:"#8c7840",p:[[36,32],[40,34],[44,38],[44,34],[48,30],[48,24],[44,22],[40,26],[36,28],[34,30],[36,32]]},
  {c:"#b09028",p:[[36,28],[40,26],[44,22],[48,24],[56,18],[60,14],[56,12],[52,14],[46,12],[44,14],[40,14],[36,18],[36,22],[36,28]]},
  {c:"#907038",p:[[44,38],[48,40],[52,40],[60,36],[66,32],[66,26],[62,22],[58,20],[56,18],[52,22],[48,24],[48,30],[44,34],[44,38]]},
  // ── Russia ─────────────────────────────────────────────────────────────────
  {c:"#406034",p:[[24,48],[28,52],[32,56],[36,58],[40,62],[44,68],[50,66],[56,68],[60,64],[62,58],[58,52],[50,48],[44,44],[36,42],[28,44],[24,48]]},
  {c:"#3a5c2c",p:[[60,52],[68,56],[70,64],[70,72],[80,72],[100,72],[120,72],[140,70],[150,68],[155,60],[150,52],[140,52],[130,48],[120,52],[110,50],[100,54],[90,52],[80,54],[70,52],[60,52]]},
  // ── Central + South Asia ───────────────────────────────────────────────────
  {c:"#8c7c36",p:[[50,48],[60,52],[68,56],[70,48],[66,40],[60,36],[52,40],[48,40],[44,44],[48,50],[50,48]]},
  {c:"#687232",p:[[60,36],[66,26],[66,22],[70,18],[76,8],[80,10],[84,14],[88,22],[80,28],[76,30],[70,28],[66,28],[62,26],[60,30],[60,36]]},
  {c:"#286a1e",p:[[98,20],[100,14],[102,8],[104,0],[100,-4],[96,0],[94,8],[92,18],[96,22],[98,20]]},
  {c:"#226818",p:[[100,-4],[102,-2],[104,0],[106,-2],[106,-6],[102,-6],[100,-4]]},
  {c:"#1e6616",p:[[108,4],[110,2],[112,0],[116,2],[116,4],[114,6],[110,6],[108,4]]},
  // ── East Asia ──────────────────────────────────────────────────────────────
  {c:"#7a7a36",p:[[74,38],[80,50],[90,52],[100,52],[110,50],[120,52],[130,48],[128,40],[126,32],[120,24],[114,18],[108,18],[104,22],[100,18],[96,22],[92,20],[94,24],[88,22],[80,28],[76,30],[70,28],[70,36],[74,38]]},
  {c:"#3a6630",p:[[130,31],[132,33],[136,35],[137,40],[134,42],[132,42],[130,38],[128,33],[130,31]]},
  {c:"#426632",p:[[126,34],[128,36],[130,38],[128,38],[126,36],[124,36],[126,34]]},
  // ── North America ──────────────────────────────────────────────────────────
  {c:"#3a5a2a",p:[[-168,60],[-156,58],[-148,58],[-136,58],[-130,54],[-132,56],[-140,58],[-152,58],[-164,58],[-168,58],[-168,60]]},
  {c:"#3e642c",p:[[-136,58],[-130,54],[-124,50],[-80,44],[-72,42],[-64,44],[-60,44],[-60,50],[-66,52],[-76,58],[-84,64],[-96,68],[-100,70],[-80,72],[-60,72],[-50,70],[-36,62],[-42,58],[-52,54],[-56,50],[-66,46],[-76,46],[-90,60],[-100,58],[-120,58],[-130,54],[-136,58]]},
  {c:"#4a6e30",p:[[-124,48],[-120,44],[-110,44],[-100,44],[-80,44],[-72,42],[-70,40],[-76,34],[-80,30],[-88,30],[-96,24],[-100,24],[-106,24],[-110,30],[-114,32],[-118,34],[-122,36],[-124,38],[-124,48]]},
  {c:"#66742e",p:[[-116,28],[-100,24],[-96,22],[-88,22],[-84,18],[-80,12],[-78,10],[-84,10],[-88,16],[-92,18],[-100,22],[-106,22],[-112,28],[-116,30],[-116,28]]},
  // ── South America ──────────────────────────────────────────────────────────
  {c:"#1e5e18",p:[[-78,10],[-70,12],[-60,8],[-52,4],[-50,0],[-44,-2],[-40,-4],[-44,-8],[-50,-8],[-54,-4],[-60,-4],[-66,-4],[-70,0],[-76,2],[-78,6],[-78,10]]},
  {c:"#3a6222",p:[[-40,-4],[-36,-8],[-36,-16],[-38,-22],[-44,-24],[-48,-16],[-50,-8],[-44,-8],[-40,-4]]},
  {c:"#78682e",p:[[-78,10],[-80,4],[-80,0],[-76,0],[-68,-6],[-68,-18],[-70,-30],[-72,-44],[-70,-50],[-66,-54],[-60,-52],[-56,-38],[-54,-20],[-54,-4],[-60,-4],[-66,-4],[-70,0],[-76,2],[-78,6],[-78,10]]},
  // ── Australia ──────────────────────────────────────────────────────────────
  {c:"#ac8e28",p:[[114,-22],[122,-20],[128,-18],[134,-14],[136,-18],[138,-22],[136,-26],[130,-26],[126,-30],[120,-34],[116,-32],[112,-28],[114,-22]]},
  {c:"#5c6c2e",p:[[138,-18],[140,-18],[144,-18],[148,-20],[152,-24],[152,-30],[148,-36],[142,-38],[136,-38],[132,-32],[128,-30],[126,-30],[130,-26],[136,-26],[138,-22],[136,-18],[138,-18]]},
  // ── Polar ──────────────────────────────────────────────────────────────────
  {c:"#aac2d4",p:[[-44,60],[-36,62],[-24,68],[-18,72],[-22,76],[-30,78],[-42,82],[-52,80],[-58,74],[-54,66],[-44,60]]},
  {c:"#bccede",p:[[-180,-72],[0,-72],[180,-72],[180,-90],[-180,-90],[-180,-72]]},
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

  // ── 01. Space background ───────────────────────────────────────────────────
  ctx.fillStyle='#00000c'; ctx.fillRect(0,0,W,H);

  // ── 02. Stars — calmer, smaller ───────────────────────────────────────────
  for(var si=0;si<STARS.length;si++){
    var st=STARS[si];
    var ot=st.o*(0.86+0.14*Math.sin(vPhase*st.tw+st.tp));
    ctx.beginPath(); ctx.arc(st.x,st.y,st.r,0,TAU);
    ctx.fillStyle='rgba(255,255,255,'+ot+')'; ctx.fill();
  }

  // ── 03. Ocean — 6-stop deep gradient with latitude depth ──────────────────
  var oCX=cx+R*0.28*sdx, oCY=cy+R*0.20*sdy;
  var oG=ctx.createRadialGradient(oCX,oCY,R*0.04,cx,cy,R);
  oG.addColorStop(0.00,'#1a6292');
  oG.addColorStop(0.16,'#124e7a');
  oG.addColorStop(0.38,'#0c3662');
  oG.addColorStop(0.58,'#071c3a');
  oG.addColorStop(0.80,'#040e20');
  oG.addColorStop(1.00,'#020810');
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fillStyle=oG; ctx.fill(); ctx.restore();

  // Latitude depth layer — poles darker, tropics slightly vibrant
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var odG=ctx.createLinearGradient(cx,cy-R,cx,cy+R);
  odG.addColorStop(0.00,'rgba(6,16,50,0.14)');
  odG.addColorStop(0.28,'rgba(6,16,50,0.05)');
  odG.addColorStop(0.50,'rgba(0,28,58,0)');
  odG.addColorStop(0.72,'rgba(6,16,50,0.05)');
  odG.addColorStop(1.00,'rgba(6,16,50,0.14)');
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

    var raw=cp.sun*1.52+0.20;
    var t=Math.pow(Math.max(0,Math.min(1,raw)),0.78);
    t*=(0.93+0.07*phash(i));
    t=Math.max(0.06,t);

    var hex=poly.c;
    var r2=parseInt(hex.slice(1,3),16);
    var g2=parseInt(hex.slice(3,5),16);
    var b2=parseInt(hex.slice(5,7),16);

    // Layer 1: directional gradient (sun→shadow within polygon)
    var tH=Math.min(1.0,t*1.14), tL=Math.max(0.04,t*0.86), pR=R*0.18;
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

  // ── 09. City lights — soft warm glow ──────────────────────────────────────
  var cityBoost=1.0+vSpeak*0.22*(0.5+0.5*Math.sin(vPhase*2.2));
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R-0.5,0,TAU); ctx.clip();
  for(var ci=0;ci<CITIES.length;ci++){
    var city=CITIES[ci], cp2=proj(city[0],city[1]);
    if(cp2.z<0) continue;
    if(cp2.sun>0.15) continue;
    var fade=Math.max(0,Math.min(1,(0.15-cp2.sun)/0.22));
    var br=city[2]*fade*cityBoost;
    if(br<0.06) continue;
    var cr=1.6*br+0.38;
    // Outer bloom — softer and warmer
    var cg1=ctx.createRadialGradient(cp2.x,cp2.y,0,cp2.x,cp2.y,cr*2.8);
    cg1.addColorStop(0.0,'rgba(255,222,135,'+(br*0.24)+')');
    cg1.addColorStop(0.5,'rgba(255,185,68,'+(br*0.10)+')');
    cg1.addColorStop(1.0,'rgba(255,148,40,0)');
    ctx.beginPath(); ctx.arc(cp2.x,cp2.y,cr*2.8,0,TAU); ctx.fillStyle=cg1; ctx.fill();
    // Inner core — bright but not overexposed
    var cg2=ctx.createRadialGradient(cp2.x,cp2.y,0,cp2.x,cp2.y,cr*1.05);
    cg2.addColorStop(0.0,'rgba(255,248,208,'+(br*0.82)+')');
    cg2.addColorStop(0.5,'rgba(255,215,120,'+(br*0.35)+')');
    cg2.addColorStop(1.0,'rgba(255,185,62,0)');
    ctx.beginPath(); ctx.arc(cp2.x,cp2.y,cr*1.05,0,TAU); ctx.fillStyle=cg2; ctx.fill();
  }
  ctx.restore();

  // ── 10. Polar ice glow ────────────────────────────────────────────────────
  var poles=[[0,88],[0,-88]];
  for(var ip=0;ip<poles.length;ip++){
    var pp=proj(poles[ip][0],poles[ip][1]);
    if(pp.z<0) continue;
    var pa=0.25+0.14*Math.max(0,pp.sun);
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
    var pg2=ctx.createRadialGradient(pp.x,pp.y,0,pp.x,pp.y,R*0.25*pp.z);
    pg2.addColorStop(0.0,'rgba(200,228,252,'+(pa*0.78)+')');
    pg2.addColorStop(0.45,'rgba(175,212,245,'+(pa*0.34)+')');
    pg2.addColorStop(1.0,'rgba(148,195,238,0)');
    ctx.beginPath(); ctx.arc(pp.x,pp.y,R*0.25*pp.z,0,TAU);
    ctx.fillStyle=pg2; ctx.fill(); ctx.restore();
  }

  // ── 11. Limb darkening ────────────────────────────────────────────────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R+0.5,0,TAU); ctx.clip();
  var ld=ctx.createRadialGradient(cx,cy,R*0.60,cx,cy,R*1.005);
  ld.addColorStop(0.0,'rgba(0,0,0,0)');
  ld.addColorStop(0.68,'rgba(0,0,0,0.065)');
  ld.addColorStop(0.86,'rgba(0,0,0,0.26)');
  ld.addColorStop(1.0,'rgba(0,0,0,0.60)');
  ctx.fillStyle=ld; ctx.fillRect(cx-R*1.05,cy-R*1.05,R*2.1,R*2.1); ctx.restore();

  // ── 12. Outer atmosphere — Rayleigh ring ──────────────────────────────────
  var ag1=ctx.createRadialGradient(cx,cy,R*0.97,cx,cy,R*1.105);
  ag1.addColorStop(0.00,'rgba(62,140,245,0)');
  ag1.addColorStop(0.14,'rgba(84,156,250,0.38)');
  ag1.addColorStop(0.44,'rgba(56,128,236,0.18)');
  ag1.addColorStop(0.75,'rgba(40,106,220,0.06)');
  ag1.addColorStop(1.00,'rgba(26,80,196,0)');
  fillArc(ag1,R*1.105);

  var ag2=ctx.createRadialGradient(cx,cy,R*1.02,cx,cy,R*1.20);
  ag2.addColorStop(0.0,'rgba(38,104,242,0)');
  ag2.addColorStop(0.3,'rgba(32,94,228,0.036)');
  ag2.addColorStop(1.0,'rgba(16,60,178,0)');
  fillArc(ag2,R*1.20);

  // ── 13. Sun-side limb scatter ─────────────────────────────────────────────
  var slg=ctx.createRadialGradient(sunSX,sunSY,R*0.70,sunSX,sunSY,R*1.16);
  slg.addColorStop(0.0,'rgba(255,255,255,0)');
  slg.addColorStop(0.76,'rgba(222,238,255,0)');
  slg.addColorStop(0.88,'rgba(222,238,255,0.085)');
  slg.addColorStop(1.0,'rgba(255,255,255,0)');
  fillArc(slg,R*1.14);

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

  // LISTENING — cool blue atmosphere shift + single organic wave
  if(vListen>0.008){
    var lisA=vListen*(0.60+0.25*b1+0.15*b3);
    var la=ctx.createRadialGradient(cx,cy,R*0.93,cx,cy,R*1.19);
    la.addColorStop(0.00,'rgba(65,146,254,0)');
    la.addColorStop(0.18,'rgba(86,162,254,'+(lisA*0.165)+')');
    la.addColorStop(0.55,'rgba(55,130,242,'+(lisA*0.065)+')');
    la.addColorStop(1.00,'rgba(36,106,228,0)');
    fillArc(la,R*1.19);
    // Single heartbeat wave — one per ~2.6s, expands and fades
    var wp=(vPhase*0.38)%1;
    var wAlpha=Math.max(0,(1-wp)*(1-wp)*vListen*0.20);
    ctx.beginPath(); ctx.arc(cx,cy,R*(1.04+wp*0.52),0,TAU);
    ctx.strokeStyle='rgba(95,174,254,'+wAlpha+')';
    ctx.lineWidth=0.35+(1-wp)*0.85; ctx.stroke();
  }

  // SPEAKING — warm atmosphere brightens + dual-freq organic pulse
  if(vSpeak>0.008){
    var sp1=0.5+0.5*Math.sin(vPhase*2.55);
    var sp2=0.5+0.5*Math.sin(vPhase*1.65+0.95);
    var spA=vSpeak*(0.46+0.33*sp1+0.21*sp2);
    // Warm corona
    var co=ctx.createRadialGradient(cx,cy,R*0.91,cx,cy,R*1.32);
    co.addColorStop(0.00,'rgba(255,148,34,0)');
    co.addColorStop(0.17,'rgba(255,142,32,'+(0.148*spA)+')');
    co.addColorStop(0.44,'rgba(255,108,18,'+(0.058*spA)+')');
    co.addColorStop(0.78,'rgba(255,66,10,'+(0.016*spA)+')');
    co.addColorStop(1.00,'rgba(255,48,8,0)');
    fillArc(co,R*1.32);
    // Globe interior warms — day side brightens with AI voice
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
    var gw=ctx.createRadialGradient(cx,cy,R*0.68,cx,cy,R);
    gw.addColorStop(0,'rgba(255,138,30,0)');
    gw.addColorStop(0.82,'rgba(255,124,24,'+(0.046*spA)+')');
    gw.addColorStop(1.0,'rgba(255,104,18,'+(0.105*spA)+')');
    ctx.fillStyle=gw; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();
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
