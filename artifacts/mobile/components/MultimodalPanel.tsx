/**
 * MultimodalPanel — premium iOS-style floating attachment sheet.
 *
 * Glass surface:
 *   Outer Animated.View: shadow carrier, no overflow clip
 *   Inner View: overflow:hidden clips BlurView to borderRadius 32
 *   BlurView intensity 80 + color overlay + hairline border
 *
 * Entry animation:
 *   Panel: overdamped spring (zero overshoot) + 200ms opacity fade
 *   Backdrop: 180ms fade
 *   Cards: staggered 0/50/100/150ms — opacity + translateY 10→0 + scale 0.96→1.0
 *
 * Card press:
 *   Scale 1→0.97 in 90ms, back in 200ms cubic-out
 *   Haptic on pressIn
 *
 * Close:
 *   150ms snap-down, cards collapse together in 110ms
 */
import { BlurView }             from "expo-blur";
import * as Haptics             from "expo-haptics";
import * as ImagePicker         from "expo-image-picker";
import { router }               from "expo-router";
import { Feather }              from "@expo/vector-icons";
import { useKeyboardContext }   from "react-native-keyboard-controller";
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
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";

// ─── Layout ───────────────────────────────────────────────────────────────────
const SW        = Dimensions.get("window").width;
const PANEL_MX  = SW * 0.04;                                             // 4% each side → 92% width
const INNER_PAD = 24;
const CARD_GAP  = 16;
const CARD_W    = (SW - PANEL_MX * 2 - INNER_PAD * 2 - CARD_GAP) / 2;
const CARD_H    = 120;
const PANEL_GAP = 8;

// ─── Easing curves ────────────────────────────────────────────────────────────
const EASE_OUT  = Easing.out(Easing.cubic);
const EASE_IN   = Easing.in(Easing.ease);
const EASE_SNAP = Easing.out(Easing.ease);

// ─── Spring — overdamped, zero overshoot ──────────────────────────────────────
const PANEL_SPRING = { damping: 32, stiffness: 240, mass: 1.0 };

