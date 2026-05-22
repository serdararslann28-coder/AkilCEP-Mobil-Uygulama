/**
 * CinematicEarth v7 — real NASA texture via Canvas2D scan-line projection.
 *
 * Surface rendering:
 *   - Equirectangular → orthographic sphere via horizontal scan-line strips
 *   - 96 bands × ≤2 drawImage calls each (~200 calls/frame ≈ 2 ms on mobile)
 *   - Texture: earth_atmos_2048.jpg from unpkg CDN (NASA Blue Marble, ~400 KB)
 *   - While loading: deep-blue ocean placeholder so animation starts instantly
 *   - ctx.filter brightness/saturate applied per-frame for subtle richness
 *
 * Overlay pipeline (Canvas2D, unchanged from v6):
 *   - Step 05: latitude tint (reduced — real texture already has climate zones)
 *   - Steps 06-17: haze, curvature, night/terminator, city lights, polar ice,
 *     aurora, limb darkening, Rayleigh rings, sun scatter, specular, globe edge,
 *     living-Earth voice reactions (idle breath, listening rings, speaking corona)
 *   - Labels: Türkiye / Istanbul / Ankara
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

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

const CITIES_JSON = JSON.stringify(CITIES);

const EARTH_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000008;overflow:hidden}
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

var CITIES = ${CITIES_JSON};

// ── Canvas setup ──────────────────────────────────────────────────────────────
var W  = window.innerWidth  || screen.width  || 375;
var H  = window.innerHeight || screen.height || 812;
var cv = document.getElementById('c');
cv.width = W; cv.height = H;
var ctx = cv.getContext('2d');
if(!ctx) return;
var cx = W*0.5, cy = H*0.46, R = Math.min(W,H)*0.44;

// ── Earth texture — NASA Blue Marble equirectangular 2048×1024 ────────────────
// Loads async; a deep-blue placeholder renders until ready.
var earthImg = null, earthReady = false;
(function(){
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload  = function(){ earthImg = img; earthReady = true; };
  img.onerror = function(){ earthReady = false; };
  img.src = 'https://unpkg.com/three@0.160.0/examples/textures/planets/earth_atmos_2048.jpg';
})();

// ── Scan-line sphere texture renderer ─────────────────────────────────────────
// Projects equirectangular texture onto an orthographic sphere using 96 horizontal
// bands. Each band: one (or two, if wraps dateline) ctx.drawImage call.
// Performance: ~200 drawImage calls / frame ≈ 2 ms on mobile.
var NBANDS = 96;

function drawTextureSphere(img){
  var texW = img.naturalWidth  || 2048;
  var texH = img.naturalHeight || 1024;
  var invBands = 1 / NBANDS;
  var rowH     = texH * invBands;

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();

  // Subtle brightness / saturation lift so the NASA photo reads well over the
  // cinematic dark background.
  try { ctx.filter = 'brightness(1.06) saturate(1.12) contrast(1.04)'; } catch(e){}

  for(var ib = 0; ib < NBANDS; ib++){
    var t0  = ib * invBands;
    var t1  = (ib + 1) * invBands;
    var yTop = cy - R + t0 * 2 * R;
    var yBot = cy - R + t1 * 2 * R + 0.5;  // 0.5 px overlap prevents hairline gaps
    var yMid = (yTop + yBot) * 0.5;
    var yRel = yMid - cy;

    if(Math.abs(yRel) >= R * 0.9998) continue;

    var lat   = Math.asin(yRel / R);                 // latitude at row centre
    var chord = 2 * R * Math.cos(lat);               // visible width at this lat
    if(chord < 1) continue;

    // Equirectangular: latitude maps linearly top→bottom (north→south)
    var texY  = (0.5 - lat / Math.PI) * texH;
    var scrX  = cx - chord * 0.5;
    var bandH = yBot - yTop;

    // Visible hemisphere: longitude range [rot−90°, rot+90°]
    // Mapped to texture x: texXStart … texXStart + texW/2
    var lonStart  = ((rot - 90) % 360 + 360) % 360;
    var texXStart = lonStart / 360 * texW;
    var texXW     = texW * 0.5;   // 180° = half the texture

    if(texXStart + texXW <= texW){
      // No dateline wrap — single drawImage
      ctx.drawImage(img, texXStart, texY, texXW, rowH, scrX, yTop, chord, bandH);
    } else {
      // Wrap: two pieces either side of the dateline
      var w1  = texW - texXStart;
      var w2  = texXW - w1;
      var sw1 = chord * w1 / texXW;
      ctx.drawImage(img, texXStart, texY, w1, rowH, scrX,       yTop, sw1,        bandH);
      ctx.drawImage(img, 0,          texY, w2, rowH, scrX + sw1, yTop, chord - sw1, bandH);
    }
  }

  try { ctx.filter = 'none'; } catch(e){}
  ctx.restore();
}

// ── Seeded starfield ──────────────────────────────────────────────────────────
var STARS=[];
(function(){
  var s=0xDEADBEEF;
  function rn(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }
  for(var i=0;i<320;i++){
    var t=rn();
    var r=t<0.62?0.10+rn()*0.14:t<0.88?0.22+rn()*0.18:t<0.97?0.40+rn()*0.18:0.58+rn()*0.20;
    STARS.push({x:rn()*W,y:rn()*H,r:r,o:0.10+rn()*0.54,tw:0.30+rn()*1.0,tp:rn()*6.28,
                 dx:(rn()-0.5)*0.22,dy:(rn()-0.5)*0.14});
  }
})();

// ── State ─────────────────────────────────────────────────────────────────────
var rot=28, SPEED=3.6, vState='idle', vPhase=0, dt=0, lastT=-1;
var vListen=0, vSpeak=0, vIdle=1;

// ── Spherical projection ──────────────────────────────────────────────────────
var SUN_LON=-30, SUN_LAT=22;
var sunLatR=SUN_LAT*Math.PI/180, sunLonR=SUN_LON*Math.PI/180;
var SX=Math.cos(sunLatR)*Math.cos(sunLonR);
var SY=Math.sin(sunLatR);
var SZ=Math.cos(sunLatR)*Math.sin(sunLonR);

function proj(lon,lat){
  var dlonR=(lon-rot)*Math.PI/180, latR=lat*Math.PI/180;
  var cLat=Math.cos(latR), sLat=Math.sin(latR);
  var lonR=lon*Math.PI/180;
  var nx=Math.cos(lonR)*cLat, ny=sLat, nz=Math.sin(lonR)*cLat;
  return{x:cx+R*Math.sin(dlonR)*cLat, y:cy-R*sLat, z:Math.cos(dlonR)*cLat,
         sun:nx*SX+ny*SY+nz*SZ};
}

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
  ctx.fillStyle='#000008'; ctx.fillRect(0,0,W,H);
  var bgG=ctx.createRadialGradient(cx,cy,R*1.4,cx,cy,Math.max(W,H));
  bgG.addColorStop(0,'rgba(10,18,52,0.28)');
  bgG.addColorStop(1,'rgba(0,0,6,0)');
  ctx.fillStyle=bgG; ctx.fillRect(0,0,W,H);

  // ── 02. Stars — drift + twinkle ───────────────────────────────────────────
  for(var si=0;si<STARS.length;si++){
    var st=STARS[si];
    // Slow positional drift: max ±0.22 px/s — imperceptible per frame, living over time
    if(dt>0){ st.x+=st.dx*dt; if(st.x<0)st.x+=W; if(st.x>W)st.x-=W;
               st.y+=st.dy*dt; if(st.y<0)st.y+=H; if(st.y>H)st.y-=H; }
    var ot=st.o*(0.86+0.14*Math.sin(vPhase*st.tw+st.tp));
    ctx.beginPath(); ctx.arc(st.x,st.y,st.r,0,TAU);
    ctx.fillStyle='rgba(255,255,255,'+ot+')'; ctx.fill();
  }

  // ── 03. Earth surface ──────────────────────────────────────────────────────
  // Real NASA texture when loaded; deep-blue gradient placeholder while loading.
  if(earthReady && earthImg){
    drawTextureSphere(earthImg);
  } else {
    // Placeholder: deep cinematic ocean blue so the globe is visible immediately
    var oCX=cx+R*0.32*sdx, oCY=cy+R*0.22*sdy;
    var oG=ctx.createRadialGradient(oCX,oCY,R*0.03,cx,cy,R);
    oG.addColorStop(0.00,'#2882bc');
    oG.addColorStop(0.32,'#0e4878');
    oG.addColorStop(0.72,'#040e26');
    oG.addColorStop(1.00,'#020810');
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fillStyle=oG; ctx.fill(); ctx.restore();
  }

  // ── 04. Sphere diffuse shading — makes flat texture read as a 3-D sphere ──
  // A sun-centred radial multiply lifts the lit hemisphere and darkens the edge,
  // complementing the night hemisphere (step 08) that handles the dark side.
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var dfG=ctx.createRadialGradient(cx+R*0.28*sdx,cy+R*0.20*sdy,0,cx,cy,R);
  dfG.addColorStop(0.00,'rgba(255,252,235,0.12)');  // warm sun centre
  dfG.addColorStop(0.35,'rgba(255,248,225,0.04)');
  dfG.addColorStop(0.68,'rgba(0,0,0,0)');
  dfG.addColorStop(1.00,'rgba(0,0,0,0.18)');        // edge darkening
  ctx.fillStyle=dfG; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 05. Latitude tint — very subtle; real texture already has climate zones ─
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var latG=ctx.createLinearGradient(cx,cy-R,cx,cy+R);
  latG.addColorStop(0.00,'rgba(118,152,208,0.022)');
  latG.addColorStop(0.46,'rgba(36,92,36,0.010)');
  latG.addColorStop(0.54,'rgba(36,92,36,0.010)');
  latG.addColorStop(1.00,'rgba(118,152,208,0.022)');
  ctx.fillStyle=latG; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 06. Inner atmosphere haze ─────────────────────────────────────────────
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R+0.5,0,TAU); ctx.clip();
  var ih=ctx.createRadialGradient(cx,cy,R*0.83,cx,cy,R*1.005);
  ih.addColorStop(0.0,'rgba(14,44,122,0)');
  ih.addColorStop(0.6,'rgba(20,52,148,0.040)');
  ih.addColorStop(1.0,'rgba(28,66,178,0.16)');
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
  tg.addColorStop(0.52,'rgba(34,16,6,0.50)');
  tg.addColorStop(0.58,'rgba(62,28,6,0.26)');
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
    // Golden-angle phase offset per city so each light flickers independently
    var cityFlk=1.0+0.038*Math.sin(vPhase*2.62+ci*2.3999);
    var br=city[2]*fade*cityBoost*cityFlk;
    if(br<0.05) continue;
    var cr=1.5*br+0.36;
    var cg0=ctx.createRadialGradient(cp2.x,cp2.y,0,cp2.x,cp2.y,cr*4.2);
    cg0.addColorStop(0.0,'rgba(255,195,80,'+(br*0.11)+')');
    cg0.addColorStop(0.55,'rgba(255,158,50,'+(br*0.042)+')');
    cg0.addColorStop(1.0,'rgba(255,120,28,0)');
    ctx.beginPath(); ctx.arc(cp2.x,cp2.y,cr*4.2,0,TAU); ctx.fillStyle=cg0; ctx.fill();
    var cg1=ctx.createRadialGradient(cp2.x,cp2.y,0,cp2.x,cp2.y,cr*2.4);
    cg1.addColorStop(0.0,'rgba(255,228,148,'+(br*0.28)+')');
    cg1.addColorStop(0.5,'rgba(255,198,90,'+(br*0.12)+')');
    cg1.addColorStop(1.0,'rgba(255,165,52,0)');
    ctx.beginPath(); ctx.arc(cp2.x,cp2.y,cr*2.4,0,TAU); ctx.fillStyle=cg1; ctx.fill();
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
  var auroraData=[
    {lon:0,   lat:72, col:[68,225,128]},
    {lon:55,  lat:68, col:[52,185,218]},
    {lon:-55, lat:70, col:[148,105,228]},
  ];
  for(var ai=0;ai<auroraData.length;ai++){
    var ad=auroraData[ai];
    var ap=proj(ad.lon,ad.lat);
    if(ap.z<0.04) continue;
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
  ld.addColorStop(0.68,'rgba(0,0,0,0.045)');
  ld.addColorStop(0.86,'rgba(0,0,0,0.20)');
  ld.addColorStop(1.0,'rgba(0,0,0,0.48)');
  ctx.fillStyle=ld; ctx.fillRect(cx-R*1.05,cy-R*1.05,R*2.1,R*2.1); ctx.restore();

  // ── 12. Outer atmosphere — layered Rayleigh ring (breathing) ────────────────
  // Multi-frequency opacity oscillation gives a gentle inhale/exhale feel.
  var atmBreath=0.88+0.10*Math.sin(vPhase*1.10)+0.05*Math.sin(vPhase*0.44+1.2);
  ctx.save(); ctx.globalAlpha=atmBreath;
  var ag1=ctx.createRadialGradient(cx,cy,R*0.972,cx,cy,R*1.108);
  ag1.addColorStop(0.00,'rgba(58,132,244,0)');
  ag1.addColorStop(0.12,'rgba(98,172,255,0.50)');
  ag1.addColorStop(0.38,'rgba(64,140,244,0.24)');
  ag1.addColorStop(0.72,'rgba(44,112,226,0.08)');
  ag1.addColorStop(1.00,'rgba(28,84,200,0)');
  fillArc(ag1,R*1.108);

  var ag2=ctx.createRadialGradient(cx,cy,R*1.01,cx,cy,R*1.22);
  ag2.addColorStop(0.00,'rgba(44,112,246,0)');
  ag2.addColorStop(0.28,'rgba(36,98,232,0.052)');
  ag2.addColorStop(0.70,'rgba(24,74,210,0.018)');
  ag2.addColorStop(1.00,'rgba(14,56,184,0)');
  fillArc(ag2,R*1.22);

  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R+1,0,TAU); ctx.clip();
  var ag3=ctx.createRadialGradient(cx,cy,R*0.88,cx,cy,R*1.002);
  ag3.addColorStop(0.0,'rgba(30,88,200,0)');
  ag3.addColorStop(0.75,'rgba(44,112,230,0.055)');
  ag3.addColorStop(1.0,'rgba(62,138,250,0.18)');
  ctx.fillStyle=ag3; ctx.fillRect(cx-R*1.05,cy-R*1.05,R*2.1,R*2.1); ctx.restore();
  ctx.restore(); // end atmBreath globalAlpha

  // ── 13. Sun-side limb scatter ─────────────────────────────────────────────
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

  // ── 15b. Ambient energy pulse — always-on living-world ring ──────────────
  // Cycles every 7 s; near-invisible but gives the globe a heartbeat.
  var ambP=(vPhase*0.143)%1;
  var ambA=Math.max(0,Math.pow(1-ambP,2.8)*0.028);
  ctx.beginPath(); ctx.arc(cx,cy,R*(1.008+ambP*0.38),0,TAU);
  ctx.strokeStyle='rgba(72,124,218,'+ambA+')';
  ctx.lineWidth=0.4+(1-ambP)*0.7; ctx.stroke();

  // ── 15c. Surface shimmer sweep — warm light crossing every 22 s ──────────
  var shimT=(vPhase*0.0454)%1;
  var shimX=cx-R+shimT*R*2;
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
  var shimG=ctx.createLinearGradient(shimX-R*0.25,cy,shimX+R*0.25,cy);
  shimG.addColorStop(0,'rgba(255,255,240,0)');
  shimG.addColorStop(0.5,'rgba(255,255,240,0.011)');
  shimG.addColorStop(1,'rgba(255,255,240,0)');
  ctx.fillStyle=shimG; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

  // ── 16. Living Earth — organic emotional states ───────────────────────────
  var b1=0.5+0.5*Math.sin(vPhase*1.38);
  var b2=0.5+0.5*Math.sin(vPhase*0.48);
  var b3=0.5+0.5*Math.sin(vPhase*3.60);

  if(vIdle>0.008){
    var idleA=vIdle*(0.52+0.28*b1+0.20*b2);
    var ba=ctx.createRadialGradient(cx,cy,R*0.97,cx,cy,R*1.135);
    ba.addColorStop(0.0,'rgba(40,92,196,0)');
    ba.addColorStop(0.38,'rgba(44,100,202,'+(0.034*idleA)+')');
    ba.addColorStop(0.72,'rgba(28,72,168,'+(0.012*idleA)+')');
    ba.addColorStop(1.0,'rgba(20,58,148,0)');
    fillArc(ba,R*1.135);
  }

  if(vListen>0.008){
    var lisA=vListen*(0.60+0.25*b1+0.15*b3);
    var la=ctx.createRadialGradient(cx,cy,R*0.92,cx,cy,R*1.22);
    la.addColorStop(0.00,'rgba(65,148,255,0)');
    la.addColorStop(0.15,'rgba(90,168,255,'+(lisA*0.18)+')');
    la.addColorStop(0.50,'rgba(58,134,244,'+(lisA*0.072)+')');
    la.addColorStop(0.82,'rgba(38,108,230,'+(lisA*0.022)+')');
    la.addColorStop(1.00,'rgba(30,88,210,0)');
    fillArc(la,R*1.22);
    var wp1=(vPhase*0.385)%1;
    var wA1=Math.max(0,Math.pow(1-wp1,1.8)*vListen*0.22);
    ctx.beginPath(); ctx.arc(cx,cy,R*(1.035+wp1*0.55),0,TAU);
    ctx.strokeStyle='rgba(100,178,255,'+wA1+')';
    ctx.lineWidth=0.30+(1-wp1)*1.0; ctx.stroke();
    var wp2=((vPhase*0.385)+0.5)%1;
    var wA2=Math.max(0,Math.pow(1-wp2,1.8)*vListen*0.14);
    ctx.beginPath(); ctx.arc(cx,cy,R*(1.035+wp2*0.55),0,TAU);
    ctx.strokeStyle='rgba(80,158,248,'+wA2+')';
    ctx.lineWidth=0.22+(1-wp2)*0.65; ctx.stroke();
  }

  if(vSpeak>0.008){
    var sp1=0.5+0.5*Math.sin(vPhase*2.55);
    var sp2=0.5+0.5*Math.sin(vPhase*1.65+0.95);
    var spA=vSpeak*(0.46+0.33*sp1+0.21*sp2);
    var co=ctx.createRadialGradient(cx,cy,R*0.90,cx,cy,R*1.35);
    co.addColorStop(0.00,'rgba(255,158,42,0)');
    co.addColorStop(0.14,'rgba(255,148,36,'+(0.16*spA)+')');
    co.addColorStop(0.38,'rgba(255,118,22,'+(0.064*spA)+')');
    co.addColorStop(0.70,'rgba(255,76,12,'+(0.020*spA)+')');
    co.addColorStop(1.00,'rgba(255,52,8,0)');
    fillArc(co,R*1.35);
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();
    var gw=ctx.createRadialGradient(cx,cy,R*0.60,cx,cy,R);
    gw.addColorStop(0,'rgba(255,148,36,0)');
    gw.addColorStop(0.78,'rgba(255,130,28,'+(0.052*spA)+')');
    gw.addColorStop(1.0,'rgba(255,108,18,'+(0.115*spA)+')');
    ctx.fillStyle=gw; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();
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
