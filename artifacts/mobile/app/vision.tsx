/**
 * VisionScreen — AKILCEP Vision Mode.
 *
 * Full-screen camera, no bands, no center frame.
 * Top:    ← AKILCEP VİZYON  ●  CANLI
 * Center: thin breathing detection ring (object awareness hint)
 * Bottom: Analiz Et  |  Shutter  |  Sor
 *
 * iPhone camera level — minimal floating controls, camera fills edge-to-edge.
 * Always dark, never follows global theme.
 */
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef } from "react";
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

const { width: SW, height: SH } = Dimensions.get("screen");

// Cover-mode: scale camera up from absoluteFill so it fills screen edge-to-edge
const CAM_SENSOR_RATIO = 4 / 3;
const CAM_NATURAL_H    = SW * CAM_SENSOR_RATIO;
const COVER_SCALE      = CAM_NATURAL_H < SH ? (SH / CAM_NATURAL_H) * 1.006 : 1.006;

// Detection ring size — slightly smaller than viewport
const RING_D = Math.round(Math.min(SW, SH) * 0.52);
const CORNER_L = 18; // bracket leg length
const CORNER_W = 1.5;
const CORNER_R = 5;

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function VisionScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 20 : insets.bottom;

  const { startVisionAnalysis } = useChat();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const permLoading = permission === null;
  const permGranted = permission?.granted === true;
  const permAskable = !permGranted && (permission?.canAskAgain ?? true);
  const cameraLive  = permGranted;

  // Auto-request on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission?.status]);

  // ── Entrance animations ──────────────────────────────────────────────────────
  const topOp  = useSharedValue(0);
  const dockOp = useSharedValue(0);
  const dockY  = useSharedValue(20);

  useEffect(() => {
    topOp.value  = withDelay(80,  withTiming(1, { duration: 460 }));
    dockY.value  = withDelay(200, withSpring(0,  { damping: 22, stiffness: 190 }));
    dockOp.value = withDelay(200, withTiming(1,  { duration: 360 }));
  }, []);

  const topStyle  = useAnimatedStyle(() => ({ opacity: topOp.value }));
  const dockStyle = useAnimatedStyle(() => ({
    opacity:   dockOp.value,
    transform: [{ translateY: dockY.value }],
  }));

  // ── Capture flash ────────────────────────────────────────────────────────────
  const flashOp    = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOp.value }));

  const triggerFlash = useCallback(() => {
    flashOp.value = withSequence(
      withTiming(0.55, { duration: 48  }),
      withTiming(0,    { duration: 300, easing: Easing.out(Easing.ease) }),
    );
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const handleCapture = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    triggerFlash();
  }, [triggerFlash]);

  const handleAnalyze = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Kamera Analizi", "Bu özellik yalnızca mobil cihazlarda çalışır.");
      return;
    }
    if (!permGranted) {
      Alert.alert("Kamera İzni", "Analiz için kamera iznine ihtiyaç var.");
      return;
    }
    if (!cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    triggerFlash();

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64:         true,
        quality:        0.70,
        skipProcessing: Platform.OS === "android",
      });

      if (!photo?.base64) {
        Alert.alert("Fotoğraf Hatası", "Fotoğraf çekilemedi. Tekrar deneyin.");
        return;
      }

      // Hand off to ChatContext — API call runs in background
      startVisionAnalysis(photo.base64, photo.uri);
      router.back();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata.";
      Alert.alert("Fotoğraf Hatası", `Fotoğraf çekilemedi.\n\n${msg}`);
    }
  }, [permGranted, startVisionAnalysis, triggerFlash]);

  const handleAsk = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>
      <StatusBar hidden />

      {/* ── Full-screen camera ─────────────────────────────────────────────── */}
      {permGranted ? (
        <CameraView
          ref={cameraRef}
          style={ss.camera}
          facing="back"
          animateShutter={false}
        />
      ) : (
        <View style={ss.camFallback} />
      )}

      {/* ── Subtle readability gradients (not black bands) ─────────────────── */}
      <LinearGradient
        colors={["rgba(0,0,0,0.46)", "rgba(0,0,0,0.0)"]}
        style={ss.gradTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.54)"]}
        style={ss.gradBottom}
        pointerEvents="none"
      />

      {/* ── Detection ring — visible when camera is live ───────────────────── */}
      {cameraLive && <DetectionRing />}

      {/* ── Capture flash ──────────────────────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.flash, flashStyle]}
        pointerEvents="none"
      />

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[ss.topBar, { paddingTop: topPad + 6 }, topStyle]}>
        <TouchableOpacity
          style={ss.backBtn}
          onPress={handleBack}
          hitSlop={16}
          activeOpacity={0.60}
        >
          <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.90)" />
        </TouchableOpacity>

        <Text style={ss.topTitle}>AKILCEP VİZYON</Text>

        <View style={ss.liveChip}>
          {permGranted && <LiveDot />}
          <Text style={[ss.liveText, !permGranted && { opacity: 0.28 }]}>
            {permGranted ? "CANLI" : permLoading ? "···" : "BEKLİYOR"}
          </Text>
        </View>
      </Animated.View>

      {/* ── Permission card ──────────────────────────────────────────────────── */}
      {!permGranted && !permLoading && (
        <View style={ss.permArea} pointerEvents="box-none">
          <View style={ss.permCard}>
            <Feather
              name={permAskable ? "camera" : "camera-off"}
              size={26}
              color="rgba(255,255,255,0.42)"
              style={{ marginBottom: 16 }}
            />
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
                onPress={() => void requestPermission()}
                activeOpacity={0.75}
              >
                <Text style={ss.permBtnText}>İzin Ver</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Bottom dock — Analiz Et | Shutter | Sor ─────────────────────────── */}
      <Animated.View
        style={[ss.dock, { paddingBottom: btmPad + 20 }, dockStyle]}
        pointerEvents="box-none"
      >
        {/* Analiz Et */}
        <TouchableOpacity
          style={ss.sideBtn}
          onPress={() => void handleAnalyze()}
          hitSlop={10}
          activeOpacity={0.65}
        >
          <View style={ss.sideBtnIcon}>
            <Feather name="zap" size={19} color="rgba(255,255,255,0.85)" />
          </View>
          <Text style={ss.sideBtnLabel}>Analiz Et</Text>
        </TouchableOpacity>

        {/* Shutter — Apple-style */}
        <TouchableOpacity
          style={ss.shutterWrap}
          onPress={handleCapture}
          activeOpacity={0.82}
        >
          <ShutterButton active={permGranted} />
        </TouchableOpacity>

        {/* Sor */}
        <TouchableOpacity
          style={ss.sideBtn}
          onPress={handleAsk}
          hitSlop={10}
          activeOpacity={0.65}
        >
          <View style={ss.sideBtnIcon}>
            <Feather name="mic" size={19} color="rgba(255,255,255,0.85)" />
          </View>
          <Text style={ss.sideBtnLabel}>Sor</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── DetectionRing ─────────────────────────────────────────────────────────────
// Thin breathing circle — hints at AI object awareness.
// Occasionally flashes corner brackets (simulated "lock").
function DetectionRing() {
  const ringOp  = useSharedValue(0);
  const scale   = useSharedValue(0.94);
  const cornerOp = useSharedValue(0.55);

  useEffect(() => {
    // Fade in after camera settles
    ringOp.value = withDelay(550, withTiming(1, { duration: 650 }));

    // Slow breathing scale
    scale.value = withDelay(550, withRepeat(
      withSequence(
        withTiming(1.0,  { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.96, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    ));

    // Corner brackets pulse — "lock" flash
    cornerOp.value = withDelay(550, withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.30, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    ));
  }, []);

  const ringStyle   = useAnimatedStyle(() => ({
    opacity:   ringOp.value * 0.28,
    transform: [{ scale: scale.value }],
  }));
  const bracketStyle = useAnimatedStyle(() => ({
    opacity: ringOp.value * cornerOp.value,
  }));

  return (
    <View style={ss.ringWrap} pointerEvents="none">
      {/* Thin breathing circle */}
      <Animated.View style={[ss.ring, ringStyle]} />

      {/* Corner L-brackets — same RING_D container */}
      <Animated.View style={[ss.ringBox, bracketStyle]}>
        {/* Top-left */}
        <View style={[ss.bracket, ss.bTL]} />
        {/* Top-right */}
        <View style={[ss.bracket, ss.bTR]} />
        {/* Bottom-left */}
        <View style={[ss.bracket, ss.bBL]} />
        {/* Bottom-right */}
        <View style={[ss.bracket, ss.bBR]} />
      </Animated.View>
    </View>
  );
}

// ─── ShutterButton ─────────────────────────────────────────────────────────────
// Apple camera shutter — outer ring + white inner disc.
function ShutterButton({ active }: { active: boolean }) {
  const innerScale = useSharedValue(1);

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
    opacity:   active ? 1 : 0.30,
  }));

  return (
    <View style={ss.shutterOuter}>
      <Animated.View style={[ss.shutterInner, innerStyle]} />
    </View>
  );
}

