/**
 * VoiceCanvas v4 — four-phase cinematic opening.
 *
 * Phase 0  DARK    (0–700ms)   : void, stars emerge
 * Phase 1  SPAWN   (700–2600)  : particles appear near centre, drift free
 * Phase 2  GATHER  (2600–5100) : magnetic spiral inward to logo zone
 * Phase 3  FORM    (5100–7000) : each particle locks to exact petal coord
 * Phase 4  STABLE  (7000+)     : logo live, particles orbit + energy rings
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type VoiceState = "idle" | "listening" | "speaking";
interface Props {
  voiceState:       VoiceState;
  onFormationDone?: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────── */
const HTML = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#010108;overflow:hidden}
canvas{position:absolute;top:0;left:0;display:block}
</style>
</head><body><canvas id="c"></canvas><script>
(function(){
'use strict';

/* ── Seeded RNG ────────────────────────────────────────────────────────────── */
var seed=0xfeedface;
function rng(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}

/* ── Screen ────────────────────────────────────────────────────────────────── */
var W=window.innerWidth||375, H=window.innerHeight||812;
var CX=W/2, CY=H*0.415;

var cv=document.getElementById('c');
cv.width=W; cv.height=H;
var ctx=cv.getContext('2d');

/* ── Phase timing (ms) ─────────────────────────────────────────────────────── */
var T0=0, T1=700, T2=2600, T3=5100, T4=7000;

/* ── Voice state ───────────────────────────────────────────────────────────── */
var STATE='listening';
window.setVoiceState=function(s){STATE=s;};

/* ═══════════════════════════════════════════════════════════════════════════
   LOGO GEOMETRY  — three overlapping petals (tall ellipses, rotated).
   Coordinates are normalised; LOGO_SCALE maps to pixels.
══════════════════════════════════════════════════════════════════════════════ */
var LOGO_SCALE = Math.min(W,H)*0.18;   // half-height of a petal in px

// Return a point on the edge of petal pi at parameter t∈[0,1]
function petalPt(t, pi){
  var a = t*Math.PI*2;
  // Tall thin ellipse (w:h ≈ 0.28)
  var lx = LOGO_SCALE*0.28 * Math.cos(a);
  var ly = LOGO_SCALE       * Math.sin(a) - LOGO_SCALE*0.82;
  var rot = pi===0?0: pi===1?-0.70:0.70;
  return [
    CX + lx*Math.cos(rot) - ly*Math.sin(rot),
    CY + lx*Math.sin(rot) + ly*Math.cos(rot),
  ];
}

// Uniform random point INSIDE petal pi
function petalFill(pi){
  var rot = pi===0?0: pi===1?-0.70:0.70;
  while(true){
    var u=rng()*2-1, v=rng()*2-1;
    if(u*u+v*v>1) continue;
    var lx=LOGO_SCALE*0.28*u;
    var ly=LOGO_SCALE*v - LOGO_SCALE*0.82;
    return [
      CX + lx*Math.cos(rot) - ly*Math.sin(rot),
      CY + lx*Math.sin(rot) + ly*Math.cos(rot),
    ];
  }
}

/* ── Build formation targets ───────────────────────────────────────────────── */
var NP = 280;
var targets=[];
// 108 outline points (36 per petal)
for(var pi=0;pi<3;pi++)
  for(var oi=0;oi<36;oi++)
    targets.push(petalPt(oi/36, pi));
// fill remaining
while(targets.length<NP)
  targets.push(petalFill(Math.floor(rng()*3)));

/* ── Formation particles ───────────────────────────────────────────────────── */
var pArr = targets.map(function(tgt, idx){
  // spawn position: loose cluster near logo centre
  var a=rng()*Math.PI*2, d=rng()*60+20;
  var spawnX=CX+Math.cos(a)*d, spawnY=CY+Math.sin(a)*d;
  // stagger spawn over SPAWN phase duration
  var spawnDelay = T1 + rng()*(T2-T1-200);
  return {
    x:spawnX, y:spawnY,
    vx:(rng()-0.5)*0.8, vy:-(rng()*0.5+0.1),
    tx:tgt[0], ty:tgt[1],
    r: rng()*1.4+0.35,
    a: rng()*0.65+0.25,
    spawnDelay:spawnDelay,
    formX:0, formY:0,      // snapshotted at start of FORM phase
    spawned:false,
    formSnapped:false,
  };
});

var formSnapshotDone=false;
var notifiedDone=false;

/* ── Ambient orbital particles (active in STABLE phase) ───────────────────── */
var ORB=80;
var orbParticles=[];
function makeOrb(){
  var a=rng()*Math.PI*2, d=rng()*LOGO_SCALE*1.2+LOGO_SCALE*0.2;
  return {
    x:CX+Math.cos(a)*d, y:CY+Math.sin(a)*d,
    vx:(rng()-0.5)*0.55, vy:-(rng()*0.5+0.06),
    r:rng()*1.0+0.18, a:rng()*0.20+0.04,
    life:0, maxLife:rng()*180+90,
  };
}
for(var oi2=0;oi2<ORB;oi2++){
  var op=makeOrb(); op.life=Math.floor(rng()*op.maxLife);
  orbParticles.push(op);
}

/* ── Stars ─────────────────────────────────────────────────────────────────── */
var NST=200;
var stars=[];
for(var si=0;si<NST;si++) stars.push({
  x:rng()*W, y:rng()*H,
  r:rng()*0.9+0.12,
  baseA:rng()*0.26+0.04,
  phase:rng()*Math.PI*2,
  spd:rng()*0.013+0.003,
});

/* ── Energy rings ──────────────────────────────────────────────────────────── */
var rings=[]; var ringTimer=0;
function spawnRing(){
  var sp=STATE==='speaking';
  rings.push({r:LOGO_SCALE*0.5,maxR:LOGO_SCALE*(sp?3.2:2.5),speed:sp?2.2:1.2,alpha:sp?0.24:0.13,lw:sp?1.0:0.65});
}

/* ── Easing ────────────────────────────────────────────────────────────────── */
function easeOut3(t){return 1-Math.pow(1-t,3);}
function easeInOut(t){return t<0.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1;}

/* ── Render ─────────────────────────────────────────────────────────────────── */
var startTime=-1, lastT=-1, elapsed=0, continuousT=0;

function frame(ts){
  requestAnimationFrame(frame);
  if(startTime<0) startTime=ts;
  var dt=lastT<0?16:Math.min(ts-lastT,50);
  lastT=ts;
  elapsed=ts-startTime;
  continuousT+=dt*0.001;

  var phase = elapsed<T1?0: elapsed<T2?1: elapsed<T3?2: elapsed<T4?3: 4;

  /* ── Background ── */
  var bgAlpha = phase===0 ? Math.max(0.88, 1.0-elapsed/T1*0.15) : 0.82;
  ctx.fillStyle='rgba(1,1,8,'+bgAlpha+')';
  ctx.fillRect(0,0,W,H);

  /* ── Stars — fade in during phase 0 ── */
  var starVis = Math.min(1, elapsed/T1);
  stars.forEach(function(s){
    s.phase+=s.spd;
    var ta=s.baseA*(0.5+0.5*Math.sin(s.phase))*starVis;
    if(ta<0.005) return;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,'+ta.toFixed(3)+')'; ctx.fill();
  });

  /* ── Central radial glow (grows through phases) ── */
  if(phase>=1){
    var gi,gR;
    if(phase<=2){
      var gt=(elapsed-T1)/(T3-T1);
      gi=0.04*gt*(1+0.2*Math.sin(continuousT*1.4));
      gR=LOGO_SCALE*(0.5+gt*0.8);
    } else {
      var si2=STATE==='speaking'?0.22:STATE==='listening'?0.12:0.05;
      gi=si2*(1+0.14*Math.sin(continuousT*1.6));
      gR=LOGO_SCALE*(STATE==='speaking'?2.2:1.7);
    }
    var grd=ctx.createRadialGradient(CX,CY,0,CX,CY,gR);
    grd.addColorStop(0,'rgba(215,232,255,'+gi.toFixed(3)+')');
    grd.addColorStop(0.4,'rgba(180,210,255,'+(gi*0.4).toFixed(3)+')');
    grd.addColorStop(1,'rgba(120,165,255,0)');
    ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
  }

  /* ── Formation particles ── */
  if(phase<4){
    pArr.forEach(function(p){
      // Gate on spawn delay
      if(elapsed<p.spawnDelay) return;
      p.spawned=true;

      if(phase<=1){
        /* FREE float */
        p.x+=p.vx; p.y+=p.vy;
        // soft boundary repulsion from edges
        if(p.x<30)p.vx+=0.05; if(p.x>W-30)p.vx-=0.05;
        if(p.y<30)p.vy+=0.05; if(p.y>H-30)p.vy-=0.05;
        // mild drag
        p.vx*=0.995; p.vy*=0.995;

      } else if(phase===2){
        /* GATHER — magnetic spiral toward logo centre */
        var gt2=Math.pow((elapsed-T2)/(T3-T2),1.6); // accelerating
        var dx=CX-p.x, dy=CY-p.y;
        var dist=Math.sqrt(dx*dx+dy*dy)||1;
        // Radial attraction
        p.vx+=dx/dist*gt2*0.38;
        p.vy+=dy/dist*gt2*0.38;
        // Tangential swirl (clockwise)
        p.vx+= (-dy/dist)*gt2*0.18;
        p.vy+= ( dx/dist)*gt2*0.18;
        // Damping
        p.vx*=0.92; p.vy*=0.92;
        p.x+=p.vx; p.y+=p.vy;

      } else if(phase===3){
        /* FORM — lock to target */
        if(!formSnapshotDone){
          pArr.forEach(function(q){q.formX=q.x;q.formY=q.y;});
          formSnapshotDone=true;
        }
        var ft=easeInOut(Math.min(1,(elapsed-T3)/(T4-T3)));
        p.x=p.formX+(p.tx-p.formX)*ft;
        p.y=p.formY+(p.ty-p.formY)*ft;
      }

      // Draw particle
      var vis=1;
      if(!p.spawned) return;
      // fade in when first spawning
      var spawnAge=elapsed-p.spawnDelay;
      if(spawnAge<400) vis=spawnAge/400;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r+(phase===2?0.5:0),0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,'+(p.a*vis).toFixed(3)+')'; ctx.fill();
    });

    // Notify RN when form phase completes
    if(phase===3 && !notifiedDone && elapsed>=T4-100){
      notifiedDone=true;
      try{window.ReactNativeWebView.postMessage('formationDone');}catch(e){}
    }
  }

  /* ── STABLE phase ── */
  if(phase===4){
    /* Disperse formation particles gently outward (logo PNG covers them) */
    pArr.forEach(function(p,i){
      if(!p.disperseV){
        var a2=rng()*Math.PI*2;
        p.disperseV={x:(Math.cos(a2)+rng()-0.5)*0.3, y:(Math.sin(a2)+rng()-0.5)*0.3};
        p.disperseLife=0; p.disperseMax=60+Math.floor(rng()*80);
      }
      p.x+=p.disperseV.x; p.y+=p.disperseV.y;
      p.disperseLife++;
      if(p.disperseLife>p.disperseMax) return;
      var alpha=p.a*(1-p.disperseLife/p.disperseMax)*0.6;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,'+alpha.toFixed(3)+')'; ctx.fill();
    });

    /* Orbital ambient particles */
    var spd=STATE==='speaking'?1.9:STATE==='listening'?1.15:0.55;
    orbParticles.forEach(function(p){
      p.x+=p.vx*spd; p.y+=p.vy*spd; p.life++;
      if(p.life>p.maxLife||p.y<-20||p.x<-20||p.x>W+20){
        var np=makeOrb(); Object.assign(p,np);
      }
      var lr=p.life/p.maxLife;
      var alpha=p.a*(lr<0.12?lr/0.12:lr>0.7?(1-lr)/0.30:1);
      if(alpha<=0.005) return;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(205,225,255,'+alpha.toFixed(3)+')'; ctx.fill();
    });

    /* Energy rings */
    if(STATE!=='idle'){
      ringTimer+=dt;
      var ri=STATE==='speaking'?460:740;
      if(ringTimer>ri){ringTimer=0;spawnRing();}
    }
    rings=rings.filter(function(ring){
      ring.r+=ring.speed;
      var fade=1-ring.r/ring.maxR;
      if(fade<=0) return false;
      ctx.beginPath(); ctx.arc(CX,CY,ring.r,0,Math.PI*2);
      ctx.strokeStyle='rgba(210,230,255,'+(ring.alpha*fade).toFixed(3)+')';
      ctx.lineWidth=ring.lw; ctx.stroke();
      return true;
    });
  }
}

requestAnimationFrame(frame);
window.addEventListener('resize',function(){
  W=window.innerWidth;H=window.innerHeight;CX=W/2;CY=H*0.415;
  cv.width=W;cv.height=H;
});
})();
</script></body></html>`;

export default function VoiceCanvas({ voiceState, onFormationDone }: Props) {
  const ref = useRef<any>(null);

  useEffect(() => {
    ref.current?.injectJavaScript(
      `if(window.setVoiceState)window.setVoiceState('${voiceState}');true;`
    );
  }, [voiceState]);

  if (Platform.OS === "web") return <View style={s.fill} />;

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
  fill: { ...StyleSheet.absoluteFill, backgroundColor: "#010108" },
  web:  { flex: 1, backgroundColor: "transparent" },
});
