import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

/* ─────────────────────────────────────────────────────────────
   All shader strings use single-quoted arrays joined with \n —
   no nested backtick escaping, fully safe in RN metro bundler.
   cameraPosition passed as explicit uniform (mobile WebGL safe).
───────────────────────────────────────────────────────────── */

// prettier-ignore
const buildHTML = () => {

  /* ── Earth GLSL (precision mediump — mobile GPU safe) ─────── */
  const earthVert = [
    'precision mediump float;',
    'varying vec3 vWorldNormal;',
    'varying vec3 vWorldPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorldPos    = wp.xyz;',
    '  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}',
  ].join('\n');

  const earthFrag = [
    'precision mediump float;',
    'uniform sampler2D uDay;',
    'uniform sampler2D uNight;',
    'uniform sampler2D uWater;',
    'uniform vec3 uSun;',
    'uniform vec3 uCam;',
    'uniform float uGlow;',
    'varying vec3 vWorldNormal;',
    'varying vec3 vWorldPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec3 N = normalize(vWorldNormal);',
    '  vec3 V = normalize(uCam - vWorldPos);',
    '  vec3 L = normalize(uSun);',
    '  float nDotL = dot(N, L);',
    '  float day   = smoothstep(-0.15, 0.25, nDotL);',
    '  vec3 dayRGB   = texture2D(uDay,   vUv).rgb;',
    '  vec3 nightRGB = texture2D(uNight, vUv).rgb;',
    '  float water   = texture2D(uWater, vUv).r;',
    // day shading
    '  float diff = max(0.0, nDotL);',
    '  vec3 dayLit = dayRGB * (0.06 + 0.94 * diff);',
    // ocean specular
    '  vec3 H  = normalize(L + V);',
    '  float sp = pow(max(0.0, dot(N, H)), 120.0) * water * 0.9;',
    '  dayLit += vec3(0.92, 0.96, 1.0) * sp * day;',
    // rim atmosphere
    '  float rim = pow(1.0 - max(0.0, dot(N, V)), 4.0);',
    '  dayLit += vec3(0.2, 0.42, 0.95) * rim * day * 0.5;',
    // twilight band
    '  float twi = smoothstep(-0.15, 0.0, nDotL) * (1.0 - smoothstep(0.0, 0.25, nDotL));',
    '  dayLit += vec3(0.85, 0.4, 0.08) * twi * 0.4;',
    // city lights
    '  vec3 cityLights = nightRGB * 1.7 * (1.0 - day);',
    '  vec3 color = dayLit * day + cityLights;',
    '  color *= uGlow;',
    '  gl_FragColor = vec4(color, 1.0);',
    '}',
  ].join('\n');

  /* ── Atmosphere GLSL ────────────────────────────────────────── */
  const atmosVert = [
    'precision mediump float;',
    'varying vec3 vWorldNormal;',
    'varying vec3 vWorldPos;',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorldPos    = wp.xyz;',
    '  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);',
    '  gl_Position  = projectionMatrix * viewMatrix * wp;',
    '}',
  ].join('\n');

  const atmosFrag = [
    'precision mediump float;',
    'uniform vec3 uSun;',
    'uniform vec3 uCam;',
    'varying vec3 vWorldNormal;',
    'varying vec3 vWorldPos;',
    'void main() {',
    '  vec3 N = normalize(vWorldNormal);',
    '  vec3 V = normalize(uCam - vWorldPos);',
    '  float sunDot = max(0.0, dot(N, normalize(uSun)));',
    '  float rim    = pow(1.0 - max(0.0, dot(N, V)), 4.5);',
    '  vec3 day   = mix(vec3(0.12, 0.32, 0.9), vec3(0.28, 0.52, 1.0), sunDot);',
    '  vec3 night = vec3(0.0, 0.015, 0.05);',
    '  vec3 col = mix(night, day, sunDot * 0.8 + 0.2);',
    '  float a = rim * 0.72 * (0.25 + 0.75 * (0.3 + 0.7 * sunDot));',
    '  gl_FragColor = vec4(col, a);',
    '}',
  ].join('\n');

  const outerAtmosFrag = [
    'precision mediump float;',
    'uniform vec3 uSun;',
    'uniform vec3 uCam;',
    'varying vec3 vWorldNormal;',
    'varying vec3 vWorldPos;',
    'void main() {',
    '  vec3 N = normalize(vWorldNormal);',
    '  vec3 V = normalize(uCam - vWorldPos);',
    '  float sunDot = max(0.0, dot(N, normalize(uSun)));',
    '  float rim = pow(0.52 - max(0.0, dot(N, V)), 5.0);',
    '  float a = max(0.0, rim) * 0.4 * (0.4 + 0.6 * sunDot);',
    '  gl_FragColor = vec4(0.2, 0.48, 1.0, a);',
    '}',
  ].join('\n');

  /* ── Inline JSON for shaders (safe transport into HTML) ─────── */
  const shaders = JSON.stringify({ earthVert, earthFrag, atmosVert, atmosFrag, outerAtmosFrag });

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
.lbl{
  position:absolute;
  font-family:-apple-system,'Helvetica Neue',sans-serif;
  font-size:9px;letter-spacing:3px;font-weight:600;
  text-transform:uppercase;white-space:nowrap;
  color:rgba(195,220,255,0.9);
  text-shadow:0 0 10px rgba(120,180,255,0.9),0 0 20px rgba(80,140,255,0.5);
  transform:translate(-50%,-130%);
  transition:opacity 0.7s;
}
.lbl-main{font-size:11px;letter-spacing:4px}
.dot{
  position:absolute;width:4px;height:4px;border-radius:50%;
  background:rgba(200,225,255,0.95);
  transform:translate(-50%,-50%);
  box-shadow:0 0 7px 2px rgba(160,210,255,0.7);
  transition:opacity 0.7s;
}
#msg{
  position:absolute;top:50%;left:50%;
  transform:translate(-50%,-50%);
  color:rgba(180,200,255,0.4);
  font-family:-apple-system,sans-serif;
  font-size:11px;letter-spacing:3px;
  text-align:center;
}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="msg">LOADING EARTH...</div>
<div id="ui">
  <div class="lbl lbl-main" id="lTR" style="opacity:0">TÜRKİYE</div>
  <div class="dot" id="dTR" style="opacity:0"></div>
  <div class="lbl" id="lIS" style="opacity:0">İstanbul</div>
  <div class="dot" id="dIS" style="opacity:0"></div>
  <div class="lbl" id="lAN" style="opacity:0">Ankara</div>
  <div class="dot" id="dAN" style="opacity:0"></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js"></script>
