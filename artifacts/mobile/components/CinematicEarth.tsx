/**
 * CinematicEarth v5 — Three.js WebGL, real NASA texture maps.
 *
 * Architecture:
 *   Layer 1 — <canvas id="gl">  Three.js WebGL: stars + Earth sphere + atmosphere
 *   Layer 2 — <canvas id="fx">  Canvas2D: listening pulse ring only
 *   Layer 3 — <div id="ui">     HTML labels (positioned via Three.js projection)
 *
 * Earth rendering:
 *   - Real equirectangular day texture (earth_atmos_2048.jpg via Three.js CDN)
 *   - Real city-lights night texture  (earth_lights_2048.png via Three.js CDN)
 *   - Custom GLSL fragment shader: day/night blend + cinematic terminator + voice tints
 *   - Atmosphere sphere (BackSide ShaderMaterial): Rayleigh rim + voice-state colouring
 *
 * Voice reactions stay fully organic via smooth-blend uniforms in the GLSL.
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── GLSL shaders — defined as TS template literals, JSON-stringified into HTML ─
// (The outer EARTH_HTML uses backtick-string, so inner strings use JSON injection)

const EARTH_VERT = `
varying vec2 vUv;
varying vec3 vWorldNormal;
void main(){
  vUv = uv;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}
`;

const EARTH_FRAG = `
uniform sampler2D dayTex;
uniform sampler2D nightTex;
uniform vec3 sunDir;
uniform float vSpeak;
uniform float vListen;
uniform float vPhase;
varying vec2 vUv;
varying vec3 vWorldNormal;
void main(){
  vec3 norm = normalize(vWorldNormal);
  float sunDot = dot(norm, normalize(sunDir));

  // Wider terminator blend: cinematic sunrise/sunset band
  float dayFactor = smoothstep(-0.24, 0.22, sunDot);

  vec4 day   = texture2D(dayTex,   vUv);
  vec4 night = texture2D(nightTex, vUv);

  // City lights pulse during AI speaking
  float cityBoost = 1.0 + vSpeak * 0.30 * (0.5 + 0.5*sin(vPhase*2.2));

  // Night side: faint moonlit land + amplified city lights
  vec4 nightSide = day * 0.016 + night * 1.60 * cityBoost;

  // Blend day / night
  vec4 color = mix(nightSide, day, dayFactor);

  // Cinematic terminator — warm amber glow at the day/night line
  float term = smoothstep(-0.28, -0.08, sunDot) * smoothstep(0.28, 0.08, sunDot);
  color.rgb += vec3(0.30, 0.13, 0.02) * term * 0.38;

  // Listening: subtle cool blue lift on the day side
  color.rgb += vec3(0.0, 0.020, 0.060) * vListen * dayFactor * 0.90;

  // Speaking: very slight warm fill on night limb (cities feel energized)
  color.rgb += vec3(0.055, 0.022, 0.0) * vSpeak * (1.0 - dayFactor) * 0.60;

  gl_FragColor = color;
}
`;

const ATM_VERT = `
varying vec3 vWorldNormal;
varying vec3 vViewDir;
void main(){
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mvPos = modelViewMatrix * vec4(position,1.0);
  vViewDir = normalize(-mvPos.xyz);
  gl_Position = projectionMatrix * mvPos;
}
`;

// Atmosphere: full organic voice reactions live here
const ATM_FRAG = `
uniform vec3 sunDir;
uniform float vIdle;
uniform float vListen;
uniform float vSpeak;
uniform float vPhase;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
void main(){
  vec3 norm = normalize(vWorldNormal);

  // Rim effect — power controls thickness of the atmospheric band
  float rim  = 1.0 - abs(dot(norm, vViewDir));
  float rim3 = pow(rim, 3.6);
  float rim5 = pow(rim, 5.5);

  float sunDot  = dot(norm, normalize(sunDir));
  float daySide = smoothstep(-0.58, 0.20, sunDot);
  float term    = smoothstep(-0.32, -0.07, sunDot) * smoothstep(0.32, 0.07, sunDot);

  // Rayleigh day-side blue
  vec3 c = vec3(0.17, 0.44, 0.94) * daySide * 0.92;

  // Sunset/sunrise amber band
  c += vec3(0.72, 0.26, 0.04) * term * 0.72;

  // Night-side dark aurora haze
  c += vec3(0.04, 0.06, 0.18) * (1.0 - daySide) * 0.26;

  // ── Voice state tints (organic, multi-freq) ──────────────────────────────
  float b1 = 0.5 + 0.5*sin(vPhase*1.38);
  float b2 = 0.5 + 0.5*sin(vPhase*0.48);

  // IDLE: atmospheric breathing — barely visible
  c *= 1.0 + vIdle * (0.52 + 0.28*b1 + 0.20*b2) * 0.042;

  // LISTENING: cool blue rim brightens
  c += vec3(0.04, 0.16, 0.62) * vListen * 0.42 * rim3;

  // SPEAKING: warm amber bloom
  float sp1 = 0.5 + 0.5*sin(vPhase*2.55);
  float sp2 = 0.5 + 0.5*sin(vPhase*1.65 + 0.95);
  float spA = vSpeak * (0.46 + 0.33*sp1 + 0.21*sp2);
  c += vec3(0.82, 0.28, 0.04) * spA * 0.38 * rim3;

  float alpha = rim3 * (0.72 + vListen*0.20 + vSpeak*0.15) + rim5*0.18;
  gl_FragColor = vec4(c, alpha);
}
`;

// ─── HTML page (single self-contained string) ─────────────────────────────────
const EARTH_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000008;overflow:hidden}
#gl,#fx{position:absolute;top:0;left:0;width:100%;height:100%}
#fx{pointer-events:none}
#ui{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden}
.lb{
  position:absolute;
  font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;
  white-space:nowrap;text-transform:uppercase;
  color:rgba(205,228,255,0.82);
  text-shadow:0 0 6px rgba(120,185,255,0.36);
  transition:opacity 0.9s ease;
  pointer-events:none;
}
#lTR{font-size:7px;font-weight:700;letter-spacing:2.5px;transform:translate(-50%,-265%)}
#lIS{font-size:5px;font-weight:600;letter-spacing:1.8px;transform:translate(-118%,-168%)}
#lAN{font-size:5px;font-weight:600;letter-spacing:1.8px;transform:translate(18%,-168%)}
.dot{
  position:absolute;width:2px;height:2px;border-radius:50%;
  background:rgba(200,228,255,0.82);transform:translate(-50%,-50%);
  box-shadow:0 0 3px 1px rgba(150,205,255,0.34);
  transition:opacity 0.9s ease;pointer-events:none;
}
</style>
</head>
<body>
<canvas id="gl"></canvas>
<canvas id="fx"></canvas>
<div id="ui">
  <div class="lb" id="lTR" style="opacity:0">TURKIYE</div>
  <div class="dot" id="dTR" style="opacity:0"></div>
  <div class="lb" id="lIS" style="opacity:0">Istanbul</div>
  <div class="dot" id="dIS" style="opacity:0"></div>
  <div class="lb" id="lAN" style="opacity:0">Ankara</div>
  <div class="dot" id="dAN" style="opacity:0"></div>
</div>

<script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
<script>
(function(){
'use strict';

// ── Injected GLSL from TypeScript ─────────────────────────────────────────────
var EARTH_VERT = ${JSON.stringify(EARTH_VERT)};
var EARTH_FRAG = ${JSON.stringify(EARTH_FRAG)};
var ATM_VERT   = ${JSON.stringify(ATM_VERT)};
var ATM_FRAG   = ${JSON.stringify(ATM_FRAG)};

// ── Globals ───────────────────────────────────────────────────────────────────
var W = window.innerWidth  || screen.width  || 375;
var H = window.innerHeight || screen.height || 812;

// Voice state
var vState = 'idle', vListen = 0, vSpeak = 0, vIdle = 1;
var vPhase = 0, lastT = -1, dt = 0;
// Rotation speed in rad/sec — idle:3.6°/s listen:6.8°/s speak:10°/s
var SPEED = 0.0628;

// Three.js objects
var renderer, scene, camera, earthMesh, atmMesh, earthMat, atmMat;

// Pre-allocated helpers (no GC pressure per frame)
var _v3 = null, _ndcV3 = null;

// ── Three.js initialisation ───────────────────────────────────────────────────
function init(){
  var gl = document.getElementById('gl');

  renderer = new THREE.WebGLRenderer({canvas:gl, antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000008);

  camera = new THREE.PerspectiveCamera(42, W/H, 0.1, 200);
  camera.position.z = 2.65;

  _v3    = new THREE.Vector3();
  _ndcV3 = new THREE.Vector3();

  buildStars();
  buildEarth();
}

// ── Starfield ─────────────────────────────────────────────────────────────────
function buildStars(){
  var n = 340;
  var pos   = new Float32Array(n * 3);
  var s = 0xDEADBEEF;
  function rn(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }
  for(var i=0;i<n;i++){
    var theta = rn() * 6.2832;
    var phi   = Math.acos(2*rn()-1);
    var r     = 55 + rn()*25;
    pos[i*3  ] = r*Math.sin(phi)*Math.cos(theta);
    pos[i*3+1] = r*Math.sin(phi)*Math.sin(theta);
    pos[i*3+2] = r*Math.cos(phi);
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // Fixed-size stars — mobile-safe, no shader needed
  var mat = new THREE.PointsMaterial({
    color:0xffffff, size:0.11, sizeAttenuation:true,
    transparent:true, opacity:0.78,
  });
  scene.add(new THREE.Points(geo, mat));
}

// ── Earth + Atmosphere ────────────────────────────────────────────────────────
function buildEarth(){
  // Sun direction fixed at lon=-30°, lat=22°
  var sLat = 22 * Math.PI/180, sLon = -30 * Math.PI/180;
  var sunDir = new THREE.Vector3(
    Math.cos(sLat)*Math.cos(sLon),
    Math.sin(sLat),
    Math.cos(sLat)*Math.sin(sLon)
  ).normalize();

  var loader = new THREE.TextureLoader();
  var dayTex   = loader.load('https://unpkg.com/three@0.160.0/examples/textures/planets/earth_atmos_2048.jpg');
  var nightTex = loader.load('https://unpkg.com/three@0.160.0/examples/textures/planets/earth_lights_2048.png');
  dayTex.colorSpace   = THREE.SRGBColorSpace;
  nightTex.colorSpace = THREE.SRGBColorSpace;

  // ── Earth sphere — custom day/night GLSL ──────────────────────────────────
  earthMat = new THREE.ShaderMaterial({
    uniforms:{
      dayTex:   {value: dayTex},
      nightTex: {value: nightTex},
      sunDir:   {value: sunDir},
      vSpeak:   {value: 0.0},
      vListen:  {value: 0.0},
      vPhase:   {value: 0.0},
    },
    vertexShader:   EARTH_VERT,
    fragmentShader: EARTH_FRAG,
  });
  earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 72, 72),
    earthMat
  );
  scene.add(earthMesh);

  // ── Atmosphere sphere — Rayleigh rim + voice state ────────────────────────
  atmMat = new THREE.ShaderMaterial({
    side:        THREE.BackSide,
    transparent: true,
    depthWrite:  false,
    uniforms:{
      sunDir:  {value: sunDir},
      vIdle:   {value: 1.0},
      vListen: {value: 0.0},
      vSpeak:  {value: 0.0},
      vPhase:  {value: 0.0},
    },
    vertexShader:   ATM_VERT,
    fragmentShader: ATM_FRAG,
  });
  atmMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.030, 72, 72),
    atmMat
  );
  scene.add(atmMesh);
}

// ── Canvas2D overlay — listening wave ring only ───────────────────────────────
var fxCanvas = document.getElementById('fx');
fxCanvas.width  = W;
fxCanvas.height = H;
var fxCtx = fxCanvas.getContext('2d');
// Project-sphere radius to canvas pixels for the ring
var cx = W*0.5, cy = H*0.46, R = Math.min(W,H)*0.44;

function drawOverlay(){
  fxCtx.clearRect(0, 0, W, H);

  // Single organic pulse wave for listening state
  if(vListen > 0.01){
    var wp     = (vPhase * 0.38) % 1;
    var wAlpha = Math.max(0, (1-wp)*(1-wp) * vListen * 0.22);
    fxCtx.beginPath();
    fxCtx.arc(cx, cy, R*(1.05 + wp*0.52), 0, 6.2832);
    fxCtx.strokeStyle = 'rgba(98,176,254,' + wAlpha + ')';
    fxCtx.lineWidth   = 0.4 + (1-wp)*0.90;
    fxCtx.stroke();
  }
}

// ── Label projection ──────────────────────────────────────────────────────────
// Geographic lon/lat → screen pixel via Three.js matrixWorld projection
var LABELS = [
  ['lTR','dTR', 35.5, 39.2],
  ['lIS','dIS', 29.0, 41.0],
  ['lAN','dAN', 32.9, 39.9],
];
function updateLabels(){
  if(!earthMesh) return;
  for(var li=0; li<LABELS.length; li++){
    var item   = LABELS[li];
    var latR   = item[3] * Math.PI/180;
    var lonR   = item[2] * Math.PI/180;
    // Point on unit sphere in Earth's LOCAL space
    _v3.set(
      Math.cos(latR)*Math.cos(lonR),
      Math.sin(latR),
      Math.cos(latR)*Math.sin(lonR)
    );
    // Transform to WORLD space via Earth's current rotation matrix
    _v3.applyMatrix4(earthMesh.matrixWorld);
    // Facing camera? Camera is at +Z; world.z > threshold means facing.
    var facing = _v3.z > 0.12;
    // Project to NDC
    _ndcV3.copy(_v3).project(camera);
    var sx  = (_ndcV3.x + 1) * 0.5 * W;
    var sy  = (-_ndcV3.y + 1) * 0.5 * H;
    var vis = facing ? '1' : '0';
    var lEl = document.getElementById(item[0]);
    var dEl = document.getElementById(item[1]);
    if(lEl){ lEl.style.left=sx+'px'; lEl.style.top=sy+'px'; lEl.style.opacity=vis; }
    if(dEl){ dEl.style.left=sx+'px'; dEl.style.top=sy+'px'; dEl.style.opacity=facing?'0.78':'0'; }
  }
}

// ── Frame loop ────────────────────────────────────────────────────────────────
function loop(t){
  requestAnimationFrame(loop);
  dt    = lastT >= 0 ? Math.min((t-lastT)/1000, 0.10) : 0.016;
  lastT = t;
  vPhase += dt;

  // Smooth state blending (~0.55s transition at 1.8/sec)
  var bs = Math.min(1, 1.8*dt);
  vListen += ((vState==='listening' ? 1:0) - vListen) * bs;
  vSpeak  += ((vState==='speaking'  ? 1:0) - vSpeak)  * bs;
  vIdle   += ((vState==='idle'      ? 1:0) - vIdle)   * bs;

  // Rotate Earth
  if(earthMesh) earthMesh.rotation.y += SPEED * dt;

  // Push blended values to GLSL uniforms
  if(earthMat){
    earthMat.uniforms.vSpeak.value  = vSpeak;
    earthMat.uniforms.vListen.value = vListen;
    earthMat.uniforms.vPhase.value  = vPhase;
  }
  if(atmMat){
    atmMat.uniforms.vIdle.value   = vIdle;
    atmMat.uniforms.vListen.value = vListen;
    atmMat.uniforms.vSpeak.value  = vSpeak;
    atmMat.uniforms.vPhase.value  = vPhase;
  }

  // Render WebGL (also updates earthMesh.matrixWorld internally)
  if(renderer) renderer.render(scene, camera);

  // Labels — called AFTER render so matrixWorld is current-frame-correct
  updateLabels();

  // Canvas overlay
  drawOverlay();
}

// ── Bootstrap — wait for Three.js CDN script to evaluate ─────────────────────
function tryInit(){
  if(typeof THREE !== 'undefined'){
    init();
    requestAnimationFrame(loop);
  } else {
    setTimeout(tryInit, 30);
  }
}

// ── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', function(){
  W = window.innerWidth  || W;
  H = window.innerHeight || H;
  cx = W*0.5; cy = H*0.46; R = Math.min(W,H)*0.44;
  fxCanvas.width = W; fxCanvas.height = H;
  if(renderer){ renderer.setSize(W,H); }
  if(camera){ camera.aspect=W/H; camera.updateProjectionMatrix(); }
});

// ── Voice state API (called from React Native via injectJavaScript) ───────────
window.onVoiceState = function(state){
  vState = state;
  SPEED = state==='speaking' ? 0.175 : state==='listening' ? 0.119 : 0.0628;
};

tryInit();
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
  wrap:        { flex: 1, width: "100%", backgroundColor: "#000008", overflow: "hidden" },
  web:         { flex: 1, backgroundColor: "transparent" },
  webFallback: { flex: 1, width: "100%", backgroundColor: "#000008" },
});
