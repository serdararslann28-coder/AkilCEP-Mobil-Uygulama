/**
 * CinematicEarth — stable mobile-first Earth for Voyage Mode.
 *
 * Stability choices:
 *  • View-space normals (no modelMatrix multiply in GLSL — simpler, faster, universal)
 *  • Sun direction pre-converted to view space once in JS (never changes: camera is static)
 *  • Single atmosphere pass (one draw call, additive blending)
 *  • All textures procedural Canvas2D — zero network requests
 *  • MeshPhongMaterial for clouds (Three.js built-in, never breaks)
 *  • antialias:false, precision:mediump, powerPreference:default
 *  • Shaders in JSON (no nested backtick escaping, Metro-safe)
 */
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── Shaders (string-array approach: zero backtick nesting) ───────────────────

// View-space normals: normalMatrix transforms object→view space each frame,
// so day/night terminator rotates correctly as Earth spins — no extra uniforms needed.
const EARTH_VERT = [
  "precision mediump float;",
  "varying vec2  vUv;",
  "varying vec3  vVN;",
  "void main(){",
  "  vVN = normalize(normalMatrix * normal);",
  "  vUv = uv;",
  "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);",
  "}",
].join("\n");

const EARTH_FRAG = [
  "precision mediump float;",
  "uniform sampler2D uDay;",
  "uniform sampler2D uNight;",
  "uniform vec3  uLight;",   // sun direction in view space (pre-computed, static)
  "uniform float uGlow;",
  "varying vec2  vUv;",
  "varying vec3  vVN;",
  "void main(){",
  "  vec3  N  = normalize(vVN);",
  "  float d  = dot(N, normalize(uLight));",
  "  float t  = smoothstep(-0.18, 0.28, d);",
  // Day: diffuse shading
  "  vec3 dayC = texture2D(uDay, vUv).rgb * (0.07 + 0.93 * max(0.0, d));",
  // Subtle blue rim on day side
  "  float rim = pow(1.0 - max(0.0, N.z), 4.0);",
  "  dayC += vec3(0.12, 0.32, 0.9) * rim * t * 0.38;",
  // Warm twilight band
  "  float twi = smoothstep(-0.18, 0.0, d) * (1.0 - smoothstep(0.0, 0.28, d));",
  "  dayC += vec3(0.88, 0.44, 0.07) * twi * 0.32;",
  // Night: city lights, visible only in shadow
  "  vec3 ngtC = texture2D(uNight, vUv).rgb * 1.55 * (1.0 - t);",
  "  gl_FragColor = vec4((dayC * t + ngtC) * uGlow, 1.0);",
  "}",
].join("\n");

// Atmosphere: rim glow, additive blending over Earth
const ATMOS_VERT = [
  "precision mediump float;",
  "varying float vRim;",
  "void main(){",
  "  vec3 n = normalize(normalMatrix * normal);",
  // n.z ≈ 1 = facing camera → rim = 0. n.z ≈ 0 = edge → rim = 1.
  "  vRim = pow(1.0 - max(0.0, n.z), 5.0);",
  "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);",
  "}",
].join("\n");

const ATMOS_FRAG = [
  "precision mediump float;",
  "varying float vRim;",
  "void main(){",
  "  gl_FragColor = vec4(0.18, 0.44, 1.0, vRim * 0.62);",
  "}",
].join("\n");

// ─── Build HTML ───────────────────────────────────────────────────────────────

