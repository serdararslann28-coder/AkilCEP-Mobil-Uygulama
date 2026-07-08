/**
 * MultimodalPanel — premium keyboard-aware action sheet.
 *
 * Appears directly above the keyboard (tracks it in real-time via
 * react-native-keyboard-controller reanimated shared value).
 * Never dismisses the keyboard or un-focuses the text input.
 *
 * Layout: drag indicator + 2×2 card grid.
 * Aesthetic: monochrome white glass, black icons, soft shadows, 28px radius.
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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// ─── Layout constants ─────────────────────────────────────────────────────────
const SW        = Dimensions.get("window").width;
const PANEL_MX  = 16;   // screen-edge margin
const INNER_PAD = 14;   // panel inner padding (horizontal + bottom)
const CARD_GAP  = 10;   // gap between cards
const CARD_W    = (SW - PANEL_MX * 2 - INNER_PAD * 2 - CARD_GAP) / 2;
const CARD_H    = 106;  // card height

// ─── Action definitions ───────────────────────────────────────────────────────
const ACTIONS = [
  { id: "camera", icon: "camera"    as const, label: "Fotoğraf Çek",  sub: "Kamerayı aç"                     },
  { id: "photos", icon: "image"     as const, label: "Galeriden Seç", sub: "Mevcut görsel yükle"              },
  { id: "files",  icon: "paperclip" as const, label: "Dosya Ekle",    sub: "PDF, Word, Excel\nve daha fazlası" },
  { id: "audio",  icon: "mic"       as const, label: "Ses Kaydı",     sub: "Sesini analiz et"                 },
] as const;

type ActionId = typeof ACTIONS[number]["id"];

// ─── Single card ──────────────────────────────────────────────────────────────
function ActionCard({
  icon,
  label,
  sub,
  onPress,
}: {
  icon:    React.ComponentProps<typeof Feather>["name"];
  label:   string;
  sub:     string;
  onPress: () => void;
}) {
  const lift = useSharedValue(1);

  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: lift.value }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        lift.value = withSpring(0.955, { damping: 22, stiffness: 460 });
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
      onPressOut={() => {
        lift.value = withSpring(1.0, { damping: 18, stiffness: 360 });
      }}
      onPress={onPress}
    >
      <Animated.View style={[ss.card, cardAnim]}>
        {/* Icon badge — top-left corner */}
        <View style={ss.iconWrap}>
          <Feather name={icon} size={20} color="#111111" />
        </View>
        {/* Labels — pinned to bottom-left */}
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
  bottomOffset:   number;   // px from screen bottom to the top of the input bar
}

// ─── Panel ────────────────────────────────────────────────────────────────────
export default function MultimodalPanel({
  open,
  onClose,
  onImagePicked,
  bottomOffset,
}: Props) {
  // Real-time keyboard height from react-native-keyboard-controller.
  // height is 0 when keyboard is hidden, negative (= -keyboardHeight) when visible.
  const { reanimated } = useKeyboardContext();
  const kbH = reanimated.height;   // SharedValue<number>, ≤ 0

  // Panel entrance / exit
  const panelOp = useSharedValue(0);
  const panelY  = useSharedValue(28);
  const bdOp    = useSharedValue(0);

  useEffect(() => {
    if (open) {
      bdOp.value    = withTiming(1, { duration: 180 });
      panelOp.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) });
      panelY.value  = withSpring(0, { damping: 28, stiffness: 380, mass: 0.85 });
    } else {
      bdOp.value    = withTiming(0, { duration: 150 });
      panelOp.value = withTiming(0, { duration: 170 });
      panelY.value  = withTiming(22, { duration: 160, easing: Easing.in(Easing.ease) });
    }
  }, [open]);

  const bdStyle = useAnimatedStyle(() => ({ opacity: bdOp.value }));

  // Panel tracks keyboard: kbH is 0 or negative, so subtracting it adds the
  // keyboard height to the bottom offset, keeping the panel above the keyboard.
  const panelStyle = useAnimatedStyle(() => ({
    opacity:   panelOp.value,
    bottom:    bottomOffset - kbH.value,
    transform: [{ translateY: panelY.value }],
  }));

  // ── Action handlers ─────────────────────────────────────────────────────────
  const handleCamera = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onClose();
    setTimeout(() => router.push("/vision"), 180);
  }, [onClose]);

  const handlePhotos = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Tap-outside backdrop — does NOT dismiss keyboard */}
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
        {/* Drag indicator */}
        <View style={ss.dragPill} />

        {/* 2 × 2 card grid */}
        <View style={ss.grid}>
          {/* Row 1 */}
          <View style={ss.gridRow}>
            {ACTIONS.slice(0, 2).map(a => (
              <ActionCard
                key={a.id}
                icon={a.icon}
                label={a.label}
                sub={a.sub}
                onPress={handlers[a.id]}
              />
            ))}
          </View>

          {/* Row 2 */}
          <View style={ss.gridRow}>
            {ACTIONS.slice(2, 4).map(a => (
              <ActionCard
                key={a.id}
                icon={a.icon}
                label={a.label}
                sub={a.sub}
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
    // Soft upward shadow — floats off the keyboard surface
    shadowColor:       "#000000",
    shadowOffset:      { width: 0, height: -3 },
    shadowOpacity:     0.09,
    shadowRadius:      22,
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