// ─── Actions ──────────────────────────────────────────────────────────────────
const ACTIONS = [
  { id: "camera", icon: "camera"    as const, label: "Fotoğraf Çek",  sub: "Kamerayı aç"         },
  { id: "photos", icon: "image"     as const, label: "Galeriden Seç", sub: "Görsel yükle"         },
  { id: "files",  icon: "paperclip" as const, label: "Dosya Ekle",    sub: "PDF, Word, Excel…"    },
  { id: "audio",  icon: "mic"       as const, label: "Ses Kaydı",     sub: "Sesini analiz et"     },
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
  const entY     = useSharedValue(10);
  const entScale = useSharedValue(0.96);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (open) {
      entOp.value    = withDelay(stagger, withTiming(1,   { duration: 200, easing: EASE_OUT }));
      entY.value     = withDelay(stagger, withTiming(0,   { duration: 240, easing: EASE_OUT }));
      entScale.value = withDelay(stagger, withTiming(1.0, { duration: 240, easing: EASE_OUT }));
    } else {
      entOp.value    = withTiming(0,    { duration: 110 });
      entY.value     = withTiming(8,    { duration: 110 });
      entScale.value = withTiming(0.97, { duration: 110 });
      pressScale.value = 1;
    }
  }, [open]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   entOp.value,
    transform: [
      { translateY: entY.value },
      { scale: entScale.value * pressScale.value },
    ],
  }));

  const handlePressIn = useCallback(() => {
    pressScale.value = withTiming(0.97, { duration: 90, easing: EASE_SNAP });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePressOut = useCallback(() => {
    pressScale.value = withTiming(1.0, { duration: 200, easing: EASE_OUT });
  }, []);

  const cardBg    = isDark ? "rgba(255,255,255,0.08)" : "#F7F7F7";
  const cardBorder = isDark ? "rgba(255,255,255,0.10)" : "#ECECEC";
  const iconBg    = isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.055)";
  const iconColor = isDark ? "rgba(255,255,255,0.88)" : "#222222";
  const labelColor = isDark ? "rgba(255,255,255,0.92)" : "#222222";
  const subColor   = isDark ? "rgba(255,255,255,0.44)" : "#9B9B9B";

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View style={[ss.card, cardStyle, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        {/* Icon badge — top-left, 52×52 rounded circle */}
        <View style={[ss.iconWrap, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={28} color={iconColor} />
        </View>
        {/* Labels — bottom-left */}
        <Text style={[ss.cardLabel, { color: labelColor }]} numberOfLines={1}>{label}</Text>
        <Text style={[ss.cardSub,   { color: subColor   }]} numberOfLines={2}>{sub}</Text>
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
  const overlayColor  = T.isDark ? "rgba(18,18,18,0.62)"    : "rgba(255,255,255,0.76)";
  const borderColor   = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const shadowColor   = "#000000";
  const shadowOpacity = T.isDark ? 0.38 : 0.06;
  const pillColor     = T.isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";

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
      {/* Light translucent backdrop — dims chat without going dark */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.backdrop, bdStyle]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Outer shadow carrier — no overflow:hidden so shadow renders on iOS */}
      <Animated.View
        style={[ss.panelShadow, panelStyle, { shadowColor, shadowOpacity }]}
        pointerEvents={open ? "box-none" : "none"}
      >
        {/* Inner glass surface — clips BlurView to rounded corners */}
        <View style={ss.panelGlass}>

          {/* Frosted glass base — intensity 80 for premium Apple blur */}
          <BlurView
            style={StyleSheet.absoluteFill}
            tint={blurTint}
            intensity={80}
          />

          {/* Color overlay */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />

          {/* Hairline border */}
          <View style={[StyleSheet.absoluteFill, ss.panelBorder, { borderColor }]} />

          {/* Drag pill */}
          <Animated.View style={[ss.dragPill, pillStyle, { backgroundColor: pillColor }]} />

          {/* 2 × 2 card grid */}
          <View style={ss.grid}>
            <View style={ss.gridRow}>
              {ACTIONS.slice(0, 2).map((a, i) => (
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
            <View style={ss.gridRow}>
              {ACTIONS.slice(2, 4).map((a, i) => (
                <ActionCard
                  key={a.id}
                  icon={a.icon}
                  label={a.label}
                  sub={a.sub}
                  index={i + 2}
                  open={open}
                  isDark={T.isDark}
                  onPress={handlers[a.id]}
                />
              ))}
            </View>
          </View>

        </View>
      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({

  // Light translucent overlay — not dark, Apple-style
  backdrop: {
    zIndex:          150,
    backgroundColor: "rgba(0,0,0,0.07)",
  },

  // Shadow carrier — must NOT have overflow:hidden
  panelShadow: {
    position:      "absolute",
    zIndex:        160,
    left:          PANEL_MX,
    right:         PANEL_MX,
    borderRadius:  32,
    shadowOffset:  { width: 0, height: -2 },
    shadowRadius:  28,
    elevation:     20,
  },

  // Glass surface — clips blur + overlays
  panelGlass: {
    borderRadius:      32,
    overflow:          "hidden",
    paddingHorizontal: INNER_PAD,
    paddingBottom:     INNER_PAD,
    paddingTop:        12,
  },

  panelBorder: {
    borderRadius: 32,
    borderWidth:  0.5,
  },

  dragPill: {
    width:        32,
    height:       4,
    borderRadius: 2,
    alignSelf:    "center",
    marginBottom: 16,
  },

  grid: {
    gap: CARD_GAP,
  },

  gridRow: {
    flexDirection: "row",
    gap:           CARD_GAP,
  },

  // Card — equal size, rounded, subtle border
  card: {
    width:        CARD_W,
    height:       CARD_H,
    borderRadius: 24,
    borderWidth:  0.5,
    padding:      14,
    justifyContent: "flex-end",
    overflow:       "hidden",
  },

  // Icon circle — 52×52 perfectly centered
  iconWrap: {
    position:       "absolute",
    top:            14,
    left:           14,
    width:          52,
    height:         52,
    borderRadius:   26,
    alignItems:     "center",
    justifyContent: "center",
  },

  // Title — SF Pro Display Semibold equivalent
  cardLabel: {
    fontSize:      18,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.3,
    marginBottom:  4,
  },

  // Subtitle — SF Pro Text Regular equivalent
  cardSub: {
    fontSize:   14,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },

});
