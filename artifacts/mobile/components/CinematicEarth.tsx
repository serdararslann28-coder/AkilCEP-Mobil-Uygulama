/**
 * CinematicEarth — mobile-optimised Earth for Voyage / Voice Mode.
 *
 * Performance strategy (fixes 6000 ms WebView timeout):
 *  • ALL heavy init deferred via setTimeout(init, 80) so WebView renders
 *    its first frame before any Canvas2D / Three.js work starts.
 *  • Texture sizes halved: day 256×128, night 128×64, clouds 128×64
 *  • Removed water-mask texture → no ocean specular (saves 1 texture unit)
 *  • Simplified Earth shader: N.z rim (no vVP varying), 2 texture samples
 *  • Atmosphere: zero uniforms, abs(n.z) rim — 3 lines of GLSL
 *  • Geometry: 36×36 Earth, 28×28 clouds, 32×32 atmos
 *  • Stars: 600 points
 *  • Continent polygons: 16 key shapes
 *  • City lights: 46 cities
 *  • Cloud noise: 2-octave only on 128×64 canvas
 */
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── Shaders ──────────────────────────────────────────────────────────────────

const EARTH_VERT = [
  "precision mediump float;",
  "varying vec2 vUv;",
  "varying vec3 vVN;",
  "void main(){",
  "  vVN=normalize(normalMatrix*normal);",
  "  vUv=uv;",
  "  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);",
  "}",
].join("\n");

// 2 texture samples, no water uniform, N.z approximation for rim/V
const EARTH_FRAG = [
  "precision mediump float;",
  "uniform sampler2D uDay;",
  "uniform sampler2D uNight;",
  "uniform vec3  uLight;",
  "uniform float uGlow;",
  "varying vec2 vUv;",
  "varying vec3 vVN;",
  "void main(){",
  "  vec3  N=normalize(vVN);",
  "  float d=dot(N,normalize(uLight));",
  "  float t=smoothstep(-0.20,0.28,d);",
  // diffuse
  "  vec3 dayC=texture2D(uDay,vUv).rgb*(0.07+0.93*max(0.0,d));",
  // blue rim (N.z: camera-facing in view space, cheap approximation)
  "  float rim=pow(1.0-max(0.0,N.z),4.0);",
  "  dayC+=vec3(0.10,0.28,0.90)*rim*t*0.40;",
  // warm twilight band
  "  float twi=smoothstep(-0.20,0.0,d)*(1.0-smoothstep(0.0,0.28,d));",
  "  dayC+=vec3(0.94,0.42,0.06)*twi*0.36;",
  // city lights (night side only)
  "  vec3 ngtC=texture2D(uNight,vUv).rgb*1.55*(1.0-t);",
  "  gl_FragColor=vec4((dayC*t+ngtC)*uGlow,1.0);",
  "}",
].join("\n");

// Zero uniforms — just a rim glow, no sun-side variation needed for stability
const ATMOS_VERT = [
  "precision mediump float;",
  "varying float vRim;",
  "void main(){",
  "  vec3 n=normalize(normalMatrix*normal);",
  "  vRim=pow(1.0-abs(n.z),4.5);",
  "  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);",
  "}",
].join("\n");