const EARTH_HTML = (() => {
  const S = JSON.stringify({ ev: EARTH_VERT, ef: EARTH_FRAG, av: ATMOS_VERT, af: ATMOS_FRAG });

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
  font-size:9px;letter-spacing:3px;font-weight:600;text-transform:uppercase;
  white-space:nowrap;color:rgba(200,225,255,0.9);
  text-shadow:0 0 10px rgba(120,180,255,0.85),0 0 20px rgba(80,140,255,0.35);
  transform:translate(-50%,-150%);transition:opacity 0.7s;
}
.lb.big{font-size:11px;letter-spacing:4px}
.dt{
  position:absolute;width:4px;height:4px;border-radius:50%;
  background:rgba(205,228,255,0.95);transform:translate(-50%,-50%);
  box-shadow:0 0 7px 2px rgba(160,210,255,0.6);transition:opacity 0.7s;
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

// ── Texture sizes (power-of-2 for mipmaps) ─────────────────────────────────
var DW=512,DH=256;   // day + water
var NW=256,NH=128;   // night (smaller = less VRAM)
var CW=256,CH=128;   // clouds

// ── Canvas helpers ─────────────────────────────────────────────────────────
function xy(lon, lat, w, h){
  return { x:(lon+180)/360*w, y:(90-lat)/180*h };
}
function poly(ctx, pts, col, w, h){
  if(!pts||pts.length<3)return;
  var p0=xy(pts[0][0],pts[0][1],w,h);
  ctx.beginPath(); ctx.moveTo(p0.x,p0.y);
  for(var i=1;i<pts.length;i++){var p=xy(pts[i][0],pts[i][1],w,h);ctx.lineTo(p.x,p.y);}
  ctx.closePath(); ctx.fillStyle=col; ctx.fill();
}

// ── Continent polygons ─────────────────────────────────────────────────────
// 22 shapes: realistic but lean. Key requirement: Europe, Africa, Asia, Turkey clearly visible.
var LAND=[
  // Africa
  {c:'#3d7040',p:[[-18,16],[-15,10],[-8,5],[-2,2],[8,0],[12,-5],[15,-12],[18,-18],[20,-24],[24,-28],[28,-30],[32,-26],[36,-20],[40,-12],[46,-8],[50,11],[46,12],[44,8],[42,12],[40,16],[38,22],[34,26],[28,30],[20,33],[15,37],[8,38],[0,37],[-5,35],[-14,35],[-18,35],[-18,16]]},
  // Sahara overlay
  {c:'#c0a050',p:[[-18,16],[-15,22],[-10,27],[-5,30],[0,30],[8,26],[15,24],[18,22],[20,18],[18,14],[10,14],[4,18],[-4,20],[-10,20],[-15,20],[-18,16]]},
  // Europe (mainland + Scandinavia)
  {c:'#4a7a38',p:[[-10,36],[0,37],[10,38],[20,37],[28,37],[30,42],[36,42],[32,48],[35,54],[28,62],[20,60],[18,72],[8,70],[0,68],[-5,60],[-8,54],[-5,50],[-10,44],[-10,36]]},
  // British Isles
  {c:'#4a7a38',p:[[-6,50],[-5,58],[-3,60],[0,61],[2,51],[-6,50]]},
  // Iceland
  {c:'#8ab0a0',p:[[-24,64],[-14,64],[-14,66],[-18,66],[-24,66],[-24,64]]},
  // Russia + Siberia
  {c:'#3a6830',p:[[30,50],[40,58],[60,60],[80,62],[100,66],[120,68],[140,70],[160,62],[168,58],[165,54],[155,50],[140,46],[130,42],[120,40],[100,46],[80,52],[60,56],[40,58],[30,55],[30,50]]},
  // Turkey + Caucasus + Iran + Central Asia
  {c:'#5a7838',p:[[26,36],[30,40],[36,42],[44,40],[50,38],[56,34],[62,28],[68,24],[72,22],[70,28],[60,28],[54,36],[48,38],[42,40],[36,42],[30,40],[26,36]]},
  // Arabian Peninsula
  {c:'#c0a050',p:[[36,30],[44,30],[52,24],[58,22],[56,14],[50,14],[44,12],[42,12],[40,16],[36,22],[36,30]]},
  // India
  {c:'#4a7838',p:[[60,28],[66,26],[70,24],[72,22],[76,8],[80,8],[82,10],[86,12],[88,22],[86,26],[80,28],[74,28],[68,28],[60,28]]},
  // Thar Desert
  {c:'#c0a050',p:[[68,28],[72,28],[72,24],[68,24],[66,26],[68,28]]},
  // SE Asia + Indochina
  {c:'#3a7030',p:[[98,22],[102,22],[106,20],[110,18],[114,10],[116,4],[104,2],[100,2],[98,8],[98,16],[98,22]]},
  // East Asia (China + Korea)
  {c:'#3d7040',p:[[75,40],[80,44],[88,44],[100,50],[110,48],[120,52],[128,50],[130,44],[128,38],[124,32],[120,26],[114,18],[110,16],[106,18],[100,18],[96,22],[88,24],[80,30],[76,34],[75,40]]},
  // Gobi Desert
  {c:'#b09048',p:[[90,44],[100,50],[110,48],[118,46],[114,38],[108,38],[100,40],[90,44]]},
  // Japan
  {c:'#4a7838',p:[[131,32],[133,34],[136,36],[138,40],[141,42],[141,44],[137,46],[134,44],[130,40],[130,36],[131,32]]},
  // North America
  {c:'#3d7040',p:[[-168,72],[-140,70],[-110,70],[-80,75],[-60,64],[-55,50],[-64,44],[-76,42],[-80,38],[-84,30],[-88,28],[-95,22],[-90,16],[-85,12],[-82,8],[-78,10],[-80,14],[-88,16],[-95,18],[-104,22],[-110,28],[-118,34],[-122,38],[-124,46],[-132,54],[-140,56],[-152,58],[-165,64],[-168,72]]},
  // Rocky Mountains
  {c:'#7a6a52',p:[[-110,48],[-104,40],[-110,34],[-118,36],[-120,44],[-110,48]]},
  // South America
  {c:'#3d7040',p:[[-80,12],[-70,12],[-62,10],[-52,4],[-50,0],[-48,-5],[-42,-10],[-36,-10],[-36,-14],[-40,-18],[-44,-22],[-46,-28],[-52,-32],[-56,-36],[-62,-40],[-66,-48],[-70,-54],[-72,-56],[-70,-52],[-68,-44],[-70,-38],[-68,-30],[-70,-22],[-68,-14],[-72,-10],[-80,0],[-80,10],[-80,12]]},
  // Amazon
  {c:'#1e6028',p:[[-70,6],[-60,6],[-50,4],[-48,-2],[-52,-8],[-62,-12],[-70,-4],[-70,6]]},
  // Andes strip
  {c:'#7a6a52',p:[[-76,4],[-70,-4],[-68,-14],[-70,-22],[-68,-30],[-70,-38],[-72,-44],[-72,-34],[-70,-26],[-72,-18],[-72,-10],[-74,-4],[-76,4]]},
  // Australia
  {c:'#8a7848',p:[[114,-22],[118,-20],[122,-18],[126,-14],[130,-12],[136,-12],[138,-14],[142,-14],[146,-18],[150,-22],[152,-26],[152,-30],[150,-34],[146,-38],[142,-38],[138,-36],[134,-36],[128,-34],[122,-34],[116,-30],[112,-24],[112,-22],[114,-22]]},
  // Australia east coast green
  {c:'#5a7838',p:[[148,-22],[152,-26],[152,-30],[150,-34],[148,-38],[144,-36],[140,-34],[140,-14],[142,-14],[146,-18],[148,-22]]},
  // Greenland
  {c:'#c8d8e8',p:[[-40,82],[-20,82],[-20,76],[-26,68],[-34,64],[-50,64],[-56,70],[-62,74],[-60,80],[-40,82]]},
  // Antarctica
  {c:'#d0dff2',p:[[-180,-72],[-140,-70],[-100,-72],[-60,-74],[-20,-72],[20,-70],[60,-74],[100,-70],[140,-72],[180,-72],[180,-90],[-180,-90],[-180,-72]]},
];

// ── City lights [lon, lat, brightness] ────────────────────────────────────
var CITIES=[
  [29.0,41.0,1.0],[32.9,39.9,0.9],              // Istanbul ★ Ankara ★
  [-0.1,51.5,0.9],[2.3,48.9,0.9],[13.4,52.5,0.85],[12.5,41.9,0.8],[4.9,52.4,0.8],
  [18.1,59.3,0.7],[14.4,50.1,0.8],[16.4,48.2,0.8],[23.7,37.9,0.8],
  [10.0,53.6,0.7],[2.2,41.4,0.8],[-3.7,40.4,0.85],[24.9,60.2,0.7],[21.0,52.2,0.8],
  [26.1,44.4,0.8],[37.6,55.7,1.0],[30.3,59.9,0.9],[49.1,55.8,0.75],
  [35.2,31.8,0.8],[44.4,33.3,0.8],[51.5,25.3,0.9],[55.3,25.3,0.9],[46.7,24.7,0.9],[31.2,30.1,0.9],
  [77.2,28.6,1.0],[72.9,19.1,1.0],[80.3,13.1,0.9],[88.4,22.6,1.0],[77.6,12.9,0.9],
  [67.0,24.9,0.85],[74.3,31.5,0.85],[73.1,33.7,0.8],
  [116.4,39.9,1.0],[121.5,31.2,1.0],[113.3,23.1,1.0],[114.1,22.5,0.9],
  [106.8,10.8,0.9],[103.8,1.4,0.9],[100.5,13.8,0.9],
  [139.7,35.7,1.0],[135.5,34.7,0.9],[126.9,37.5,0.9],[121.6,25.0,0.9],
  [36.8,-1.3,0.8],[18.6,-33.9,0.8],[28.0,-26.2,0.9],[38.7,9.0,0.8],[7.5,9.1,0.8],
  [-74.0,40.7,1.0],[-87.6,41.8,1.0],[-118.2,34.1,1.0],[-122.4,37.8,0.9],
  [-75.1,39.9,0.9],[-80.2,25.8,0.9],[-77.0,38.9,0.9],[-99.1,19.4,1.0],
  [-43.2,-22.9,1.0],[-46.6,-23.5,1.0],[-58.4,-34.6,0.9],[-70.7,-33.5,0.85],
  [151.2,-33.9,0.9],[144.9,-37.8,0.9],[153.0,-27.5,0.8],
];

// ── Noise for clouds ───────────────────────────────────────────────────────
function nh(x,y){var s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}
function ni(x,y){
  var ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  var ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  return nh(ix,iy)*(1-ux)*(1-uy)+nh(ix+1,iy)*ux*(1-uy)+nh(ix,iy+1)*(1-ux)*uy+nh(ix+1,iy+1)*ux*uy;
}
function fbm(x,y){return 0.5*ni(x,y)+0.25*ni(x*2,y*2)+0.125*ni(x*4,y*4)+0.0625*ni(x*8,y*8);}

// ── Texture generators ─────────────────────────────────────────────────────
function makeDayTex(){
  var cv=document.createElement('canvas');cv.width=DW;cv.height=DH;
  var ctx=cv.getContext('2d');
  // Ocean
  var g=ctx.createLinearGradient(0,0,0,DH);
  g.addColorStop(0.0,'#071626');g.addColorStop(0.15,'#0c2542');
  g.addColorStop(0.5,'#163d5e');g.addColorStop(0.85,'#0c2542');g.addColorStop(1.0,'#071626');
  ctx.fillStyle=g;ctx.fillRect(0,0,DW,DH);
  // Tropical ocean lightening
  var g2=ctx.createLinearGradient(0,DH*0.3,0,DH*0.7);
  g2.addColorStop(0,'rgba(28,72,120,0)');g2.addColorStop(0.5,'rgba(28,72,120,0.16)');g2.addColorStop(1,'rgba(28,72,120,0)');
  ctx.fillStyle=g2;ctx.fillRect(0,0,DW,DH);
  // Land
  LAND.forEach(function(L){poly(ctx,L.p,L.c,DW,DH);});
  // Polar ice
  var pg=ctx.createRadialGradient(DW/2,0,0,DW/2,0,DH*0.13);
  pg.addColorStop(0,'rgba(218,232,246,1)');pg.addColorStop(1,'rgba(218,232,246,0)');
  ctx.fillStyle=pg;ctx.fillRect(0,0,DW,DH*0.15);
  return new THREE.CanvasTexture(cv);
}

function makeNightTex(){
  var cv=document.createElement('canvas');cv.width=NW;cv.height=NH;
  var ctx=cv.getContext('2d');
  ctx.fillStyle='#000';ctx.fillRect(0,0,NW,NH);
  CITIES.forEach(function(c){
    var p=xy(c[0],c[1],NW,NH);
    var br=c[2],r=2.5*br;
    var grd=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*3);
    grd.addColorStop(0,'rgba(255,240,160,'+(br*0.95)+')');
    grd.addColorStop(0.3,'rgba(255,215,120,'+(br*0.45)+')');
    grd.addColorStop(0.7,'rgba(255,195,90,'+(br*0.12)+')');
    grd.addColorStop(1,'rgba(255,175,70,0)');
    ctx.fillStyle=grd;ctx.beginPath();ctx.arc(p.x,p.y,r*3,0,Math.PI*2);ctx.fill();
  });
  return new THREE.CanvasTexture(cv);
}

function makeCloudTex(){
  var cv=document.createElement('canvas');cv.width=CW;cv.height=CH;
  var ctx=cv.getContext('2d');
  var id=ctx.createImageData(CW,CH);
  for(var yy=0;yy<CH;yy++){
    var lat=(0.5-yy/CH)*180;
    var pf=Math.cos(lat*Math.PI/180);
    for(var xx=0;xx<CW;xx++){
      var v=fbm(xx/CW*9,yy/CH*4.5);
      var a=Math.max(0,(v-0.50)*3.8*pf);
      var i=(yy*CW+xx)*4;
      id.data[i]=255;id.data[i+1]=255;id.data[i+2]=255;
      id.data[i+3]=Math.min(255,Math.round(a*195));
    }
  }
  ctx.putImageData(id,0,0);
  return new THREE.CanvasTexture(cv);
}

// ── Renderer ───────────────────────────────────────────────────────────────
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

// ── Scene / Camera ─────────────────────────────────────────────────────────
var scene=new THREE.Scene();
var camera=new THREE.PerspectiveCamera(42,window.innerWidth/window.innerHeight,0.01,200);
camera.position.set(0,0.1,2.7);
camera.updateMatrixWorld();

// ── Stars ──────────────────────────────────────────────────────────────────
(function(){
  var N=1800,pos=new Float32Array(N*3);
  for(var i=0;i<N;i++){
    var r=55+Math.random()*40,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);
    pos[i*3]=r*Math.sin(ph)*Math.cos(th);pos[i*3+1]=r*Math.sin(ph)*Math.sin(th);pos[i*3+2]=r*Math.cos(ph);
  }
  var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(geo,new THREE.PointsMaterial({color:0xffffff,size:0.07,sizeAttenuation:true,transparent:true,opacity:0.8})));
})();

