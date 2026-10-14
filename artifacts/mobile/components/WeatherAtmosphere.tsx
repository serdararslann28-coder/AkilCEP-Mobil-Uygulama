import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useFrameCallback, useSharedValue, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { WeatherData } from "@/lib/weather";

const FADE_MS = 2000;
type Item = { id: number; data: WeatherData; leaving: boolean; enterMs: number };
type LayerProps = {
  data: WeatherData; leaving: boolean; clock: SharedValue<number>; w: number; h: number;
  count: number; reduced: boolean; isDark: boolean; enterMs: number; active: boolean; wind?: number;
};
const mod = (x: number, m: number) => { "worklet"; return ((x % m) + m) % m; };
const rnd = (i: number, salt: number) => { const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return s - Math.floor(s); };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Soft diffuse shape from one radial gradient: no textures, no downloads. */
const Blob = memo(function Blob({ id, w, h, color, alpha }: { id: string; w: number; h: number; color: string; alpha: number }) {
  return (
    <Svg width={w} height={h}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={alpha} />
          <Stop offset="55%" stopColor={color} stopOpacity={alpha * 0.4} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} fill={`url(#${id})`} />
    </Svg>
  );
});

function Drift({ clock, i, w, h, bw, bh, speed, y, salt, children, reduced }: {
  clock: SharedValue<number>; i: number; w: number; h: number; bw: number; bh: number;
  speed: number; y: number; salt: number; children: React.ReactNode; reduced: boolean;
}) {
  const off = rnd(i, salt) * (w + bw * 2);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: reduced ? off - bw : mod(clock.value * speed + off, w + bw * 2) - bw }],
  }));
  return <Animated.View style={[{ position: "absolute", top: y, left: 0, width: bw, height: bh }, style]}>{children}</Animated.View>;
}

function Clouds({ p, n, tone, alpha }: { p: LayerProps; n: number; tone: string; alpha: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const bw = p.w * (0.9 + rnd(i, 1) * 0.7), bh = bw * (0.38 + rnd(i, 2) * 0.2);
        return (
          <Drift key={i} clock={p.clock} i={i} w={p.w} h={p.h} bw={bw} bh={bh} reduced={p.reduced}
            speed={4 + (p.wind ?? 0) * 0.35 + rnd(i, 3) * 5} y={p.h * (0.02 + (i / n) * 0.7) - bh * 0.3} salt={4}>
            <Blob id={`cl${p.data.fetchedAt}${i}${tone.length}`} w={bw} h={bh} color={tone} alpha={alpha * (0.7 + rnd(i, 5) * 0.5)} />
          </Drift>
        );
      })}
    </>
  );
}

function Sun({ p }: { p: LayerProps }) {
  const size = p.w * 1.3;
  const style = useAnimatedStyle(() => ({
    opacity: 0.8 + (p.reduced ? 0 : Math.sin(p.clock.value * 0.35) * 0.2),
    transform: [{ translateX: p.reduced ? 0 : Math.sin(p.clock.value * 0.07) * 14 },
      { translateY: p.reduced ? 0 : Math.cos(p.clock.value * 0.06) * 10 }],
  }));
  if (!p.data.isDay) return null;
  return (
    <Animated.View style={[{ position: "absolute", top: -size * 0.45, right: -size * 0.4, width: size, height: size }, style]}>
      <Blob id={`sun${p.data.fetchedAt}`} w={size} h={size} color={p.isDark ? "#E8B96A" : "#F6C877"} alpha={p.isDark ? 0.16 : 0.34} />
    </Animated.View>
  );
}