const ATMOS_FRAG = [
  "precision mediump float;",
  "varying float vRim;",
  "void main(){gl_FragColor=vec4(0.18,0.42,1.0,vRim*0.58);}",
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
  font-family:-apple-system,'Helvetica Neue',sans-serif;
  white-space:nowrap;text-transform:uppercase;letter-spacing:3.5px;
  color:rgba(210,232,255,0.92);
  text-shadow:0 0 10px rgba(110,175,255,0.88);
  transform:translate(-50%,-160%);transition:opacity 0.8s;
}
.lb.big{font-size:11px;font-weight:700;letter-spacing:4px}
.lb.sm {font-size: 8px;font-weight:600;letter-spacing:3px}
.dt{
  position:absolute;width:4px;height:4px;border-radius:50%;
  background:rgba(215,235,255,0.95);transform:translate(-50%,-50%);
  box-shadow:0 0 7px 2px rgba(155,208,255,0.62);transition:opacity 0.8s;
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
// Defer ALL heavy work — let the WebView finish its first paint first.
// This is what prevents the 6000 ms initialisation timeout.
setTimeout(function(){
(function(){
'use strict';
var S=${S};

// ── Texture dimensions ─────────────────────────────────────────────────────
var DW=256,DH=128;   // day map (halved vs previous)
var NW=128,NH=64;    // night / city lights
var CW=128,CH=64;    // clouds

// ── Helpers ────────────────────────────────────────────────────────────────
function pt(lon,lat,w,h){return{x:(lon+180)/360*w,y:(90-lat)/180*h};}
function poly(ctx,pts,c,w,h){
  if(!pts||pts.length<3)return;
  var p0=pt(pts[0][0],pts[0][1],w,h);
  ctx.beginPath();ctx.moveTo(p0.x,p0.y);
  for(var i=1;i<pts.length;i++){var p=pt(pts[i][0],pts[i][1],w,h);ctx.lineTo(p.x,p.y);}
  ctx.closePath();ctx.fillStyle=c;ctx.fill();
}

// ── 16 continent polygons (lean but geographically recognisable) ───────────
var LAND=[
  {c:'#3c6e3a',p:[[-18,16],[-8,5],[8,0],[15,-12],[20,-24],[28,-30],[36,-20],[46,-8],[50,11],[40,16],[34,26],[20,33],[8,38],[0,37],[-10,36],[-18,16]]},
  {c:'#c2a04c',p:[[-18,16],[-10,27],[8,26],[18,22],[20,18],[10,14],[-4,18],[-10,20],[-18,16]]},
  {c:'#487838',p:[[-10,36],[0,37],[20,37],[28,37],[30,42],[35,54],[18,72],[0,68],[-8,54],[-10,44],[-10,36]]},
  {c:'#487838',p:[[5,58],[18,72],[28,70],[28,62],[18,58],[5,58]]},
  {c:'#3a6830',p:[[30,50],[60,60],[100,66],[140,70],[168,58],[155,50],[130,42],[100,46],[60,56],[30,50]]},
  {c:'#527c3c',p:[[26,36],[30,40],[36,42],[44,40],[46,38],[44,36],[40,34],[36,36],[28,36],[26,36]]},
  {c:'#4a7238',p:[[36,42],[50,38],[62,28],[72,22],[60,28],[48,38],[36,42]]},
  {c:'#c8a855',p:[[36,30],[44,30],[56,14],[44,12],[40,16],[36,22],[36,30]]},
  {c:'#487838',p:[[60,28],[70,24],[76,8],[86,12],[88,22],[80,28],[60,28]]},
  {c:'#3a7030',p:[[98,22],[110,18],[116,4],[100,2],[98,16],[98,22]]},
  {c:'#3c6e3a',p:[[75,40],[100,50],[120,52],[130,44],[124,32],[114,18],[100,18],[80,30],[75,40]]},
  {c:'#487838',p:[[131,32],[138,40],[141,44],[134,44],[130,36],[131,32]]},
  {c:'#3c6e3a',p:[[-168,72],[-80,75],[-55,50],[-76,42],[-88,28],[-95,22],[-85,12],[-104,22],[-122,38],[-132,54],[-165,64],[-168,72]]},
  {c:'#3c6e3a',p:[[-80,12],[-52,4],[-50,0],[-42,-10],[-40,-18],[-52,-32],[-66,-48],[-72,-56],[-70,-38],[-68,-14],[-80,0],[-80,12]]},
  {c:'#1c5e26',p:[[-70,6],[-50,4],[-52,-8],[-62,-12],[-70,-4],[-70,6]]},
  {c:'#8a7848',p:[[114,-22],[130,-12],[142,-14],[152,-26],[150,-34],[138,-36],[122,-34],[114,-22]]},
  {c:'#c4d4e6',p:[[-40,82],[-20,76],[-34,64],[-56,70],[-60,80],[-40,82]]},
  {c:'#ccdaee',p:[[-180,-72],[-60,-74],[60,-74],[180,-72],[180,-90],[-180,-90],[-180,-72]]},
];

// ── 46 city lights [lon, lat, brightness] ─────────────────────────────────
var CITIES=[
  // Turkey ★
  [29.0,41.0,1.0],[32.9,39.9,0.92],[27.1,38.4,0.78],[30.7,36.9,0.68],[35.3,37.0,0.68],
  // Europe
  [-0.1,51.5,0.88],[2.3,48.9,0.88],[13.4,52.5,0.85],[12.5,41.9,0.80],[4.9,52.4,0.80],
  [18.1,59.3,0.72],[14.4,50.1,0.80],[16.4,48.2,0.78],[23.7,37.9,0.78],[-3.7,40.4,0.84],
  [24.9,60.2,0.70],[21.0,52.2,0.78],[26.1,44.4,0.78],
  // Russia / E. Europe
  [37.6,55.7,1.0],[30.3,59.9,0.90],[30.5,50.5,0.84],
  // Middle East
  [35.2,31.8,0.80],[44.4,33.3,0.80],[51.5,25.3,0.90],[55.3,25.3,0.90],[46.7,24.7,0.90],
  [31.2,30.1,0.90],[51.4,35.7,0.88],[35.5,33.9,0.74],
  // S. Asia
  [77.2,28.6,1.0],[72.9,19.1,1.0],[80.3,13.1,0.90],[88.4,22.6,1.0],[74.3,31.5,0.86],
  // E. / SE. Asia
  [116.4,39.9,1.0],[121.5,31.2,1.0],[113.3,23.1,1.0],[103.8,1.4,0.90],[139.7,35.7,1.0],
  [126.9,37.5,0.90],
  // Africa
  [36.8,-1.3,0.78],[28.0,-26.2,0.88],[31.2,30.1,0.88],[7.5,9.1,0.80],
  // Americas
  [-74.0,40.7,1.0],[-87.6,41.8,1.0],[-118.2,34.1,1.0],[-99.1,19.4,1.0],
  [-43.2,-22.9,1.0],[-58.4,-34.6,0.88],
  // Australia
  [151.2,-33.9,0.90],[144.9,-37.8,0.90],
];

// ── 2-octave cloud noise (fast) ────────────────────────────────────────────
function nh(x,y){var s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}
function ni(x,y){
  var ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  var ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  return nh(ix,iy)*(1-ux)*(1-uy)+nh(ix+1,iy)*ux*(1-uy)+nh(ix,iy+1)*(1-ux)*uy+nh(ix+1,iy+1)*ux*uy;
}
// 2 octaves only (was 4) — 50% cheaper
function fbm2(x,y){return 0.6*ni(x,y)+0.4*ni(2*x,2*y);}

// ── Texture builders ───────────────────────────────────────────────────────
function makeDayTex(){
  var cv=document.createElement('canvas');cv.width=DW;cv.height=DH;
  var ctx=cv.getContext('2d');
  var g=ctx.createLinearGradient(0,0,0,DH);
  g.addColorStop(0,'#07172e');g.addColorStop(0.5,'#153c5c');g.addColorStop(1,'#07172e');
  ctx.fillStyle=g;ctx.fillRect(0,0,DW,DH);
  LAND.forEach(function(L){poly(ctx,L.p,L.c,DW,DH);});
  // Polar ice
  var pi=ctx.createRadialGradient(DW/2,0,0,DW/2,0,DH*0.13);
  pi.addColorStop(0,'rgba(215,232,248,1)');pi.addColorStop(1,'rgba(215,232,248,0)');
  ctx.fillStyle=pi;ctx.fillRect(0,0,DW,DH*0.15);
  return new THREE.CanvasTexture(cv);
}

function makeNightTex(){
  var cv=document.createElement('canvas');cv.width=NW;cv.height=NH;
  var ctx=cv.getContext('2d');
  ctx.fillStyle='#000';ctx.fillRect(0,0,NW,NH);
  CITIES.forEach(function(c){
    var p=pt(c[0],c[1],NW,NH);var br=c[2],r=2.2*br;
    var grd=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*3);
    grd.addColorStop(0,'rgba(255,242,168,'+(br*0.96)+')');
    grd.addColorStop(0.3,'rgba(255,214,120,'+(br*0.44)+')');
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
      var v=fbm2(xx/CW*6,yy/CH*3);
      var a=Math.max(0,(v-0.48)*3.6*pf);
      var i=(yy*CW+xx)*4;
      id.data[i]=255;id.data[i+1]=255;id.data[i+2]=255;
      id.data[i+3]=Math.min(255,Math.round(a*190));
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
    canvas:canvas,antialias:false,alpha:false,
    precision:'mediump',powerPreference:'default',preserveDrawingBuffer:false
  });
}catch(e){return;}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(window.innerWidth,window.innerHeight);

// ── Scene / camera ─────────────────────────────────────────────────────────
var scene=new THREE.Scene();
var cam=new THREE.PerspectiveCamera(42,window.innerWidth/window.innerHeight,0.01,200);
cam.position.set(0,0.1,2.7);
cam.updateMatrixWorld(true);

// ── Stars (600 — lean) ─────────────────────────────────────────────────────
(function(){
  var N=600,pos=new Float32Array(N*3);
  for(var i=0;i<N;i++){
    var r=60+Math.random()*36,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);
    pos[i*3]=r*Math.sin(ph)*Math.cos(th);pos[i*3+1]=r*Math.sin(ph)*Math.sin(th);pos[i*3+2]=r*Math.cos(ph);
  }
  var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:0.07,sizeAttenuation:true,transparent:true,opacity:0.80})));
})();

