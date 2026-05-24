/**
 * VoiceCanvas v3 — cinematic particle engine.
 *
 * Opening: particles spawn at screen edges → fly to three-petal leaf positions
 *          → logo "solidifies" → particles drift into ambient mode.
 * Ongoing: energy rings, flowing particle streams, radial glow breathing.
 * Voice state drives speed, intensity, ring frequency.
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props {
  voiceState:    VoiceState;
  onFormationDone?: () => void;   // fires when particles reach logo shape
}

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#010108;overflow:hidden}
canvas{position:absolute;top:0;left:0;display:block}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function(){
'use strict';

/* ── Seeded RNG (LCG) ────────────────────────────────────────────────────── */
var seed=0xdeadbeef;
function rng(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}

/* ── Dimensions ─────────────────────────────────────────────────────────── */
var W=window.innerWidth||375, H=window.innerHeight||812;
var CX=W/2, CY=H*0.415;

var canvas=document.getElementById('c');
canvas.width=W; canvas.height=H;
var ctx=canvas.getContext('2d');

/* ── Voice state ─────────────────────────────────────────────────────────── */
var STATE='listening';
window.setVoiceState=function(s){ STATE=s; };

/* ═══════════════════════════════════════════════════════════════════════════
   LOGO SHAPE — Three-petal leaf, normalised to unit coords then scaled.
   Petal geometry: each petal is a tall ellipse.
     Petal 0 (centre)  — straight up, apex ~(0,-1)
     Petal 1 (left)    — rotated -38°
     Petal 2 (right)   — rotated +38°
   All three share the same base origin (0,0) = bottom of stem.
═══════════════════════════════════════════════════════════════════════════ */
var LOGO_H = Math.min(W,H)*0.36;  // tall axis of each petal
var LOGO_W = LOGO_H*0.28;         // wide axis

// Return world coords [x,y] for parameter t ∈ [0,1] on petal ellipse edge
function petalEdge(t, petalIndex, scale){
  var angle = t*Math.PI*2;
  // local ellipse coords
  var lx = LOGO_W*scale*0.5*Math.cos(angle);
  var ly = -LOGO_H*scale*0.5*(0.5+Math.sin(angle)*0.5+0.5);  // elongated upward
  // Actually simpler: tall ellipse centred at (0, -halfH)
  var ex = (LOGO_W*scale*0.5)*Math.cos(angle);
  var ey = (LOGO_H*scale*0.5)*Math.sin(angle) - LOGO_H*scale*0.42;
  // Rotation per petal
  var rot = petalIndex===0 ? 0 : petalIndex===1 ? -0.68 : 0.68;
  var rx = ex*Math.cos(rot) - ey*Math.sin(rot);
  var ry = ex*Math.sin(rot) + ey*Math.cos(rot);
  return [CX+rx, CY+ry];
}

// Fill a petal with random interior points (uniform distribution inside ellipse)
function samplePetal(n, petalIndex){
  var pts=[];
  var rot = petalIndex===0 ? 0 : petalIndex===1 ? -0.68 : 0.68;
  while(pts.length<n){
    var u=rng()*2-1, v=rng()*2-1;
    if(u*u+v*v>1)continue;          // rejection sample unit disk
    var ex=u*LOGO_W*0.5;
    var ey=v*LOGO_H*0.5 - LOGO_H*0.42;
    var rx=ex*Math.cos(rot)-ey*Math.sin(rot);
    var ry=ex*Math.sin(rot)+ey*Math.cos(rot);
    pts.push([CX+rx, CY+ry]);
  }
  return pts;
}

/* ── Build formation targets ─────────────────────────────────────────────── */
var NP=300;   // total formation particles
var targets=[];
// Outline points (crisp edges)
var nOutline=120;
for(var pi=0;pi<3;pi++){
  for(var oi=0;oi<nOutline/3;oi++){
    targets.push(petalEdge(oi/(nOutline/3), pi, 1.0));
  }
}
// Interior fill
var nFill=NP-targets.length;
var nFillEach=Math.ceil(nFill/3);
for(var pi2=0;pi2<3;pi2++){
  samplePetal(nFillEach, pi2).forEach(function(p){targets.push(p);});
}
targets=targets.slice(0,NP);

