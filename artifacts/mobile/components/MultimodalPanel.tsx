/**
 * MultimodalPanel — premium keyboard-aware action sheet.
 *
 * Keyboard tracking: react-native-keyboard-controller reanimated.height
 * (SharedValue<number>, 0 when hidden, negative when visible).
 *
 * Entry choreography:
 *   1. Panel container slides up + fades in (240ms, cubic-out)
 *   2. Cards cascade left-to-right: opacity 0→1, translateY 12→0,
 *      scale 0.96→1.0 — each delayed by 50ms (total 350ms)
 *
 * Press micro-interaction:
 *   - Scale 1→0.97 in 90ms (immediate, intentional)
 *   - Shadow grows while pressed
 *   - Returns 0.97→1.0 in 200ms cubic-out (smooth, never bouncy)
 *   - Haptic on pressIn
 *
 * Exit: panel + cards fade + drop together in 150ms.
 * Keyboard and input focus are never disturbed.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
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
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

// ─── Layout ───────────────────────────────────────────────────────────────────
const SW        = Dimensions.get("window").width;
const PANEL_MX  = 16;
const INNER_PAD = 14;
const CARD_GAP  = 10;
const CARD_W    = (SW - PANEL_MX * 2 - INNER_PAD * 2 - CARD_GAP) / 2;
const CARD_H    = 106;

// Easing curves — deliberately calm, no spring bounce
const EASE_OUT  = Easing.out(Easing.cubic);
const EASE_IN   = Easing.in(Easing.ease);
const EASE_SNAP = Easing.out(Easing.ease);

// ─── Actions ──────────────────────────────────────────────────────────────────
const ACTIONS = [
  { id: "camera", icon: "camera"    as const, label: "Fotoğraf Çek",  sub: "Kamerayı aç"                     },
  { id: "photos", icon: "image"     as const, label: "Galeriden Seç", sub: "Mevcut görsel yükle"              },
  { id: "files",  icon: "paperclip" as const, label: "Dosya Ekle",    sub: "PDF, Word, Excel\nve daha fazlası" },
  { id: "audio",  icon: "mic"       as const, label: "Ses Kaydı",     sub: "Sesini analiz et"                 },
] as const;

type ActionId = typeof ACTIONS[number]["id"];

// ─── Card ─────────────────────────────────────────────────────────────────────
function ActionCard({
  icon,
  label,
  sub,
  index,
  open,
  onPress,
}: {
  icon:    React.ComponentProps<typeof Feather>["name"];
  label:   string;
  sub:     string;
  index:   number;
  open:    boolean;
  onPress: () => void;
}) {
  const stagger = index * 50;          // 0 / 50 / 100 / 150 ms

  // Entry: opacity, translateY, scale
  const entOp    = useSharedValue(0);
  const entY     = useSharedValue(12);
  const entScale = useSharedValue(0.96);

  // Press: scale + shadow emphasis
  const pressScale  = useSharedValue(1);
  const pressShadow = useSharedValue(0);

  useEffect(() => {
    if (open) {
      // Staggered entrance — cubic-out, no bounce, 200ms body
      entOp.value    = withDelay(stagger, withTiming(1,    { duration: 200, easing: EASE_OUT }));
      entY.value     = withDelay(stagger, withTiming(0,    { duration: 240, easing: EASE_OUT }));
      entScale.value = withDelay(stagger, withTiming(1.0,  { duration: 240, easing: EASE_OUT }));
    } else {
      // All cards exit together — quick, no stagger
      entOp.value    = withTiming(0,    { duration: 110 });
      entY.value     = withTiming(8,    { duration: 110 });
      entScale.value = withTiming(0.97, { duration: 110 });
      // Reset press state so it's clean on next open
      pressScale.value  = 1;
      pressShadow.value = 0;
    }
  }, [open]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: entOp.value,
    transform: [
      { translateY: entY.value },
      { scale: entScale.value * pressScale.value },
    ],
    // Shadow grows subtly on press — creates a "lifted" feel
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

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
      <Animated.View style={[ss.card, animStyle]}>
        {/* Icon badge — top-left */}
        <View style={ss.iconWrap}>
          <Feather name={icon} size={20} color="#111111" />
        </View>
        {/* Labels — bottom-left */}
        <Text style={ss.cardLabel} numberOfLines={1}>{label}</Text>
        <Text style={ss.cardSub}>{sub}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  open:           boolean;
  onClose:        () => void;
  onImagePicked?: (uri: string) => void;
  bottomOffset:   number;   // px from screen bottom to top of input bar
}

