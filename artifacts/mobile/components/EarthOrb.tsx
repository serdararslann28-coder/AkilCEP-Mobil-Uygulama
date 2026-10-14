/**
 * EarthOrb — real rotating globe.
 *
 * A tiny raw-WebGL ray-sphere renderer (inside react-native-webview on native,
 * an iframe srcDoc on web, with a 15 fps Canvas raster fallback). Per pixel: ray/sphere normal -> axial tilt ->
 * longitude/latitude -> NASA Blue Marble day texture, plus an independent cloud
 * layer rotating at its own rate. Textures are bundled offline (see
 * assets/earth/ATTRIBUTION.md). Capped at 30 fps, DPR <= 2, paused when
 * inactive / backgrounded / hidden, static frame with reduced motion.
 *
 * Props: phase only changes rotation tempo. `level` (0..1, optional) is a real
 * mic meter value; when undefined nothing amplitude-like is shown.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { EARTH_CLOUD_B64, EARTH_DAY_B64 } from "@/assets/earth/earthTextures";

export type EarthPhase = "idle" | "listening" | "thinking" | "speaking";

interface Props {
  size: number;
  phase?: EarthPhase;
  level?: number;
  active?: boolean;
}

const TEMPLATE = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>*{margin:0;padding:0}html,body{width:100%;height:100%;background:transparent;overflow:hidden}
canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
#m{position:absolute;left:0;right:0;top:45%;text-align:center;font:13px sans-serif;color:#555;padding:0 16px;display:none}</style>
</head><body><canvas id="c"></canvas><div id="m"></div><script>
(function(){
var cv=document.getElementById('c'),msg=document.getElementById('m');
var DAY='data:image/jpeg;base64,@@DAY@@',CLOUD='data:image/jpeg;base64,@@CLOUD@@';
function fail(t){msg.textContent=t;msg.style.display='block';try{window.ReactNativeWebView.postMessage('error:'+t)}catch(e){}}
window.addEventListener('message',function(e){try{var o=typeof e.data==='string'?JSON.parse(e.data):e.data;
 if(o&&o.orb&&typeof window.__orb==='function')window.__orb(o.orb)}catch(x){}});
var gl=cv.getContext('webgl',{premultipliedAlpha:true,alpha:true,antialias:false,powerPreference:'low-power'});
if(!gl){software();return;}
var VS='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
var FS='precision mediump float;uniform vec2 R;uniform float spin,cspin,scl;uniform sampler2D D,C;'+
'void main(){vec2 q=(gl_FragCoord.xy-.5*R)/(.5*min(R.x,R.y))/(0.94*scl);'+
'float r2=dot(q,q);float aa=1.-smoothstep(.9925,1.,sqrt(r2));if(aa<=0.){gl_FragColor=vec4(0.);return;}'+
'float z=sqrt(max(0.,1.-r2));vec3 n=vec3(q.x,q.y,z);'+
'float pa=.38,ca=cos(pa),sa=sin(pa);vec3 p=vec3(n.x,n.y*ca+n.z*sa,-n.y*sa+n.z*ca);'+
'float ta=-.36,ct=cos(ta),st=sin(ta);p=vec3(p.x*ct-p.y*st,p.x*st+p.y*ct,p.z);'+
'float lat=asin(clamp(p.y,-1.,1.));float lon=atan(p.x,p.z);'+
'float v=.5+lat/3.14159265;'+
'vec3 day=texture2D(D,vec2(fract((lon-spin)/6.2831853+.5),v)).rgb;'+
'float cl=texture2D(C,vec2(fract((lon-cspin)/6.2831853+.5),v)).r;cl=smoothstep(.18,.95,cl)*.92;'+
'vec3 L=normalize(vec3(-.5,.42,.76));float df=dot(n,L);float sh=smoothstep(-.35,.65,df);'+
'float light=.40+.72*sh;'+
'day=pow(day,vec3(.95))*1.06;'+
'float ocean=step(day.r+.02,day.b)*step(day.g,day.b+.05);'+
'vec3 H=normalize(L+vec3(0.,0.,1.));float sp=pow(max(dot(n,H),0.),48.)*.28*ocean*(1.-cl);'+
'vec3 col=day*(1.-.10*cl)*light;'+
'vec3 cc=vec3(.97,.98,1.)*(.50+.55*sh);col=mix(col,cc,cl);col+=sp;'+
'float rim=pow(1.-z,3.2);col=mix(col,vec3(.52,.74,1.),rim*.30);'+
'float edge=smoothstep(.955,.995,sqrt(r2))*.30;col=mix(col,vec3(.62,.80,1.),edge);'+
'gl_FragColor=vec4(col*aa,aa);}';
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)){fail('Shader: '+gl.getShaderInfoLog(o));return null}return o}
var vs=sh(gl.VERTEX_SHADER,VS),fs=sh(gl.FRAGMENT_SHADER,FS);if(!vs||!fs)return;
var pg=gl.createProgram();gl.attachShader(pg,vs);gl.attachShader(pg,fs);gl.linkProgram(pg);
if(!gl.getProgramParameter(pg,gl.LINK_STATUS)){fail('Program link failed');return}
gl.useProgram(pg);
var bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
var pl=gl.getAttribLocation(pg,'p');gl.enableVertexAttribArray(pl);gl.vertexAttribPointer(pl,2,gl.FLOAT,false,0,0);
var U={};['R','spin','cspin','scl','D','C'].forEach(function(k){U[k]=gl.getUniformLocation(pg,k)});
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
function tex(unit,img){var t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
gl.uniform1i(U.D,0);gl.uniform1i(U.C,1);
 var st={phase:'idle',level:-1,active:true,reduce:false},speed=.07,cur=.07,lvl=0,spin=1.1,cspin=.4,ready=false,raf=0,last=0,loaded=0,elapsed=0;
var TS={idle:.07,listening:.11,thinking:.24,speaking:.15};
window.__orbSnapshot=function(){return {renderer:'webgl',spin:spin,cloudSpin:cspin,active:st.active,reduce:st.reduce,ready:ready}};
function resize(){var d=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(cv.clientWidth*d)),h=Math.max(1,Math.round(cv.clientHeight*d));
if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}gl.viewport(0,0,w,h)}
function draw(){resize();gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.uniform2f(U.R,cv.width,cv.height);gl.uniform1f(U.spin,spin);gl.uniform1f(U.cspin,cspin);gl.uniform1f(U.scl,1+.025*lvl+(st.reduce?0:.003*Math.sin(elapsed*.9)));
gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
function loop(ts){raf=0;if(!ready||!st.active||st.reduce||document.hidden)return;
raf=requestAnimationFrame(loop);if(ts-last<33)return;var dt=last?Math.min((ts-last)/1000,.1):.033;last=ts;
cur+=(speed-cur)*Math.min(1,dt*2.5);lvl+=((st.level<0?0:st.level)-lvl)*Math.min(1,dt*10);
 elapsed+=dt;spin+=cur*dt;cspin+=cur*dt*1.35+dt*.012;draw()}
function kick(){if(raf){cancelAnimationFrame(raf);raf=0}last=0;if(!ready)return;
if(st.reduce||!st.active||document.hidden){draw();return}raf=requestAnimationFrame(loop)}
 window.__orb=function(o){var running=st.active&&!st.reduce;for(var k in o)st[k]=o[k];speed=TS[st.phase]||.07;
 if(!raf||running!==(st.active&&!st.reduce))kick()};
document.addEventListener('visibilitychange',kick);window.addEventListener('resize',kick);
 window.addEventListener('pagehide',function(){st.active=false;if(raf)cancelAnimationFrame(raf);raf=0});
cv.addEventListener('webglcontextlost',function(e){e.preventDefault();ready=false;fail('Grafik bağlamı kaybedildi.')});
function onLoad(){loaded++;if(loaded<2)return;ready=true;try{window.ReactNativeWebView.postMessage('ready')}catch(e){}kick()}
function load(unit,src,name){var im=new Image();im.onload=function(){tex(unit,im);onLoad()};
im.onerror=function(){fail('Dünya dokusu yüklenemedi ('+name+').')};im.src=src}
load(0,DAY,'gün');load(1,CLOUD,'bulut');
// Same spherical projection on devices without WebGL. Precompute geometry once;
// animate texture lookups at 15 fps on a small raster, not a spinning flat image.
function software(){
var ctx=cv.getContext('2d');if(!ctx){fail('Dünya çizimi bu cihazda desteklenmiyor.');return}
var N=240,buffer=document.createElement('canvas');buffer.width=buffer.height=N;
var bc=buffer.getContext('2d'),out=bc.createImageData(N,N),pixels=out.data;
var geometry=[],day=null,cloud=null,ready=false,raf=0,last=0,spin=1.1,cspin=.4,cur=.07,lvl=0,time=0;
var st={phase:'idle',level:-1,active:true,reduce:false},speeds={idle:.07,listening:.11,thinking:.24,speaking:.15};
function smooth(a,b,x){var t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
for(var y=0;y<N;y++)for(var x=0;x<N;x++){
 var nx=(x+.5-N/2)/(N*.47),ny=(N/2-y-.5)/(N*.47),r=Math.hypot(nx,ny);if(r>=1)continue;
 var z=Math.sqrt(1-r*r),py=ny*Math.cos(.38)+z*Math.sin(.38),pz=-ny*Math.sin(.38)+z*Math.cos(.38);
 var px=nx*Math.cos(-.36)-py*Math.sin(-.36);py=nx*Math.sin(-.36)+py*Math.cos(-.36);
 var longitude=Math.atan2(px,pz)/6.2831853+.5,latitude=.5-Math.asin(Math.max(-1,Math.min(1,py)))/Math.PI;
 var light=smooth(-.35,.65,(-.5*nx+.42*ny+.76*z)/Math.hypot(.5,.42,.76));
 var hx=-.5,hy=.42,hz=.76+Math.hypot(.5,.42,.76);
 var spec=Math.pow(Math.max(0,(nx*hx+ny*hy+z*hz)/Math.hypot(hx,hy,hz)),48)*.28;
 geometry.push([(y*N+x)*4,longitude,latitude,.4+.72*light,.5+.55*light,Math.pow(1-z,3.2)*.3,smooth(.955,.995,r)*.3,spec]);
 pixels[(y*N+x)*4+3]=Math.round(255*(1-smooth(.9925,1,r)));
}
var lut=[];for(var n=0;n<256;n++)lut[n]=Math.pow(n/255,.95)*1.06;
var rimColors=[.52,.74,1],edgeColors=[.62,.80,1];
function sample(tex,u,v){u-=Math.floor(u);return (Math.min(tex.h-1,Math.floor(v*tex.h))*tex.w+Math.floor(u*tex.w))*4}
function draw(){
 if(!ready)return;
 for(var j=0;j<geometry.length;j++){
  var g=geometry[j],di=sample(day,g[1]-spin/6.2831853,g[2]),ci=sample(cloud,g[1]-cspin/6.2831853,g[2]);
  var cl=smooth(.18,.95,cloud.data[ci]/255)*.92;
  var r=lut[day.data[di]],gg=lut[day.data[di+1]],b=lut[day.data[di+2]];
  var spec=(b>r+.02&&b+.05>=gg)?g[7]*(1-cl):0;
  var base=(1-.1*cl)*g[3]*(1-cl),cc=g[4]*cl;
  for(var k=0;k<3;k++){var val=k===0?r:k===1?gg:b,wh=k===0?.97:k===1?.98:1;
   var color=val*base+wh*cc+spec,c=color*(1-g[5])+rimColors[k]*g[5];pixels[g[0]+k]=Math.round(255*(c*(1-g[6])+edgeColors[k]*g[6]))}
 }
 bc.putImageData(out,0,0);
 var d=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(cv.clientWidth*d)),h=Math.max(1,Math.round(cv.clientHeight*d));
 if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
 ctx.clearRect(0,0,w,h);var scale=1+.025*lvl+(st.reduce?0:.003*Math.sin(time*.9)),s=Math.min(w,h)*scale;
 ctx.drawImage(buffer,(w-s)/2,(h-s)/2,s,s);
}
function loop(ts){raf=0;if(!ready||!st.active||st.reduce||document.hidden)return;raf=requestAnimationFrame(loop);
 if(ts-last<66)return;var dt=last?Math.min(.15,(ts-last)/1000):.066;last=ts;
 cur+=((speeds[st.phase]||.07)-cur)*Math.min(1,dt*2.5);lvl+=((st.level<0?0:st.level)-lvl)*Math.min(1,dt*10);
 time+=dt;spin+=cur*dt;cspin+=cur*dt*1.35+dt*.012;draw()}
function kick(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;if(!ready)return;draw();if(st.active&&!st.reduce&&!document.hidden)raf=requestAnimationFrame(loop)}
window.__orb=function(o){var running=st.active&&!st.reduce;for(var k in o)st[k]=o[k];if(!raf||running!==(st.active&&!st.reduce))kick()};
window.__orbSnapshot=function(){return {renderer:'canvas',spin:spin,cloudSpin:cspin,active:st.active,reduce:st.reduce,ready:ready}};
document.addEventListener('visibilitychange',kick);window.addEventListener('resize',kick);
window.addEventListener('pagehide',function(){st.active=false;if(raf)cancelAnimationFrame(raf);raf=0});
function loadTexture(src,assign){var im=new Image();im.onload=function(){var c=document.createElement('canvas');c.width=im.width;c.height=im.height;
 var cx=c.getContext('2d');cx.drawImage(im,0,0);assign({w:im.width,h:im.height,data:cx.getImageData(0,0,im.width,im.height).data});
 if(day&&cloud){ready=true;try{window.ReactNativeWebView.postMessage('ready')}catch(e){}kick()}}
 im.onerror=function(){fail('Dünya dokusu yüklenemedi.')};im.src=src}
loadTexture(DAY,function(t){day=t});loadTexture(CLOUD,function(t){cloud=t});
}
})();
</script></body></html>`;

export default function EarthOrb({
  size,
  phase = "idle",
  level,
  active = true,
}: Props) {
  const ref = useRef<WebView>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [reduce, setReduce] = useState(false);
  const html = useMemo(
    () => TEMPLATE.replace("@@DAY@@", EARTH_DAY_B64).replace("@@CLOUD@@", EARTH_CLOUD_B64),
    [],
  );
  const source = useMemo(() => ({ html }), [html]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);

  const push = useCallback(() => {
    const orb = {
      phase,
       level: typeof level === "number" && Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : -1,
      active: active && appActive,
      reduce,
    };
    if (Platform.OS === "web") {
      frameRef.current?.contentWindow?.postMessage(JSON.stringify({ orb }), "*");
    } else {
      ref.current?.injectJavaScript(`window.__orb&&window.__orb(${JSON.stringify(orb)});true;`);
    }
  }, [phase, level, active, appActive, reduce]);

  const pushRef = useRef(push);
  pushRef.current = push;
  useEffect(() => { push(); }, [push]);

  const box = { width: size, height: size };

  if (error) {
    return (
      <View style={[box, s.center]}>
        <Text style={s.err}>{error}</Text>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return React.createElement("iframe", {
      ref: (el: HTMLIFrameElement | null) => { frameRef.current = el; },
      srcDoc: html,
      title: "Earth",
      onLoad: () => pushRef.current(),
      style: { width: size, height: size, border: 0, background: "transparent" },
    });
  }

  return (
    <View style={box} pointerEvents="none">
      <WebView
        ref={ref}
         source={source}
        style={s.web}
        originWhitelist={["*"]}
        scrollEnabled={false}
        javaScriptEnabled
        androidLayerType="hardware"
        overScrollMode="never"
        onLoadEnd={() => pushRef.current()}
        onMessage={(e) => {
          const d = e.nativeEvent.data;
          if (d === "ready") pushRef.current();
          else if (d.startsWith("error:")) setError(d.slice(6));
        }}
        onError={(e) => setError(`Dünya yüklenemedi: ${e.nativeEvent.description}`)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  web: { flex: 1, backgroundColor: "transparent" },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  err: { fontSize: 13, color: "#555", textAlign: "center" },
});