// ── Sun direction → view space (computed once, camera is static) ───────────
var sunWorld=new THREE.Vector3(1.5,0.5,1.0).normalize();
var sunView=sunWorld.clone().transformDirection(camera.matrixWorldInverse);

// ── Lighting for clouds (MeshPhongMaterial needs lights) ──────────────────
var sunLight=new THREE.DirectionalLight(0xfff8e8,1.6);
sunLight.position.set(1.5,0.5,1.0);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x0a1828,0.55));

// ── Voice glow ─────────────────────────────────────────────────────────────
var tGlow=1.0,cGlow=1.0;
window.onVoiceState=function(s){
  tGlow=s==='speaking'?1.4:s==='listening'?1.12:1.0;
};

// ── Earth group ────────────────────────────────────────────────────────────
var earthGroup=new THREE.Group();
scene.add(earthGroup);
var earthMat=null,cloudMesh=null;

// Earth surface
earthMat=new THREE.ShaderMaterial({
  uniforms:{
    uDay:  {value:makeDayTex()},
    uNight:{value:makeNightTex()},
    uLight:{value:sunView},
    uGlow: {value:1.0}
  },
  vertexShader:S.ev, fragmentShader:S.ef
});
earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1,52,52),earthMat));

// Cloud layer — MeshPhongMaterial is Three.js built-in → always works
cloudMesh=new THREE.Mesh(
  new THREE.SphereGeometry(1.012,38,38),
  new THREE.MeshPhongMaterial({
    map:makeCloudTex(),transparent:true,opacity:0.36,
    depthWrite:false,blending:THREE.NormalBlending,shininess:0
  })
);
earthGroup.add(cloudMesh);