/* ── Formation particles ─────────────────────────────────────────────────── */
var FORM_DUR=2200;   // ms to reach target
var fParticles=targets.map(function(t,i){
  // Spawn from random screen edge
  var edge=Math.floor(rng()*4);
  var sx,sy;
  if(edge===0){sx=rng()*W;sy=-20;}
  else if(edge===1){sx=W+20;sy=rng()*H;}
  else if(edge===2){sx=rng()*W;sy=H+20;}
  else{sx=-20;sy=rng()*H;}
  return{
    sx:sx,sy:sy,
    tx:t[0],ty:t[1],
    x:sx,y:sy,
    r: rng()*1.3+0.4,
    a: rng()*0.75+0.25,
    delay: rng()*700,
    t:0,done:false,
    // Each particle keeps its target for ambient phase
  };
});
var formDone=false;
var formStartTime=-1;
var FORMED_HOLD=600;   // ms to hold at target before ambient
var heldStart=-1;
var ambientReady=false;

/* ── Ambient free particles (post-formation, streaming from logo) ─────────── */
var AMB=70;
var ambParticles=[];
function makeAmb(){
  var angle=rng()*Math.PI*2;
  var spawnR=rng()*LOGO_H*0.4+LOGO_H*0.05;
  return{
    x:CX+Math.cos(angle)*spawnR,
    y:CY+Math.sin(angle)*spawnR,
    vx:Math.cos(angle)*(rng()*0.4+0.08),
    vy:Math.sin(angle)*(rng()*0.4+0.08) - rng()*0.3,
    r:rng()*1.1+0.2,
    a:rng()*0.22+0.04,
    life:0,maxLife:rng()*160+80,
  };
}
for(var ai=0;ai<AMB;ai++){
  var ap=makeAmb();
  ap.life=Math.floor(rng()*ap.maxLife); // start scattered
  ambParticles.push(ap);
}

/* ── Stars ───────────────────────────────────────────────────────────────── */
var NSTARS=180;
var stars=[];
for(var si=0;si<NSTARS;si++){
  stars.push({
    x:rng()*W,y:rng()*H,
    r:rng()*0.85+0.12,
    baseA:rng()*0.24+0.04,
    phase:rng()*Math.PI*2,
    speed:rng()*0.012+0.003,
  });
}

/* ── Energy rings ────────────────────────────────────────────────────────── */
var rings=[];
var ringTimer=0;
function spawnRing(){
  var sp=STATE==='speaking';
  rings.push({
    r:LOGO_W*0.6,
    maxR:LOGO_H*(sp?1.9:1.5),
    speed:sp?2.0:1.1,
    alpha:sp?0.26:0.15,
    lw:sp?1.1:0.7,
  });
}

