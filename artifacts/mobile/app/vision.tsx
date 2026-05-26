/**
 * VisionScreen — AKILCEP Vision Mode.
 *
 * Camera architecture:
 *   CameraView sits at the absolute root of the component tree with
 *   StyleSheet.absoluteFillObject + a transform:scale to achieve cover-mode.
 *
 *   Why transform:scale and not overflow:hidden?
 *   overflow:hidden only clips React Native View children — it cannot clip
 *   the camera's own native rendering surface (a SurfaceView/TextureView on
 *   Android, AVPreviewLayer on iOS). The scale transform makes the camera
 *   fill the entire screen from the inside; the screen edge itself clips the
 *   overflow naturally without any container tricks.
 *
 *   Cover-mode scale formula:
 *     Camera sensor is 4:3 portrait (conservative assumption; works for 16:9 too).
 *     Natural camera height at screen width W = W × (4/3).
 *     If screen H > natural camera H, scale up by H / (W × 4/3).
 *     Result: camera height == screen height, sides overflow and get clipped.
 *
 * Always dark graphite palette — never follows global theme.
 */
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
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

// Screen dimensions — use "screen" to include status + nav bar areas on Android
const { width: SW, height: SH } = Dimensions.get("screen");

// ── Cover-mode transform scale ────────────────────────────────────────────────
// 4:3 is the conservative sensor assumption (also correct for 16:9 — only
// over-scales slightly, still fills with no black bars).
// The camera is given absoluteFill; scale from center until height ≥ SH.
const CAM_SENSOR_RATIO = 4 / 3;             // sensor: height = width × 4/3
const CAM_NATURAL_H    = SW * CAM_SENSOR_RATIO;  // camera height at screen width
const COVER_SCALE      = CAM_NATURAL_H < SH
  ? (SH / CAM_NATURAL_H) * 1.008          // 0.8% extra — guarantees no hair gap
  : 1.008;

// Focus frame: 62% of shorter screen dimension
const FRAME_D   = Math.round(Math.min(SW, SH) * 0.62);
const CORNER_SZ = 26;
const CORNER_TH = 2;
const CORNER_BR = 4;

// Ambient analysis labels — rotate every 3 s
const LABELS = [
  "Analiz ediliyor...",
  "Nesne algılandı",
  "Canlı yorum hazırlanıyor",
  "Ortam taranıyor",
  "AI görüşü etkinleştirildi",
  "Nesne tanınıyor...",
];

