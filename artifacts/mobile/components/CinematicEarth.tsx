import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";

interface Props {
  voiceState: VoiceState;
}

/* ─────────────────────────────────────────────────────────────
   Three.js cinematic Earth — runs inside a WebView for full
   GPU shader access (PBR, atmospheric scattering, GLSL).
   Communicates with React Native via window.onVoiceState().
───────────────────────────────────────────────────────────── */
const EARTH_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000005;overflow:hidden}
canvas{position:absolute;inset:0;width:100%;height:100%}
#ui{position:absolute;inset:0;pointer-events:none}
.lbl{
  position:absolute;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;
  font-size:9px;letter-spacing:3px;font-weight:500;
  text-transform:uppercase;white-space:nowrap;
  color:rgba(195,220,255,0.9);
  text-shadow:0 0 10px rgba(120,180,255,0.9),0 0 20px rgba(80,140,255,0.5);
  transform:translate(-50%,-130%);
  transition:opacity 0.7s ease;
}
.lbl-main{font-size:11px;font-weight:700;letter-spacing:4px}
.dot{
  position:absolute;
  width:4px;height:4px;border-radius:50%;
  background:rgba(200,225,255,0.95);
  transform:translate(-50%,-50%);
  box-shadow:0 0 8px 3px rgba(160,210,255,0.7);
  transition:opacity 0.7s ease;
}
#loading{
  position:absolute;top:50%;left:50%;
  transform:translate(-50%,-50%);
  color:rgba(180,200,255,0.35);
  font-family:-apple-system,sans-serif;
  font-size:11px;letter-spacing:3px;
}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="loading">LOADING EARTH...</div>
<div id="ui">
  <div class="lbl lbl-main" id="lTR" style="opacity:0">TÜRKİYE</div>
  <div class="dot" id="dTR" style="opacity:0"></div>
  <div class="lbl" id="lIS" style="opacity:0">İstanbul</div>
  <div class="dot" id="dIS" style="opacity:0"></div>
  <div class="lbl" id="lAN" style="opacity:0">Ankara</div>
  <div class="dot" id="dAN" style="opacity:0"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.min.js"></script>
<script>
(function(){
'use strict';

// ── Renderer ──────────────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: false, powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ── Scene / Camera ────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.01, 200);
camera.position.set(0, 0.1, 2.7);

// ── Stars ─────────────────────────────────────────────────────
(function buildStars() {
  const N = 3000;
  const pos = new Float32Array(N * 3);
  const sizes = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = 50 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i*3+2] = r * Math.cos(phi);
    sizes[i] = 0.04 + Math.random() * 0.08;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.065, sizeAttenuation: true, transparent: true, opacity: 0.85
  })));
})();

// ── Sun direction (world space) ───────────────────────────────
const SUN = new THREE.Vector3(1.4, 0.5, 0.9).normalize();

// ── Lighting ──────────────────────────────────────────────────
const sunLight = new THREE.DirectionalLight(0xfff8e8, 2.2);
sunLight.position.copy(SUN);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x0d1a33, 0.4));
// Subtle fill light from opposite
const fillLight = new THREE.DirectionalLight(0x1a2a50, 0.15);
fillLight.position.set(-1, -0.3, -0.5);
scene.add(fillLight);

// ── Earth Group ───────────────────────────────────────────────
const earthGroup = new THREE.Group();
scene.add(earthGroup);

// ── Voice state ───────────────────────────────────────────────
let targetGlow = 1.0, currentGlow = 1.0;
let targetPulse = 0.0, currentPulse = 0.0;
window.onVoiceState = function(s) {
  if (s === 'speaking')       { targetGlow = 1.4; targetPulse = 1.0; }
  else if (s === 'listening') { targetGlow = 1.12; targetPulse = 0.5; }
  else                        { targetGlow = 1.0;  targetPulse = 0.0; }
};

