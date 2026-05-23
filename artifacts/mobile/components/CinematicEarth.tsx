/**
 * CinematicEarth — Three.js WebGL globe.
 *
 * v2 enhancements:
 *  - Starfield drawn on a dedicated canvas layer
 *  - Outer glow sphere that pulses with voice state
 *  - Extra atmosphere halo ring
 *  - Ambient pulse CSS ring injected at globe center
 *  - Voice-state driven glow intensity + rotation speed
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── HTML ─────────────────────────────────────────────────────────────────────
const EARTH_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#020208;overflow:hidden}
canvas{display:block;position:absolute;top:0;left:0}
#stars{z-index:0;pointer-events:none}
#gl{z-index:1}
#ui{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;overflow:hidden}

/* ── pulse rings ── */
#rings{
  position:absolute;
  transform:translate(-50%,-50%);
  pointer-events:none;
}
.ring{
  position:absolute;
  border-radius:50%;
  border:1px solid rgba(180,210,255,0.18);
  transform:translate(-50%,-50%);
  animation:none;
}
@keyframes expand{
  0%  {transform:translate(-50%,-50%) scale(1);   opacity:0.22;}
  100%{transform:translate(-50%,-50%) scale(2.8); opacity:0;}
}

/* ── labels ── */
.lb{
  position:absolute;
  font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;
  white-space:nowrap;text-transform:uppercase;
  color:rgba(200,228,255,0.72);
  pointer-events:none;
  transition:opacity 0.9s ease;
}
#lTR{font-size:7px;font-weight:700;letter-spacing:2.5px;transform:translate(-50%,-270%)}
#lIS{font-size:5px;font-weight:600;letter-spacing:1.8px;transform:translate(-118%,-155%)}
#lAN{font-size:5px;font-weight:600;letter-spacing:1.8px;transform:translate(18%,-155%)}
.dot{
  position:absolute;width:2.5px;height:2.5px;border-radius:50%;
  background:rgba(200,228,255,0.68);transform:translate(-50%,-50%);
  pointer-events:none;transition:opacity 0.9s ease;
}
</style>
</head>
<body>
<canvas id="stars"></canvas>
<div id="ui">
  <div id="rings"></div>
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

/* ── Stars ─────────────────────────────────────────────────────────────────── */
function drawStars(){
  var W=window.innerWidth||375, H=window.innerHeight||812;
  var sc=document.getElementById('stars');
  sc.width=W; sc.height=H;
  var ctx=sc.getContext('2d');
  ctx.clearRect(0,0,W,H);
  for(var i=0;i<220;i++){
    var x=Math.random()*W, y=Math.random()*H;
    var r=Math.random()*0.9+0.15;
    var a=Math.random()*0.55+0.08;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,'+a+')';
    ctx.fill();
  }
  // A few slightly brighter ones
  for(var j=0;j<18;j++){
    var bx=Math.random()*W, by=Math.random()*H;
    ctx.beginPath();
    ctx.arc(bx,by,1.1,0,Math.PI*2);
    ctx.fillStyle='rgba(200,225,255,'+(Math.random()*0.35+0.35)+')';
    ctx.fill();
  }
}
drawStars();

/* ── CDN load ───────────────────────────────────────────────────────────────── */
var CDNS=[
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
  'https://unpkg.com/three@0.160.0/build/three.min.js',
];
var cdnIdx=0;

function tryLoadCDN(){
  if(cdnIdx>=CDNS.length){showFallback();return;}
  var s=document.createElement('script');
  s.onload=onThreeReady;
  s.onerror=function(){cdnIdx++;tryLoadCDN();};
  s.src=CDNS[cdnIdx++];
  document.head.appendChild(s);
}

function showFallback(){
  document.body.style.background=
    'radial-gradient(circle at 50% 48%,#0a1844 0%,#030615 60%,#020208 100%)';
}

