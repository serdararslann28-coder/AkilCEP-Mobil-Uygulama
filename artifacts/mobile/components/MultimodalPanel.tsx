/**
 * MultimodalPanel — compact cinematic AI action sheet expanding from input dock.
 * Glassmorphism card · spring animation · camera strip · waveform audio UI.
 * PURE / VOID fully supported. Always rendered — visibility via animated values.
 */
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
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

// ─── Constants ────────────────────────────────────────────────────────────────
const PANEL_MX = 10;

// Waveform bar count and stagger for audio active state
const AUDIO_BARS   = 5;
const BAR_DELAYS   = [0, 80, 160, 80, 0] as const;
const BAR_DURATIONS= [420, 380, 340, 380, 420] as const;
const BAR_MAX_H    = [10, 16, 22, 16, 10] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type ToolId =
  | "camera" | "photos" | "files" | "audio"
  | "web" | "imagegen" | "think" | "deep";

interface ToolDef {
  id:    ToolId;
  icon:  string;
  label: string;
  sub:   string;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS: ToolDef[] = [
  { id: "camera",   icon: "camera",    label: "Kamera",          sub: "Canlı görüntü analiz et" },
  { id: "photos",   icon: "image",     label: "Fotoğraflar",     sub: "Galeriden içerik seç" },
  { id: "files",    icon: "paperclip", label: "Dosyalar",        sub: "PDF ve belgeleri analiz et" },
  { id: "audio",    icon: "mic",       label: "Ses Kaydı",       sub: "Ses dosyası yükle ve analiz et" },
  { id: "web",      icon: "globe",     label: "Web Araması",     sub: "Gerçek zamanlı internet verisi" },
  { id: "imagegen", icon: "zap",       label: "Görsel oluştur",  sub: "AI ile yeni görseller üret" },
  { id: "think",    icon: "cpu",       label: "Düşün",           sub: "Daha güçlü akıl yürütme" },
  { id: "deep",     icon: "layers",    label: "Derin araştırma", sub: "Gelişmiş AI araştırması" },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  open:           boolean;
  onClose:        () => void;
  onImagePicked?: (uri: string) => void;
  bottomOffset:   number;
  T:              any;
}

// ─── Waveform sub-component ───────────────────────────────────────────────────
function AudioWaveform({ active, color }: { active: boolean; color: string }) {
  const bars = [
    useSharedValue(2), useSharedValue(2), useSharedValue(2),
    useSharedValue(2), useSharedValue(2),
  ];

  useEffect(() => {
    bars.forEach((sv, i) => {
      if (active) {
        sv.value = withDelay(
          BAR_DELAYS[i],
          withRepeat(
            withSequence(
              withTiming(BAR_MAX_H[i], { duration: BAR_DURATIONS[i], easing: Easing.inOut(Easing.ease) }),
              withTiming(2,            { duration: BAR_DURATIONS[i], easing: Easing.inOut(Easing.ease) }),
            ),
            -1, false,
          ),
        );
      } else {
        sv.value = withTiming(2, { duration: 240 });
      }
    });
  }, [active]);

  const styles = bars.map(sv =>
    useAnimatedStyle(() => ({ height: sv.value })),
  );

  return (
    <View style={wf.row}>
      {bars.map((_, i) => (
        <Animated.View
          key={i}
          style={[wf.bar, { backgroundColor: color }, styles[i]]}
        />
      ))}
    </View>
  );
}

const wf = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 3, height: 24 },
  bar: { width: 2.5, borderRadius: 2, minHeight: 2 },
});