// ── Atmosphere (single pass, additive) ────────────────────────────────────
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1.06,44,44),
  new THREE.ShaderMaterial({
    uniforms:{},
    vertexShader:S.av, fragmentShader:S.af,
    side:THREE.FrontSide,blending:THREE.AdditiveBlending,
    transparent:true,depthWrite:false
  })
));

// Outer halo (back-side rendered, wider glow)
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1.22,32,32),
  new THREE.ShaderMaterial({
    uniforms:{},
    vertexShader:[
      'precision mediump float;',
      'varying float vRim;',
      'void main(){',
      '  vec3 n=normalize(normalMatrix*normal);',
      '  vRim=pow(0.52-max(0.0,n.z),5.0);',
      '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
      '}'
    ].join('\n'),
    fragmentShader:[
      'precision mediump float;',
      'varying float vRim;',
      'void main(){',
      '  gl_FragColor=vec4(0.18,0.42,1.0,max(0.0,vRim)*0.38);',
      '}'
    ].join('\n'),
    side:THREE.BackSide,blending:THREE.AdditiveBlending,
    transparent:true,depthWrite:false
  })
));

// ── Orbit rings ────────────────────────────────────────────────────────────
[[1.40,Math.PI/2,0.09],[1.60,Math.PI/2+0.2,0.05]].forEach(function(r){
  var m=new THREE.Mesh(
    new THREE.TorusGeometry(r[0],0.0006,2,140),
    new THREE.MeshBasicMaterial({color:0x4488ff,transparent:true,opacity:r[2]})
  );
  m.rotation.x=r[1]; scene.add(m);
});