/* ── Three.js scene ─────────────────────────────────────────────────────────── */
function onThreeReady(){
  var W=window.innerWidth||375, H=window.innerHeight||812;

  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, W/H, 0.1, 100);
  camera.position.z = 7.0;
  camera.lookAt(0, -0.15, 0);

  var renderer=new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(W,H);
  renderer.setClearColor(0x020208,1);
  renderer.domElement.id='gl';
  document.body.insertBefore(renderer.domElement, document.getElementById('ui'));

  /* ── Earth ── */
  var earthGeo=new THREE.SphereGeometry(1,64,48);
  var earthMat=new THREE.MeshPhongMaterial({
    color:     new THREE.Color(0x1a3366),
    shininess: 12,
    specular:  new THREE.Color(0x1a2a44),
  });
  var earth=new THREE.Mesh(earthGeo,earthMat);
  earth.rotation.y=-2.50;
  scene.add(earth);

  /* ── Atmosphere — inner blue ring ── */
  var atmosMat=new THREE.MeshBasicMaterial({
    color:new THREE.Color(0x2244bb),
    side:THREE.BackSide,
    transparent:true,
    opacity:0.14,
  });
  var atmos=new THREE.Mesh(new THREE.SphereGeometry(1.016,48,32),atmosMat);
  atmos.rotation.y=earth.rotation.y;
  scene.add(atmos);

  /* ── Outer glow sphere (pulses with voice state) ── */
  var glowMat=new THREE.MeshBasicMaterial({
    color:new THREE.Color(0x2255cc),
    side:THREE.BackSide,
    transparent:true,
    opacity:0.048,
  });
  var glowSphere=new THREE.Mesh(new THREE.SphereGeometry(1.15,32,24),glowMat);
  scene.add(glowSphere);

  /* ── Far halo ── */
  var haloMat=new THREE.MeshBasicMaterial({
    color:new THREE.Color(0x112255),
    side:THREE.BackSide,
    transparent:true,
    opacity:0.030,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.28,24,16),haloMat));

  /* ── Lighting ── */
  var sun=new THREE.DirectionalLight(0xfff6e8,1.12);
  sun.position.set(9.4,3.4,-0.9);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x060814,0.42));

  /* ── Texture loading ── */
  var TEX_URLS=[
    'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/textures/planets/earth_atmos_2048.jpg',
    'https://unpkg.com/three@0.160.0/examples/textures/planets/earth_atmos_2048.jpg',
    'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
  ];
  var texIdx=0;
  function tryLoadTex(){
    if(texIdx>=TEX_URLS.length)return;
    var img=new Image();
    img.onload=function(){
      var tex=new THREE.Texture(img);
      if(THREE.SRGBColorSpace!==undefined)tex.colorSpace=THREE.SRGBColorSpace;
      tex.needsUpdate=true;
      earthMat.map=tex;
      earthMat.color=new THREE.Color(1,1,1);
      earthMat.needsUpdate=true;
    };
    img.onerror=function(){texIdx++;tryLoadTex();};
    img.src=TEX_URLS[texIdx++];
  }
  tryLoadTex();

  /* ── Labels ── */
  var _pos=new THREE.Vector3(), _nrm=new THREE.Vector3();
  function placeLabel(lblId,dotId,lat,lon){
    var latR=lat*Math.PI/180, lonR=lon*Math.PI/180;
    _pos.set(
      Math.cos(latR)*Math.cos(lonR),
      Math.sin(latR),
      Math.cos(latR)*Math.sin(lonR)
    );
    _nrm.copy(_pos);
    _pos.applyMatrix4(earth.matrixWorld);
    _nrm.transformDirection(earth.matrixWorld);
    var dot=(camera.position.x-_pos.x)*_nrm.x
           +(camera.position.y-_pos.y)*_nrm.y
           +(camera.position.z-_pos.z)*_nrm.z;
    var lb=document.getElementById(lblId);
    var dt=document.getElementById(dotId);
    if(!lb||!dt)return;
    if(dot<0.06){lb.style.opacity='0';dt.style.opacity='0';return;}
    var fade=Math.min(1,(dot-0.06)*5.5);
    _pos.project(camera);
    var sx=(_pos.x+1)*W*0.5, sy=(-_pos.y+1)*H*0.5;
    lb.style.left=sx+'px'; lb.style.top=sy+'px';
    dt.style.left=sx+'px'; dt.style.top=sy+'px';
    lb.style.opacity=String(fade*0.72);
    dt.style.opacity=String(fade*0.58);
  }

  /* ── Pulse rings at globe screen position ── */
  var GLOBE_CX = W*0.5;
  var GLOBE_CY = H*0.44;   // approximate screen-Y of globe center
  var RING_D   = H*0.41;   // approx pixel diameter of globe

  var ringsEl=document.getElementById('rings');
  ringsEl.style.left=GLOBE_CX+'px';
  ringsEl.style.top =GLOBE_CY+'px';

  var rings=[];
  var ringCount=3;
  for(var ri=0;ri<ringCount;ri++){
    var rd=document.createElement('div');
    rd.className='ring';
    var sz=RING_D*(1.0+ri*0.28);
    rd.style.width=sz+'px';
    rd.style.height=sz+'px';
    rd.style.marginLeft=(-sz/2)+'px';
    rd.style.marginTop =(-sz/2)+'px';
    rd.style.opacity='0';
    ringsEl.appendChild(rd);
    rings.push(rd);
  }

  /* ── Voice state ── */
  var SPEED=2.6;
  var glowTarget=0.048;
  var glowCurrent=0.048;
  var ringActive=false;
  var ringTimers=[];

  function clearRingTimers(){ringTimers.forEach(clearTimeout);ringTimers=[];}

  function startRings(){
    clearRingTimers();
    rings.forEach(function(r){r.style.animation='none';r.style.opacity='0';});
    var delay=[0,480,960];
    rings.forEach(function(r,i){
      var t=setTimeout(function(){
        r.style.animation='none';
        r.offsetHeight; // reflow
        r.style.animation='expand 2200ms ease-out infinite';
        r.style.animationDelay=(i*480)+'ms';
      },delay[i]);
      ringTimers.push(t);
    });
  }

  function stopRings(){
    clearRingTimers();
    rings.forEach(function(r){r.style.animation='none';r.style.opacity='0';});
  }

  window.onVoiceState=function(state){
    if(state==='speaking'){
      SPEED=7.5;
      glowTarget=0.18;
      startRings();
    } else if(state==='listening'){
      SPEED=4.8;
      glowTarget=0.10;
      startRings();
    } else {
      SPEED=2.6;
      glowTarget=0.048;
      stopRings();
    }
  };

  /* ── Glow breathing ── */
  var glowDir=1, glowBreath=0, glowBreathSpeed=0.008;
  function tickGlow(dt){
    // Lerp toward target
    glowCurrent+=(glowTarget-glowCurrent)*0.035;
    // Subtle breathing on top
    glowBreath+=glowBreathSpeed*glowDir*(dt*60);
    if(glowBreath>1||glowBreath<0)glowDir=-glowDir;
    var breathAmt=0.012*Math.sin(glowBreath*Math.PI);
    glowMat.opacity=Math.max(0,Math.min(0.35,glowCurrent+breathAmt));
    glowMat.needsUpdate=true;
  }

  /* ── Animation loop ── */
  var lastT=-1;
  function frame(t){
    requestAnimationFrame(frame);
    var dt=lastT<0?0:Math.min((t-lastT)/1000,0.10);
    lastT=t;
    earth.rotation.y+=SPEED*dt*Math.PI/180;
    atmos.rotation.y=earth.rotation.y;
    tickGlow(dt);
    earth.updateMatrixWorld(true);
    placeLabel('lTR','dTR',39.0,35.0);
    placeLabel('lIS','dIS',41.0,29.0);
    placeLabel('lAN','dAN',39.9,32.9);
    renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);

  /* ── Resize ── */
  window.addEventListener('resize',function(){
    W=window.innerWidth; H=window.innerHeight;
    camera.aspect=W/H;
    camera.updateProjectionMatrix();
    camera.lookAt(0,-0.15,0);
    renderer.setSize(W,H);
    GLOBE_CX=W*0.5; GLOBE_CY=H*0.44; RING_D=H*0.41;
    ringsEl.style.left=GLOBE_CX+'px';
    ringsEl.style.top =GLOBE_CY+'px';
    drawStars();
  });
}

tryLoadCDN();
})();
</script>
</body>
</html>`;

// ─── React component ──────────────────────────────────────────────────────────
export default function CinematicEarth({ voiceState }: Props) {
  const webRef = useRef<any>(null);

  useEffect(() => {
    webRef.current?.injectJavaScript(
      `if(window.onVoiceState)window.onVoiceState('${voiceState}');true;`
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
  wrap:        { flex: 1, width: "100%", backgroundColor: "#020208", overflow: "hidden" },
  web:         { flex: 1, backgroundColor: "transparent" },
  webFallback: { flex: 1, width: "100%", backgroundColor: "#020208" },
});