// ─── Main component ───────────────────────────────────────────────────────────
export default function MultimodalPanel({
  open, onClose, onImagePicked, bottomOffset, T,
}: Props) {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  // ── Panel entrance / exit ─────────────────────────────────────────────────
  const slideY  = useSharedValue(18);
  const panelOp = useSharedValue(0);
  const bdOp    = useSharedValue(0);

  useEffect(() => {
    if (open) {
      bdOp.value    = withTiming(1, { duration: 180 });
      panelOp.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) });
      slideY.value  = withSpring(0, { damping: 24, stiffness: 280, mass: 0.80 });
    } else {
      bdOp.value    = withTiming(0, { duration: 160 });
      panelOp.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.ease) });
      slideY.value  = withTiming(14, { duration: 160 });
      setActiveTool(null);
    }
  }, [open]);

  const bdStyle    = useAnimatedStyle(() => ({ opacity: bdOp.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity:   panelOp.value,
    transform: [{ translateY: slideY.value }],
  }));

  // ── Web search pulse ──────────────────────────────────────────────────────
  const webPulse = useSharedValue(0);
  useEffect(() => {
    if (activeTool === "web") {
      webPulse.value = withRepeat(
        withSequence(
          withTiming(1,    { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.20, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    } else {
      webPulse.value = withTiming(0, { duration: 280 });
    }
  }, [activeTool]);
  const webDotStyle = useAnimatedStyle(() => ({ opacity: 0.35 + webPulse.value * 0.65 }));

  // ── Camera glow breathe ───────────────────────────────────────────────────
  const camGlow = useSharedValue(0.5);
  useEffect(() => {
    camGlow.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);
  const camGlowStyle = useAnimatedStyle(() => ({ opacity: camGlow.value }));

  // ── Image pickers ─────────────────────────────────────────────────────────
  const handleCamera = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") { onClose(); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.88,
    });
    if (!result.canceled && result.assets[0]) {
      onImagePicked?.(result.assets[0].uri);
      onClose();
    }
  }, [onImagePicked, onClose]);

  const handlePhotos = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.88,
    });
    if (!result.canceled && result.assets[0]) {
      onImagePicked?.(result.assets[0].uri);
      onClose();
    }
  }, [onImagePicked, onClose]);

  const handleTool = useCallback((id: ToolId) => {
    Haptics.selectionAsync();
    if (id === "camera") { handleCamera(); return; }
    if (id === "photos") { handlePhotos(); return; }
    setActiveTool(prev => (prev === id ? null : id));
  }, [handleCamera, handlePhotos]);

  // ── Theme-derived values ──────────────────────────────────────────────────
  const glassBase  = T.isDark ? "rgba(11,11,14,0.97)"   : "rgba(253,252,250,0.97)";
  const glassBdr   = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.065)";
  const rowDiv     = T.isDark ? "rgba(255,255,255,0.055)": "rgba(0,0,0,0.05)";
  const iconBg     = T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.048)";
  const iconBgOn   = T.isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.085)";
  const chevron    = T.isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)";
  const audioBar   = T.isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.38)";

  return (
    <>
      {/* Tap-outside backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.backdrop, bdStyle]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Floating glass panel */}
      <Animated.View
        style={[
          ss.panel,
          { bottom: bottomOffset, backgroundColor: glassBase, borderColor: glassBdr },
          panelStyle,
        ]}
        pointerEvents={open ? "box-none" : "none"}
      >
        {/* Blur foundation */}
        <BlurView
          intensity={T.isDark ? 80 : 52}
          tint={T.isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />

        <View style={ss.inner}>

          {/* ── Camera strip ── */}
          <TouchableOpacity
            style={ss.camStrip}
            onPress={handleCamera}
            activeOpacity={0.80}
          >
            {/* Dark cinematic bg */}
            <View style={ss.camBg} />
            {/* Breathing ambient orb */}
            <Animated.View style={[ss.camOrb, camGlowStyle]} />

            {/* Left: icon + label */}
            <View style={ss.camLeft}>
              <View style={ss.camIconRing}>
                <Feather name="camera" size={16} color="rgba(255,255,255,0.80)" />
              </View>
              <View>
                <Text style={ss.camTitle}>Fotoğraf Çek</Text>
                <Text style={ss.camSub}>Kamera ile görüntü al</Text>
              </View>
            </View>

            {/* Right: live indicator */}
            <View style={ss.camLiveRow}>
              <View style={ss.camDot} />
              <Text style={ss.camLiveText}>Kamera aktif</Text>
            </View>
          </TouchableOpacity>

          {/* Divider between camera strip and tools */}
          <View style={[ss.stripDiv, { backgroundColor: rowDiv }]} />

          {/* ── Tool rows ── */}
          {TOOLS.map((tool, idx) => {
            const isActive = activeTool === tool.id;
            const isWeb    = tool.id === "web";
            const isAudio  = tool.id === "audio";

            return (
              <View key={tool.id}>

                {/* Main row */}
                <TouchableOpacity
                  style={[
                    ss.row,
                    isActive && { backgroundColor: T.isDark ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.025)" },
                  ]}
                  activeOpacity={0.58}
                  onPress={() => handleTool(tool.id)}
                >
                  {/* Icon */}
                  <View style={[ss.icon, { backgroundColor: isActive ? iconBgOn : iconBg }]}>
                    <Feather
                      name={tool.icon as any}
                      size={13}
                      color={isActive ? T.fg : T.fgSoft}
                    />
                  </View>

                  {/* Text */}
                  <View style={ss.rowText}>
                    <Text style={[ss.rowLabel, { color: T.fg }]}>{tool.label}</Text>
                    <Text style={[ss.rowSub, { color: T.zinc }]} numberOfLines={1}>{tool.sub}</Text>
                  </View>

                  {/* Right accessory */}
                  {isWeb && isActive ? (
                    // Web: animated pulse dot inline
                    <View style={ss.webBadge}>
                      <Animated.View style={[ss.webDot, webDotStyle]} />
                      <Text style={ss.webBadgeText}>CANLI</Text>
                    </View>
                  ) : isAudio && isActive ? (
                    // Audio: mini waveform preview in row
                    <AudioWaveform active={true} color={audioBar} />
                  ) : (
                    <Feather name="chevron-right" size={11} color={chevron} />
                  )}
                </TouchableOpacity>

                {/* Audio expanded panel */}
                {isAudio && isActive && (
                  <View style={[ss.audioPanel, { borderTopColor: rowDiv }]}>
                    {/* Large waveform visualization */}
                    <View style={ss.audioBars}>
                      {Array.from({ length: 18 }).map((_, i) => {
                        const h = 4 + Math.sin(i * 0.72) * 10 + Math.cos(i * 1.3) * 6;
                        return (
                          <View
                            key={i}
                            style={[
                              ss.audioBarLg,
                              {
                                height:          Math.max(4, Math.abs(h)),
                                backgroundColor: T.isDark
                                  ? "rgba(255,255,255,0.18)"
                                  : "rgba(0,0,0,0.14)",
                              },
                            ]}
                          />
                        );
                      })}
                    </View>
                    {/* Action row */}
                    <View style={ss.audioActions}>
                      <Text style={[ss.audioHint, { color: T.zinc }]}>
                        Dosya seç veya ses kaydet
                      </Text>
                      <TouchableOpacity
                        style={[ss.audioBtn, { backgroundColor: T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.055)" }]}
                        onPress={() => { Haptics.selectionAsync(); }}
                        activeOpacity={0.70}
                      >
                        <Feather name="upload" size={11} color={T.fgSoft} />
                        <Text style={[ss.audioBtnText, { color: T.fg }]}>Dosya Seç</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Row divider */}
                {idx < TOOLS.length - 1 && (
                  <View style={[ss.div, { backgroundColor: rowDiv }]} />
                )}
              </View>
            );
          })}

        </View>
      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({

  backdrop: {
    zIndex:          150,
    backgroundColor: "rgba(0,0,0,0.12)",
  },

  panel: {
    position:     "absolute",
    left:         PANEL_MX,
    right:        PANEL_MX,
    zIndex:       160,
    borderRadius: 22,
    overflow:     "hidden",
    borderWidth:  StyleSheet.hairlineWidth,
    shadowColor:  "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius:  28,
    elevation:    16,
  },

  inner: {
    paddingTop:    8,
    paddingBottom: 8,
  },

  // ── Camera strip
  camStrip: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginHorizontal: 10,
    marginBottom:   8,
    height:         72,
    borderRadius:   14,
    overflow:       "hidden",
    paddingHorizontal: 14,
  },
  camBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#07090E",
  },
  camOrb: {
    position:        "absolute",
    width:           200,
    height:          200,
    borderRadius:    100,
    top:             -80,
    left:            -20,
    backgroundColor: "rgba(140,180,255,0.06)",
  },
  camLeft: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           11,
  },
  camIconRing: {
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.10)",
  },
  camTitle: {
    fontSize:      13,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.82)",
    letterSpacing: -0.1,
  },
  camSub: {
    fontSize:      10,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.36)",
    letterSpacing: 0.1,
    marginTop:     1,
  },
  camLiveRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           5,
  },
  camDot: {
    width:           5,
    height:          5,
    borderRadius:    3,
    backgroundColor: "#2DC76D",
  },
  camLiveText: {
    fontSize:      9,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.38)",
    letterSpacing: 0.3,
  },

  // ── Divider between camera and tools
  stripDiv: {
    height:      StyleSheet.hairlineWidth,
    marginBottom: 4,
  },

  // ── Tool rows
  row: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingVertical:   10,
    paddingHorizontal: 12,
    gap:            11,
  },
  icon: {
    width:          32,
    height:         32,
    borderRadius:   9,
    alignItems:     "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap:  1,
  },
  rowLabel: {
    fontSize:      13,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
  },
  rowSub: {
    fontSize:      10,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.05,
  },

  // ── Divider between rows
  div: {
    height:     StyleSheet.hairlineWidth,
    marginLeft: 55,
  },

  // ── Web search badge
  webBadge: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             4,
    paddingHorizontal: 7,
    paddingVertical:   2.5,
    backgroundColor: "rgba(74,158,255,0.09)",
    borderRadius:    7,
  },
  webDot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: "#4A9EFF",
  },
  webBadgeText: {
    fontSize:      8,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 0.9,
    color:         "#4A9EFF",
  },

  // ── Audio expanded panel
  audioPanel: {
    borderTopWidth:   StyleSheet.hairlineWidth,
    paddingTop:       12,
    paddingHorizontal: 12,
    paddingBottom:    10,
    gap:              10,
  },
  audioBars: {
    flexDirection: "row",
    alignItems:    "flex-end",
    gap:           3,
    height:        28,
    paddingHorizontal: 4,
  },
  audioBarLg: {
    flex:         1,
    borderRadius: 2,
    minHeight:    3,
  },
  audioActions: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  audioHint: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.05,
  },
  audioBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            5,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:   10,
  },
  audioBtnText: {
    fontSize:      11,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
  },
});