// ─── Panel ────────────────────────────────────────────────────────────────────
export default function MultimodalPanel({
  open,
  onClose,
  onImagePicked,
  bottomOffset,
}: Props) {
  // Keyboard height from keyboard-controller — ≤0, negative when keyboard visible
  const { reanimated } = useKeyboardContext();
  const kbH = reanimated.height;

  // Panel container animation
  const panelOp = useSharedValue(0);
  const panelY  = useSharedValue(20);
  const bdOp    = useSharedValue(0);

  // Drag pill has its own opacity — fades in with the panel
  const pillOp  = useSharedValue(0);

  useEffect(() => {
    if (open) {
      // Backdrop: fade in quickly
      bdOp.value    = withTiming(1, { duration: 180 });
      // Pill: appears as soon as panel is visible
      pillOp.value  = withTiming(1, { duration: 140, easing: EASE_OUT });
      // Panel: slides up + fades in — slightly slower than pill
      panelOp.value = withTiming(1, { duration: 220, easing: EASE_OUT });
      panelY.value  = withTiming(0, { duration: 260, easing: EASE_OUT });
    } else {
      // Exit: backdrop fades, panel slides down — all in sync
      bdOp.value    = withTiming(0, { duration: 160 });
      pillOp.value  = withTiming(0, { duration: 120 });
      panelOp.value = withTiming(0, { duration: 150 });
      panelY.value  = withTiming(16, { duration: 160, easing: EASE_IN });
    }
  }, [open]);

  const bdStyle = useAnimatedStyle(() => ({ opacity: bdOp.value }));

  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOp.value }));

  // Panel position: bottomOffset above input bar, raised by keyboard height.
  // kbH ≤ 0 → subtracting negative value = adding keyboard height.
  const panelStyle = useAnimatedStyle(() => ({
    opacity:   panelOp.value,
    bottom:    bottomOffset - kbH.value,
    transform: [{ translateY: panelY.value }],
  }));

  // ── Handlers ────────────────────────────────────────────────────────────────
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
      {/* Tap-outside backdrop — closes panel without disturbing keyboard */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.backdrop, bdStyle]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Floating action sheet */}
      <Animated.View
        style={[ss.panel, panelStyle]}
        pointerEvents={open ? "box-none" : "none"}
      >
        {/* Drag indicator — fades in first (pillOp independent of card timing) */}
        <Animated.View style={[ss.dragPill, pillStyle]} />

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

  backdrop: {
    zIndex:          150,
    backgroundColor: "rgba(0,0,0,0.18)",
  },

  panel: {
    position:          "absolute",
    zIndex:            160,
    left:              PANEL_MX,
    right:             PANEL_MX,
    backgroundColor:   "#FFFFFF",
    borderRadius:      28,
    paddingHorizontal: INNER_PAD,
    paddingBottom:     INNER_PAD + 6,
    paddingTop:        12,
    shadowColor:       "#000000",
    shadowOffset:      { width: 0, height: -3 },
    shadowOpacity:     0.08,
    shadowRadius:      20,
    elevation:         20,
  },

  dragPill: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: "rgba(0,0,0,0.13)",
    alignSelf:       "center",
    marginBottom:    14,
  },

  grid: {
    gap: CARD_GAP,
  },

  gridRow: {
    flexDirection: "row",
    gap:           CARD_GAP,
  },

  card: {
    width:           CARD_W,
    height:          CARD_H,
    backgroundColor: "#F6F6F6",
    borderRadius:    18,
    padding:         13,
    justifyContent:  "flex-end",
    overflow:        "hidden",
  },

  iconWrap: {
    position:        "absolute",
    top:             13,
    left:            13,
    width:           40,
    height:          40,
    borderRadius:    13,
    backgroundColor: "rgba(0,0,0,0.058)",
    alignItems:      "center",
    justifyContent:  "center",
  },

  cardLabel: {
    fontSize:      13,
    fontFamily:    "Inter_600SemiBold",
    color:         "#111111",
    letterSpacing: -0.2,
    marginBottom:  2,
  },

  cardSub: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    color:         "#888888",
    letterSpacing: -0.05,
    lineHeight:    15,
  },

});
