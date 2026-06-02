/**
 * MultimodalPanel — fixed-height floating tool bubble above the input bar.
 * All 8 tools in a single scrollable bubble; top/bottom fade indicators.
 * PURE / VOID theme aware. Never covers the input bar.
 */
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
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
const SCREEN_W   = Dimensions.get("window").width;
const BUBBLE_MX  = SCREEN_W * 0.055;        // ~5.5% margin → ~89% width
const BUBBLE_H   = 296;                      // fixed bubble height
const FADE_H     = 28;                       // gradient fade strip height

// ─── Tools ───────────────────────────────────────────────────────────────────
const TOOLS: { id: string; icon: React.ComponentProps<typeof Feather>["name"]; label: string }[] = [
  { id: "camera",   icon: "camera",    label: "Kamera"          },
  { id: "photos",   icon: "image",     label: "Fotoğraflar"     },
  { id: "files",    icon: "paperclip", label: "Dosyalar"        },
  { id: "web",      icon: "globe",     label: "Web Araması"     },
  { id: "imagegen", icon: "zap",       label: "Görsel Oluştur"  },
  { id: "think",    icon: "cpu",       label: "Düşün"           },
  { id: "audio",    icon: "mic",       label: "Ses Kaydı"       },
  { id: "deep",     icon: "layers",    label: "Derin Araştırma" },
];

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

  // ── Panel animation ────────────────────────────────────────────────────────
  const panelOp    = useSharedValue(0);
  const panelScale = useSharedValue(0.93);
  const panelY     = useSharedValue(12);
  const bdOp       = useSharedValue(0);

  useEffect(() => {
    if (open) {
      bdOp.value       = withTiming(1, { duration: 160 });
      panelOp.value    = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
      panelScale.value = withSpring(1, { damping: 22, stiffness: 340, mass: 0.72 });
      panelY.value     = withSpring(0, { damping: 22, stiffness: 340, mass: 0.72 });
    } else {
      bdOp.value       = withTiming(0,    { duration: 140 });
      panelOp.value    = withTiming(0,    { duration: 160 });
      panelScale.value = withTiming(0.95, { duration: 160 });
      panelY.value     = withTiming(10,   { duration: 160 });
    }
  }, [open]);

  const bdStyle    = useAnimatedStyle(() => ({ opacity: bdOp.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity:   panelOp.value,
    transform: [{ scale: panelScale.value }, { translateY: panelY.value }],
  }));

  // ── Scroll fade state ─────────────────────────────────────────────────────
  const scrollRef     = useRef<ScrollView>(null);
  const [canScrollUp,   setCanScrollUp]   = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(true);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    setCanScrollUp(contentOffset.y > 2);
    setCanScrollDown(contentOffset.y + layoutMeasurement.height < contentSize.height - 2);
  };

  // Reset scroll position when panel opens
  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setCanScrollUp(false);
      setCanScrollDown(true);
    }
  }, [open]);

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  // ── Theme ─────────────────────────────────────────────────────────────────
  const panelBg  = T.isDark ? "#111111"                  : "#FFFFFF";
  const panelBdr = T.isDark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.07)";
  const divClr   = T.isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.055)";
  const iconBg   = T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.050)";
  const chevClr  = T.isDark ? "rgba(255,255,255,0.20)"  : "rgba(0,0,0,0.17)";

  // Gradient colors: transparent → panel background
  const fadeTop: [string, string]    = ["transparent", panelBg];
  const fadeBottom: [string, string] = [panelBg, "transparent"];

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
          {
            bottom:          bottomOffset,
            left:            BUBBLE_MX,
            right:           BUBBLE_MX,
            backgroundColor: panelBg,
            borderColor:     panelBdr,
          },
          panelStyle,
        ]}
        pointerEvents={open ? "box-none" : "none"}
      >

        {/* Scrollable tool list — fixed height */}
        <View style={ss.scrollContainer}>
          <ScrollView
            ref={scrollRef}
            style={ss.scroll}
            contentContainerStyle={ss.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            bounces={false}
          >
            {TOOLS.map((tool, i) => (
              <View key={tool.id}>
                <TouchableOpacity
                  style={ss.row}
                  onPress={() => handlePress(tool.id)}
                  activeOpacity={0.55}
                >
                  <View style={[ss.iconWrap, { backgroundColor: iconBg }]}>
                    <Feather name={tool.icon} size={14} color={T.fg} />
                  </View>
                  <Text style={[ss.label, { color: T.fg }]}>{tool.label}</Text>
                  <Feather name="chevron-right" size={12} color={chevClr} />
                </TouchableOpacity>
                {i < TOOLS.length - 1 && (
                  <View style={[ss.div, { backgroundColor: divClr }]} />
                )}
              </View>
            ))}
          </ScrollView>

          {/* Top fade — shown when user has scrolled down */}
          {canScrollUp && (
            <LinearGradient
              colors={fadeTop}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={ss.fadeTop}
              pointerEvents="none"
            />
          )}

          {/* Bottom fade — shown when more content below */}
          {canScrollDown && (
            <LinearGradient
              colors={fadeBottom}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={ss.fadeBottom}
              pointerEvents="none"
            />
          )}
        </View>

        {/* Scroll hint dots — visible while more content below */}
        {canScrollDown && (
          <View style={[ss.scrollHint, { borderTopColor: divClr, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[ss.hintDot, { backgroundColor: chevClr }]} />
            <View style={[ss.hintDot, ss.hintDotMid, { backgroundColor: chevClr }]} />
            <View style={[ss.hintDot, { backgroundColor: chevClr }]} />
          </View>
        )}

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
    borderRadius:  28,
    borderWidth:   StyleSheet.hairlineWidth,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius:  30,
    elevation:     18,
    overflow:      "hidden",
  },

  scrollContainer: {
    height:   BUBBLE_H,
    position: "relative",
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingVertical: 6,
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

  // Gradient fade strips
  fadeTop: {
    position: "absolute",
    top:      0,
    left:     0,
    right:    0,
    height:   FADE_H,
  },

  fadeBottom: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    height:   FADE_H,
  },

  // Subtle three-dot scroll hint at the bottom of the bubble
  scrollHint: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            4,
    paddingVertical: 8,
  },

  hintDot: {
    width:        3,
    height:       3,
    borderRadius: 2,
    opacity:      0.45,
  },

  hintDotMid: {
    opacity: 0.70,
  },
});