<script>
(function(){
var S = ${shaders};

// ── Renderer ──────────────────────────────────────────────────
var canvas = document.getElementById('c');
var renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: false,
    alpha: false,
    precision: 'mediump',
    powerPreference: 'default',
    preserveDrawingBuffer: false
  });
} catch(e) {
  document.getElementById('msg').textContent = 'WebGL unavailable';
  return;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// ── Scene / Camera ────────────────────────────────────────────
var scene  = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(0, 0.1, 2.7);

// ── Stars ─────────────────────────────────────────────────────
(function() {
  var N = 1800;
  var pos = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) {
    var r     = 55 + Math.random() * 40;
    var theta = Math.random() * Math.PI * 2;
    var phi   = Math.acos(2 * Math.random() - 1);
    pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i*3+2] = r * Math.cos(phi);
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.07, sizeAttenuation: true,
    transparent: true, opacity: 0.8
  })));
})();

// ── Sun / camera uniforms ─────────────────────────────────────
var SUN = new THREE.Vector3(1.4, 0.5, 0.9).normalize();
var CAM = camera.position.clone();

// ── Lighting ──────────────────────────────────────────────────
var sunLight = new THREE.DirectionalLight(0xfff8e8, 2.0);
sunLight.position.copy(SUN);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x0d1a33, 0.5));

// ── Earth group ───────────────────────────────────────────────
var earthGroup = new THREE.Group();
scene.add(earthGroup);

// ── Voice state ───────────────────────────────────────────────
var targetGlow = 1.0, currentGlow = 1.0;
window.onVoiceState = function(s) {
  if      (s === 'speaking')  targetGlow = 1.4;
  else if (s === 'listening') targetGlow = 1.12;
  else                        targetGlow = 1.0;
};

// ── Shared uniform block for camera ───────────────────────────
var sharedUniforms = {
  uSun: { value: SUN },
  uCam: { value: CAM }
};

// ── Atmosphere spheres (added before Earth loads) ─────────────
var atmosInner = new THREE.ShaderMaterial({
  uniforms: { uSun: sharedUniforms.uSun, uCam: sharedUniforms.uCam },
  vertexShader:   S.atmosVert,
  fragmentShader: S.atmosFrag,
  side: THREE.FrontSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.026, 48, 48), atmosInner));

var atmosOuter = new THREE.ShaderMaterial({
  uniforms: { uSun: sharedUniforms.uSun, uCam: sharedUniforms.uCam },
  vertexShader:   S.atmosVert,
  fragmentShader: S.outerAtmosFrag,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.18, 36, 36), atmosOuter));

// ── Orbit rings ───────────────────────────────────────────────
[[1.38, Math.PI/2, 0.09], [1.6, Math.PI/2 + 0.22, 0.05]].forEach(function(r) {
  var geo = new THREE.TorusGeometry(r[0], 0.0007, 2, 140);
  var mat = new THREE.MeshBasicMaterial({ color: 0x4499ff, transparent: true, opacity: r[2] });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = r[1];
  scene.add(mesh);
});