// ── Sun (static — camera never moves) ─────────────────────────────────────
var sunW=new THREE.Vector3(1.5,0.5,1.0).normalize();
var sunV=sunW.clone().transformDirection(cam.matrixWorldInverse);

scene.add(Object.assign(new THREE.DirectionalLight(0xfff6e8,1.6),{position:sunW.clone()}));
scene.add(new THREE.AmbientLight(0x08152a,0.55));

// ── Voice glow ─────────────────────────────────────────────────────────────
var tGlow=1.0,cGlow=1.0;
window.onVoiceState=function(s){tGlow=s==='speaking'?1.42:s==='listening'?1.12:1.0;};

// ── Earth ──────────────────────────────────────────────────────────────────
var earthGroup=new THREE.Group();scene.add(earthGroup);
var earthMat=new THREE.ShaderMaterial({
  uniforms:{uDay:{value:makeDayTex()},uNight:{value:makeNightTex()},uLight:{value:sunV},uGlow:{value:1.0}},
  vertexShader:S.ev,fragmentShader:S.ef
});
earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1,36,36),earthMat));

// Cloud layer
var cloudMesh=new THREE.Mesh(
  new THREE.SphereGeometry(1.011,28,28),
  new THREE.MeshPhongMaterial({map:makeCloudTex(),transparent:true,opacity:0.32,depthWrite:false,blending:THREE.NormalBlending,shininess:0})
);
earthGroup.add(cloudMesh);