// ─── LiveDot ──────────────────────────────────────────────────────────────────
function LiveDot() {
  const op = useSharedValue(1);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(
        withTiming(0.18, { duration: 580, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 580, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);
  return (
    <Animated.View style={[ss.liveDot, useAnimatedStyle(() => ({ opacity: op.value }))]} />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const BRACKET_CLR = "rgba(255,255,255,0.88)";

const ss = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#000",
  },

  // Camera — absoluteFill + scale to cover-mode
  camera: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: COVER_SCALE }],
  },

  camFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0a0c",
  },

  // Gradients — subtle, not heavy black bands
  gradTop: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: SH * 0.18,
  },
  gradBottom: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height:   SH * 0.28,
  },

  // White flash on capture
  flash: {
    backgroundColor: "#fff",
  },

  // ── Top bar ─────────────────────────────────────────────────────────────────
  topBar: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    flexDirection:   "row",
    alignItems:      "center",
    paddingHorizontal: 16,
    paddingBottom:   12,
  },

  backBtn: {
    width:           36,
    height:          36,
    alignItems:      "center",
    justifyContent:  "center",
  },

  topTitle: {
    flex:          1,
    textAlign:     "center",
    fontSize:      12,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.90)",
    letterSpacing: 1.8,
  },

  liveChip: {
    width:          56,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "flex-end",
    gap:            5,
  },

  liveDot: {
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: "#4CD964", // iOS green
  },

  liveText: {
    fontSize:      9,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.78)",
    letterSpacing: 1.2,
  },

  // ── Detection ring ──────────────────────────────────────────────────────────
  ringWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
  },

  ring: {
    position:     "absolute",
    width:         RING_D,
    height:        RING_D,
    borderRadius:  RING_D / 2,
    borderWidth:   1,
    borderColor:   "#fff",
  },

  // Container sized to ring for bracket positioning
  ringBox: {
    position: "absolute",
    width:    RING_D,
    height:   RING_D,
  },

  bracket: {
    position:  "absolute",
    width:     CORNER_L,
    height:    CORNER_L,
    borderColor: BRACKET_CLR,
    borderWidth: 0, // override per bracket below
  },

  bTL: {
    top: 0, left: 0,
    borderTopWidth:  CORNER_W,
    borderLeftWidth: CORNER_W,
    borderTopLeftRadius: CORNER_R,
  },
  bTR: {
    top: 0, right: 0,
    borderTopWidth:   CORNER_W,
    borderRightWidth: CORNER_W,
    borderTopRightRadius: CORNER_R,
  },
  bBL: {
    bottom: 0, left: 0,
    borderBottomWidth: CORNER_W,
    borderLeftWidth:   CORNER_W,
    borderBottomLeftRadius: CORNER_R,
  },
  bBR: {
    bottom: 0, right: 0,
    borderBottomWidth:  CORNER_W,
    borderRightWidth:   CORNER_W,
    borderBottomRightRadius: CORNER_R,
  },

  // ── Bottom dock ─────────────────────────────────────────────────────────────
  dock: {
    position:       "absolute",
    bottom:         0,
    left:           0,
    right:          0,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
  },

  sideBtn: {
    width:          72,
    alignItems:     "center",
    gap:            8,
  },

  sideBtnIcon: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.15)",
  },

  sideBtnLabel: {
    fontSize:      11,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.72)",
    letterSpacing: 0.2,
  },

  shutterWrap: {
    alignItems:     "center",
    justifyContent: "center",
  },

  // Apple camera shutter — outer ring
  shutterOuter: {
    width:           78,
    height:          78,
    borderRadius:    39,
    borderWidth:     3,
    borderColor:     "rgba(255,255,255,0.88)",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // Solid inner disc
  shutterInner: {
    width:           62,
    height:          62,
    borderRadius:    31,
    backgroundColor: "rgba(255,255,255,0.92)",
  },

  // ── Permission card ─────────────────────────────────────────────────────────
  permArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
  },

  permCard: {
    width:             260,
    alignItems:        "center",
    paddingHorizontal: 28,
    paddingVertical:   32,
    backgroundColor:   "rgba(18,18,22,0.82)",
    borderRadius:      24,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.10)",
  },

  permTitle: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.88)",
    letterSpacing: -0.3,
    textAlign:     "center",
    marginBottom:  8,
  },

  permSub: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.40)",
    lineHeight:    20,
    textAlign:     "center",
    marginBottom:  22,
  },

  permBtn: {
    paddingHorizontal: 24,
    paddingVertical:   10,
    backgroundColor:   "rgba(255,255,255,0.12)",
    borderRadius:      20,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.18)",
  },

  permBtnText: {
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.88)",
    letterSpacing: 0.2,
  },
});