// ── Load textures ─────────────────────────────────────────────
var loader = new THREE.TextureLoader();
var CDN = 'https://unpkg.com/three-globe/example/img/';
var earthMat = null;
var cloudMesh = null;

function loadTex(url, cb) {
  loader.load(url, cb, undefined, function(err) {
    console.warn('Texture failed:', url, err);
  });
}

var texCount = 0;
var textures = {};
var TEX_KEYS = ['day', 'night', 'water', 'clouds'];
var TEX_URLS = [
  CDN + 'earth-blue-marble.jpg',
  CDN + 'earth-night.jpg',
  CDN + 'earth-water.png',
  CDN + 'clouds.png'
];

TEX_KEYS.forEach(function(key, i) {
  loadTex(TEX_URLS[i], function(tex) {
    textures[key] = tex;
    texCount++;
    if (texCount === TEX_KEYS.length) onTexturesLoaded();
  });
});

function onTexturesLoaded() {
  document.getElementById('msg').style.display = 'none';

  // Earth surface
  earthMat = new THREE.ShaderMaterial({
    uniforms: {
      uDay:   { value: textures.day },
      uNight: { value: textures.night },
      uWater: { value: textures.water },
      uSun:   sharedUniforms.uSun,
      uCam:   sharedUniforms.uCam,
      uGlow:  { value: 1.0 }
    },
    vertexShader:   S.earthVert,
    fragmentShader: S.earthFrag
  });
  var earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 56), earthMat);
  earthGroup.add(earthMesh);

  // Cloud layer
  cloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, 40, 40),
    new THREE.MeshPhongMaterial({
      map: textures.clouds,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
  );
  earthGroup.add(cloudMesh);
}

// Fallback: if textures take > 10s draw a procedural Earth
setTimeout(function() {
  if (!earthMat) {
    document.getElementById('msg').textContent = 'Using procedural Earth';
    var fbMat = new THREE.MeshPhongMaterial({ color: 0x1a6699, shininess: 30 });
    earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), fbMat));
    document.getElementById('msg').style.display = 'none';
  }
}, 10000);

// ── Geographic labels ─────────────────────────────────────────
function ll(lat, lon) {
  var phi   = (90 - lat) * Math.PI / 180;
  var theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -Math.sin(phi) * Math.cos(theta),
     Math.cos(phi),
     Math.sin(phi) * Math.sin(theta)
  );
}
var GEO = [
  { lb:'lTR', dt:'dTR', p: ll(39.0,  35.0)  },
  { lb:'lIS', dt:'dIS', p: ll(41.01, 28.98) },
  { lb:'lAN', dt:'dAN', p: ll(39.93, 32.86) }
];

// ── Animation ─────────────────────────────────────────────────
var SPIN  = (Math.PI * 2) / 50;
var clock = new THREE.Clock();
var _v3   = new THREE.Vector3();
var _camFwd = new THREE.Vector3(0, 0, 1);

function tick() {
  requestAnimationFrame(tick);
  var dt = clock.getDelta();

  earthGroup.rotation.y += SPIN * dt;
  if (cloudMesh) cloudMesh.rotation.y += SPIN * dt * 1.07;

  // Smooth glow
  currentGlow += (targetGlow - currentGlow) * 0.04;
  if (earthMat) earthMat.uniforms.uGlow.value = currentGlow;

  // Labels
  var W = window.innerWidth, H = window.innerHeight;
  GEO.forEach(function(g) {
    _v3.copy(g.p).applyMatrix4(earthGroup.matrixWorld);
    var facing = _v3.clone().normalize().dot(_camFwd);
    var op = facing > 0.1 ? Math.min(1, (facing - 0.1) / 0.35).toFixed(2) : '0';
    _v3.project(camera);
    var sx = ( _v3.x * 0.5 + 0.5) * W;
    var sy = (-_v3.y * 0.5 + 0.5) * H;
    var le = document.getElementById(g.lb);
    var de = document.getElementById(g.dt);
    if (le) { le.style.left = sx+'px'; le.style.top = sy+'px'; le.style.opacity = op; }
    if (de) { de.style.left = sx+'px'; de.style.top = (sy+10)+'px'; de.style.opacity = op; }
  });

  renderer.render(scene, camera);
}
tick();

// ── Resize ────────────────────────────────────────────────────
window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── WebGL context loss recovery ───────────────────────────────
canvas.addEventListener('webglcontextlost', function(e) {
  e.preventDefault();
}, false);
canvas.addEventListener('webglcontextrestored', function() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

})();
</script>
</body>
</html>`;
};

const EARTH_HTML = buildHTML();

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
        allowFileAccess
        domStorageEnabled
        cacheEnabled={false}
        onError={(e) => console.warn("Earth WebView error:", e.nativeEvent)}
        onHttpError={(e) => console.warn("Earth HTTP error:", e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    width: "100%",
    backgroundColor: "#000005",
    overflow: "hidden",
  },
  web: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