/* ── Easing ──────────────────────────────────────────────────────────────── */
function easeInOut(t){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
function easeOut(t){return 1-Math.pow(1-t,3);}

/* ── Notify RN when formation is done ───────────────────────────────────── */
function notifyFormationDone(){
  try{window.ReactNativeWebView.postMessage('formationDone');}catch(e){}
}

/* ── Main render loop ───────────────────────────────────────────────────── */
var lastT=-1, elapsed=0;
var T=0; // continuous time in seconds

function frame(ts){
  requestAnimationFrame(frame);
  var dt = lastT<0 ? 16 : Math.min(ts-lastT,50);
  lastT=ts; elapsed+=dt; T+=dt*0.001;

  /* Background — partial alpha clear for motion trails */
  ctx.fillStyle='rgba(1,1,8,0.82)';
  ctx.fillRect(0,0,W,H);

  /* ── Stars ── */
  stars.forEach(function(s){
    s.phase+=s.speed;
    var ta=s.baseA*(0.55+0.45*Math.sin(s.phase));
    ctx.beginPath();
    ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,'+ta.toFixed(3)+')';
    ctx.fill();
  });

  /* ── Center radial glow ── */
  var gi = STATE==='speaking'?0.22 : STATE==='listening'?0.12 : 0.05;
  gi *= (1+0.14*Math.sin(T*1.6));
  var gR = LOGO_H*(STATE==='speaking'?1.1:0.85);
  var grd=ctx.createRadialGradient(CX,CY,0,CX,CY,gR);
  grd.addColorStop(0,'rgba(220,235,255,'+(gi).toFixed(3)+')');
  grd.addColorStop(0.35,'rgba(180,210,255,'+(gi*0.45).toFixed(3)+')');
  grd.addColorStop(1,'rgba(100,150,255,0)');
  ctx.fillStyle=grd;
  ctx.fillRect(0,0,W,H);

  /* ── Formation phase ── */
  if(!ambientReady){
    if(formStartTime<0) formStartTime=ts;
    var tElapsed=ts-formStartTime;

    var allArrived=true;
    fParticles.forEach(function(p){
      if(p.done){
        // Hold at target — draw as logo pixel
        ctx.beginPath();
        ctx.arc(p.tx,p.ty,p.r,0,Math.PI*2);
        ctx.fillStyle='rgba(255,255,255,'+p.a.toFixed(3)+')';
        ctx.fill();
        return;
      }
      var et=tElapsed-p.delay;
      if(et<0){allArrived=false;return;}
      var progress=Math.min(1,et/FORM_DUR);
      if(progress<1)allArrived=false;
      var ep=easeOut(progress);
      p.x=p.sx+(p.tx-p.sx)*ep;
      p.y=p.sy+(p.ty-p.sy)*ep;
      // Fade in as particle approaches
      var alpha=p.a*(progress<0.08?progress/0.08:1);
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r+(1-progress)*1.5,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,'+alpha.toFixed(3)+')';
      ctx.fill();
      if(progress>=1){p.done=true;}
    });

    if(allArrived){
      if(heldStart<0){heldStart=ts; notifyFormationDone();}
      if(ts-heldStart>FORMED_HOLD) ambientReady=true;
    }

  } else {
    /* ── Ambient phase — particles fade away from logo positions ── */
    /* (The RN logo PNG covers this area — particles just drift off) */
    fParticles.forEach(function(p,i){
      if(!p.dispersing){
        p.dispersing=true;
        p.dvx=(rng()-0.5)*0.35;
        p.dvy=-(rng()*0.45+0.05);
        p.dlife=0;
        p.dmaxLife=80+rng()*120;
      }
      p.x+=p.dvx;
      p.y+=p.dvy;
      p.dlife++;
      if(p.dlife>p.dmaxLife) return; // done, invisible
      var alpha=p.a*(1-p.dlife/p.dmaxLife);
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,'+alpha.toFixed(3)+')';
      ctx.fill();
    });
  }

  /* ── Ambient streaming particles (always, but only visible once formed) ── */
  if(ambientReady){
    var spd=STATE==='speaking'?1.8:STATE==='listening'?1.1:0.55;
    ambParticles.forEach(function(p){
      p.x+=p.vx*spd; p.y+=p.vy*spd;
      p.life++;
      if(p.life>p.maxLife||p.y<-20||p.x<-20||p.x>W+20){
        var np=makeAmb(); Object.assign(p,np);
      }
      var lr=p.life/p.maxLife;
      var alpha=p.a*(lr<0.12?lr/0.12:lr>0.7?(1-lr)/0.30:1);
      if(alpha<=0)return;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(210,230,255,'+alpha.toFixed(3)+')';
      ctx.fill();
    });

    /* ── Energy rings ── */
    if(STATE!=='idle'){
      ringTimer+=dt;
      var interval=STATE==='speaking'?480:760;
      if(ringTimer>interval){ringTimer=0;spawnRing();}
    }
    rings=rings.filter(function(ring){
      ring.r+=ring.speed;
      var fade=1-ring.r/ring.maxR;
      if(fade<=0)return false;
      ctx.beginPath();
      ctx.arc(CX,CY,ring.r,0,Math.PI*2);
      ctx.strokeStyle='rgba(210,230,255,'+(ring.alpha*fade).toFixed(3)+')';
      ctx.lineWidth=ring.lw;
      ctx.stroke();
      return true;
    });
  }
}

requestAnimationFrame(frame);

window.addEventListener('resize',function(){
  W=window.innerWidth;H=window.innerHeight;
  CX=W/2;CY=H*0.415;
  canvas.width=W;canvas.height=H;
});
})();
</script>
</body>
</html>`;

export default function VoiceCanvas({ voiceState, onFormationDone }: Props) {
  const ref = useRef<any>(null);

  useEffect(() => {
    ref.current?.injectJavaScript(
      `if(window.setVoiceState)window.setVoiceState('${voiceState}');true;`
    );
  }, [voiceState]);

  if (Platform.OS === "web") {
    return <View style={s.fill} />;
  }

  return (
    <View style={s.fill}>
      <WebView
        ref={ref}
        source={{ html: HTML }}
        style={s.web}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={["*"]}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        domStorageEnabled
        allowFileAccess
        onMessage={(e) => {
          if (e.nativeEvent.data === "formationDone") onFormationDone?.();
        }}
        onError={(e) => console.warn("VoiceCanvas:", e.nativeEvent.description)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: "#010108" },
  web:  { flex: 1, backgroundColor: "transparent" },
});
