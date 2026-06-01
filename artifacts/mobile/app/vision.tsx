/**
 * VisionScreen — AkılCEP Vision Mode.
 *
 * Full-screen camera. Always dark. Never follows global theme.
 *
 * "Analiz Et" — silently captures + sends to Gemini → chat.
 * "Sor"       — records voice → Whisper STT → captures + sends image
 *               + spoken question to Gemini → chat.
 *
 * Sor flow:
 *   tap (idle)     → mic starts  → state: "listening"
 *   tap (listening) → mic stops  → Whisper → state: "analyzing"
 *                                → capture photo → Gemini Vision
 *                                → router.replace("/chat")
 */
import { Audio }        from "expo-av";
import { BlurView }     from "expo-blur";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem  from "expo-file-system";
import * as Haptics     from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Feather }      from "@expo/vector-icons";
import { router }       from "expo-router";
import { StatusBar }    from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChat }      from "@/context/ChatContext";
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

// API base — same pattern as ChatContext
function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}/api` : "/api";
}

// Fallback: blob → base64 string (strips data-url prefix)
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r.split(",")[1] ?? "");
      else reject(new Error("FileReader result was not a string"));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type AskState = "idle" | "listening" | "analyzing";

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function VisionScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 20 : insets.bottom;

  const { startVisionAnalysis } = useChat();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef       = useRef<CameraView>(null);
  const askRecordingRef = useRef<Audio.Recording | null>(null);

  // Camera facing — persists for session lifetime
  const [facing,   setFacing]   = useState<"back" | "front">("back");
  const [askState, setAskState] = useState<AskState>("idle");

  const permLoading = permission === null;
  const permGranted = permission?.granted === true;
  const permAskable = !permGranted && (permission?.canAskAgain ?? true);

  // Auto-request camera permission on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission?.status]);

  // Cleanup: stop any in-flight recording if user leaves the screen
  useEffect(() => {
    return () => {
      const rec = askRecordingRef.current;
      if (rec) {
        askRecordingRef.current = null;
        rec.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

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

  // ── Detection frame (shown on shutter/analyze/ask press) ────────────────────
  const frameOp      = useSharedValue(0);
  const frameBracket = useSharedValue(0);

  const triggerDetection = useCallback(() => {
    frameOp.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(1, { duration: 900 }),
      withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) }),
    );
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
    // Stop any active recording before leaving
    const rec = askRecordingRef.current;
    if (rec) {
      askRecordingRef.current = null;
      rec.stopAndUnloadAsync().catch(() => {});
    }
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
      router.replace("/chat");

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata.";
      Alert.alert("Fotoğraf Hatası", `Fotoğraf çekilemedi.\n\n${msg}`);
    }
  }, [permGranted, startVisionAnalysis, triggerFlash, triggerDetection]);

  // ── "Sor" — voice question pipeline ─────────────────────────────────────────
  const handleAsk = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Sesli Soru", "Bu özellik yalnızca mobil cihazlarda çalışır.");
      return;
    }

    // Debounce: ignore taps while processing
    if (askState === "analyzing") return;

    // ── Phase 2: tap again to stop and process ─────────────────────────────────
    if (askState === "listening") {
      const rec = askRecordingRef.current;
      askRecordingRef.current = null;
      setAskState("analyzing");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        // 1. Stop mic
        await rec?.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const audioUri = rec?.getURI();

        // 2. Transcribe via Whisper
        let question = "";
        if (audioUri) {
          let audioBase64: string;
          try {
            audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch {
            const resp = await fetch(audioUri);
            const blob = await resp.blob();
            audioBase64 = await blobToBase64(blob);
          }

          try {
            const tRes = await fetch(`${getApiBase()}/openai/transcribe`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ audio: audioBase64 }),
            });
            if (tRes.ok) {
              const d = await tRes.json() as { text?: string };
              question = d.text?.trim() ?? "";
            }
          } catch (err) {
            // Transcription failed — proceed with image-only analysis
            console.warn("[vision ask] transcription failed:", err);
          }
        }

        // 3. Capture photo
        if (!cameraRef.current) { setAskState("idle"); return; }

        triggerFlash();
        triggerDetection();

        const photo = await cameraRef.current.takePictureAsync({
          base64:         true,
          quality:        0.70,
          skipProcessing: Platform.OS === "android",
        });

        if (!photo?.base64) {
          Alert.alert("Fotoğraf Hatası", "Fotoğraf çekilemedi. Tekrar deneyin.");
          setAskState("idle");
          return;
        }

        // 4. Send image + spoken question to Gemini, navigate to chat
        // Format question so Gemini responds concisely in Turkish
        const formattedQuestion = question
          ? `Bu fotoğrafı incele ve şu soruyu Türkçe, kısaca (2-3 cümle) yanıtla: ${question}`
          : undefined;

        startVisionAnalysis(photo.base64, photo.uri, formattedQuestion);
        router.replace("/chat");

      } catch (err: unknown) {
        console.warn("[vision ask] processing error:", err);
        setAskState("idle");
        Alert.alert("Sesli Soru Hatası", "İşlem tamamlanamadı. Tekrar deneyin.");
      }
      return;
    }

    // ── Phase 1: start mic recording ───────────────────────────────────────────
    if (!permGranted) {
      Alert.alert("Kamera İzni", "Sesli soru için kamera iznine de ihtiyaç var.");
      return;
    }

    const { granted: micGranted } = await Audio.requestPermissionsAsync();
    if (!micGranted) {
      Alert.alert("Mikrofon İzni", "Sesli soru için mikrofon iznine ihtiyaç var.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      askRecordingRef.current = recording;
      setAskState("listening");
    } catch {
      Alert.alert("Mikrofon Hatası", "Ses kaydı başlatılamadı. Tekrar deneyin.");
    }
  }, [askState, permGranted, triggerFlash, triggerDetection, startVisionAnalysis]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>
      <StatusBar hidden />

      {/* Full-screen camera with flip animation wrapper */}
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

      {/* Subtle readability gradients */}
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

      {/* Detection frame — appears on shutter/analyze/ask */}
      <View style={ss.frameWrap} pointerEvents="none">
        <Animated.View style={[ss.frameOutline, frameStyle]} />
        <Animated.View style={[ss.bracketContainer, bracketStyle]}>
          <View style={[ss.bracket, ss.bTL]} />
          <View style={[ss.bracket, ss.bTR]} />
          <View style={[ss.bracket, ss.bBL]} />
          <View style={[ss.bracket, ss.bBR]} />
        </Animated.View>
      </View>

      {/* Capture flash */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.flash, flashStyle]}
        pointerEvents="none"
      />

      {/* Ask overlay — shown while listening or analyzing */}
      {askState !== "idle" && (
        <AskOverlay
          state={askState}
          btmPad={btmPad}
          onStop={() => void handleAsk()}
        />
      )}

      {/* Top bar */}
      <Animated.View style={[ss.topBar, { paddingTop: topPad + 6 }, topStyle]}>
        <TouchableOpacity
          style={ss.topIconBtn}
          onPress={handleBack}
          hitSlop={16}
          activeOpacity={0.60}
        >
          <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.90)" />
        </TouchableOpacity>

        <View style={ss.topCenter} pointerEvents="none">
          <Text style={ss.topTitle}>AkılCEP Vizyon</Text>
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

      {/* Permission card */}
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

      {/* Bottom dock — Analiz Et | Shutter | Sor */}
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
          disabled={askState !== "idle"}
        >
          <View style={[ss.sideBtnIcon, askState !== "idle" && ss.sideBtnDimmed]}>
            <Feather name="zap" size={19} color="rgba(255,255,255,0.85)" />
          </View>
          <Text style={ss.sideBtnLabel}>Analiz Et</Text>
        </TouchableOpacity>

        {/* Shutter — Apple-style */}
        <TouchableOpacity
          style={ss.shutterWrap}
          onPress={handleCapture}
          activeOpacity={0.82}
          disabled={askState !== "idle"}
        >
          <View style={[ss.shutterOuter, askState !== "idle" && ss.shutterDimmed]}>
            <View style={[
              ss.shutterInner,
              !permGranted && { opacity: 0.28 },
              askState !== "idle" && { opacity: 0.28 },
            ]} />
          </View>
        </TouchableOpacity>

        {/* Sor — mic icon, state-aware */}
        <TouchableOpacity
          style={ss.sideBtn}
          onPress={() => void handleAsk()}
          hitSlop={10}
          activeOpacity={0.65}
        >
          <AskButton state={askState} />
          <Text style={[
            ss.sideBtnLabel,
            askState === "listening" && { color: "rgba(255,100,100,0.90)" },
          ]}>
            {askState === "listening" ? "Durdur" : askState === "analyzing" ? "Analiz" : "Sor"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── AskButton ─────────────────────────────────────────────────────────────────
// "Sor" dock icon — pulsing red ring when listening, spinner when analyzing.
function AskButton({ state }: { state: AskState }) {
  const pulse = useSharedValue(1);
  const op    = useSharedValue(0.85);

  useEffect(() => {
    if (state === "listening") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.30, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0,  { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
      op.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 700 }),
          withTiming(0.85, { duration: 700 }),
        ),
        -1, false,
      );
    } else {
      pulse.value = withTiming(1,    { duration: 200 });
      op.value    = withTiming(0.85, { duration: 200 });
    }
  }, [state]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity:   op.value,
  }));

  const isListening = state === "listening";
  const isAnalyzing = state === "analyzing";

  return (
    <View style={ss.askBtnWrap}>
      {/* Pulsing outer ring while listening */}
      {isListening && (
        <Animated.View style={[ss.askRing, ringStyle]} />
      )}
      <View style={[
        ss.sideBtnIcon,
        isListening && ss.sideBtnRed,
        isAnalyzing && ss.sideBtnDimmed,
      ]}>
        {isAnalyzing ? (
          <AnalyzingDots />
        ) : (
          <Feather
            name="mic"
            size={19}
            color={isListening ? "rgba(255,120,120,0.95)" : "rgba(255,255,255,0.85)"}
          />
        )}
      </View>
    </View>
  );
}

// ─── AnalyzingDots ─────────────────────────────────────────────────────────────
// Three-dot pulsing indicator used inside the ask button while analyzing.
function AnalyzingDots() {
  const dots = [useSharedValue(0.25), useSharedValue(0.25), useSharedValue(0.25)];
  const delays = [0, 160, 320];

  useEffect(() => {
    dots.forEach((sv, i) => {
      sv.value = withDelay(delays[i]!, withRepeat(
        withSequence(
          withTiming(1,    { duration: 480, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.25, { duration: 480, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      ));
    });
  }, []);

  return (
    <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
      {dots.map((sv, i) => (
        <Animated.View
          key={i}
          style={[ss.analyzesDot, useAnimatedStyle(() => ({ opacity: sv.value }))]}
        />
      ))}
    </View>
  );
}

// ─── AskOverlay ────────────────────────────────────────────────────────────────
// Frosted glass pill floating above the dock — shows mic state + stop hint.
function AskOverlay({
  state,
  btmPad,
  onStop,
}: {
  state:   AskState;
  btmPad:  number;
  onStop:  () => void;
}) {
  const opAnim = useSharedValue(0);

  useEffect(() => {
    opAnim.value = withTiming(1, { duration: 260 });
    return () => { opAnim.value = withTiming(0, { duration: 180 }); };
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opAnim.value }));

  // Position just above the dock row
  const bottom = btmPad + 20 + 78 + 12 + 28; // dock padding + shutter height + gap + label

  return (
    <Animated.View style={[ss.overlayWrap, { bottom }, containerStyle]} pointerEvents="box-none">
      <BlurView intensity={22} tint="dark" style={ss.overlayPill}>
        {state === "listening" ? (
          <>
            <MicRipple />
            <Text style={ss.overlayText}>Dinleniyor…</Text>
            <TouchableOpacity
              style={ss.overlayStop}
              onPress={onStop}
              activeOpacity={0.70}
            >
              <Text style={ss.overlayStopText}>Gönder</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={ss.overlaySpinWrap}>
              <AnalyzingDots />
            </View>
            <Text style={ss.overlayText}>Analiz ediliyor…</Text>
          </>
        )}
      </BlurView>
    </Animated.View>
  );
}

// ─── MicRipple ────────────────────────────────────────────────────────────────
// Small pulsing red dot indicating active mic in the overlay.
function MicRipple() {
  const scale = useSharedValue(1);
  const op    = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 750, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 0   }),
      ),
      -1, false,
    );
    op.value = withRepeat(
      withSequence(
        withTiming(0,   { duration: 750, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 0   }),
      ),
      -1, false,
    );
  }, []);

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   op.value,
  }));

  return (
    <View style={ss.micRippleWrap}>
      <Animated.View style={[ss.micRipple, rippleStyle]} />
      <View style={ss.micDot} />
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

  camera: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: COVER_SCALE }],
  },

  camFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0a0c",
  },

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

  flash: {
    backgroundColor: "#fff",
  },

  // ── Detection frame ─────────────────────────────────────────────────────────
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
  },
  frameOutline: {
    position:     "absolute",
    width:        FRAME_W,
    height:       FRAME_H,
    borderRadius: FRAME_BR,
    borderWidth:  1,
    borderColor:  "rgba(255,255,255,0.85)",
  },
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
    borderWidth: 0,
  },
  bTL: { top: 0, left: 0,   borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W,   borderTopLeftRadius:     CORNER_R },
  bTR: { top: 0, right: 0,  borderTopWidth: CORNER_W, borderRightWidth: CORNER_W,  borderTopRightRadius:    CORNER_R },
  bBL: { bottom: 0, left: 0,  borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W,  borderBottomLeftRadius:  CORNER_R },
  bBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderBottomRightRadius: CORNER_R },

  // ── Top bar ─────────────────────────────────────────────────────────────────
  topBar: {
    position:          "absolute",
    top: 0, left: 0, right: 0,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 8,
    paddingBottom:     12,
  },
  topIconBtn: {
    width:          42,
    height:         42,
    alignItems:     "center",
    justifyContent: "center",
  },
  topCenter: {
    flex:       1,
    alignItems: "center",
    gap:        4,
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
    bottom: 0, left: 0, right: 0,
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
  sideBtnDimmed: {
    opacity: 0.30,
  },
  sideBtnRed: {
    backgroundColor: "rgba(255,70,70,0.18)",
    borderColor:     "rgba(255,100,100,0.30)",
  },
  sideBtnLabel: {
    fontSize:      11,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.72)",
    letterSpacing: 0.2,
  },

  // Ask button wrapper (holds pulsing ring)
  askBtnWrap: {
    alignItems:     "center",
    justifyContent: "center",
  },
  askRing: {
    position:     "absolute",
    width:        44,
    height:       44,
    borderRadius: 22,
    borderWidth:  1.5,
    borderColor:  "rgba(255,100,100,0.60)",
  },

  // Analyzing dots inside ask button
  analyzesDot: {
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: "rgba(255,255,255,0.88)",
  },

  // Shutter
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
  shutterDimmed: {
    borderColor: "rgba(255,255,255,0.28)",
  },
  shutterInner: {
    width:           62,
    height:          62,
    borderRadius:    31,
    backgroundColor: "rgba(255,255,255,0.92)",
  },

  // ── Ask overlay ─────────────────────────────────────────────────────────────
  overlayWrap: {
    position:       "absolute",
    left:           0,
    right:          0,
    alignItems:     "center",
  },
  overlayPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: 20,
    paddingVertical:   13,
    borderRadius:      28,
    overflow:          "hidden",
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.12)",
  },
  overlayText: {
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.88)",
    letterSpacing: -0.1,
  },
  overlayStop: {
    paddingHorizontal: 12,
    paddingVertical:   5,
    backgroundColor:   "rgba(255,255,255,0.14)",
    borderRadius:      12,
  },
  overlayStopText: {
    fontSize:      12,
    fontFamily:    "Inter_600SemiBold",
    color:         "rgba(255,255,255,0.80)",
    letterSpacing: 0.2,
  },
  overlaySpinWrap: {
    width:          18,
    alignItems:     "center",
    justifyContent: "center",
  },

  // Mic ripple in overlay
  micRippleWrap: {
    width:          18,
    height:         18,
    alignItems:     "center",
    justifyContent: "center",
  },
  micRipple: {
    position:        "absolute",
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: "rgba(255,80,80,0.45)",
  },
  micDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: "#FF5252",
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
