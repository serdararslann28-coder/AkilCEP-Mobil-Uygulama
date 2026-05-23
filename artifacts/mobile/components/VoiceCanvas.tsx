/**
 * VoiceCanvas — full-screen canvas particle engine for Voice Mode.
 * Handles: starfield, ambient dust, energy ripple rings, particle formation.
 * Communicates via window.setVoiceState(state) injection.
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props { voiceState: VoiceState; }

const CANVAS_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#020208;overflow:hidden}
canvas{position:absolute;top:0;left:0;display:block}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function(){
var W=window.innerWidth||375, H=window.innerHeight||812;
var CX=W/2, CY=H*0.42; // logo center Y
var c=document.getElementById('c');
c.width=W; c.height=H;
var ctx=c.getContext('2d');

// ── Voice state ───────────────────────────────────────────────────────────────
var STATE='listening';
window.setVoiceState=function(s){ STATE=s; };

// ── Stars (drawn once on offscreen canvas) ───────────────────────────────────
var starCanvas=document.createElement('canvas');
starCanvas.width=W; starCanvas.height=H;
var sc=starCanvas.getContext('2d');
var STARS=[];
var seed=0xc0ffeeba;
function rng(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(var i=0;i<220;i++){
  STARS.push({
    x:rng()*W, y:rng()*H,
    r:rng()*0.85+0.15,
    a:rng()*0.32+0.04,
    twinkleSpeed: rng()*0.008+0.002,
    twinklePhase: rng()*Math.PI*2,
  });
}
function drawStars(){
  sc.clearRect(0,0,W,H);
  STARS.forEach(function(s){
    sc.beginPath();
    sc.arc(s.x,s.y,s.r,0,Math.PI*2);
    sc.fillStyle='rgba(255,255,255,'+s.a+')';
    sc.fill();
  });
}
drawStars();

// ── Dust particles ────────────────────────────────────────────────────────────
var NDUST=90;
var dust=[];
for(var d=0;d<NDUST;d++){
  dust.push({
    x:rng()*W, y:rng()*H,
    vx:(rng()-0.5)*0.18,
    vy:-(rng()*0.22+0.04),
    r: rng()*1.0+0.25,
    a: rng()*0.18+0.02,
    life:rng(),maxLife:1,
    originX:rng()*W, originY:rng()*H,
  });
}
function resetDust(p){
  // Spawn near logo center with outward drift
  var angle=rng()*Math.PI*2;
  var dist=rng()*60+20;
  p.x=CX+Math.cos(angle)*dist;
  p.y=CY+Math.sin(angle)*dist;
  p.vx=(Math.cos(angle)*0.15+( rng()-0.5)*0.1);
  p.vy=(Math.sin(angle)*0.15+(-(rng()*0.3+0.05)));
  p.r=rng()*1.2+0.2;
  p.a=rng()*0.22+0.04;
  p.life=0;
  p.maxLife=rng()*180+100;
}
dust.forEach(function(p){resetDust(p); p.life=rng()*p.maxLife;});

// ── Energy rings ──────────────────────────────────────────────────────────────
var rings=[];
var ringTimer=0;

function spawnRing(){
  var isSpeaking=(STATE==='speaking');
  rings.push({
    r:5,
    maxR: isSpeaking ? 240 : 180,
    speed: isSpeaking ? 1.8 : 1.0,
    alpha: isSpeaking ? 0.28 : 0.16,
    width: isSpeaking ? 1.2 : 0.8,
  });
}

// ── Formation intro particles ─────────────────────────────────────────────────
// Particles fly from edges toward logo center then scatter
var formDone=false;
var formParticles=[];
var NFORM=55;
for(var f=0;f<NFORM;f++){
  var angle=rng()*Math.PI*2;
  var startDist=Math.max(W,H)*0.6+rng()*200;
  formParticles.push({
    x: CX+Math.cos(angle)*startDist,
    y: CY+Math.sin(angle)*startDist,
    tx: CX+(rng()-0.5)*30,
    ty: CY+(rng()-0.5)*30,
    r: rng()*1.6+0.4,
    a: rng()*0.55+0.25,
    speed: rng()*0.04+0.025,
    delay: rng()*0.4,
    t: 0,
  });
}
var formAlpha=1.0; // fades to 0 once done

// ── Twinkle ───────────────────────────────────────────────────────────────────
var T=0;

// ── Render loop ───────────────────────────────────────────────────────────────
var lastTime=-1;

function frame(ts){
  requestAnimationFrame(frame);
  var dt=lastTime<0?16:Math.min(ts-lastTime,50);
  lastTime=ts;
  T+=dt*0.001;

  // ── Background: dark fade (motion trail) ──
  ctx.fillStyle='rgba(2,2,8,0.78)';
  ctx.fillRect(0,0,W,H);

  // ── Stars ──
  ctx.drawImage(starCanvas,0,0);
  // Twinkle pass
  STARS.forEach(function(s){
    s.twinklePhase+=s.twinkleSpeed*dt*0.001*60;
    var ta=s.a*(0.6+0.4*Math.sin(s.twinklePhase));
    ctx.beginPath();
    ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,'+ta+')';
    ctx.fill();
  });

  // ── Formation intro ──
  if(formAlpha>0.01){
    var allDone=true;
    formParticles.forEach(function(p){
      p.t+=dt*0.001;
      if(p.t<p.delay){allDone=false;return;}
      var progress=Math.min(1,(p.t-p.delay)*p.speed*3);
      var ex=p.x+(p.tx-p.x)*easeOut(progress);
      var ey=p.y+(p.ty-p.y)*easeOut(progress);
      if(progress<1)allDone=false;
      var alpha=p.a*formAlpha*(progress<0.1?progress*10:1)*(progress>0.85?(1-progress)*6.7:1);
      if(alpha<=0)return;
      ctx.beginPath();
      ctx.arc(ex,ey,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,'+alpha+')';
      ctx.fill();
    });
    if(allDone)formAlpha=Math.max(0,formAlpha-dt*0.001*0.8);
  }

  // ── Dust particles ──
  var dustSpeed = STATE==='speaking' ? 1.6 : STATE==='listening' ? 1.1 : 0.6;
  dust.forEach(function(p){
    p.x+=p.vx*dustSpeed;
    p.y+=p.vy*dustSpeed;
    p.life+=1;
    if(p.life>p.maxLife||p.y<-10||p.x<-10||p.x>W+10){resetDust(p);}
    var lifeRatio=p.life/p.maxLife;
    var alpha=p.a*(lifeRatio<0.15?lifeRatio/0.15:lifeRatio>0.75?(1-lifeRatio)/0.25:1);
    if(alpha<=0)return;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fillStyle='rgba(200,220,255,'+alpha+')';
    ctx.fill();
  });

  // ── Energy rings ──
  if(STATE!=='idle'){
    ringTimer+=dt;
    var interval=STATE==='speaking'?520:820;
    if(ringTimer>interval){ ringTimer=0; spawnRing(); }
  }
  rings=rings.filter(function(ring){
    ring.r+=ring.speed*(STATE==='speaking'?1.5:1.0);
    var fade=1-(ring.r/ring.maxR);
    if(fade<=0)return false;
    ctx.beginPath();
    ctx.arc(CX,CY,ring.r,0,Math.PI*2);
    ctx.strokeStyle='rgba(220,235,255,'+(ring.alpha*fade)+')';
    ctx.lineWidth=ring.width;
    ctx.stroke();
    return true;
  });

  // ── Center glow ──
  var glowIntensity = STATE==='speaking'?0.18:STATE==='listening'?0.10:0.04;
  var glowPulse=glowIntensity*(1+0.18*Math.sin(T*1.8));
  var glowR=STATE==='speaking'?110:STATE==='listening'?85:60;
  var grd=ctx.createRadialGradient(CX,CY,0,CX,CY,glowR*(1+0.08*Math.sin(T*1.2)));
  grd.addColorStop(0,'rgba(230,240,255,'+glowPulse+')');
  grd.addColorStop(0.4,'rgba(200,220,255,'+(glowPulse*0.45)+')');
  grd.addColorStop(1,'rgba(150,180,255,0)');
  ctx.fillStyle=grd;
  ctx.beginPath();
  ctx.arc(CX,CY,glowR*1.8,0,Math.PI*2);
  ctx.fill();
}

function easeOut(t){return 1-Math.pow(1-t,2.8);}

requestAnimationFrame(frame);

window.addEventListener('resize',function(){
  W=window.innerWidth; H=window.innerHeight;
  CX=W/2; CY=H*0.42;
  c.width=W; c.height=H;
  starCanvas.width=W; starCanvas.height=H;
  drawStars();
});
})();
</script>
</body>
</html>`;

export default function VoiceCanvas({ voiceState }: Props) {
  const webRef = useRef<any>(null);

  useEffect(() => {
    webRef.current?.injectJavaScript(
      `if(window.setVoiceState)window.setVoiceState('${voiceState}');true;`
    );
  }, [voiceState]);

  if (Platform.OS === "web") {
    return <View style={styles.fallback} />;
  }

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        source={{ html: CANVAS_HTML }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={["*"]}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        domStorageEnabled
        allowFileAccess
        onError={(e) => console.warn("VoiceCanvas error:", e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { ...StyleSheet.absoluteFillObject, backgroundColor: "#020208" },
  web:      { flex: 1, backgroundColor: "transparent" },
  fallback: { ...StyleSheet.absoluteFillObject, backgroundColor: "#020208" },
});
