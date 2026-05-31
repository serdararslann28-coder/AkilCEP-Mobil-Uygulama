/**
 * VisionScreen — AKILCEP Vision Mode.
 *
 * Full-screen camera. Always dark. Never follows global theme.
 * Top:    ← AKILCEP VİZYON  ●  CANLI   [↺]
 * Center: detection frame — appears only when shutter fires (simulated lock)
 * Bottom: Analiz Et  |  Shutter  |  Sor
 *
 * Camera facing flips with a smooth card-flip animation (scaleX).
 */
import { Feather } from "@expo/vector-icons";
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
  runOnJS,
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

// Cover-mode: scale camera so it fills edge-to-edge (no black bars)
const CAM_SENSOR_RATIO = 4 / 3;
const CAM_NATURAL_H    = SW * CAM_SENSOR_RATIO;
const COVER_SCALE      = CAM_NATURAL_H < SH ? (SH / CAM_NATURAL_H) * 1.006 : 1.006;

// Detection frame geometry
const FRAME_W  = Math.round(SW * 0.68);
const FRAME_H  = Math.round(FRAME_W * 1.06);
const FRAME_BR = 16;
const CORNER_L = 20;
const CORNER_W = 1.8;
const CORNER_R = 6;
const BRACKET_CLR = "rgba(255,255,255,0.92)";

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function VisionScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 20 : insets.bottom;

  const { startVisionAnalysis } = useChat();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Camera facing — persists for session lifetime
  const [facing, setFacing] = useState<"back" | "front">("back");

  const permLoading = permission === null;
  const permGranted = permission?.granted === true;
  const permAskable = !permGranted && (permission?.canAskAgain ?? true);

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

  // ── Camera flip (card-flip via scaleX) ──────────────────────────────────────
  const flipScaleX = useSharedValue(1);

  const doSetFacing = useCallback((next: "back" | "front") => {
    setFacing(next);
  }, []);

  const handleFlip = useCallback(() => {
    if (!permGranted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const next: "back" | "front" = facing === "back" ? "front" : "back";

    // Fold → switch → unfold
    flipScaleX.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.ease) }, (done) => {
      if (done) {
        runOnJS(doSetFacing)(next);
        flipScaleX.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) });
      }
    });
  }, [facing, permGranted, doSetFacing]);

  const camFlipStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: flipScaleX.value }],
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

  // ── Detection frame (shown on shutter/analyze) ───────────────────────────────
  const frameOp      = useSharedValue(0);
  const frameBracket = useSharedValue(0);

  const triggerDetection = useCallback(() => {
    // Frame fades in quickly, then lingers, then fades out
    frameOp.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(1, { duration: 900 }),  // hold
      withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) }),
    );
    // Brackets flash in with a pulse
    frameBracket.value = withSequence(
      withTiming(1,    { duration: 80  }),
      withTiming(0.55, { duration: 200 }),
      withTiming(1,    { duration: 80  }),
      withTiming(0,    { duration: 500, easing: Easing.out(Easing.ease) }),
    );
  }, []);

  const frameStyle   = useAnimatedStyle(() => ({ opacity: frameOp.value * 0.75 }));
  const bracketStyle = useAnimatedStyle(() => ({ opacity: frameBracket.value }));

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const handleCapture = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    triggerFlash();
    triggerDetection();
  }, [triggerFlash, triggerDetection]);

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
    triggerDetection();

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

      startVisionAnalysis(photo.base64, photo.uri);
      // Replace vision in stack → chat shows photo + analysis result
      router.replace("/chat");

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata.";
      Alert.alert("Fotoğraf Hatası", `Fotoğraf çekilemedi.\n\n${msg}`);
    }
  }, [permGranted, startVisionAnalysis, triggerFlash, triggerDetection]);

  const handleAsk = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>
      <StatusBar hidden />

      {/* ── Full-screen camera with flip animation wrapper ────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, camFlipStyle]}>
        {permGranted ? (
          <CameraView
            ref={cameraRef}
            style={ss.camera}
            facing={facing}
            animateShutter={false}
          />
        ) : (
          <View style={ss.camFallback} />
        )}
      </Animated.View>

      {/* ── Subtle readability gradients ─────────────────────────────────── */}
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

      {/* ── Detection frame — appears on shutter/analyze press ───────────── */}
      <View style={ss.frameWrap} pointerEvents="none">
        {/* Frame outline */}
        <Animated.View style={[ss.frameOutline, frameStyle]} />

        {/* Corner brackets — brighter than outline, double-flash on lock */}
        <Animated.View style={[ss.bracketContainer, bracketStyle]}>
          <View style={[ss.bracket, ss.bTL]} />
          <View style={[ss.bracket, ss.bTR]} />
          <View style={[ss.bracket, ss.bBL]} />
          <View style={[ss.bracket, ss.bBR]} />
        </Animated.View>
      </View>

      {/* ── Capture flash ──────────────────────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.flash, flashStyle]}
        pointerEvents="none"
      />

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[ss.topBar, { paddingTop: topPad + 6 }, topStyle]}>
        {/* Back */}
        <TouchableOpacity
          style={ss.topIconBtn}
          onPress={handleBack}
          hitSlop={16}
          activeOpacity={0.60}
        >
          <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.90)" />
        </TouchableOpacity>

        {/* Title + live indicator */}
        <View style={ss.topCenter} pointerEvents="none">
          <Text style={ss.topTitle}>AKILCEP VİZYON</Text>
          {permGranted && (
            <View style={ss.liveRow}>
              <LiveDot />
              <Text style={ss.liveText}>CANLI</Text>
            </View>
          )}
          {!permGranted && (
            <Text style={ss.waitText}>
              {permLoading ? "···" : "BEKLİYOR"}
            </Text>
          )}
        </View>

        {/* Flip camera */}
        <TouchableOpacity
          style={ss.topIconBtn}
          onPress={handleFlip}
          hitSlop={16}
          activeOpacity={0.60}
          disabled={!permGranted}
        >
          <Feather
            name="refresh-cw"
            size={18}
            color={permGranted ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.22)"}
          />
        </TouchableOpacity>
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
          <View style={ss.shutterOuter}>
            <View style={[
              ss.shutterInner,
              !permGranted && { opacity: 0.28 },
            ]} />
          </View>
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
const ss = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#000",
  },

  // Camera — absoluteFill + cover-scale
  camera: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: COVER_SCALE }],
  },

  camFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0a0c",
  },

  // Subtle gradients for text readability
  gradTop: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height:   SH * 0.18,
  },
  gradBottom: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height:   SH * 0.28,
  },

  // Capture flash
  flash: {
    backgroundColor: "#fff",
  },

  // ── Detection frame ─────────────────────────────────────────────────────────
  // Centers the frame box in the screen
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
  },

  // Thin outline
  frameOutline: {
    position:     "absolute",
    width:        FRAME_W,
    height:       FRAME_H,
    borderRadius: FRAME_BR,
    borderWidth:  1,
    borderColor:  "rgba(255,255,255,0.85)",
  },

  // Container for corner brackets, same size as frame
  bracketContainer: {
    position: "absolute",
    width:    FRAME_W,
    height:   FRAME_H,
  },

  bracket: {
    position:    "absolute",
    width:       CORNER_L,
    height:      CORNER_L,
    borderColor: BRACKET_CLR,
    borderWidth: 0, // each side set individually below
  },

  bTL: {
    top: 0, left: 0,
    borderTopWidth:      CORNER_W,
    borderLeftWidth:     CORNER_W,
    borderTopLeftRadius: CORNER_R,
  },
  bTR: {
    top: 0, right: 0,
    borderTopWidth:       CORNER_W,
    borderRightWidth:     CORNER_W,
    borderTopRightRadius: CORNER_R,
  },
  bBL: {
    bottom: 0, left: 0,
    borderBottomWidth:     CORNER_W,
    borderLeftWidth:       CORNER_W,
    borderBottomLeftRadius: CORNER_R,
  },
  bBR: {
    bottom: 0, right: 0,
    borderBottomWidth:      CORNER_W,
    borderRightWidth:       CORNER_W,
    borderBottomRightRadius: CORNER_R,
  },

  // ── Top bar ─────────────────────────────────────────────────────────────────
  topBar: {
    position:          "absolute",
    top:               0,
    left:              0,
    right:             0,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 8,
    paddingBottom:     12,
  },

  topIconBtn: {
    width:           42,
    height:          42,
    alignItems:      "center",
    justifyContent:  "center",
  },

  topCenter: {
    flex:           1,
    alignItems:     "center",
    gap:            4,
  },

  topTitle: {
    fontSize:      11,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.88)",
    letterSpacing: 2.0,
  },

  liveRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           5,
  },

  liveDot: {
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: "#4CD964",
  },

  liveText: {
    fontSize:      9,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.70)",
    letterSpacing: 1.4,
  },

  waitText: {
    fontSize:      9,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.30)",
    letterSpacing: 1.0,
  },

  // ── Bottom dock ─────────────────────────────────────────────────────────────
  dock: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 32,
  },

  sideBtn: {
    width:      72,
    alignItems: "center",
    gap:        8,
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

  shutterOuter: {
    width:          78,
    height:         78,
    borderRadius:   39,
    borderWidth:    3,
    borderColor:    "rgba(255,255,255,0.88)",
    alignItems:     "center",
    justifyContent: "center",
  },

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
