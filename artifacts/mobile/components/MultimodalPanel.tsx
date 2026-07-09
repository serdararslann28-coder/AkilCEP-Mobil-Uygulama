/**
 * MultimodalPanel — premium Apple-inspired attachment sheet.
 *
 * Layout: single horizontal row of 4 equal-width cards (flex:1 each).
 *         Cards stretch to equal height — tallest card sets the row height.
 *
 * Glass surface:
 *   Outer Animated.View: shadow carrier (no overflow:hidden)
 *   Inner View: overflow:hidden clips BlurView to borderRadius 34
 *   BlurView intensity 85 + soft white overlay + hairline border
 *
 * Entry:
 *   Panel: overdamped spring up + 200ms opacity
 *   Backdrop blur: 180ms fade
 *   Cards: staggered 0/50/100/150ms — opacity + scale 0.96→1.00
 *
 * Press: scale 1→0.98 in 90ms, return in 200ms cubic-out + light haptic
 *
 * Close: 150ms snap-down, cards collapse in 110ms
 */
import { BlurView }           from "expo-blur";
import * as Haptics           from "expo-haptics";
import * as ImagePicker       from "expo-image-picker";
import { router }             from "expo-router";
import { Feather }            from "@expo/vector-icons";
import { useKeyboardContext } from "react-native-keyboard-controller";
import React, { useCallback, useEffect } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";

// ─── Layout ───────────────────────────────────────────────────────────────────
const SW        = Dimensions.get("window").width;
const PANEL_MX  = SW * 0.04;      // 4% each side → 92% panel width
const INNER_PAD = 16;
const CARD_GAP  = 10;
const PANEL_GAP = 8;              // gap between panel bottom and input bar top

// ─── Easing curves ────────────────────────────────────────────────────────────
const EASE_OUT  = Easing.out(Easing.cubic);
const EASE_IN   = Easing.in(Easing.ease);
const EASE_SNAP = Easing.out(Easing.ease);

// ─── Spring — overdamped, zero overshoot ──────────────────────────────────────
const PANEL_SPRING = { damping: 32, stiffness: 240, mass: 1.0 };

// ─── Actions ──────────────────────────────────────────────────────────────────
const ACTIONS = [
  { id: "camera", icon: "camera"    as const, label: "Fotoğraf Çek",  sub: "Kamerayı aç"                   },
  { id: "photos", icon: "image"     as const, label: "Galeriden Seç", sub: "Mevcut görsel yükle"            },
  { id: "files",  icon: "paperclip" as const, label: "Dosya Ekle",    sub: "PDF, Word, Excel\nve diğer dosyalar" },
  { id: "audio",  icon: "mic"       as const, label: "Ses Kaydı",     sub: "Sesini analiz et"               },
] as const;

type ActionId = typeof ACTIONS[number]["id"];

