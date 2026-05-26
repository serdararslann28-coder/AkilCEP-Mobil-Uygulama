/**
 * VisionScreen — AKILCEP Vision Mode.
 *
 * Full-screen cinematic AI camera:
 *   - expo-camera v17 CameraView (correct SDK-54 version)
 *   - useCameraPermissions() for runtime permission request
 *   - AI focus frame with scanning animation
 *   - Ambient floating analysis labels (cycled every 3 s)
 *   - Glassmorphism bottom dock: Capture / Analyze / Ask / Web
 *   - Graceful fallback for web and denied permission
 *
 * Always dark graphite palette — never follows global theme.
 */
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
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

const { width: W, height: H } = Dimensions.get("window");

// Focus frame: 62% of shorter screen dimension
const FRAME_D   = Math.round(Math.min(W, H) * 0.62);
const CORNER_SZ = 26;
const CORNER_TH = 2;
const CORNER_BR = 4;

// Ambient analysis labels — rotated every 3 s
const LABELS = [
  "Analiz ediliyor...",
  "Nesne algılandı",
  "Canlı yorum hazırlanıyor",
  "Ortam taranıyor",
  "AI görüşü etkinleştirildi",
  "Nesne tanınıyor...",
];

// Bottom dock actions
const DOCK = [
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

  // expo-camera v17 permission hook — works on both native and web
  const [permission, requestPermission] = useCameraPermissions();

  const [labelIdx,   setLabelIdx]   = useState(0);
  const cyclerId = useRef<ReturnType<typeof setInterval> | null>(null);

  // Request on mount if not yet determined
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission?.status]);

  // Clean up label cycler on unmount
  useEffect(() => {
    return () => { if (cyclerId.current) clearInterval(cyclerId.current); };
  }, []);

  // ── Entrance animations ───────────────────────────────────────────────────
  const topOp  = useSharedValue(0);
  const dockOp = useSharedValue(0);
  const dockY  = useSharedValue(30);

  useEffect(() => {
    topOp.value  = withDelay(150, withTiming(1, { duration: 500 }));
    dockY.value  = withDelay(300, withSpring(0, { damping: 22, stiffness: 180 }));
    dockOp.value = withDelay(300, withTiming(1, { duration: 420 }));
  }, []);

  const topStyle  = useAnimatedStyle(() => ({ opacity: topOp.value }));
  const dockStyle = useAnimatedStyle(() => ({
    opacity:   dockOp.value,
    transform: [{ translateY: dockY.value }],
  }));

  // ── Focus frame animations (start once camera is live) ───────────────────
  const cameraReady = permission?.granted === true;

  const frameOp    = useSharedValue(0);
  const frameSc    = useSharedValue(0.92);
  const cornerGlow = useSharedValue(0.45);
  const scanY      = useSharedValue(0);

  useEffect(() => {
    if (!cameraReady) return;

    frameOp.value  = withDelay(500, withTiming(1, { duration: 700 }));
    frameSc.value  = withDelay(500, withSpring(1, { damping: 20, stiffness: 130 }));

    // Corner brackets breathe
    cornerGlow.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1,   { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      ),
    );

    // Scan line sweeps top-to-bottom, jumps back, repeats
    scanY.value = withDelay(
      900,
      withRepeat(
        withTiming(FRAME_D + 2, { duration: 2200, easing: Easing.linear }),
        -1, false,
      ),
    );

    // Start label cycling
    cyclerId.current = setInterval(() => {
      labelOp.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(0, { duration: 50 }),
      );
      setTimeout(() => {
        setLabelIdx(prev => (prev + 1) % LABELS.length);
        labelOp.value = withTiming(1, { duration: 380 });
      }, 350);
    }, 3000);

    return () => { if (cyclerId.current) clearInterval(cyclerId.current); };
  }, [cameraReady]);

  const frameStyle  = useAnimatedStyle(() => ({
    opacity:   frameOp.value,
    transform: [{ scale: frameSc.value }],
  }));
  const cornerStyle = useAnimatedStyle(() => ({ opacity: cornerGlow.value }));
  const scanStyle   = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
  }));

  // ── Ambient label ─────────────────────────────────────────────────────────
  const labelOp = useSharedValue(0);

  useEffect(() => {
    if (cameraReady) {
      labelOp.value = withDelay(1400, withTiming(1, { duration: 500 }));
    }
  }, [cameraReady]);

  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOp.value }));

  // ── Capture flash ─────────────────────────────────────────────────────────
  const flashOp    = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOp.value }));

  const handleCapture = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    flashOp.value = withSequence(
      withTiming(0.55, { duration: 55 }),
      withTiming(0,    { duration: 350, easing: Easing.out(Easing.ease) }),
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

  // ── Permission state ──────────────────────────────────────────────────────
  // Null while loading, then .granted / .canAskAgain tell us what to show
  const permLoading = permission === null;
  const permGranted = permission?.granted === true;
  const permAskable = !permGranted && (permission?.canAskAgain ?? true);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>

      {/* ════ CAMERA FEED ════ */}
      {permGranted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          animateShutter={false}
        />
      ) : (
        // Cinematic dark fallback bg while permission loads / denied
        <View style={[StyleSheet.absoluteFill, ss.camBg]}>
          <View style={ss.camBgOrb} />
        </View>
      )}

      {/* ════ VIGNETTE OVERLAYS — always present for cinematic feel ════ */}
      <View style={ss.vTop}    pointerEvents="none" />
      <View style={ss.vBottom} pointerEvents="none" />
      <View style={ss.vLeft}   pointerEvents="none" />
      <View style={ss.vRight}  pointerEvents="none" />

      {/* ════ CAPTURE FLASH ════ */}
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

        {/* Live indicator — only shown when camera is active */}
        <View style={[ss.liveChip, !permGranted && ss.liveChipOff]}>
          {permGranted ? <LiveDot /> : (
            <View style={[ss.liveDotStatic, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
          )}
          <Text style={[ss.liveText, !permGranted && { opacity: 0.30 }]}>
            {permGranted ? "CANLI" : permLoading ? "..." : "BEKLİYOR"}
          </Text>
        </View>
      </Animated.View>

      {/* ════ AI FOCUS FRAME (camera active) ════ */}
      {permGranted && (
        <View style={ss.frameWrap} pointerEvents="none">
          <Animated.View style={[ss.frameContainer, frameStyle]}>
            {/* Scan line — clips inside frame */}
            <View style={ss.scanClip}>
              <Animated.View style={[ss.scanLine, scanStyle]} />
            </View>
            {/* Subtle ambient fill */}
            <View style={ss.frameFill} />
            {/* Corner brackets */}
            <Animated.View style={[StyleSheet.absoluteFill, cornerStyle]}>
              <View style={[ss.corner, ss.cTL]} />
              <View style={[ss.corner, ss.cTR]} />
              <View style={[ss.corner, ss.cBL]} />
              <View style={[ss.corner, ss.cBR]} />
            </Animated.View>
          </Animated.View>

          {/* Ambient analysis label */}
          <Animated.View style={[ss.labelWrap, labelStyle]}>
            <View style={ss.labelCard}>
              <View style={ss.labelDot} />
              <Text style={ss.labelText}>{LABELS[labelIdx]}</Text>
            </View>
          </Animated.View>
        </View>
      )}

      {/* ════ PERMISSION / UNAVAILABLE CARD ════ */}
      {!permGranted && !permLoading && (
        <View style={ss.permWrap} pointerEvents="box-none">
          <View style={ss.permCard}>
            <View style={ss.permIconRing}>
              <Feather
                name={permAskable ? "camera" : "camera-off"}
                size={24}
                color="rgba(255,255,255,0.55)"
              />
            </View>
            <Text style={ss.permTitle}>
              {Platform.OS === "web"
                ? "Kamera Desteklenmiyor"
                : permAskable
                  ? "Kamera İzni Gerekli"
                  : "Kamera Erişimi Yok"}
            </Text>
            <Text style={ss.permSub}>
              {Platform.OS === "web"
                ? "Vizyon Modu yalnızca mobil cihazlarda\ngerçek kamera önizlemesi gösterir."
                : permAskable
                  ? "AI Vizyon Modu için kamera iznine\nihtiyaç duyulmaktadır."
                  : "Kamera izni reddedildi. Lütfen cihaz\nayarlarından izin verin."}
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

      {/* ════ BOTTOM DOCK ════ */}
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
                style={isCapture ? ss.dockCapture : ss.dockSecondary}
                onPress={() => handleDockAction(action.id)}
                activeOpacity={isCapture ? 0.80 : 0.70}
                hitSlop={isCapture ? 0 : 8}
              >
                {isCapture ? (
                  // Concentric-ring shutter button
                  <View style={ss.shutterOuter}>
                    <View style={[
                      ss.shutterInner,
                      !permGranted && { backgroundColor: "rgba(255,255,255,0.30)" },
                    ]} />
                  </View>
                ) : (
                  <>
                    <Feather name={action.icon as any} size={18} color="rgba(255,255,255,0.68)" />
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

// ── Pulsing live dot — its own animation loop ─────────────────────────────────
function LiveDot() {
  const op = useSharedValue(1);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(
        withTiming(0.22, { duration: 560, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 560, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);
  return (
    <Animated.View
      style={[ss.liveDotStatic, useAnimatedStyle(() => ({ opacity: op.value }))]}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CORNER_CLR = "rgba(255,255,255,0.75)";
const SCAN_CLR   = "rgba(200,220,255,0.20)";

const ss = StyleSheet.create({

  root: { flex: 1, backgroundColor: "#060608" },

  // ── Camera fallback bg
  camBg: {
    backgroundColor: "#060608",
    alignItems:      "center",
    justifyContent:  "center",
  },
  camBgOrb: {
    position:        "absolute",
    width:           W * 1.4,
    height:          W * 1.4,
    borderRadius:    W * 0.7,
    backgroundColor: "rgba(80,110,180,0.04)",
  },

  // ── Vignette layers
  vTop: {
    position:        "absolute",
    top: 0, left: 0, right: 0,
    height:          H * 0.30,
    backgroundColor: "rgba(4,4,8,0.70)",
  },
  vBottom: {
    position:        "absolute",
    bottom: 0, left: 0, right: 0,
    height:          H * 0.42,
    backgroundColor: "rgba(4,4,8,0.82)",
  },
  vLeft: {
    position:        "absolute",
    top: 0, bottom: 0, left: 0,
    width:           W * 0.10,
    backgroundColor: "rgba(4,4,8,0.26)",
  },
  vRight: {
    position:        "absolute",
    top: 0, bottom: 0, right: 0,
    width:           W * 0.10,
    backgroundColor: "rgba(4,4,8,0.26)",
  },

  // ── Flash overlay
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
  topCenter: {
    flex:       1,
    alignItems: "center",
  },
  topTitle: {
    fontSize:      10,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.58)",
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
  liveDotStatic: {
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

  // ── AI focus frame
  frameWrap: {
    position:       "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems:     "center",
    justifyContent: "center",
    paddingBottom:  90,
  },
  frameContainer: {
    width:  FRAME_D,
    height: FRAME_D,
  },
  scanClip: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    overflow: "hidden",
  },
  scanLine: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    height:          1.5,
    backgroundColor: SCAN_CLR,
  },
  frameFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  corner: {
    position:    "absolute",
    width:       CORNER_SZ,
    height:      CORNER_SZ,
    borderColor: CORNER_CLR,
  },
  cTL: {
    top: 0, left: 0,
    borderTopWidth:      CORNER_TH,
    borderLeftWidth:     CORNER_TH,
    borderTopLeftRadius: CORNER_BR,
  },
  cTR: {
    top: 0, right: 0,
    borderTopWidth:       CORNER_TH,
    borderRightWidth:     CORNER_TH,
    borderTopRightRadius: CORNER_BR,
  },
  cBL: {
    bottom: 0, left: 0,
    borderBottomWidth:     CORNER_TH,
    borderLeftWidth:       CORNER_TH,
    borderBottomLeftRadius: CORNER_BR,
  },
  cBR: {
    bottom: 0, right: 0,
    borderBottomWidth:      CORNER_TH,
    borderRightWidth:       CORNER_TH,
    borderBottomRightRadius: CORNER_BR,
  },

  // Ambient label
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
  permWrap: {
    position:       "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
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
  permIconRing: {
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
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.34)",
    textAlign:     "center",
    lineHeight:    20,
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
    backgroundColor:   "rgba(8,8,12,0.78)",
    borderRadius:      34,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.07)",
  },
  dockSecondary: {
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
    color:         "rgba(255,255,255,0.45)",
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