// ── Geographic labels ──────────────────────────────────────────────────────
function ll(lat,lon){
  var phi=(90-lat)*Math.PI/180,th=(lon+180)*Math.PI/180;
  return new THREE.Vector3(-Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th));
}
var GEO=[
  {lb:'lTR',dt:'dTR',p:ll(39.0, 35.0)},
  {lb:'lIS',dt:'dIS',p:ll(41.01,28.98)},
  {lb:'lAN',dt:'dAN',p:ll(39.93,32.86)},
];

// ── Animation ──────────────────────────────────────────────────────────────
var SPIN=Math.PI*2/50;
var clock=new THREE.Clock();
var _v=new THREE.Vector3();
var _fwd=new THREE.Vector3(0,0,1);

function tick(){
  requestAnimationFrame(tick);
  var dt=clock.getDelta();

  earthGroup.rotation.y+=SPIN*dt;
  if(cloudMesh)cloudMesh.rotation.y+=SPIN*dt*1.07;

  // Smooth glow
  cGlow+=(tGlow-cGlow)*0.04;
  if(earthMat)earthMat.uniforms.uGlow.value=cGlow;

  // Labels
  var W=window.innerWidth,H=window.innerHeight;
  GEO.forEach(function(g){
    _v.copy(g.p).applyMatrix4(earthGroup.matrixWorld);
    var facing=_v.clone().normalize().dot(_fwd);
    var op=facing>0.12?Math.min(1,(facing-0.12)/0.32).toFixed(2):'0';
    _v.project(camera);
    var sx=(_v.x*0.5+0.5)*W, sy=(-_v.y*0.5+0.5)*H;
    var le=document.getElementById(g.lb),de=document.getElementById(g.dt);
    if(le){le.style.left=sx+'px';le.style.top=sy+'px';le.style.opacity=op;}
    if(de){de.style.left=sx+'px';de.style.top=(sy+12)+'px';de.style.opacity=op;}
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

// ── Context loss ───────────────────────────────────────────────────────────
canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();},false);

})();
</script>
</body>
</html>`;
})();

// ─── Component ────────────────────────────────────────────────────────────────

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
