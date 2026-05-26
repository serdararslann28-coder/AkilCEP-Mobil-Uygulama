/**
 * MultimodalPanel — cinematic AI toolbox expanding upward from the input dock.
 * Glassmorphism card, spring animation, 8 AI tools, web search live state.
 * PURE / VOID fully supported. Always rendered — visibility via animated opacity.
 */
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useState } from "react";
import {
  Dimensions,
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
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SW } = Dimensions.get("window");
const PANEL_MX = 12;

// ─── Types ───────────────────────────────────────────────────────────────────
type ToolId =
  | "camera" | "photos" | "files" | "audio"
  | "web" | "imagegen" | "think" | "deep";

interface ToolDef {
  id:    ToolId;
  icon:  string;
  label: string;
  sub:   string;
}

// ─── Tool definitions ────────────────────────────────────────────────────────
const TOOLS: ToolDef[] = [
  { id: "camera",   icon: "camera",    label: "Kamera",          sub: "Canlı görüntü analiz et" },
  { id: "photos",   icon: "image",     label: "Fotoğraflar",     sub: "Galeriden içerik seç" },
  { id: "files",    icon: "paperclip", label: "Dosyalar",        sub: "PDF ve belgeleri analiz et" },
  { id: "audio",    icon: "mic",       label: "Ses Kaydı",       sub: "Ses dosyası yükle ve analiz et" },
  { id: "web",      icon: "globe",     label: "Web Araması",     sub: "İnternette ara ve güncel bilgi bul" },
  { id: "imagegen", icon: "zap",       label: "Görsel oluştur",  sub: "AI ile yeni görseller üret" },
  { id: "think",    icon: "cpu",       label: "Düşün",           sub: "Daha güçlü akıl yürütme" },
  { id: "deep",     icon: "layers",    label: "Derin araştırma", sub: "Gelişmiş AI araştırması yap" },
];

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  open:           boolean;
  onClose:        () => void;
  onImagePicked?: (uri: string) => void;
  bottomOffset:   number;  // pixels from screen bottom — sits just above input bar
  T:              any;     // theme token object
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function MultimodalPanel({
  open, onClose, onImagePicked, bottomOffset, T,
}: Props) {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  // ── Panel entrance / exit ─────────────────────────────────────────────────
  const slideY  = useSharedValue(20);
  const panelOp = useSharedValue(0);
  const bdOp    = useSharedValue(0);

  React.useEffect(() => {
    if (open) {
      bdOp.value    = withTiming(1, { duration: 200 });
      panelOp.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
      slideY.value  = withSpring(0, { damping: 22, stiffness: 260, mass: 0.85 });
    } else {
      bdOp.value    = withTiming(0, { duration: 180 });
      panelOp.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.ease) });
      slideY.value  = withTiming(16, { duration: 180 });
      setActiveTool(null);
    }
  }, [open]);

  const bdStyle    = useAnimatedStyle(() => ({ opacity: bdOp.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity:   panelOp.value,
    transform: [{ translateY: slideY.value }],
  }));

  // ── Web search live pulse ─────────────────────────────────────────────────
  const webPulse = useSharedValue(0);
  React.useEffect(() => {
    if (activeTool === "web") {
      webPulse.value = withRepeat(
        withSequence(
          withTiming(1,    { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    } else {
      webPulse.value = withTiming(0, { duration: 300 });
    }
  }, [activeTool]);
  const webPulseStyle = useAnimatedStyle(() => ({ opacity: webPulse.value }));

  // ── Camera card ambient breathe ───────────────────────────────────────────
  const camGlow = useSharedValue(0.6);
  React.useEffect(() => {
    camGlow.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);
  const camGlowStyle = useAnimatedStyle(() => ({ opacity: camGlow.value }));

  // ── Image pickers ─────────────────────────────────────────────────────────
  const handleCamera = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      onClose();
      return;
    }
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
  const glassBase  = T.isDark ? "rgba(12,12,16,0.96)"   : "rgba(252,251,249,0.97)";
  const glassBdr   = T.isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)";
  const rowDivider = T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.055)";
  const iconBg     = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const iconBgOn   = T.isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.09)";
  const rowBgOn    = T.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const chevronClr = T.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.13)";

  return (
    <>
      {/* Backdrop — dim, tap-to-dismiss */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.backdrop, bdStyle]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[
          ss.panel,
          { bottom: bottomOffset, backgroundColor: glassBase, borderColor: glassBdr },
          panelStyle,
        ]}
        pointerEvents={open ? "box-none" : "none"}
      >
        {/* Glass blur layer */}
        <BlurView
          intensity={T.isDark ? 72 : 48}
          tint={T.isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />

        {/* Content */}
        <View style={ss.inner}>

          {/* ── Camera preview card ── */}
          <View style={ss.camCard}>
            {/* Dark cinematic bg */}
            <View style={ss.camBg} />
            {/* Animated ambient glow orb */}
            <Animated.View style={[ss.camGlowOrb, camGlowStyle]} />
            {/* Center CTA */}
            <TouchableOpacity
              style={ss.camCTA}
              onPress={handleCamera}
              activeOpacity={0.72}
            >
              <View style={ss.camIconWrap}>
                <Feather name="camera" size={20} color="rgba(255,255,255,0.72)" />
              </View>
              <Text style={ss.camCTALabel}>Fotoğraf Çek</Text>
            </TouchableOpacity>
            {/* Live indicator */}
            <View style={ss.camLive}>
              <View style={ss.camLiveDot} />
              <Text style={ss.camLiveLabel}>Kamera aktif</Text>
            </View>
          </View>

          {/* ── Tool rows ── */}
          {TOOLS.map((tool, idx) => {
            const isActive = activeTool === tool.id;
            const isWeb    = tool.id === "web";

            return (
              <View key={tool.id}>
                {/* Row */}
                <TouchableOpacity
                  style={[ss.toolRow, isActive && { backgroundColor: rowBgOn }]}
                  activeOpacity={0.60}
                  onPress={() => handleTool(tool.id)}
                >
                  {/* Icon pill */}
                  <View style={[ss.toolIcon, { backgroundColor: isActive ? iconBgOn : iconBg }]}>
                    <Feather
                      name={tool.icon as any}
                      size={13}
                      color={isActive ? T.fg : T.muted}
                    />
                  </View>

                  {/* Labels */}
                  <View style={ss.toolText}>
                    <Text style={[ss.toolLabel, { color: T.fg }]}>{tool.label}</Text>
                    <Text style={[ss.toolSub, { color: T.muted }]} numberOfLines={1}>
                      {tool.sub}
                    </Text>
                  </View>

                  {/* Right — web live chip or chevron */}
                  {isWeb && isActive ? (
                    <View style={ss.liveChip}>
                      <Animated.View style={[ss.livePulseDot, webPulseStyle]} />
                      <Text style={ss.liveChipText}>AKTİF</Text>
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={11} color={chevronClr} />
                  )}
                </TouchableOpacity>

                {/* Web search expanded info strip */}
                {isWeb && isActive && (
                  <View style={[ss.webStrip, { borderTopColor: rowDivider }]}>
                    <Animated.View style={[ss.webStripOrb, webPulseStyle]} />
                    <Text style={[ss.webStripText, { color: T.muted }]}>
                      Web araması aktif — yanıtlar gerçek zamanlı internet verisiyle zenginleştirilecek
                    </Text>
                  </View>
                )}

                {/* Divider — indented to align with text */}
                {idx < TOOLS.length - 1 && (
                  <View style={[ss.rowDiv, { backgroundColor: rowDivider }]} />
                )}
              </View>
            );
          })}

        </View>
      </Animated.View>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({

  backdrop: {
    zIndex:          150,
    backgroundColor: "rgba(0,0,0,0.16)",
  },

  panel: {
    position:     "absolute",
    left:         PANEL_MX,
    right:        PANEL_MX,
    zIndex:       160,
    borderRadius: 24,
    overflow:     "hidden",
    borderWidth:  StyleSheet.hairlineWidth,
    shadowColor:  "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius:  36,
    elevation:    20,
  },

  inner: {
    paddingTop:    10,
    paddingBottom: 10,
  },

  // ── Camera preview card
  camCard: {
    height:           130,
    marginHorizontal: 12,
    marginBottom:     10,
    borderRadius:     16,
    overflow:         "hidden",
    alignItems:       "center",
    justifyContent:   "center",
  },
  camBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#07090F",
  },
  camGlowOrb: {
    position:        "absolute",
    width:           260,
    height:          260,
    borderRadius:    130,
    top:             -80,
    alignSelf:       "center",
    backgroundColor: "rgba(160,200,255,0.055)",
  },
  camCTA: {
    alignItems: "center",
    gap:        10,
  },
  camIconWrap: {
    width:           50,
    height:          50,
    borderRadius:    25,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.11)",
  },
  camCTALabel: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.44)",
    letterSpacing: 0.2,
  },
  camLive: {
    position:      "absolute",
    top:           10,
    left:          12,
    flexDirection: "row",
    alignItems:    "center",
    gap:           5,
  },
  camLiveDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: "#2DC76D",
  },
  camLiveLabel: {
    fontSize:      10,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.44)",
    letterSpacing: 0.3,
  },

  // ── Tool rows
  toolRow: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingVertical:   11,
    paddingHorizontal: 14,
    gap:            12,
  },
  toolIcon: {
    width:          34,
    height:         34,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  toolText: {
    flex: 1,
    gap:  2,
  },
  toolLabel: {
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
  },
  toolSub: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.05,
  },

  // ── Divider
  rowDiv: {
    height:     StyleSheet.hairlineWidth,
    marginLeft: 60,
  },

  // ── Web search active chip
  liveChip: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             5,
    paddingHorizontal: 8,
    paddingVertical:   3,
    backgroundColor: "rgba(74,158,255,0.10)",
    borderRadius:    8,
  },
  livePulseDot: {
    width:           5,
    height:          5,
    borderRadius:    3,
    backgroundColor: "#4A9EFF",
  },
  liveChipText: {
    fontSize:      9,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 0.8,
    color:         "#4A9EFF",
  },

  // ── Web search expanded strip
  webStrip: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              10,
    paddingHorizontal: 14,
    paddingVertical:   10,
    borderTopWidth:   StyleSheet.hairlineWidth,
  },
  webStripOrb: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: "#4A9EFF",
  },
  webStripText: {
    flex:          1,
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.05,
    lineHeight:    16,
  },
});
