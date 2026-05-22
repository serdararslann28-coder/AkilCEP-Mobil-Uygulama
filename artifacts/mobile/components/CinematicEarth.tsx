/**
 * CinematicEarth — Three.js WebGL globe with NASA Blue Marble texture.
 *
 * Architecture:
 *   - Three.js loaded from jsDelivr CDN (unpkg fallback) via dynamic <script>
 *   - SphereGeometry(1, 64, 48) — proper equirectangular UV mapping, no distortion
 *   - Texture loaded via manual Image() — bypasses THREE.TextureLoader's default
 *     crossOrigin='anonymous' which breaks in null-origin WebView context
 *   - MeshPhongMaterial for realistic Phong shading with ocean specular
 *   - Directional light from lon=130°E / lat=20°N (Arabia side) → Turkey in twilight
 *   - BackSide atmosphere sphere for blue limb ring
 *   - Labels projected each frame via matrixWorld + camera.project()
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

// ─── HTML template ────────────────────────────────────────────────────────────
const EARTH_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000008;overflow:hidden}
canvas{display:block;position:absolute;top:0;left:0}
#ui{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden}
.lb{
  position:absolute;
  font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;
  white-space:nowrap;text-transform:uppercase;
  color:rgba(205,228,255,0.78);
  pointer-events:none;
  transition:opacity 0.9s ease;
}
#lTR{font-size:7px;font-weight:700;letter-spacing:2.5px;transform:translate(-50%,-270%)}
#lIS{font-size:5px;font-weight:600;letter-spacing:1.8px;transform:translate(-118%,-155%)}
#lAN{font-size:5px;font-weight:600;letter-spacing:1.8px;transform:translate(18%,-155%)}
.dot{
  position:absolute;width:2px;height:2px;border-radius:50%;
  background:rgba(200,228,255,0.62);transform:translate(-50%,-50%);
  pointer-events:none;transition:opacity 0.9s ease;
}
</style>
</head>
<body>
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

// ── 1. Load Three.js from CDN with fallback ──────────────────────────────────
var CDNS = [
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
  'https://unpkg.com/three@0.160.0/build/three.min.js',
];
var cdnIdx = 0;

function tryLoadCDN() {
  if (cdnIdx >= CDNS.length) { showFallback(); return; }
  var s = document.createElement('script');
  s.onload  = onThreeReady;
  s.onerror = function() { cdnIdx++; tryLoadCDN(); };
  s.src     = CDNS[cdnIdx++];
  document.head.appendChild(s);
}

function showFallback() {
  // Deep-blue gradient placeholder if CDN unavailable
  document.body.style.background =
    'radial-gradient(circle at 50% 52%, #0a1844 0%, #030615 60%, #000008 100%)';
}

// ── 2. Three.js scene ────────────────────────────────────────────────────────
function onThreeReady() {
  var W = window.innerWidth  || 375;
  var H = window.innerHeight || 812;

  // Scene / camera
  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  camera.position.z = 2.45;

  // WebGL renderer
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000008, 1);
  // Insert canvas BEFORE the label overlay
  document.body.insertBefore(renderer.domElement, document.getElementById('ui'));

  // ── Earth sphere ───────────────────────────────────────────────────────────
  // 64×48 segments — crisp at 2× DPR, lightweight on mobile GPU
  var earthGeo = new THREE.SphereGeometry(1, 64, 48);
  var earthMat = new THREE.MeshPhongMaterial({
    color:     new THREE.Color(0x224488), // ocean placeholder until texture loads
    shininess: 7,
    specular:  new THREE.Color(0x1a2a44),
  });
  var earth = new THREE.Mesh(earthGeo, earthMat);
  // Initial rotation: computed so Turkey (35°E) starts left-of-center
  // Derivation: Three.js SphereGeometry UV has lon=-90°W at +Z (rot=0);
  // rotY = -2.50 rad → Turkey's world phi ≈ 1.25 rad (slightly left of π/2 = centre)
  earth.rotation.y = -2.50;
  scene.add(earth);

  // ── Atmosphere — BackSide sphere for blue limb ring ────────────────────────
  var atmosMat = new THREE.MeshBasicMaterial({
    color:       new THREE.Color(0x2a55cc),
    side:        THREE.BackSide,
    transparent: true,
    opacity:     0.10,
  });
  var atmos = new THREE.Mesh(new THREE.SphereGeometry(1.018, 48, 32), atmosMat);
  atmos.rotation.y = earth.rotation.y;
  scene.add(atmos);

  // Faint outer halo
  var haloMat = new THREE.MeshBasicMaterial({
    color:       new THREE.Color(0x1a3899),
    side:        THREE.BackSide,
    transparent: true,
    opacity:     0.040,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.09, 32, 24), haloMat));

  // ── Lighting ───────────────────────────────────────────────────────────────
  // Sun at lon=130°E / lat=20°N.  World-space position derived from initial
  // earth rotation (-2.50 rad) so that Turkey (35°E) is near the terminator.
  // After rotating the initial sun-lon (130°E) through rotY=-2.50:
  //   x_world ≈ 0.94,  y_world ≈ 0.34,  z_world ≈ -0.09
  // Turkey sun-factor ≈ -0.08  →  deep twilight, city lights visible  ✓
  var sun = new THREE.DirectionalLight(0xfff8f0, 1.08);
  sun.position.set(9.4, 3.4, -0.9);
  scene.add(sun);

  // Very dark blue fill light for the night side — suggests faint earthshine
  scene.add(new THREE.AmbientLight(0x060814, 0.45));

  // ── Texture loading ────────────────────────────────────────────────────────
  // Manual Image() — THREE.TextureLoader sets crossOrigin='anonymous' which
  // causes CORS failure when the WebView runs from a null origin.
  var TEX_URLS = [
    'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/textures/planets/earth_atmos_2048.jpg',
    'https://unpkg.com/three@0.160.0/examples/textures/planets/earth_atmos_2048.jpg',
    'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
  ];
  var texIdx = 0;
  function tryLoadTex() {
    if (texIdx >= TEX_URLS.length) return;
    var img = new Image();
    // NO crossOrigin attribute — null-origin WebView rejects CORS requests
    img.onload = function() {
      var tex = new THREE.Texture(img);
      // Correct sRGB gamma so colours match the original texture
      if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      earthMat.map   = tex;
      earthMat.color = new THREE.Color(1, 1, 1); // let texture speak for itself
      earthMat.needsUpdate = true;
    };
    img.onerror = function() { texIdx++; tryLoadTex(); };
    img.src = TEX_URLS[texIdx++];
  }
  tryLoadTex();

  // ── Labels — project lat/lon to screen each frame ─────────────────────────
  // Pre-allocated vectors to avoid per-frame GC pressure
  var _pos = new THREE.Vector3();
  var _nrm = new THREE.Vector3();

  function placeLabel(lblId, dotId, lat, lon) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    // Local sphere position using Three.js SphereGeometry UV convention:
    //   x = cos(lat)*cos(lon),  y = sin(lat),  z = cos(lat)*sin(lon)
    // (This matches the derived UV → 3D mapping: phi = π + lonR, theta = π/2 - latR)
    _pos.set(
      Math.cos(latR) * Math.cos(lonR),
      Math.sin(latR),
      Math.cos(latR) * Math.sin(lonR)
    );
    _nrm.copy(_pos);

    // World space
    _pos.applyMatrix4(earth.matrixWorld);
    _nrm.transformDirection(earth.matrixWorld);

    // Visibility: dot of (camera→point direction) with surface normal
    var toCamDot =
      (camera.position.x - _pos.x) * _nrm.x +
      (camera.position.y - _pos.y) * _nrm.y +
      (camera.position.z - _pos.z) * _nrm.z;

    var lb  = document.getElementById(lblId);
    var dot = document.getElementById(dotId);
    if (!lb || !dot) return;

    if (toCamDot < 0.06) {
      lb.style.opacity  = '0';
      dot.style.opacity = '0';
      return;
    }
    // Smooth fade-in near the horizon
    var fade = Math.min(1, (toCamDot - 0.06) * 5.5);

    // Project to screen (modifies _pos in-place)
    _pos.project(camera);
    var sx = (_pos.x  + 1) * W * 0.5;
    var sy = (-_pos.y + 1) * H * 0.5;

    lb.style.left     = sx + 'px';
    lb.style.top      = sy + 'px';
    dot.style.left    = sx + 'px';
    dot.style.top     = sy + 'px';
    lb.style.opacity  = String(fade * 0.78);
    dot.style.opacity = String(fade * 0.62);
  }

  // ── Animation loop ─────────────────────────────────────────────────────────
  var SPEED = 2.6;   // degrees / second  (idle)
  var lastT = -1;

  window.onVoiceState = function(state) {
    SPEED = state === 'speaking' ? 7.5 : state === 'listening' ? 5.2 : 2.6;
  };

  function frame(t) {
    requestAnimationFrame(frame);

    var dt = lastT < 0 ? 0 : Math.min((t - lastT) / 1000, 0.10);
    lastT = t;

    earth.rotation.y += SPEED * dt * Math.PI / 180;
    atmos.rotation.y  = earth.rotation.y;

    // Must be called before label projection so matrixWorld is current
    earth.updateMatrixWorld(true);

    placeLabel('lTR', 'dTR', 39.0, 35.0);  // Turkey
    placeLabel('lIS', 'dIS', 41.0, 29.0);  // Istanbul
    placeLabel('lAN', 'dAN', 39.9, 32.9);  // Ankara

    renderer.render(scene, camera);
  }

  requestAnimationFrame(frame);

  // ── Resize ─────────────────────────────────────────────────────────────────
  window.addEventListener('resize', function() {
    W = window.innerWidth;
    H = window.innerHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
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