const Drop = memo(function Drop({ clock, i, p, intensity, total }: {
  clock: SharedValue<number>; i: number; p: LayerProps; intensity: number; total: number;
}) {
  const { w, h } = p;
  const slant = clamp(p.data.wind / 100, 0, 0.28);
  const breeze = clamp(p.data.wind / 35, 0, 1);
  const depth = 0.2 + rnd(i, 19) * 0.8;
  const phase = rnd(i, 20) * Math.PI * 2;
  // Stagger evenly spaced drops in lanes: continuous full-height coverage,
  // different lane speeds, and no particles permanently drifting off screen.
  const lanes = Math.max(2, Math.ceil(Math.sqrt(total * w / h)));
  const lane = i % lanes, row = Math.floor(i / lanes);
  const rows = Math.ceil((total - lane) / lanes);
  // Near droplets are wider, faster and clearer; distant droplets remain soft.
  const speed = 380 + depth * 460 + rnd(lane, 7) * 100 + intensity * 220;
  const len = 3 + depth * 7 + rnd(i, 8) * 2;
  const thickness = 1.6 + depth * 3.4 + rnd(i, 18) * 0.4;
  const x0 = (lane + 0.35 + rnd(i, 9) * 0.3) / lanes * w, span = h + 80;
  const off = (row + 0.4 + rnd(i, 10) * 0.2) / rows * span;
  const style = useAnimatedStyle(() => {
    const t = clock.value;
    const y = mod(t * speed + off, span) - 40;
    const gust = Math.sin(t * 0.55 + phase) * breeze;
    return { transform: [{ translateX: mod(x0 - y * slant + gust * (4 + depth * 7), w + len) - len / 2 },
      { translateY: y }, { rotate: `${Math.atan(slant + gust * 0.035)}rad` }] };
  });
  const id = `rain${p.data.fetchedAt}-${i}`;
  const tone = p.isDark ? "#B8CEE2" : "#718DA5";
  return (
    <Animated.View testID={`weather-rain-${i}`} style={[{
      position: "absolute", top: 0, left: 0, width: thickness, height: len,
      opacity: 0.26 + depth * 0.48 + rnd(i, 11) * 0.06,
    }, style]}>
      {/* A rounded water bead with a fading motion tail, not an opaque line.
          Static SVG geometry; only its transform runs on the shared UI clock. */}
      <Svg width={thickness} height={len} viewBox="0 0 12 24" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={tone} stopOpacity={0} />
            <Stop offset="25%" stopColor={tone} stopOpacity={0.08} />
            <Stop offset="65%" stopColor={tone} stopOpacity={0.8} />
            <Stop offset="100%" stopColor={tone} stopOpacity={0.4} />
          </LinearGradient>
        </Defs>
        <Path d="M6 0 C5.4 1 4.6 5 3.2 9 C1.7 12 0.7 14.2 0.7 17.2 C0.7 24.6 11.3 24.6 11.3 17.2 C11.3 14.2 10.3 12 8.8 9 C7.4 5 6.6 1 6 0 Z"
          fill={`url(#${id})`} />
        <Ellipse cx={4.1} cy={16.5} rx={1.2} ry={2.2} fill="#FFF" opacity={0.4 * depth} />
      </Svg>
    </Animated.View>
  );
});

function Flake({ clock, i, p }: { clock: SharedValue<number>; i: number; p: LayerProps }) {
  const { w, h } = p;
  const size = 2.5 + rnd(i, 12) * 4.5, speed = 22 + rnd(i, 13) * 38 + size * 3;
  const x0 = rnd(i, 14) * w, off = rnd(i, 15) * (h + 40), ph = rnd(i, 16) * 6.28, wind = p.data.wind * 1.6;
  const style = useAnimatedStyle(() => {
    const t = clock.value;
    return { transform: [{ translateX: mod(x0 + Math.sin(t * 0.7 + ph) * 16 + t * wind, w + 20) - 10 },
      { translateY: mod(t * speed + off, h + 40) - 20 }] };
  });
  return <Animated.View testID={`weather-snow-${i}`} style={[{ position: "absolute", top: 0, left: 0, width: size, height: size, borderRadius: size,
    opacity: 0.35 + rnd(i, 17) * 0.4, backgroundColor: p.isDark ? "rgba(235,242,250,0.8)" : "rgba(150,170,195,0.8)" }, style]} />;
}

function Flash({ clock, w, h }: { clock: SharedValue<number>; w: number; h: number }) {
  const style = useAnimatedStyle(() => {
    const t = mod(clock.value, 17), d = t - 14;
    const f = d > 0 && d < 0.5 ? (d < 0.12 ? d / 0.12 : Math.max(0, 1 - (d - 0.12) / 0.38)) : 0;
    return { opacity: f * 0.07 };
  });
  return <Animated.View style={[{ position: "absolute", width: w, height: h, backgroundColor: "#DDE6F5" }, style]} />;
}

