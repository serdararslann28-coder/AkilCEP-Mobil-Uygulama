/**
 * VisionScreen — AKILCEP Vision Mode.
 *
 * Camera: absoluteFillObject + transform:scale (cover-mode, no wrapper needed).
 * Focus system: thin ivory outline + breathing + gradient shimmer + ambient
 *   particles + BlurView frosted label. Apple-minimal, never sci-fi.
 * Always dark graphite palette — never follows global theme.
 */
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@/context/ChatContext";
import {
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Screen dimensions — "screen" includes status/nav bar on Android
const { width: SW, height: SH } = Dimensions.get("screen");

// ── Cover-mode transform scale ─────────────────────────────────────────────────
// 4:3 conservative sensor assumption. Camera absoluteFills the screen then is
// scaled up from center until height ≥ SH. Screen edge clips the overflow.
const CAM_SENSOR_RATIO = 4 / 3;
const CAM_NATURAL_H    = SW * CAM_SENSOR_RATIO;
const COVER_SCALE      = CAM_NATURAL_H < SH
  ? (SH / CAM_NATURAL_H) * 1.008
  : 1.008;

// ── Focus frame geometry ───────────────────────────────────────────────────────
const FRAME_D  = Math.round(Math.min(SW, SH) * 0.60); // square frame side
const FRAME_BR = 22;  // border radius — rounded, not harsh
const FRAME_BW = 0.8; // border width — hair-thin for elegance

// Corner accent brackets (independent from main outline)
const CORNER_L = 22;  // bracket leg length
const CORNER_W = 1.5; // bracket line width
const CORNER_R = 7;   // bracket inner radius

// Ambient particles around the frame
const PARTICLES: Array<{ x: number; y: number; delay: number }> = [
  { x: -(FRAME_D * 0.54), y: -(FRAME_D * 0.28), delay: 0    },
  { x:   FRAME_D * 0.57,  y: -(FRAME_D * 0.18), delay: 700  },
  { x: -(FRAME_D * 0.46), y:   FRAME_D * 0.34,  delay: 1400 },
  { x:   FRAME_D * 0.52,  y:   FRAME_D * 0.26,  delay: 350  },
  { x:   FRAME_D * 0.04,  y: -(FRAME_D * 0.56), delay: 1050 },
  { x: -(FRAME_D * 0.06), y:   FRAME_D * 0.54,  delay: 210  },
];

// Cycling ambient analysis labels
const LABELS = [
  "Analiz ediliyor...",
  "Nesne algılandı",
  "Canlı analiz hazırlanıyor",
  "Saç modeli analiz ediliyor",
  "Ürün tanımlanıyor",
  "Ortam taranıyor",
  "AI görüşü etkinleştirildi",
];

// Bottom dock actions
const DOCK = [
  { id: "analyze", icon: "cpu",    label: "Analiz Et" },
  { id: "capture", icon: "circle", label: "Çek",      large: true },
  { id: "ask",     icon: "mic",    label: "Sor" },
  { id: "web",     icon: "globe",  label: "Web" },
] as const;

// ─── Main screen ──────────────────────────────────────────────────────────────
// Resolve API base — same pattern as ChatContext
function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}/api` : "/api";
}

export default function VisionScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 20 : insets.bottom;

  const { injectMessages } = useChat();

  const [permission, requestPermission] = useCameraPermissions();
  const [labelIdx,   setLabelIdx]   = useState(0);
  const [analyzing,  setAnalyzing]  = useState(false);
  const cyclerId  = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Auto-request permission on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission?.status]);

  useEffect(() => () => { if (cyclerId.current) clearInterval(cyclerId.current); }, []);

  // ── Entrance animations ────────────────────────────────────────────────────
  const topOp  = useSharedValue(0);
  const dockOp = useSharedValue(0);
  const dockY  = useSharedValue(28);

  useEffect(() => {
    topOp.value  = withDelay(100, withTiming(1, { duration: 500 }));
    dockY.value  = withDelay(260, withSpring(0, { damping: 22, stiffness: 180 }));
    dockOp.value = withDelay(260, withTiming(1, { duration: 420 }));
  }, []);

  const topStyle  = useAnimatedStyle(() => ({ opacity: topOp.value }));
  const dockStyle = useAnimatedStyle(() => ({
    opacity: dockOp.value,
    transform: [{ translateY: dockY.value }],
  }));

  // ── Focus frame lifecycle — starts once camera permission is live ──────────
  const cameraLive = permission?.granted === true;

  const frameOp  = useSharedValue(0);
  const labelOp  = useSharedValue(0);

  useEffect(() => {
    if (!cameraLive) return;

    frameOp.value = withDelay(420, withTiming(1, { duration: 700 }));
    labelOp.value = withDelay(1400, withTiming(1, { duration: 550 }));

    // Cycle analysis labels every 3.2 s
    cyclerId.current = setInterval(() => {
      labelOp.value = withTiming(0, { duration: 300 });
      setTimeout(() => {
        setLabelIdx(p => (p + 1) % LABELS.length);
        labelOp.value = withTiming(1, { duration: 400 });
      }, 320);
    }, 3200);

    return () => { if (cyclerId.current) clearInterval(cyclerId.current); };
  }, [cameraLive]);

  const frameAreaStyle = useAnimatedStyle(() => ({ opacity: frameOp.value }));
  const labelStyle     = useAnimatedStyle(() => ({ opacity: labelOp.value }));

  // ── Capture flash ──────────────────────────────────────────────────────────
  const flashOp    = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOp.value }));

  const handleCapture = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    flashOp.value = withSequence(
      withTiming(0.50, { duration: 60 }),
      withTiming(0,    { duration: 360, easing: Easing.out(Easing.ease) }),
    );
  }, []);

  // ── Gemini Vision: capture → encode → analyse → inject into chat ───────────
  const handleAnalyze = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Kamera Analizi", "Bu özellik yalnızca mobil cihazlarda çalışır.");
      return;
    }
    if (!permission?.granted) {
      Alert.alert("Kamera İzni", "Analiz için kamera iznine ihtiyaç var.");
      return;
    }
    if (!cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Flash effect to signal capture
    flashOp.value = withSequence(
      withTiming(0.45, { duration: 55 }),
      withTiming(0,    { duration: 340, easing: Easing.out(Easing.ease) }),
    );

    setAnalyzing(true);

    try {
      // 1. Capture photo as base64
      const photo = await cameraRef.current.takePictureAsync({
        base64:          true,
        quality:         0.70,
        skipProcessing:  Platform.OS === "android",
      });

      if (!photo?.base64) {
        Alert.alert("Fotoğraf Hatası", "Fotoğraf çekilemedi. Tekrar deneyin.");
        return;
      }

      // 2. Send to Gemini Vision API
      const res = await fetch(`${getApiBase()}/gemini/vision`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          image:    photo.base64,
          mimeType: "image/jpeg",
        }),
      });

      // Guard against non-JSON responses (e.g. 413 Payload Too Large returns HTML)
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const statusText =
          res.status === 413
            ? "Fotoğraf çok büyük. Daha düşük kalitede tekrar deneyin."
            : `Sunucu hatası (${res.status}). Lütfen tekrar deneyin.`;
        Alert.alert("Analiz Hatası", statusText);
        return;
      }

      const data = await res.json() as { ok: boolean; analysis?: string; error?: string };

      if (!res.ok || !data.ok || !data.analysis) {
        Alert.alert(
          "Analiz Hatası",
          data.error ?? "Gemini yanıt vermedi. Lütfen tekrar deneyin.",
        );
        return;
      }

      // 3. Inject user + AI messages into chat then navigate back
      injectMessages("Bu fotoğrafı analiz et.", data.analysis);
      router.back();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata.";
      Alert.alert("Bağlantı Hatası", `Sunucuya ulaşılamadı.\n\n${msg}`);
    } finally {
      setAnalyzing(false);
    }
  }, [permission?.granted, injectMessages, flashOp]);

  const handleDock = useCallback((id: string) => {
    if (id === "capture") { handleCapture(); return; }
    if (id === "analyze") { void handleAnalyze(); return; }
    Haptics.selectionAsync();
  }, [handleCapture, handleAnalyze]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const permLoading = permission === null;
  const permGranted = permission?.granted === true;
  const permAskable = !permGranted && (permission?.canAskAgain ?? true);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>

      <StatusBar hidden />

      {/* ── LAYER 1: Camera (absoluteFill + cover-scale, no wrapper) ───────── */}
      {permGranted ? (
        <CameraView
          ref={cameraRef}
          style={ss.camera}
          facing="back"
          animateShutter={false}
        />
      ) : (
        <View style={ss.camFallback}>
          <View style={ss.camFallbackOrb} />
        </View>
      )}

      {/* ── LAYER 2: Cinematic vignettes ────────────────────────────────────── */}
      <View style={ss.vTop}    pointerEvents="none" />
      <View style={ss.vBottom} pointerEvents="none" />

      {/* ── LAYER 3: Capture flash ──────────────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.flash, flashStyle]}
        pointerEvents="none"
      />

      {/* ── LAYER 3b: Gemini Vision analysis overlay ─────────────────────────── */}
      {analyzing && (
        <View style={ss.analyzeOverlay} pointerEvents="box-none">
          <BlurView intensity={28} tint="dark" style={ss.analyzeCard}>
            <AnalyzingSpinner />
            <Text style={ss.analyzeTitle}>Analiz ediliyor</Text>
            <Text style={ss.analyzeSub}>Gemini görüntüyü inceliyor…</Text>
          </BlurView>
        </View>
      )}

      {/* ── LAYER 4: Top bar ────────────────────────────────────────────────── */}
      <Animated.View style={[ss.topBar, { paddingTop: topPad + 10 }, topStyle]}>
        <TouchableOpacity
          style={ss.backBtn}
          onPress={handleBack}
          hitSlop={18}
          activeOpacity={0.65}
        >
          <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.80)" />
        </TouchableOpacity>

        <View style={ss.topCenter} pointerEvents="none">
          <Text style={ss.topTitle}>AKILCEP VİZYON</Text>
        </View>

        <View style={[ss.liveChip, !permGranted && ss.liveChipOff]}>
          {permGranted ? <LiveDot /> : <View style={ss.liveDot} />}
          <Text style={[ss.liveText, !permGranted && { opacity: 0.28 }]}>
            {permGranted ? "CANLI" : permLoading ? "···" : "BEKLİYOR"}
          </Text>
        </View>
      </Animated.View>

      {/* ── LAYER 5: AI Focus system (frame + particles + label) ────────────── */}
      {cameraLive && (
        <Animated.View
          style={[ss.focusArea, frameAreaStyle]}
          pointerEvents="none"
        >
          {/* Ambient particles drifting around the frame */}
          {PARTICLES.map((p, i) => (
            <AmbientParticle key={i} x={p.x} y={p.y} delay={p.delay} />
          ))}

          {/* The focus frame itself */}
          <AIFocusFrame />

          {/* Mode label above the frame */}
          <View style={ss.modeRow}>
            <View style={ss.modeDash} />
            <Text style={ss.modeText}>AI VİZYON · AKTİF</Text>
            <View style={ss.modeDash} />
          </View>

          {/* Cycling analysis label below the frame */}
          <Animated.View style={[ss.labelWrap, labelStyle]}>
            <AnalysisLabel text={LABELS[labelIdx]} />
          </Animated.View>
        </Animated.View>
      )}

      {/* ── LAYER 5b: Permission card ────────────────────────────────────────── */}
      {!permGranted && !permLoading && (
        <View style={ss.permArea} pointerEvents="box-none">
          <View style={ss.permCard}>
            <View style={ss.permIcon}>
              <Feather
                name={permAskable ? "camera" : "camera-off"}
                size={22}
                color="rgba(255,255,255,0.50)"
              />
            </View>
            <Text style={ss.permTitle}>
              {Platform.OS === "web"
                ? "Kamera Desteklenmiyor"
                : permAskable ? "Kamera İzni Gerekli" : "Kamera Erişimi Yok"}
            </Text>
            <Text style={ss.permSub}>
              {Platform.OS === "web"
                ? "Vizyon Modu yalnızca\nmobil cihazlarda çalışır."
                : permAskable
                  ? "AI Vizyon Modu için\nkamera iznine ihtiyaç var."
                  : "Lütfen cihaz ayarlarından\nkamera iznini verin."}
            </Text>
            {permAskable && Platform.OS !== "web" && (
              <TouchableOpacity
                style={ss.permBtn}
                onPress={() => requestPermission()}
                activeOpacity={0.75}
              >
                <Text style={ss.permBtnText}>İzin Ver</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── LAYER 6: Bottom dock ────────────────────────────────────────────── */}
      <Animated.View
        style={[ss.dock, { paddingBottom: btmPad + 18 }, dockStyle]}
        pointerEvents="box-none"
      >
        <View style={ss.dockRow}>
          {DOCK.map((action) => {
            const isCapture = action.id === "capture";
            return (
              <TouchableOpacity
                key={action.id}
                style={isCapture ? ss.dockCapture : ss.dockBtn}
                onPress={() => handleDock(action.id)}
                activeOpacity={isCapture ? 0.80 : 0.68}
                hitSlop={isCapture ? 0 : 8}
              >
                {isCapture ? (
                  <View style={ss.shutterOuter}>
                    <View style={[
                      ss.shutterInner,
                      !permGranted && { backgroundColor: "rgba(255,255,255,0.28)" },
                    ]} />
                  </View>
                ) : (
                  <>
                    <Feather
                      name={action.icon as any}
                      size={17}
                      color="rgba(255,255,255,0.65)"
                    />
                    <Text style={ss.dockLabel}>{action.label}</Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

    </View>
  );
}

// ─── AIFocusFrame ─────────────────────────────────────────────────────────────
// Thin ivory rounded outline + outer glow ring + L-corner accents +
// gradient shimmer sweep + breathing pulse. Apple-minimal, never sci-fi.
function AIFocusFrame() {
  // Breathing: very slow scale oscillation — frame feels alive, not mechanical
  const breathe = useSharedValue(1);
  // Shimmer: vertical gradient sweep through the interior
  const shimmer = useSharedValue(0);
  // Glow: outer ring opacity breathes slightly offset from main scale
  const glowOp  = useSharedValue(0.06);
  // Corner accent brightness
  const cornerOp = useSharedValue(0.5);

  useEffect(() => {
    // 2.8 s breathing cycle — inhale/exhale
    breathe.value = withRepeat(
      withSequence(
        withTiming(0.988, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.012, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );

    // Shimmer sweeps top → bottom every 3.6 s, then resets instantly
    shimmer.value = withDelay(600, withRepeat(
      withSequence(
        withTiming(FRAME_D, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0,        { duration: 0 }),
        withTiming(0,        { duration: 1000 }), // pause between sweeps
      ),
      -1, false,
    ));

    // Outer glow pulses 0.06 → 0.16, offset phase
    glowOp.value = withDelay(1400, withRepeat(
      withSequence(
        withTiming(0.16, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.06, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    ));

    // Corners pulse gently
    cornerOp.value = withRepeat(
      withSequence(
        withTiming(0.90, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.40, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shimmer.value - FRAME_D * 0.15 }],
  }));
  const glowStyle    = useAnimatedStyle(() => ({ opacity: glowOp.value  }));
  const cornerStyle  = useAnimatedStyle(() => ({ opacity: cornerOp.value }));

  return (
    <Animated.View style={[ss.frameRoot, breatheStyle]}>

      {/* Outer glow ring — larger, lower opacity, champagne mist */}
      <Animated.View style={[ss.glowRing, glowStyle]} pointerEvents="none" />

      {/* Main frame outline — thin ivory border, subtle fill */}
      <View style={ss.frameOutline}>

        {/* Barely-there interior fill */}
        <View style={ss.frameFill} />

        {/* Gradient shimmer sweep — clips inside frame bounds */}
        <View style={ss.shimmerClip}>
          <Animated.View style={[ss.shimmerWrap, shimmerStyle]} pointerEvents="none">
            <LinearGradient
              colors={[
                "transparent",
                "rgba(245,242,235,0.09)",
                "rgba(255,253,248,0.14)",
                "rgba(245,242,235,0.09)",
                "transparent",
              ]}
              style={ss.shimmerGradient}
            />
          </Animated.View>
        </View>

      </View>

      {/* Corner accent brackets — ivory, independent brightness */}
      <Animated.View style={[StyleSheet.absoluteFill, cornerStyle]}>
        <View style={[ss.corner, ss.cTL]} />
        <View style={[ss.corner, ss.cTR]} />
        <View style={[ss.corner, ss.cBL]} />
        <View style={[ss.corner, ss.cBR]} />
      </Animated.View>

    </Animated.View>
  );
}

// ─── AmbientParticle ──────────────────────────────────────────────────────────
// A single tiny floating dot that drifts and pulses softly.
// Positioned absolutely relative to the focusArea center via x/y offsets.
function AmbientParticle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const op    = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    op.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.24, { duration: 1800 + delay % 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.04, { duration: 1800 + delay % 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    ));
    drift.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(5,  { duration: 2400 + delay % 400, easing: Easing.inOut(Easing.sin) }),
        withTiming(-5, { duration: 2400 + delay % 400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   op.value,
    transform: [{ translateY: drift.value }],
  }));

  return (
    <Animated.View
      style={[
        ss.particle,
        { transform: [{ translateX: x }, { translateY: y }] },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

// ─── AnalysisLabel ────────────────────────────────────────────────────────────
// Frosted glass card — expo-blur + pulsing activity dot.
function AnalysisLabel({ text }: { text: string }) {
  const dotOp = useSharedValue(1);

  useEffect(() => {
    dotOp.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOp.value }));

  return (
    <BlurView intensity={18} tint="dark" style={ss.labelCard}>
      <Animated.View style={[ss.labelDot, dotStyle]} />
      <Text style={ss.labelText}>{text}</Text>
    </BlurView>
  );
}

// ─── AnalyzingSpinner ─────────────────────────────────────────────────────────
// Three-dot pulsing indicator shown during Gemini Vision analysis.
function AnalyzingSpinner() {
  const dots = [useSharedValue(0.25), useSharedValue(0.25), useSharedValue(0.25)];
  const DELAYS = [0, 220, 440];

  useEffect(() => {
    dots.forEach((sv, i) => {
      sv.value = withDelay(
        DELAYS[i]!,
        withRepeat(
          withSequence(
            withTiming(1,    { duration: 520, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.25, { duration: 520, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, false,
        ),
      );
    });
  }, []);

  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
      {dots.map((sv, i) => (
        <Animated.View
          key={i}
          style={[ss.spinDot, useAnimatedStyle(() => ({ opacity: sv.value }))]}
        />
      ))}
    </View>
  );
}

// ─── LiveDot ──────────────────────────────────────────────────────────────────
function LiveDot() {
  const op = useSharedValue(1);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(
        withTiming(0.18, { duration: 560, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 560, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);
  return (
    <Animated.View
      style={[ss.liveDot, useAnimatedStyle(() => ({ opacity: op.value }))]}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const IVORY      = "rgba(245,242,236,0.30)"; // main frame border
const IVORY_BRT  = "rgba(255,252,246,0.68)"; // corner accents
const GLOW_FILL  = "rgba(245,242,236,0.06)"; // outer glow ring bg

const ss = StyleSheet.create({

  // ── Root
  root: {
    flex:            1,
    backgroundColor: "#060608",
  },

  // ── Gemini Vision analysis overlay
  analyzeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex:          80,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(4,4,8,0.55)",
  },
  analyzeCard: {
    alignItems:        "center",
    paddingHorizontal: 40,
    paddingVertical:   32,
    borderRadius:      24,
    overflow:          "hidden",
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.10)",
  },
  analyzeTitle: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.90)",
    letterSpacing: -0.3,
    marginBottom:  6,
  },
  analyzeSub: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.42)",
    letterSpacing: 0.1,
  },

  // ── Analyzing spinner dots
  spinDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: "rgba(255,255,255,0.88)",
  },

  // ── Camera — absoluteFill + cover-scale (screen edge clips overflow)
  camera: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: COVER_SCALE }],
  },

  // ── Fallback bg
  camFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#060608",
    alignItems:      "center",
    justifyContent:  "center",
  },
  camFallbackOrb: {
    position:        "absolute",
    width:           SW * 1.4,
    height:          SW * 1.4,
    borderRadius:    SW * 0.7,
    backgroundColor: "rgba(80,100,160,0.04)",
  },

  // ── Vignettes
  vTop: {
    position:        "absolute",
    top: 0, left: 0, right: 0,
    height:          SH * 0.21,
    backgroundColor: "rgba(4,4,8,0.70)",
  },
  vBottom: {
    position:        "absolute",
    bottom: 0, left: 0, right: 0,
    height:          SH * 0.36,
    backgroundColor: "rgba(4,4,8,0.82)",
  },

  // ── Capture flash
  flash: {
    zIndex:          90,
    backgroundColor: "#FFFFFF",
  },

  // ── Top bar
  topBar: {
    position:          "absolute",
    top: 0, left: 0, right: 0,
    zIndex:            50,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 20,
    paddingBottom:     14,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.10)",
  },
  topCenter: { flex: 1, alignItems: "center" },
  topTitle: {
    fontSize:      10,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.55)",
    letterSpacing: 3.6,
  },
  liveChip: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 9,
    paddingVertical:   5,
    backgroundColor:   "rgba(255,255,255,0.07)",
    borderRadius:      20,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.09)",
  },
  liveChipOff: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor:     "rgba(255,255,255,0.05)",
  },
  liveDot: {
    width:           5,
    height:          5,
    borderRadius:    3,
    backgroundColor: "#2DC76D",
  },
  liveText: {
    fontSize:      8,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.50)",
    letterSpacing: 1.4,
  },

  // ── Focus area — centered column, pointerEvents none
  focusArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
    paddingBottom:  90,
  },

  // ── Frame root — breathing animated wrapper
  frameRoot: {
    width:          FRAME_D,
    height:         FRAME_D,
    alignItems:     "center",
    justifyContent: "center",
  },

  // ── Outer glow ring (slightly larger than frame, champagne)
  glowRing: {
    position:        "absolute",
    width:           FRAME_D + 28,
    height:          FRAME_D + 28,
    borderRadius:    FRAME_BR + 8,
    backgroundColor: GLOW_FILL,
    borderWidth:     1,
    borderColor:     "rgba(245,242,236,0.10)",
  },

  // ── Main frame outline — thin ivory border
  frameOutline: {
    width:        FRAME_D,
    height:       FRAME_D,
    borderRadius: FRAME_BR,
    borderWidth:  FRAME_BW,
    borderColor:  IVORY,
    overflow:     "hidden",
  },

  // ── Interior fill — barely visible warm tint
  frameFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245,242,236,0.020)",
  },

  // ── Shimmer: clips inside the frame outline (overflow hidden on parent)
  shimmerClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  shimmerWrap: {
    position: "absolute",
    left:     0,
    right:    0,
    top:      0,
  },
  shimmerGradient: {
    width:  "100%",
    height: FRAME_D * 0.30,
  },

  // ── Corner accent brackets (ivory, independent animation)
  corner: {
    position:    "absolute",
    width:       CORNER_L,
    height:      CORNER_L,
    borderColor: IVORY_BRT,
  },
  cTL: {
    top: -FRAME_BW, left: -FRAME_BW,
    borderTopWidth:      CORNER_W,
    borderLeftWidth:     CORNER_W,
    borderTopLeftRadius: CORNER_R,
  },
  cTR: {
    top: -FRAME_BW, right: -FRAME_BW,
    borderTopWidth:       CORNER_W,
    borderRightWidth:     CORNER_W,
    borderTopRightRadius: CORNER_R,
  },
  cBL: {
    bottom: -FRAME_BW, left: -FRAME_BW,
    borderBottomWidth:      CORNER_W,
    borderLeftWidth:        CORNER_W,
    borderBottomLeftRadius: CORNER_R,
  },
  cBR: {
    bottom: -FRAME_BW, right: -FRAME_BW,
    borderBottomWidth:       CORNER_W,
    borderRightWidth:        CORNER_W,
    borderBottomRightRadius: CORNER_R,
  },

  // ── Ambient particle
  particle: {
    position:        "absolute",
    width:           3,
    height:          3,
    borderRadius:    2,
    backgroundColor: "rgba(245,242,236,0.70)",
  },

  // ── AI mode indicator row (above frame)
  modeRow: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            8,
    marginBottom:   14,
  },
  modeDash: {
    width:           16,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  modeText: {
    fontSize:      8,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.28)",
    letterSpacing: 2.4,
  },

  // ── Analysis label (below frame)
  labelWrap: {
    marginTop: 22,
    alignItems: "center",
  },
  labelCard: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   9,
    borderRadius:      24,
    overflow:          "hidden",
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.08)",
  },
  labelDot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: "rgba(210,225,255,0.70)",
  },
  labelText: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(235,232,225,0.68)",
    letterSpacing: 0.1,
  },

  // ── Permission card
  permArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
    paddingBottom:  100,
  },
  permCard: {
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 30,
    paddingVertical:   32,
    backgroundColor:   "rgba(255,255,255,0.04)",
    borderRadius:      24,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.08)",
    maxWidth:          300,
  },
  permIcon: {
    width:           64,
    height:          64,
    borderRadius:    32,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.10)",
    marginBottom:    4,
  },
  permTitle: {
    fontSize:      16,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.72)",
    letterSpacing: -0.3,
    textAlign:     "center",
  },
  permSub: {
    fontSize:   13,
    fontFamily: "Inter_400Regular",
    color:      "rgba(255,255,255,0.34)",
    textAlign:  "center",
    lineHeight: 20,
  },
  permBtn: {
    marginTop:         6,
    paddingHorizontal: 28,
    paddingVertical:   12,
    backgroundColor:   "rgba(255,255,255,0.09)",
    borderRadius:      14,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.13)",
  },
  permBtnText: {
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.80)",
    letterSpacing: -0.1,
  },

  // ── Bottom dock
  dock: {
    position:   "absolute",
    bottom:     0, left: 0, right: 0,
    zIndex:     50,
    alignItems: "center",
  },
  dockRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   "rgba(8,8,12,0.82)",
    borderRadius:      34,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.07)",
  },
  dockBtn: {
    alignItems:        "center",
    justifyContent:    "center",
    gap:               5,
    paddingHorizontal: 16,
    paddingVertical:   11,
    borderRadius:      22,
    backgroundColor:   "rgba(255,255,255,0.055)",
    minWidth:          66,
  },
  dockLabel: {
    fontSize:      9,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.42)",
    letterSpacing: 0.3,
  },
  dockCapture: {
    alignItems:       "center",
    justifyContent:   "center",
    marginHorizontal: 4,
  },
  shutterOuter: {
    width:          70,
    height:         70,
    borderRadius:   35,
    borderWidth:    2,
    borderColor:    "rgba(255,255,255,0.36)",
    alignItems:     "center",
    justifyContent: "center",
  },
  shutterInner: {
    width:           54,
    height:          54,
    borderRadius:    27,
    backgroundColor: "rgba(255,255,255,0.90)",
  },
});