// ─── ActionCard ───────────────────────────────────────────────────────────────
function ActionCard({
  icon,
  label,
  sub,
  index,
  open,
  isDark,
  onPress,
}: {
  icon:    React.ComponentProps<typeof Feather>["name"];
  label:   string;
  sub:     string;
  index:   number;
  open:    boolean;
  isDark:  boolean;
  onPress: () => void;
}) {
  const stagger = index * 50;

  const entOp    = useSharedValue(0);
  const entScale = useSharedValue(0.96);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (open) {
      entOp.value    = withDelay(stagger, withTiming(1,   { duration: 200, easing: EASE_OUT }));
      entScale.value = withDelay(stagger, withTiming(1.0, { duration: 240, easing: EASE_OUT }));
    } else {
      entOp.value    = withTiming(0,    { duration: 110 });
      entScale.value = withTiming(0.97, { duration: 110 });
      pressScale.value = 1;
    }
  }, [open]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   entOp.value,
    transform: [{ scale: entScale.value * pressScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    pressScale.value = withTiming(0.98, { duration: 90, easing: EASE_SNAP });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePressOut = useCallback(() => {
    pressScale.value = withTiming(1.0, { duration: 200, easing: EASE_OUT });
  }, []);

  // Theme-reactive colors
  const cardBg     = isDark ? "rgba(40,40,40,0.82)"   : "rgba(255,255,255,0.95)";
  const cardBorder = isDark ? "rgba(255,255,255,0.10)" : "#ECECEC";
  const iconBg     = isDark ? "rgba(255,255,255,0.12)" : "#F5F5F7";
  const iconColor  = isDark ? "rgba(255,255,255,0.88)" : "#222222";
  const labelColor = isDark ? "rgba(255,255,255,0.92)" : "#222222";
  const subColor   = isDark ? "rgba(255,255,255,0.44)" : "#9B9B9B";

  return (
    <Pressable
      style={ss.cardPressable}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View style={[ss.card, cardStyle, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        {/* Icon circle — 52×52 centered */}
        <View style={[ss.iconWrap, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={26} color={iconColor} />
        </View>
        {/* Title */}
        <Text style={[ss.cardLabel, { color: labelColor }]}>{label}</Text>
        {/* Subtitle — wraps naturally, no truncation */}
        <Text style={[ss.cardSub, { color: subColor }]}>{sub}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  open:           boolean;
  onClose:        () => void;
  onImagePicked?: (uri: string) => void;
  bottomOffset:   number;
}

// ─── Panel ────────────────────────────────────────────────────────────────────
export default function MultimodalPanel({
  open,
  onClose,
  onImagePicked,
  bottomOffset,
}: Props) {
  const { theme: T } = useTheme();
  const { reanimated } = useKeyboardContext();
  const kbH = reanimated.height;

  const panelOp = useSharedValue(0);
  const panelY  = useSharedValue(20);
  const bdOp    = useSharedValue(0);
  const pillOp  = useSharedValue(0);

  useEffect(() => {
    if (open) {
      bdOp.value    = withTiming(1,  { duration: 180 });
      pillOp.value  = withTiming(1,  { duration: 140, easing: EASE_OUT });
      panelOp.value = withTiming(1,  { duration: 200, easing: EASE_OUT });
      panelY.value  = withSpring(0,  PANEL_SPRING);
    } else {
      bdOp.value    = withTiming(0,  { duration: 160 });
      pillOp.value  = withTiming(0,  { duration: 120 });
      panelOp.value = withTiming(0,  { duration: 150 });
      panelY.value  = withTiming(16, { duration: 160, easing: EASE_IN });
    }
  }, [open]);

  const bdStyle   = useAnimatedStyle(() => ({ opacity: bdOp.value }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOp.value }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity:   panelOp.value,
    bottom:    bottomOffset + PANEL_GAP - kbH.value,
    transform: [{ translateY: panelY.value }],
  }));

  // Glass tokens
  const blurTint      = T.isDark ? "dark"                   : "light";
  const overlayColor  = T.isDark ? "rgba(18,18,18,0.65)"    : "rgba(255,255,255,0.82)";
  const borderColor   = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const shadowColor   = "#000000";
  const shadowOpacity = T.isDark ? 0.36 : 0.06;
  const pillColor     = T.isDark ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.14)";

  // Action handlers
  const handleCamera = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    setTimeout(() => router.push("/vision"), 180);
  }, [onClose]);

  const handlePhotos = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.88,
    });
    if (!result.canceled && result.assets[0]) {
      onImagePicked?.(result.assets[0].uri);
      onClose();
    }
  }, [onImagePicked, onClose]);

  const handleFiles = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onClose();
  }, [onClose]);

  const handleAudio = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onClose();
  }, [onClose]);

  const handlers: Record<ActionId, () => void> = {
    camera: handleCamera,
    photos: handlePhotos,
    files:  handleFiles,
    audio:  handleAudio,
  };

  return (
    <>
      {/* Very light backdrop — dims content gently, Apple-style */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.backdrop, bdStyle]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Outer shadow carrier — no overflow:hidden */}
      <Animated.View
        style={[ss.panelShadow, panelStyle, { shadowColor, shadowOpacity }]}
        pointerEvents={open ? "box-none" : "none"}
      >
        {/* Glass surface — clips BlurView to borderRadius 34 */}
        <View style={ss.panelGlass}>

          <BlurView
            style={StyleSheet.absoluteFill}
            tint={blurTint}
            intensity={85}
          />

          {/* Soft white overlay */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />

          {/* Hairline border */}
          <View style={[StyleSheet.absoluteFill, ss.panelBorder, { borderColor }]} />

          {/* Drag handle */}
          <Animated.View style={[ss.dragPill, pillStyle, { backgroundColor: pillColor }]} />

          {/* Single-row 4-card grid */}
          <View style={ss.grid}>
            {ACTIONS.map((a, i) => (
              <ActionCard
                key={a.id}
                icon={a.icon}
                label={a.label}
                sub={a.sub}
                index={i}
                open={open}
                isDark={T.isDark}
                onPress={handlers[a.id]}
              />
            ))}
          </View>

        </View>
      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({

  // Very light overlay — not dark, Apple-style
  backdrop: {
    zIndex:          150,
    backgroundColor: "rgba(0,0,0,0.05)",
  },

  // Shadow carrier — must NOT have overflow:hidden
  panelShadow: {
    position:      "absolute",
    zIndex:        160,
    left:          PANEL_MX,
    right:         PANEL_MX,
    borderRadius:  34,
    shadowOffset:  { width: 0, height: 2 },
    shadowRadius:  24,
    elevation:     18,
  },

  // Glass surface — clips blur + overlays to radius 34
  panelGlass: {
    borderRadius:      34,
    overflow:          "hidden",
    paddingHorizontal: INNER_PAD,
    paddingBottom:     INNER_PAD,
    paddingTop:        10,
  },

  panelBorder: {
    borderRadius: 34,
    borderWidth:  0.5,
  },

  dragPill: {
    width:        36,
    height:       4,
    borderRadius: 2,
    alignSelf:    "center",
    marginBottom: 14,
  },

  // Single horizontal row — alignItems stretch equalizes card heights
  grid: {
    flexDirection: "row",
    gap:           CARD_GAP,
    alignItems:    "stretch",
  },

  // Pressable fills flex:1 so grid gaps work correctly
  cardPressable: {
    flex: 1,
  },

  // Card — flex:1 height from tallest sibling via stretch
  card: {
    flex:           1,
    borderRadius:   22,
    borderWidth:    0.5,
    alignItems:     "center",
    paddingHorizontal: 6,
    paddingTop:     16,
    paddingBottom:  14,
  },

  // Icon circle — 52×52 centered
  iconWrap: {
    width:          52,
    height:         52,
    borderRadius:   26,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   12,
  },

  // Title — SF Pro Display Medium equivalent
  cardLabel: {
    fontSize:      17,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.2,
    textAlign:     "center",
    marginBottom:  4,
  },

  // Subtitle — wraps naturally, no truncation
  cardSub: {
    fontSize:   13,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    textAlign:  "center",
  },

});