// ── Atmosphere (single front-side pass) ────────────────────────────────────
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1.06,32,32),
  new THREE.ShaderMaterial({
    uniforms:{},vertexShader:S.av,fragmentShader:S.af,
    side:THREE.FrontSide,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false
  })
));
// Outer halo
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1.20,24,24),
  new THREE.ShaderMaterial({
    uniforms:{},
    vertexShader:['precision mediump float;','varying float vR;','void main(){','  vec3 n=normalize(normalMatrix*normal);','  vR=pow(0.52-max(0.0,n.z),5.0);','  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'].join('\n'),
    fragmentShader:['precision mediump float;','varying float vR;','void main(){gl_FragColor=vec4(0.15,0.38,1.0,max(0.0,vR)*0.34);}'].join('\n'),
    side:THREE.BackSide,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false
  })
));

// ── Label positions ────────────────────────────────────────────────────────
function ll(lat,lon){
  var phi=(90-lat)*Math.PI/180,th=(lon+180)*Math.PI/180;
  return new THREE.Vector3(-Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th));
}
var GEO=[
  {lb:'lTR',dt:'dTR',p:ll(39.0,35.0)},
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
  var dt=Math.min(clock.getDelta(),0.05);

  earthGroup.rotation.y+=SPIN*dt;
  cloudMesh.rotation.y+=SPIN*dt*1.06;

  cGlow+=(tGlow-cGlow)*0.04;
  earthMat.uniforms.uGlow.value=cGlow;

  var W=window.innerWidth,H=window.innerHeight;
  GEO.forEach(function(g){
    _v.copy(g.p).applyMatrix4(earthGroup.matrixWorld);
    var f=_v.clone().normalize().dot(_fwd);
    var op=f>0.12?Math.min(1,(f-0.12)/0.32).toFixed(2):'0';
    _v.project(cam);
    var sx=(_v.x*0.5+0.5)*W,sy=(-_v.y*0.5+0.5)*H;
    var le=document.getElementById(g.lb),de=document.getElementById(g.dt);
    if(le){le.style.left=sx+'px';le.style.top=sy+'px';le.style.opacity=op;}
    if(de){de.style.left=sx+'px';de.style.top=(sy+13)+'px';de.style.opacity=op;}
  });

  renderer.render(scene,cam);
}
tick();

window.addEventListener('resize',function(){
  cam.aspect=window.innerWidth/window.innerHeight;
  cam.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});
canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();},false);

})();
}, 80); // ← deferred 80 ms: WebView paints first frame before any JS runs
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