// ── GLSL: Earth ───────────────────────────────────────────────
const earthVert = \`
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos    = wp.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
\`;

const earthFrag = \`
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uWater;
  uniform vec3 uSun;
  uniform float uGlow;
  uniform float uTime;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSun);

    float nDotL  = dot(N, L);
    float day    = smoothstep(-0.15, 0.25, nDotL);

    vec3 dayRGB   = texture2D(uDay,   vUv).rgb;
    vec3 nightRGB = texture2D(uNight, vUv).rgb;
    float water   = texture2D(uWater, vUv).r;

    // Day lighting
    float diffuse = max(0.0, nDotL);
    vec3 dayLit = dayRGB * (0.06 + 0.94 * diffuse);

    // Ocean specular
    vec3 H   = normalize(L + V);
    float sp = pow(max(0.0, dot(N, H)), 180.0) * water * 1.0;
    dayLit += vec3(0.92, 0.96, 1.0) * sp * day;

    // Atmospheric rim on day side
    float rim = pow(1.0 - max(0.0, dot(N, V)), 4.5);
    dayLit += vec3(0.2, 0.4, 0.95) * rim * day * 0.55;

    // Twilight golden-orange band at terminator
    float twi = smoothstep(-0.15, 0.0, nDotL) * (1.0 - smoothstep(0.0, 0.25, nDotL));
    dayLit += vec3(0.85, 0.42, 0.08) * twi * 0.45;

    // Night city lights — glow in darkness
    float nightFac = 1.0 - day;
    vec3 cityLights = nightRGB * 1.8 * nightFac;

    // AI speaking pulse — soft brightening
    float pulse = sin(uTime * 3.0) * 0.5 + 0.5;

    vec3 color = dayLit * day + cityLights;
    color *= uGlow;

    gl_FragColor = vec4(color, 1.0);
  }
\`;

// ── GLSL: Atmosphere ──────────────────────────────────────────
const atmosVert = \`
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos    = wp.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position  = projectionMatrix * viewMatrix * wp;
  }
\`;

const atmosFrag = \`
  uniform vec3 uSun;
  uniform float uPulse;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSun);
    float sunDot = max(0.0, dot(N, L));
    float rim    = pow(1.0 - max(0.0, dot(N, V)), 4.8);
    vec3 dayAtm  = mix(vec3(0.12, 0.32, 0.9), vec3(0.3, 0.55, 1.0), sunDot);
    vec3 nightAtm = vec3(0.0, 0.015, 0.05);
    vec3 col = mix(nightAtm, dayAtm, sunDot * 0.8 + 0.2);
    float a  = rim * 0.78 * (0.25 + 0.75 * (0.3 + 0.7 * sunDot));
    a += uPulse * rim * 0.15;
    gl_FragColor = vec4(col, a);
  }
\`;

const outerAtmosFrag = \`
  uniform vec3 uSun;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSun);
    float sunDot = max(0.0, dot(N, L));
    float rim = pow(0.52 - max(0.0, dot(N, V)), 5.0);
    float a = max(0.0, rim) * 0.45 * (0.4 + 0.6 * sunDot);
    gl_FragColor = vec4(0.2, 0.48, 1.0, a);
  }
\`;

// Atmosphere inner
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1.026, 64, 64),
  new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uPulse: { value: 0.0 } },
    vertexShader: atmosVert, fragmentShader: atmosFrag,
    side: THREE.FrontSide, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false,
  })
));
// Atmosphere outer halo
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1.2, 48, 48),
  new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN } },
    vertexShader: atmosVert, fragmentShader: outerAtmosFrag,
    side: THREE.BackSide, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false,
  })
));

// ── Orbit lines ───────────────────────────────────────────────
[
  { r: 1.38, tilt: Math.PI/2,          opacity: 0.09 },
  { r: 1.62, tilt: Math.PI/2 + 0.22,  opacity: 0.055 },
].forEach(({ r, tilt, opacity }) => {
  const geo = new THREE.TorusGeometry(r, 0.0007, 2, 180);
  const mat = new THREE.MeshBasicMaterial({ color: 0x4499ff, transparent: true, opacity });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = tilt;
  scene.add(mesh);
});

// ── Load textures & assemble Earth ───────────────────────────
const loader = new THREE.TextureLoader();
const CDN = 'https://unpkg.com/three-globe/example/img/';
let earthMat, atmosMats = [], cloudMesh;

Promise.all([
  loader.loadAsync(CDN + 'earth-blue-marble.jpg'),
  loader.loadAsync(CDN + 'earth-night.jpg'),
  loader.loadAsync(CDN + 'earth-water.png'),
  loader.loadAsync(CDN + 'clouds.png'),
]).then(([day, night, water, clouds]) => {
  document.getElementById('loading').style.display = 'none';

  day.colorSpace   = THREE.SRGBColorSpace;
  night.colorSpace = THREE.SRGBColorSpace;

  // Earth surface
  earthMat = new THREE.ShaderMaterial({
    uniforms: {
      uDay:   { value: day },
      uNight: { value: night },
      uWater: { value: water },
      uSun:   { value: SUN },
      uGlow:  { value: 1.0 },
      uTime:  { value: 0.0 },
    },
    vertexShader: earthVert,
    fragmentShader: earthFrag,
  });
  earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1, 72, 72), earthMat));

  // Cloud layer
  cloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.013, 56, 56),
    new THREE.MeshPhongMaterial({
      map: clouds, transparent: true, opacity: 0.38,
      depthWrite: false, blending: THREE.NormalBlending,
    })
  );
  earthGroup.add(cloudMesh);

  // Update atmos uniforms now that we have atmos materials
  // (atmosphere meshes already added, they use SUN reference)
}).catch(err => {
  document.getElementById('loading').textContent = 'TEXTURE LOAD FAILED';
  console.error(err);
});

// ── Geo positions (lat/lon → 3D) ─────────────────────────────
function ll(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -Math.sin(phi) * Math.cos(theta),
     Math.cos(phi),
     Math.sin(phi) * Math.sin(theta)
  );
}

const GEO = [
  { lb:'lTR', dt:'dTR', p: ll(39.0,  35.0)  },
  { lb:'lIS', dt:'dIS', p: ll(41.01, 28.98) },
  { lb:'lAN', dt:'dAN', p: ll(39.93, 32.86) },
];

// ── Animation ─────────────────────────────────────────────────
const SPIN  = (Math.PI * 2) / 50; // one revolution per 50 s
const clock = new THREE.Clock();
const _v3   = new THREE.Vector3();
const _cam  = new THREE.Vector3(0, 0, 1); // camera look direction (Earth at origin)

function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  const elapsed = clock.elapsedTime;

  earthGroup.rotation.y += SPIN * dt;
  if (cloudMesh) cloudMesh.rotation.y += SPIN * dt * 1.07;

  // Smooth uniforms
  currentGlow  += (targetGlow  - currentGlow)  * 0.04;
  currentPulse += (targetPulse - currentPulse) * 0.04;
  if (earthMat) {
    earthMat.uniforms.uGlow.value = currentGlow;
    earthMat.uniforms.uTime.value = elapsed;
  }

  // Labels
  const W = innerWidth, H = innerHeight;
  GEO.forEach(({ lb, dt, p }) => {
    // Apply Earth rotation to get world position
    _v3.copy(p).applyMatrix4(earthGroup.matrixWorld);
    // How much does it face the camera?
    const facing = _v3.clone().normalize().dot(_cam);
    const op = facing > 0.1 ? Math.min(1, (facing - 0.1) / 0.35).toFixed(3) : '0';

    _v3.project(camera);
    const sx = ( _v3.x * 0.5 + 0.5) * W;
    const sy = (-_v3.y * 0.5 + 0.5) * H;

    const le = document.getElementById(lb);
    const de = document.getElementById(dt);
    if (le) { le.style.left = sx+'px'; le.style.top = sy+'px'; le.style.opacity = op; }
    if (de) { de.style.left = sx+'px'; de.style.top = (sy+10)+'px'; de.style.opacity = op; }
  });

  renderer.render(scene, camera);
}
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

})();
</script>
</body>
</html>`;

export default function CinematicEarth({ voiceState }: Props) {
  const webRef = useRef<any>(null);

  useEffect(() => {
    webRef.current?.injectJavaScript(
      `if(window.onVoiceState)window.onVoiceState('${voiceState}');true;`
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