function Layer(p: LayerProps) {
  const { data, count, reduced, w, h } = p;
  const op = useSharedValue(0);
  useEffect(() => {
    if (!p.active) { cancelAnimation(op); return; }
    op.value = withTiming(p.leaving ? 0 : 1, { duration: p.leaving ? FADE_MS : p.enterMs, easing: Easing.inOut(Easing.quad) });
    return () => cancelAnimation(op);
  }, [p.leaving, p.enterMs, p.active, op]);
  const fade = useAnimatedStyle(() => ({ opacity: op.value }));
  const k = data.kind;
  const mix = clamp(Math.max(data.rain, data.precipitation) / 4, 0, 1);
  const nPrecip = clamp(Math.round(count * (0.45 + mix * 0.55)), 4, count);
  const nRain = nPrecip * 6; // Double rain only; retain snow/cloud budgets and the shared 30 FPS clock.
  const cloudTone = p.isDark ? "#B7C4D8" : "#8C9BB0";
  const stormTone = p.isDark ? "#8392AB" : "#5F6C82";
  const wind = data.wind;
  const wet = k === "rain" || (k === "storm" && Math.max(data.rain, data.precipitation) > 0);
  const shade = useSharedValue(0);
  useEffect(() => {
    if (!p.active) { cancelAnimation(shade); return; }
    shade.value = withTiming(wet ? (p.isDark ? 0.06 : 0.1 + mix * 0.045) : 0, {
      duration: reduced ? 0 : FADE_MS, easing: Easing.inOut(Easing.quad),
    });
    return () => cancelAnimation(shade);
  }, [wet, mix, p.isDark, p.active, reduced, shade]);
  const shadeStyle = useAnimatedStyle(() => ({ opacity: shade.value }));
  const lp: LayerProps = { ...p, wind };
  return (
    <Animated.View testID={`weather-layer-${k}`} pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }, fade]}>
      {wet && <Animated.View testID="weather-rain-shade" pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: p.isDark ? "#101A28" : "#3B516C" }, shadeStyle]} />}
      {k === "sun" && <Sun p={p} />}
      {k === "partly-cloudy" && (<><Sun p={p} /><Clouds p={lp} n={3} tone={cloudTone} alpha={0.2} /></>)}
      {k === "clouds" && <Clouds p={lp} n={5} tone={cloudTone} alpha={0.24} />}
      {k === "fog" && <Clouds p={lp} n={4} tone={p.isDark ? "#C9D2DE" : "#AEB8C4"} alpha={0.22} />}
      {(k === "rain" || k === "storm") && (
        <>
          <Clouds p={lp} n={k === "storm" ? 4 : 3} tone={k === "storm" ? stormTone : cloudTone} alpha={k === "storm" ? 0.3 : 0.18} />
          {wet && !reduced && Array.from({ length: nRain }, (_, i) =>
            <Drop key={i} clock={p.clock} i={i} p={p} intensity={mix} total={nRain} />)}
        </>
      )}
      {k === "snow" && !reduced &&
        Array.from({ length: clamp(Math.round(count * (0.5 + clamp(data.snow / 2, 0, 1) * 0.5)), 5, count) }, (_, i) =>
          <Flake key={i} clock={p.clock} i={i} p={p} />)}
      {k === "storm" && (
        <>
          {!reduced && <Flash clock={p.clock} w={w} h={h} />}
        </>
      )}
    </Animated.View>
  );
}

function WeatherAtmosphere({ data, active, isDark, firstDailyEntry }: {
  data: WeatherData | null; active: boolean; isDark: boolean; firstDailyEntry: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const [reduced, setReduced] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const idRef = useRef(0);
  const clock = useSharedValue(0);
  const acc = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReduced(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { alive = false; sub.remove(); };
  }, []);

  const kind = data?.kind, isDay = data?.isDay, fetchedAt = data?.fetchedAt;
  useEffect(() => {
    setItems(cur => {
      const last = cur.filter(i => !i.leaving).pop();
      if (!data) return cur.map(i => ({ ...i, leaving: true }));
      if (last && last.data.kind === data.kind && last.data.isDay === data.isDay) {
        return cur.map(i => (i.id === last.id ? { ...i, data } : i));
      }
      return [...cur.slice(-1).map(i => ({ ...i, leaving: true })), {
        id: ++idRef.current, data, leaving: false, enterMs: cur.length || firstDailyEntry ? FADE_MS : 500,
      }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, isDay, fetchedAt]);

  useEffect(() => {
    if (!items.some(i => i.leaving)) return;
    const t = setTimeout(() => setItems(cur => cur.filter(i => !i.leaving)), FADE_MS + 150);
    return () => clearTimeout(t);
  }, [items]);

  const running = active && !reduced && items.length > 0;
  const frame = useFrameCallback(info => {
    acc.value += info.timeSincePreviousFrame ?? 16;
    if (acc.value < 33) return;
    clock.value += Math.min(acc.value, 100) / 1000;
    acc.value = 0;
  }, false);
  useEffect(() => { frame.setActive(running); return () => frame.setActive(false); }, [running, frame]);

  const count = useMemo(() => {
    const area = width * height;
    const small = Math.min(width, height) < 380 || area < 330000;
    const base = small ? 12 : 20;
    return Platform.OS === "web" ? base : Math.min(base, area < 420000 ? 12 : 16);
  }, [width, height]);

  return (
    <View pointerEvents="none" testID="weather-atmosphere" style={[StyleSheet.absoluteFill, { zIndex: 0, overflow: "hidden" }]}>
      {items.map(it => (
        <Layer key={it.id} data={it.data} leaving={it.leaving} clock={clock} w={width} h={height}
          count={count} reduced={reduced} isDark={isDark} enterMs={it.enterMs} active={active} />
      ))}
    </View>
  );
}

export default memo(WeatherAtmosphere);