// Bottom dock
const DOCK = [
  { id: "analyze", icon: "cpu",    label: "Analiz Et" },
  { id: "capture", icon: "circle", label: "Çek",       large: true },
  { id: "ask",     icon: "mic",    label: "Sor" },
  { id: "web",     icon: "globe",  label: "Web" },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function VisionScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 20 : insets.bottom;

  const [permission, requestPermission] = useCameraPermissions();
  const [labelIdx, setLabelIdx] = useState(0);
  const cyclerId = useRef<ReturnType<typeof setInterval> | null>(null);

  // Request on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission?.status]);

  useEffect(() => () => { if (cyclerId.current) clearInterval(cyclerId.current); }, []);

  // ── Entrance ─────────────────────────────────────────────────────────────
  const topOp  = useSharedValue(0);
  const dockOp = useSharedValue(0);
  const dockY  = useSharedValue(30);

  useEffect(() => {
    topOp.value  = withDelay(120, withTiming(1, { duration: 480 }));
    dockY.value  = withDelay(280, withSpring(0,  { damping: 22, stiffness: 180 }));
    dockOp.value = withDelay(280, withTiming(1,  { duration: 400 }));
  }, []);

  const topStyle  = useAnimatedStyle(() => ({ opacity: topOp.value }));
  const dockStyle = useAnimatedStyle(() => ({
    opacity:   dockOp.value,
    transform: [{ translateY: dockY.value }],
  }));

  // ── Focus frame (starts once permission granted) ──────────────────────────
  const cameraLive = permission?.granted === true;

  const frameOp    = useSharedValue(0);
  const frameSc    = useSharedValue(0.92);
  const cornerGlow = useSharedValue(0.4);
  const scanY      = useSharedValue(0);
  const labelOp    = useSharedValue(0);

  useEffect(() => {
    if (!cameraLive) return;

    frameOp.value  = withDelay(450, withTiming(1,   { duration: 650 }));
    frameSc.value  = withDelay(450, withSpring(1,    { damping: 20, stiffness: 130 }));
    labelOp.value  = withDelay(1300, withTiming(1,  { duration: 500 }));

    cornerGlow.value = withDelay(650, withRepeat(
      withSequence(
        withTiming(1,   { duration: 1900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.38,{ duration: 1900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    ));

    scanY.value = withDelay(850, withRepeat(
      withTiming(FRAME_D + 2, { duration: 2100, easing: Easing.linear }),
      -1, false,
    ));

    cyclerId.current = setInterval(() => {
      labelOp.value = withSequence(
        withTiming(0, { duration: 280 }),
        withTiming(0, { duration: 50 }),
      );
      setTimeout(() => {
        setLabelIdx(p => (p + 1) % LABELS.length);
        labelOp.value = withTiming(1, { duration: 360 });
      }, 330);
    }, 3000);

    return () => { if (cyclerId.current) clearInterval(cyclerId.current); };
  }, [cameraLive]);

  const frameStyle  = useAnimatedStyle(() => ({
    opacity: frameOp.value, transform: [{ scale: frameSc.value }],
  }));
  const cornerStyle = useAnimatedStyle(() => ({ opacity: cornerGlow.value }));
  const scanStyle   = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
  }));
  const labelStyle  = useAnimatedStyle(() => ({ opacity: labelOp.value }));

  // ── Capture flash ─────────────────────────────────────────────────────────
  const flashOp    = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOp.value }));

  const handleCapture = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    flashOp.value = withSequence(
      withTiming(0.55, { duration: 55 }),
      withTiming(0,    { duration: 340, easing: Easing.out(Easing.ease) }),
    );
  }, []);

  const handleDock = useCallback((id: string) => {
    if (id === "capture") { handleCapture(); return; }
    Haptics.selectionAsync();
  }, [handleCapture]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const permLoading = permission === null;
  const permGranted = permission?.granted === true;
  const permAskable = !permGranted && (permission?.canAskAgain ?? true);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>

      {/* Status bar hidden — full immersion */}
      <StatusBar hidden />

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 1 — CAMERA (absoluteFill + cover-scale)
          Direct child of root. No wrapper. No container. No overflow:hidden.
          The transform:scale enlarges from center; screen edge clips naturally.
      ══════════════════════════════════════════════════════════════════════ */}
      {permGranted ? (
        <CameraView
          style={ss.camera}
          facing="back"
          animateShutter={false}
        />
      ) : (
        // Dark cinematic bg while loading / denied
        <View style={ss.camFallback}>
          <View style={ss.camFallbackOrb} />
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 2 — CINEMATIC VIGNETTES (pointerEvents none, top/bottom only)
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={ss.vTop}    pointerEvents="none" />
      <View style={ss.vBottom} pointerEvents="none" />

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 3 — WHITE CAPTURE FLASH
      ══════════════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.flash, flashStyle]}
        pointerEvents="none"
      />

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 4 — TOP BAR
      ══════════════════════════════════════════════════════════════════════ */}
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
          {permGranted ? <LiveDot /> : (
            <View style={ss.liveDot} />
          )}
          <Text style={[ss.liveText, !permGranted && { opacity: 0.28 }]}>
            {permGranted ? "CANLI" : permLoading ? "···" : "BEKLİYOR"}
          </Text>
        </View>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 5 — AI FOCUS FRAME + AMBIENT LABEL
      ══════════════════════════════════════════════════════════════════════ */}
      {cameraLive && (
        <View style={ss.frameArea} pointerEvents="none">
          <Animated.View style={[ss.frame, frameStyle]}>
            {/* Scan line */}
            <View style={ss.scanClip}>
              <Animated.View style={[ss.scanLine, scanStyle]} />
            </View>
            {/* Subtle fill tint */}
            <View style={ss.frameFill} />
            {/* L-corner brackets */}
            <Animated.View style={[StyleSheet.absoluteFill, cornerStyle]}>
              <View style={[ss.corner, ss.cTL]} />
              <View style={[ss.corner, ss.cTR]} />
              <View style={[ss.corner, ss.cBL]} />
              <View style={[ss.corner, ss.cBR]} />
            </Animated.View>
          </Animated.View>

          {/* Cycling analysis label */}
          <Animated.View style={[ss.labelWrap, labelStyle]}>
            <View style={ss.labelCard}>
              <View style={ss.labelDot} />
              <Text style={ss.labelText}>{LABELS[labelIdx]}</Text>
            </View>
          </Animated.View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 5b — PERMISSION CARD (shown when camera not available)
      ══════════════════════════════════════════════════════════════════════ */}
      {!permGranted && !permLoading && (
        <View style={ss.permArea} pointerEvents="box-none">
          <View style={ss.permCard}>
            <View style={ss.permIcon}>
              <Feather
                name={permAskable ? "camera" : "camera-off"}
                size={24}
                color="rgba(255,255,255,0.55)"
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

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 6 — BOTTOM DOCK
      ══════════════════════════════════════════════════════════════════════ */}
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
                    <Feather name={action.icon as any} size={18} color="rgba(255,255,255,0.70)" />
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

// ── Pulsing live dot ──────────────────────────────────────────────────────────
function LiveDot() {
  const op = useSharedValue(1);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(
        withTiming(0.20, { duration: 540, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 540, easing: Easing.inOut(Easing.ease) }),
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
const CORNER_CLR = "rgba(255,255,255,0.75)";
const SCAN_CLR   = "rgba(200,220,255,0.22)";

const ss = StyleSheet.create({

  // ── Root — flex:1, no overflow constraints
  root: {
    flex:            1,
    backgroundColor: "#060608",
  },

  // ── CAMERA — absoluteFill + cover-scale transform
  // The scale makes the camera fill the screen height; screen edge clips the sides.
  camera: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: COVER_SCALE }],
  },

  // ── Dark fallback while permission resolves / denied / web
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
    backgroundColor: "rgba(80,110,180,0.04)",
  },

  // ── Vignettes
  vTop: {
    position:        "absolute",
    top: 0, left: 0, right: 0,
    height:          SH * 0.22,
    backgroundColor: "rgba(4,4,8,0.72)",
  },
  vBottom: {
    position:        "absolute",
    bottom: 0, left: 0, right: 0,
    height:          SH * 0.36,
    backgroundColor: "rgba(4,4,8,0.84)",
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
    color:         "rgba(255,255,255,0.60)",
    letterSpacing: 3.4,
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

  // ── Focus frame area
  frameArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
    paddingBottom:  100,
  },
  frame: {
    width:  FRAME_D,
    height: FRAME_D,
  },
  scanClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  scanLine: {
    position:        "absolute",
    top:             0, left: 0, right: 0,
    height:          1.5,
    backgroundColor: SCAN_CLR,
  },
  frameFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.014)",
  },
  corner: {
    position:    "absolute",
    width:       CORNER_SZ,
    height:      CORNER_SZ,
    borderColor: CORNER_CLR,
  },
  cTL: {
    top: 0, left: 0,
    borderTopWidth: CORNER_TH, borderLeftWidth: CORNER_TH,
    borderTopLeftRadius: CORNER_BR,
  },
  cTR: {
    top: 0, right: 0,
    borderTopWidth: CORNER_TH, borderRightWidth: CORNER_TH,
    borderTopRightRadius: CORNER_BR,
  },
  cBL: {
    bottom: 0, left: 0,
    borderBottomWidth: CORNER_TH, borderLeftWidth: CORNER_TH,
    borderBottomLeftRadius: CORNER_BR,
  },
  cBR: {
    bottom: 0, right: 0,
    borderBottomWidth: CORNER_TH, borderRightWidth: CORNER_TH,
    borderBottomRightRadius: CORNER_BR,
  },

  // ── Ambient label
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
    backgroundColor:   "rgba(255,255,255,0.065)",
    borderRadius:      20,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.09)",
  },
  labelDot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: "rgba(200,220,255,0.65)",
  },
  labelText: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.52)",
    letterSpacing: 0.2,
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
    bottom:     0,
    left:       0,
    right:      0,
    zIndex:     50,
    alignItems: "center",
  },
  dockRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   "rgba(8,8,12,0.80)",
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
    color:         "rgba(255,255,255,0.44)",
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
    borderColor:    "rgba(255,255,255,0.38)",
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
