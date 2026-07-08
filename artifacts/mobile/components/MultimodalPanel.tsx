/**
 * MultimodalPanel — keyboard-aware floating glass action sheet.
 *
 * Panel entry:
 *   - Container: overdamped spring (damping 32, stiffness 240) — fluid, zero bounce
 *   - Fade: 220ms cubic-out
 *
 * Card choreography (all on UI thread via Reanimated — 60 FPS guaranteed):
 *   1. Cards cascade left-to-right: 50ms stagger between each
 *   2. Per card: opacity 0→1, translateY 12→0, scale 0.96→1.0 — 200/240ms cubic-out
 *   3. Exit: all cards collapse together in 110ms — no stagger
 *
 * Press micro-interaction (per card):
 *   - Scale 1→0.97 in 90ms (immediate, deliberate)
 *   - Shadow grows while pressed — "lifted" feel
 *   - Returns 0.97→1.0 in 200ms cubic-out
 *   - Haptic on pressIn
 *
 * Glass surface:
 *   - Outer Animated.View: carries soft shadow, no overflow clip
 *   - Inner View: overflow:hidden clips BlurView to borderRadius
 *   - BlurView + color overlay + hairline border
 *   - VOID: dark-tinted blur | PURE: light-tinted blur
 *
 * Keyboard: never dismissed. Input focus: never disturbed.
 * Tap-outside backdrop closes panel only.
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
const PANEL_MX  = 16;
const INNER_PAD = 14;
const CARD_GAP  = 10;
const CARD_W    = (SW - PANEL_MX * 2 - INNER_PAD * 2 - CARD_GAP) / 2;
const CARD_H    = 106;
const PANEL_GAP = 8;   // breathing gap between input bar top and panel bottom

// ─── Easing curves — calm, deliberate, no bounce ──────────────────────────────
const EASE_OUT  = Easing.out(Easing.cubic);
const EASE_IN   = Easing.in(Easing.ease);
const EASE_SNAP = Easing.out(Easing.ease);

// ─── Spring config — overdamped (damping ratio > 1 → zero overshoot) ──────────
const PANEL_SPRING = { damping: 32, stiffness: 240, mass: 1.0 };

// ─── Actions ──────────────────────────────────────────────────────────────────
const ACTIONS = [
  { id: "camera", icon: "camera"    as const, label: "Fotoğraf Çek",  sub: "Kamerayı aç"                     },
  { id: "photos", icon: "image"     as const, label: "Galeriden Seç", sub: "Mevcut görsel yükle"              },
  { id: "files",  icon: "paperclip" as const, label: "Dosya Ekle",    sub: "PDF, Word, Excel\nve daha fazlası" },
  { id: "audio",  icon: "mic"       as const, label: "Ses Kaydı",     sub: "Sesini analiz et"                 },
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
  const stagger = index * 50;   // 0 / 50 / 100 / 150 ms

  // Entry state — opacity, vertical offset, scale
  const entOp    = useSharedValue(0);
  const entY     = useSharedValue(12);
  const entScale = useSharedValue(0.96);

  // Press state — scale + shadow emphasis
  const pressScale  = useSharedValue(1);
  const pressShadow = useSharedValue(0);

  useEffect(() => {
    if (open) {
      // Staggered entrance — cubic-out, no bounce, 200ms opacity / 240ms transform
      entOp.value    = withDelay(stagger, withTiming(1,   { duration: 200, easing: EASE_OUT }));
      entY.value     = withDelay(stagger, withTiming(0,   { duration: 240, easing: EASE_OUT }));
      entScale.value = withDelay(stagger, withTiming(1.0, { duration: 240, easing: EASE_OUT }));
    } else {
      // All cards exit together — quick, uniform
      entOp.value    = withTiming(0,    { duration: 110 });
      entY.value     = withTiming(8,    { duration: 110 });
      entScale.value = withTiming(0.97, { duration: 110 });
      // Reset press state so next open is clean
      pressScale.value  = 1;
      pressShadow.value = 0;
    }
  }, [open]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   entOp.value,
    transform: [
      { translateY: entY.value },
      { scale: entScale.value * pressScale.value },
    ],
    // Shadow lifts subtly on press — reinforces physical depth
    shadowOpacity: interpolate(pressShadow.value, [0, 1], [0, 0.10]),
    shadowColor:   "#000000",
    shadowOffset:  { width: 0, height: 3 },
    shadowRadius:  8,
    elevation:     interpolate(pressShadow.value, [0, 1], [0, 4]),
  }));

  const handlePressIn = useCallback(() => {
    pressScale.value  = withTiming(0.97, { duration: 90,  easing: EASE_SNAP });
    pressShadow.value = withTiming(1,    { duration: 90 });
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handlePressOut = useCallback(() => {
    pressScale.value  = withTiming(1.0, { duration: 200, easing: EASE_OUT });
    pressShadow.value = withTiming(0,   { duration: 200 });
  }, []);

  // Theme-reactive colors — avoid re-renders by passing isDark as prop
  const cardBg   = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.045)";
  const iconBg   = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.058)";
  const iconColor = isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.72)";
  const labelColor = isDark ? "rgba(255,255,255,0.90)" : "#111111";
  const subColor   = isDark ? "rgba(255,255,255,0.42)" : "#888888";

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
      <Animated.View style={[ss.card, cardStyle, { backgroundColor: cardBg }]}>
        {/* Icon badge — top-left */}
        <View style={[ss.iconWrap, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={20} color={iconColor} />
        </View>
        {/* Labels — bottom-left */}
        <Text style={[ss.cardLabel, { color: labelColor }]} numberOfLines={1}>{label}</Text>
        <Text style={[ss.cardSub,   { color: subColor   }]}>{sub}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  open:           boolean;
  onClose:        () => void;
  onImagePicked?: (uri: string) => void;
  bottomOffset:   number;  // px from screen bottom to top of input bar
}

// ─── Panel ────────────────────────────────────────────────────────────────────
export default function MultimodalPanel({
  open,
  onClose,
  onImagePicked,
  bottomOffset,
}: Props) {
  const { theme: T } = useTheme();

  // Keyboard height from keyboard-controller — ≤0, negative when visible
  const { reanimated } = useKeyboardContext();
  const kbH = reanimated.height;

  // Panel container shared values
  const panelOp = useSharedValue(0);
  const panelY  = useSharedValue(20);
  const bdOp    = useSharedValue(0);
  const pillOp  = useSharedValue(0);

  useEffect(() => {
    if (open) {
      // Backdrop + pill: simple fades
      bdOp.value   = withTiming(1, { duration: 180 });
      pillOp.value = withTiming(1, { duration: 140, easing: EASE_OUT });
      // Panel opacity: timing fade (spring on opacity looks wrong)
      panelOp.value = withTiming(1, { duration: 200, easing: EASE_OUT });
      // Panel position: overdamped spring — fluid, zero overshoot
      panelY.value  = withSpring(0, PANEL_SPRING);
    } else {
      // Exit: short timing — a snap-down feels more intentional than a spring reverse
      bdOp.value    = withTiming(0,  { duration: 160 });
      pillOp.value  = withTiming(0,  { duration: 120 });
      panelOp.value = withTiming(0,  { duration: 150 });
      panelY.value  = withTiming(16, { duration: 160, easing: EASE_IN });
    }
  }, [open]);

  const bdStyle = useAnimatedStyle(() => ({ opacity: bdOp.value }));

  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOp.value }));

  // Panel bottom = input bar top + breathing gap, raised by keyboard height.
  // kbH ≤ 0: subtracting a negative value adds keyboard height — panel tracks keyboard.
  const panelStyle = useAnimatedStyle(() => ({
    opacity:   panelOp.value,
    bottom:    bottomOffset + PANEL_GAP - kbH.value,
    transform: [{ translateY: panelY.value }],
  }));

  // ── Glass token selection ────────────────────────────────────────────────────
  const blurTint     = T.isDark ? "dark"                   : "light";
  const overlayColor = T.isDark ? "rgba(12,12,12,0.56)"    : "rgba(255,255,255,0.64)";
  const borderColor  = T.isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)";
  const shadowColor  = T.isDark ? "rgba(0,0,0,1)"          : "rgba(0,0,0,1)";
  const shadowOpacity = T.isDark ? 0.45                    : 0.10;
  const pillColor    = T.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.13)";

  // ── Action handlers ──────────────────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Tap-outside backdrop — closes panel, never disturbs keyboard */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.backdrop, bdStyle]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Outer shadow carrier — no overflow clip so shadow renders on iOS */}
      <Animated.View
        style={[
          ss.panelShadow,
          panelStyle,
          { shadowColor, shadowOpacity },
        ]}
        pointerEvents={open ? "box-none" : "none"}
      >
        {/* Inner glass surface — clips BlurView to rounded corners */}
        <View style={ss.panelGlass}>

          {/* Frosted glass base */}
          <BlurView
            style={StyleSheet.absoluteFill}
            tint={blurTint}
            intensity={65}
          />

          {/* Color overlay — thickens / tints the blur for legibility */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />

          {/* Hairline border — defines the panel edge on both themes */}
          <View style={[StyleSheet.absoluteFill, ss.panelBorder, { borderColor }]} />

          {/* Drag pill — fades in first, independent of card timing */}
          <Animated.View style={[ss.dragPill, pillStyle, { backgroundColor: pillColor }]} />

          {/* 2 × 2 staggered card grid */}
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

        </View>{/* panelGlass */}
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

  // Outer wrapper — carries drop shadow (must NOT have overflow:hidden)
  panelShadow: {
    position:      "absolute",
    zIndex:        160,
    left:          PANEL_MX,
    right:         PANEL_MX,
    borderRadius:  28,
    shadowOffset:  { width: 0, height: -4 },
    shadowRadius:  24,
    elevation:     24,
  },

  // Inner surface — clips BlurView + overlays to borderRadius
  panelGlass: {
    borderRadius:      28,
    overflow:          "hidden",
    paddingHorizontal: INNER_PAD,
    paddingBottom:     INNER_PAD + 6,
    paddingTop:        14,
  },

  // Hairline border rendered as an absoluteFill view with just borders
  panelBorder: {
    borderRadius: 28,
    borderWidth:  0.5,
  },

  dragPill: {
    width:        36,
    height:       4,
    borderRadius: 2,
    alignSelf:    "center",
    marginBottom: 14,
  },

  grid: {
    gap: CARD_GAP,
  },

  gridRow: {
    flexDirection: "row",
    gap:           CARD_GAP,
  },

  card: {
    width:        CARD_W,
    height:       CARD_H,
    borderRadius: 18,
    padding:      13,
    justifyContent: "flex-end",
    overflow:       "hidden",
  },

  iconWrap: {
    position:       "absolute",
    top:            13,
    left:           13,
    width:          40,
    height:         40,
    borderRadius:   13,
    alignItems:     "center",
    justifyContent: "center",
  },

  cardLabel: {
    fontSize:      13,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.2,
    marginBottom:  2,
  },

  cardSub: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.05,
    lineHeight:    15,
  },

});
