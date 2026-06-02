/**
 * MultimodalPanel — compact chat-style tool bubble that floats above the input bar.
 * Clean rows: icon + label + chevron. Collapsible "Daha Fazla" section.
 * PURE / VOID theme aware. No camera strip, no subtitles, no bottom sheet.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  Dimensions,
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
  withSpring,
  withTiming,
} from "react-native-reanimated";

// ─── Layout ───────────────────────────────────────────────────────────────────
const SCREEN_W  = Dimensions.get("window").width;
const BUBBLE_MX = SCREEN_W * 0.06; // 6% margin each side → 88% width

// ─── Tool definitions ─────────────────────────────────────────────────────────
const PRIMARY: { id: string; icon: React.ComponentProps<typeof Feather>["name"]; label: string }[] = [
  { id: "camera",  icon: "camera",    label: "Kamera"      },
  { id: "photos",  icon: "image",     label: "Fotoğraflar" },
  { id: "files",   icon: "paperclip", label: "Dosyalar"    },
  { id: "web",     icon: "globe",     label: "Web Araması" },
];

const MORE_TOOLS: { id: string; icon: React.ComponentProps<typeof Feather>["name"]; label: string }[] = [
  { id: "think",    icon: "cpu",      label: "Düşün"          },
  { id: "imagegen", icon: "zap",      label: "Görsel Oluştur" },
  { id: "audio",    icon: "mic",      label: "Ses Kaydı"      },
  { id: "deep",     icon: "layers",   label: "Derin Araştırma"},
];

// Each row is ~46 px tall; more-section max-height derived from this
const ROW_H  = 46;
const MORE_H = MORE_TOOLS.length * ROW_H + 8;

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  open:           boolean;
  onClose:        () => void;
  onImagePicked?: (uri: string) => void;
  bottomOffset:   number;
  T:              any;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MultimodalPanel({ open, onClose, onImagePicked, bottomOffset, T }: Props) {

  // ── Panel entrance / exit ─────────────────────────────────────────────────
  const panelOp    = useSharedValue(0);
  const panelScale = useSharedValue(0.93);
  const panelY     = useSharedValue(12);
  const bdOp       = useSharedValue(0);
  const moreAnim   = useSharedValue(0); // 0 = collapsed, 1 = expanded

  useEffect(() => {
    if (open) {
      bdOp.value       = withTiming(1,  { duration: 160 });
      panelOp.value    = withTiming(1,  { duration: 200, easing: Easing.out(Easing.ease) });
      panelScale.value = withSpring(1,  { damping: 22, stiffness: 340, mass: 0.72 });
      panelY.value     = withSpring(0,  { damping: 22, stiffness: 340, mass: 0.72 });
    } else {
      bdOp.value       = withTiming(0, { duration: 140 });
      panelOp.value    = withTiming(0, { duration: 160 });
      panelScale.value = withTiming(0.95, { duration: 160 });
      panelY.value     = withTiming(10,   { duration: 160 });
      moreAnim.value   = withTiming(0,    { duration: 140 });
    }
  }, [open]);

  const bdStyle    = useAnimatedStyle(() => ({ opacity: bdOp.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity:   panelOp.value,
    transform: [{ scale: panelScale.value }, { translateY: panelY.value }],
  }));

  // More section: height + opacity
  const moreContentStyle = useAnimatedStyle(() => ({
    maxHeight: moreAnim.value * MORE_H,
    opacity:   moreAnim.value,
  }));

  // Chevron rotates 180° when expanded
  const chevStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${moreAnim.value * 180}deg` }],
  }));

  const toggleMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = moreAnim.value > 0.5 ? 0 : 1;
    moreAnim.value = withTiming(next, { duration: 260, easing: Easing.inOut(Easing.ease) });
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    setTimeout(() => router.push("/vision"), 160);
  }, [onClose]);

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

  const handlePress = useCallback((id: string) => {
    if (id === "camera") { handleCamera(); return; }
    if (id === "photos") { handlePhotos(); return; }
    Haptics.selectionAsync();
    onClose();
  }, [handleCamera, handlePhotos, onClose]);

  // ── Theme helpers ─────────────────────────────────────────────────────────
  const panelBg  = T.isDark ? "#111111"                   : "#FFFFFF";
  const panelBdr = T.isDark ? "rgba(255,255,255,0.08)"   : "rgba(0,0,0,0.07)";
  const divClr   = T.isDark ? "rgba(255,255,255,0.055)"  : "rgba(0,0,0,0.055)";
  const iconBg   = T.isDark ? "rgba(255,255,255,0.07)"   : "rgba(0,0,0,0.050)";
  const chevClr  = T.isDark ? "rgba(255,255,255,0.20)"   : "rgba(0,0,0,0.17)";

  // ── Row renderer ─────────────────────────────────────────────────────────
  const renderRow = (
    item: { id: string; icon: React.ComponentProps<typeof Feather>["name"]; label: string },
    isLast: boolean,
  ) => (
    <View key={item.id}>
      <TouchableOpacity
        style={ss.row}
        onPress={() => handlePress(item.id)}
        activeOpacity={0.55}
      >
        <View style={[ss.iconWrap, { backgroundColor: iconBg }]}>
          <Feather name={item.icon} size={14} color={T.fg} />
        </View>
        <Text style={[ss.label, { color: T.fg }]}>{item.label}</Text>
        <Feather name="chevron-right" size={12} color={chevClr} />
      </TouchableOpacity>
      {!isLast && <View style={[ss.div, { backgroundColor: divClr }]} />}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Tap-outside backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.backdrop, bdStyle]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Floating bubble */}
      <Animated.View
        style={[
          ss.panel,
          { bottom: bottomOffset, left: BUBBLE_MX, right: BUBBLE_MX, backgroundColor: panelBg, borderColor: panelBdr },
          panelStyle,
        ]}
        pointerEvents={open ? "box-none" : "none"}
      >

        {/* Primary tools */}
        <View style={ss.section}>
          {PRIMARY.map((item, i) => renderRow(item, i === PRIMARY.length - 1))}
        </View>

        {/* Separator */}
        <View style={[ss.sectionDiv, { backgroundColor: divClr }]} />

        {/* "Daha Fazla" toggle */}
        <TouchableOpacity style={ss.moreToggle} onPress={toggleMore} activeOpacity={0.60}>
          <Text style={[ss.moreLabel, { color: T.muted }]}>Daha Fazla</Text>
          <Animated.View style={chevStyle}>
            <Feather name="chevron-down" size={13} color={T.muted} />
          </Animated.View>
        </TouchableOpacity>

        {/* More section — clipped animated reveal */}
        <View style={{ overflow: "hidden" }}>
          <Animated.View style={moreContentStyle}>
            <View style={[ss.sectionDiv, { backgroundColor: divClr }]} />
            <View style={ss.section}>
              {MORE_TOOLS.map((item, i) => renderRow(item, i === MORE_TOOLS.length - 1))}
            </View>
          </Animated.View>
        </View>

      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({

  backdrop: {
    zIndex:          150,
    backgroundColor: "rgba(0,0,0,0.07)",
  },

  panel: {
    position:      "absolute",
    zIndex:        160,
    borderRadius:  24,
    borderWidth:   StyleSheet.hairlineWidth,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius:  30,
    elevation:     18,
    paddingVertical: 4,
  },

  section: {
    paddingVertical: 2,
  },

  sectionDiv: {
    height: StyleSheet.hairlineWidth,
  },

  row: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingVertical:   12,
    gap:               12,
  },

  iconWrap: {
    width:          30,
    height:         30,
    borderRadius:   9,
    alignItems:     "center",
    justifyContent: "center",
  },

  label: {
    flex:          1,
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
  },

  div: {
    height:     StyleSheet.hairlineWidth,
    marginLeft: 58,
  },

  moreToggle: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               5,
    paddingVertical:   11,
    paddingHorizontal: 16,
  },

  moreLabel: {
    fontSize:   13,
    fontFamily: "Inter_400Regular",
    letterSpacing: -0.1,
  },
});
