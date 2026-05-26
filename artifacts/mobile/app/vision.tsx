/**
 * VisionScreen — AKILCEP Vision Mode.
 * Full-screen cinematic AI camera with focus frame, ambient labels, bottom dock.
 * Always dark graphite palette — never adapts to global theme.
 *
 * expo-camera is loaded lazily so the web bundle never crashes —
 * the Vision screen shows a graceful "mobile only" fallback on web.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
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

// expo-camera is not available on web — lazy-require so the bundle never crashes
const isNative = Platform.OS !== "web";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CameraView: React.ComponentType<any> | null = isNative
  ? (require("expo-camera") as { CameraView: React.ComponentType<any> }).CameraView
  : null;

const { width: W, height: H } = Dimensions.get("window");

// Focus frame square — 62% of shorter screen dimension
const FRAME_D   = Math.round(Math.min(W, H) * 0.62);
const CORNER_SZ = 26;
const CORNER_TH = 2;
const CORNER_BR = 3;

// Floating ambient analysis labels — rotate through these
const LABELS = [
  "Analiz ediliyor...",
  "Nesne algılandı",
  "Canlı yorum hazırlanıyor",
  "Ortam taranıyor",
  "AI görüşü etkinleştirildi",
  "Nesne tanınıyor...",
];

// ─── Bottom dock actions ──────────────────────────────────────────────────────
const DOCK_ACTIONS = [
  { id: "analyze", icon: "cpu",    label: "Analiz Et" },
  { id: "capture", icon: "circle", label: "Çek",       large: true },
  { id: "ask",     icon: "mic",    label: "Sor" },
  { id: "web",     icon: "globe",  label: "Web" },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function VisionScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 20 : insets.bottom;

  // Manual permission state — expo-image-picker is always available
  const [permGranted, setPermGranted] = useState(false);
  const cyclerId = useRef<ReturnType<typeof setInterval> | null>(null);
  const [labelIdx, setLabelIdx] = useState(0);

  // Request camera permission on mount (native only)
  useEffect(() => {
    if (!isNative) return;
    ImagePicker.requestCameraPermissionsAsync().then(({ status }) => {
      setPermGranted(status === "granted");
    });
  }, []);

  // ── Entrance animations ───────────────────────────────────────────────────
  const topOp  = useSharedValue(0);
  const dockOp = useSharedValue(0);
  const dockY  = useSharedValue(28);

  useEffect(() => {
    topOp.value  = withDelay(200, withTiming(1, { duration: 500 }));
    dockY.value  = withDelay(360, withSpring(0, { damping: 22, stiffness: 180 }));
    dockOp.value = withDelay(360, withTiming(1, { duration: 420 }));
  }, []);

  const topStyle  = useAnimatedStyle(() => ({ opacity: topOp.value }));
  const dockStyle = useAnimatedStyle(() => ({
    opacity:   dockOp.value,
    transform: [{ translateY: dockY.value }],
  }));

  // ── Focus frame animations ────────────────────────────────────────────────
  const frameOp    = useSharedValue(0);
  const frameSc    = useSharedValue(0.94);
  const cornerGlow = useSharedValue(0.5);
  const scanY      = useSharedValue(0);
  const showFrame  = permGranted && isNative;

  useEffect(() => {
    if (!showFrame) return;
    frameOp.value  = withDelay(600, withTiming(1, { duration: 700 }));
    frameSc.value  = withDelay(600, withSpring(1, { damping: 20, stiffness: 140 }));
    cornerGlow.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
    // Scan line sweeps top → bottom, resets
    scanY.value = withDelay(
      900,
      withRepeat(
        withTiming(FRAME_D, { duration: 2400, easing: Easing.linear }),
        -1, false,
      ),
    );
  }, [showFrame]);

  const frameStyle  = useAnimatedStyle(() => ({
    opacity:   frameOp.value,
    transform: [{ scale: frameSc.value }],
  }));
  const cornerStyle = useAnimatedStyle(() => ({ opacity: cornerGlow.value }));
  const scanStyle   = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
  }));

  // ── Ambient label cycling ─────────────────────────────────────────────────
  const labelOp = useSharedValue(0);

  useEffect(() => {
    if (!showFrame) return;
    labelOp.value = withDelay(1200, withTiming(1, { duration: 500 }));
    cyclerId.current = setInterval(() => {
      labelOp.value = withSequence(
        withTiming(0, { duration: 320 }),
        withTiming(0, { duration: 60 }),
      );
      setTimeout(() => {
        setLabelIdx(prev => (prev + 1) % LABELS.length);
        labelOp.value = withTiming(1, { duration: 400 });
      }, 380);
    }, 3000);
    return () => { if (cyclerId.current) clearInterval(cyclerId.current); };
  }, [showFrame]);

  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOp.value }));

  // ── Capture flash ─────────────────────────────────────────────────────────
  const flashOp    = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOp.value }));

  const handleCapture = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    flashOp.value = withSequence(
      withTiming(0.55, { duration: 60 }),
      withTiming(0,    { duration: 380, easing: Easing.out(Easing.ease) }),
    );
  }, []);

  const handleDockAction = useCallback((id: string) => {
    if (id === "capture") { handleCapture(); return; }
    Haptics.selectionAsync();
  }, [handleCapture]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>

      {/* ════ CAMERA FEED — native only ════ */}
      {permGranted && isNative && CameraView ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={[StyleSheet.absoluteFill, ss.camFallback]}>
          <View style={ss.camFallbackOrb} />
        </View>
      )}

      {/* ════ DARK VIGNETTE OVERLAYS ════ */}
      <View style={ss.vignetteTop}    pointerEvents="none" />
      <View style={ss.vignetteBottom} pointerEvents="none" />
      <View style={ss.vignetteLeft}   pointerEvents="none" />
      <View style={ss.vignetteRight}  pointerEvents="none" />

      {/* ════ WHITE FLASH ════ */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.flash, flashStyle]}
        pointerEvents="none"
      />

      {/* ════ TOP BAR ════ */}
      <Animated.View style={[ss.topBar, { paddingTop: topPad + 10 }, topStyle]}>

        <TouchableOpacity
          style={ss.backBtn}
          onPress={handleBack}
          hitSlop={18}
          activeOpacity={0.65}
        >
          <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.72)" />
        </TouchableOpacity>

        <View style={ss.topCenter} pointerEvents="none">
          <Text style={ss.topTitle}>AKILCEP VİZYON</Text>
        </View>

        <View style={ss.liveChip}>
          <LiveDot />
          <Text style={ss.liveText}>CANLI</Text>
        </View>

      </Animated.View>

      {/* ════ AI FOCUS FRAME ════ */}
      {showFrame && (
        <View style={ss.frameWrap} pointerEvents="none">
          <Animated.View style={[ss.frameContainer, frameStyle]}>

            {/* Scan line clipped to frame */}
            <View style={ss.scanClip}>
              <Animated.View style={[ss.scanLine, scanStyle]} />
            </View>

            {/* Subtle ambient fill */}
            <View style={ss.frameFill} />

            {/* Corner brackets */}
            <Animated.View style={[StyleSheet.absoluteFill, cornerStyle]}>
              <View style={[ss.corner, ss.cornerTL]} />
              <View style={[ss.corner, ss.cornerTR]} />
              <View style={[ss.corner, ss.cornerBL]} />
              <View style={[ss.corner, ss.cornerBR]} />
            </Animated.View>

          </Animated.View>

          {/* Analysis ambient label */}
          <Animated.View style={[ss.labelWrap, labelStyle]}>
            <View style={ss.labelCard}>
              <View style={ss.labelDot} />
              <Text style={ss.labelText}>{LABELS[labelIdx]}</Text>
            </View>
          </Animated.View>
        </View>
      )}

      {/* ════ UNAVAILABLE — web or denied ════ */}
      {(!permGranted || !isNative) && (
        <View style={ss.unavailWrap} pointerEvents="none">
          <View style={ss.unavailCard}>
            <Feather name="camera-off" size={22} color="rgba(255,255,255,0.28)" />
            <Text style={ss.unavailTitle}>Kamera Kullanılamıyor</Text>
            <Text style={ss.unavailSub}>
              {!isNative
                ? "Vizyon modu yalnızca mobil cihazlarda çalışır"
                : "Kamera izni verilmedi"}
            </Text>
          </View>
        </View>
      )}

      {/* ════ BOTTOM DOCK ════ */}
      <Animated.View
        style={[ss.dock, { paddingBottom: btmPad + 20 }, dockStyle]}
        pointerEvents="box-none"
      >
        <View style={ss.dockInner}>
          {DOCK_ACTIONS.map((action) => {
            const isCapture = action.id === "capture";
            return (
              <TouchableOpacity
                key={action.id}
                style={isCapture ? ss.dockBtnCapture : ss.dockBtnSecondary}
                onPress={() => handleDockAction(action.id)}
                activeOpacity={0.75}
                hitSlop={isCapture ? 0 : 8}
              >
                {isCapture ? (
                  <View style={ss.captureOuter}>
                    <View style={ss.captureInner} />
                  </View>
                ) : (
                  <>
                    <Feather name={action.icon as any} size={18} color="rgba(255,255,255,0.72)" />
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

// ── Live breathing dot ────────────────────────────────────────────────────────
function LiveDot() {
  const op = useSharedValue(1);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.View style={[ss.dotPulse, style]} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CORNER_CLR = "rgba(255,255,255,0.72)";
const SCAN_CLR   = "rgba(200,220,255,0.18)";
const DOCK_GLASS = "rgba(10,10,14,0.76)";

const ss = StyleSheet.create({

  root: { flex: 1, backgroundColor: "#050508" },

  // Camera fallback
  camFallback: {
    backgroundColor: "#050508",
    alignItems:      "center",
    justifyContent:  "center",
  },
  camFallbackOrb: {
    position:        "absolute",
    width:           W * 1.2,
    height:          W * 1.2,
    borderRadius:    W * 0.6,
    backgroundColor: "rgba(100,130,180,0.035)",
  },

  // Vignette layers
  vignetteTop: {
    position: "absolute", top: 0, left: 0, right: 0,
    height:   H * 0.32,
    backgroundColor: "rgba(3,3,8,0.72)",
  },
  vignetteBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height:   H * 0.42,
    backgroundColor: "rgba(3,3,8,0.80)",
  },
  vignetteLeft: {
    position: "absolute", top: 0, bottom: 0, left: 0,
    width:    W * 0.12,
    backgroundColor: "rgba(3,3,8,0.28)",
  },
  vignetteRight: {
    position: "absolute", top: 0, bottom: 0, right: 0,
    width:    W * 0.12,
    backgroundColor: "rgba(3,3,8,0.28)",
  },

  // Capture flash
  flash: {
    zIndex:          90,
    backgroundColor: "#FFFFFF",
  },

  // Top bar
  topBar: {
    position:       "absolute",
    top:            0,
    left:           0,
    right:          0,
    zIndex:         50,
    flexDirection:  "row",
    alignItems:     "center",
    paddingHorizontal: 20,
    paddingBottom:  14,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.09)",
  },
  topCenter: {
    flex:       1,
    alignItems: "center",
  },
  topTitle: {
    fontSize:      10,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.60)",
    letterSpacing: 3.2,
  },
  liveChip: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 9,
    paddingVertical:   5,
    backgroundColor:   "rgba(255,255,255,0.06)",
    borderRadius:      20,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.08)",
  },
  dotPulse: {
    width:           5,
    height:          5,
    borderRadius:    3,
    backgroundColor: "#2DC76D",
  },
  liveText: {
    fontSize:      8,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.48)",
    letterSpacing: 1.4,
  },

  // AI focus frame
  frameWrap: {
    position:       "absolute",
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     "center",
    justifyContent: "center",
    paddingBottom:  80,
  },
  frameContainer: {
    width:  FRAME_D,
    height: FRAME_D,
  },
  scanClip: {
    position: "absolute",
    top:      0,
    left:     0,
    right:    0,
    bottom:   0,
    overflow: "hidden",
  },
  scanLine: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: SCAN_CLR,
  },
  frameFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.012)",
    borderRadius:    2,
  },

  // Corner bracket pieces
  corner: {
    position:    "absolute",
    width:       CORNER_SZ,
    height:      CORNER_SZ,
    borderColor: CORNER_CLR,
  },
  cornerTL: {
    top:                 0,
    left:                0,
    borderTopWidth:      CORNER_TH,
    borderLeftWidth:     CORNER_TH,
    borderTopLeftRadius: CORNER_BR,
  },
  cornerTR: {
    top:                  0,
    right:                0,
    borderTopWidth:       CORNER_TH,
    borderRightWidth:     CORNER_TH,
    borderTopRightRadius: CORNER_BR,
  },
  cornerBL: {
    bottom:                0,
    left:                  0,
    borderBottomWidth:     CORNER_TH,
    borderLeftWidth:       CORNER_TH,
    borderBottomLeftRadius: CORNER_BR,
  },
  cornerBR: {
    bottom:                 0,
    right:                  0,
    borderBottomWidth:      CORNER_TH,
    borderRightWidth:       CORNER_TH,
    borderBottomRightRadius: CORNER_BR,
  },

  // Ambient analysis label
  labelWrap: {
    marginTop:  18,
    alignItems: "center",
  },
  labelCard: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               7,
    paddingHorizontal: 14,
    paddingVertical:   7,
    backgroundColor:   "rgba(255,255,255,0.06)",
    borderRadius:      20,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.08)",
  },
  labelDot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: "rgba(200,220,255,0.60)",
  },
  labelText: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.52)",
    letterSpacing: 0.2,
  },

  // Unavailable fallback
  unavailWrap: {
    position:       "absolute",
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     "center",
    justifyContent: "center",
    paddingBottom:  80,
  },
  unavailCard: {
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 28,
    paddingVertical:   28,
    backgroundColor:   "rgba(255,255,255,0.04)",
    borderRadius:      20,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.07)",
  },
  unavailTitle: {
    fontSize:      15,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.42)",
    letterSpacing: -0.2,
  },
  unavailSub: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    color:      "rgba(255,255,255,0.24)",
    textAlign:  "center",
    lineHeight: 18,
    maxWidth:   220,
  },

  // Bottom dock
  dock: {
    position:   "absolute",
    bottom:     0,
    left:       0,
    right:      0,
    zIndex:     50,
    alignItems: "center",
  },
  dockInner: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 22,
    paddingVertical:   16,
    backgroundColor:   DOCK_GLASS,
    borderRadius:      32,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.08)",
  },

  // Secondary dock buttons (Analyze / Ask / Web)
  dockBtnSecondary: {
    alignItems:        "center",
    justifyContent:    "center",
    gap:               5,
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderRadius:      20,
    backgroundColor:   "rgba(255,255,255,0.06)",
    minWidth:          66,
  },
  dockLabel: {
    fontSize:      9,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.48)",
    letterSpacing: 0.3,
  },

  // Capture button — concentric rings
  dockBtnCapture: {
    alignItems:       "center",
    justifyContent:   "center",
    marginHorizontal: 4,
  },
  captureOuter: {
    width:           68,
    height:          68,
    borderRadius:    34,
    borderWidth:     2,
    borderColor:     "rgba(255,255,255,0.35)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  captureInner: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
});
