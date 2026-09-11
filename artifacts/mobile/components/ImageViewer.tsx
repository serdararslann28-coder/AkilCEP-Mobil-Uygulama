/**
 * ImageViewer — gallery-quality full-screen image viewer with inline editing.
 *
 * Gestures:
 *  - Pinch to zoom (1× fit → 5× max)
 *  - Double-tap to toggle 1× ↔ 2.5×
 *  - Pan to move while zoomed
 *  - Swipe down to close (with background fade)
 *
 * Controls (floating overlays):
 *  - Top:    ✕ Close  ⬇ Download  ↗ Share
 *  - Bottom: quick-edit pills + "Görseli düzenle..." inline input
 *
 * Notes:
 *  - Image fills true screen dimensions, no layout margins
 *  - Keyboard-aware: bottom bar slides up with keyboard
 *  - Download → expo-media-library (lazy loaded)
 *  - Share → temp file + native share sheet
 */
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  visible:   boolean;
  imageData: string;        // data:image/png;base64,...
  onClose:   () => void;
  onEdit?:   (instruction: string) => void;
}

const SPRING      = { damping: 24, stiffness: 220, mass: 0.85 } as const;
const MAX_ZOOM    = 5;
const SWIPE_CLOSE = 90;     // px drag-down to trigger close
const SWIPE_VY    = 650;    // px/s velocity to trigger close

// Quick-action pills pre-fill the edit input
const QUICK_ACTIONS = [
  { label: "Alanları Seç",            text: "Şu alanı değiştir: " },
  { label: "En-Boy Oranını Değiştir", text: "En-boy oranını değiştir: " },
  { label: "Arka Planı Kaldır",       text: "Arka planı kaldır" },
];

export default function ImageViewer({ visible, imageData, onClose, onEdit }: Props) {
  const { showToast } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = Dimensions.get("window");

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editText, setEditText] = useState("");

  // ── Keyboard tracking ──────────────────────────────────────────────────────
  const kbOffset = useSharedValue(0);

  useEffect(() => {
    const SHOW = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const HIDE = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s = Keyboard.addListener(SHOW, (e) => {
      kbOffset.value = withTiming(e.endCoordinates.height, { duration: 280 });
    });
    const h = Keyboard.addListener(HIDE, () => {
      kbOffset.value = withTiming(0, { duration: 280 });
    });
    return () => { s.remove(); h.remove(); };
  }, []);

  const bottomBarAnim = useAnimatedStyle(() => ({ bottom: kbOffset.value }));

  // ── Overlay entrance ───────────────────────────────────────────────────────
  const overlayOp = useSharedValue(0);
  const imgScale  = useSharedValue(0.90);

  useEffect(() => {
    if (visible) {
      // Reset all transforms on open
      scale.value      = 1;
      savedScale.value = 1;
      tx.value         = 0;
      savedTx.value    = 0;
      ty.value         = 0;
      savedTy.value    = 0;

      overlayOp.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
      imgScale.value  = withSpring(1, SPRING);
    } else {
      // Normal close (button press) — scale + fade
      overlayOp.value = withTiming(0, { duration: 220 });
      imgScale.value  = withTiming(0.90, { duration: 190 });
      setEditText("");
    }
  }, [visible]);

  // ── Zoom + pan shared values ───────────────────────────────────────────────
  const scale      = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx         = useSharedValue(0);
  const ty         = useSharedValue(0);
  const savedTx    = useSharedValue(0);
  const savedTy    = useSharedValue(0);

  // ── Swipe-to-close (JS-thread) ─────────────────────────────────────────────
  const triggerClose = useCallback(() => {
    // Slide image off the bottom and fade background, then notify parent
    ty.value        = withTiming(SH * 0.7, { duration: 300, easing: Easing.out(Easing.ease) });
    overlayOp.value = withTiming(0, { duration: 260 });
    Keyboard.dismiss();
    setEditText("");
    setTimeout(onClose, 280);
  }, [onClose, SH]);

  // ── Gestures ───────────────────────────────────────────────────────────────
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, MAX_ZOOM));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Snap back to 1× if pinched below fit
      if (scale.value < 1.05) {
        scale.value      = withSpring(1, SPRING);
        tx.value         = withSpring(0, SPRING);
        ty.value         = withSpring(0, SPRING);
        savedScale.value = 1;
        savedTx.value    = 0;
        savedTy.value    = 0;
      }
    });

  const pan = Gesture.Pan()
    .minDistance(4)
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value <= 1.05) {
        // Swipe-to-close mode: only track downward motion with resistance
        if (e.translationY > 0) {
          ty.value = e.translationY * 0.82;
        }
      } else {
        // Pan mode while zoomed
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      }
    })
    .onEnd((e) => {
      if (savedScale.value <= 1.05) {
        // Close if swiped far enough or fast enough
        if (ty.value > SWIPE_CLOSE || e.velocityY > SWIPE_VY) {
          runOnJS(triggerClose)();
        } else {
          ty.value = withSpring(0, SPRING);
        }
      } else {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd(() => {
      if (scale.value > 1.1) {
        // Zoom out to 1×
        scale.value      = withSpring(1, SPRING);
        tx.value         = withSpring(0, SPRING);
        ty.value         = withSpring(0, SPRING);
        savedScale.value = 1;
        savedTx.value    = 0;
        savedTy.value    = 0;
      } else {
        // Zoom in to 2.5×
        scale.value      = withSpring(2.5, SPRING);
        savedScale.value = 2.5;
      }
    });

  // doubleTap wins over pinch+pan so it isn't mistaken for a pan start
  const composed = Gesture.Race(
    doubleTap,
    Gesture.Simultaneous(pinch, pan),
  );

  // ── Animated styles ────────────────────────────────────────────────────────
  // Overlay fades as image is dragged down (swipe preview)
  const overlayStyle = useAnimatedStyle(() => {
    const swipeFade =
      savedScale.value <= 1.05
        ? Math.max(0, 1 - Math.max(0, ty.value) / 200)
        : 1;
    return { opacity: overlayOp.value * swipeFade };
  });

  // Image wrapper: entrance scale + user transforms
  const imageWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: imgScale.value },
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  // ── Actions ────────────────────────────────────────────────────────────────
  const getBase64 = () => imageData.replace(/^data:image\/\w+;base64,/, "");

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setEditText("");
    onClose();
  }, [onClose]);

  const handleDownload = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS === "web") { showToast("İndirme mobil cihazlarda çalışır"); return; }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ML = require("expo-media-library") as typeof import("expo-media-library");
      const { status } = await ML.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("İzin Gerekli", "Galeriye kaydetmek için izin gereklidir.");
        return;
      }
      const uri = `${FileSystem.cacheDirectory}akilcep-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(uri, getBase64(), { encoding: FileSystem.EncodingType.Base64 });
      await ML.saveToLibraryAsync(uri);
      try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
      showToast("Görsel kaydedildi");
    } catch {
      showToast("Kaydetme başarısız");
    }
  }, [imageData]);

  const handleShare = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (Platform.OS === "web") { showToast("Paylaşım mobil cihazlarda çalışır"); return; }

      const uri = `${FileSystem.cacheDirectory}akilcep-share-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(uri, getBase64(), { encoding: FileSystem.EncodingType.Base64 });
      await Share.share(
        Platform.OS === "ios"
          ? { url: uri }
          : { message: uri, title: "AkılCEP Görseli" },
      );
      setTimeout(async () => {
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
      }, 8000);
    } catch { /* cancelled */ }
  }, [imageData]);

  const handleSend = useCallback(() => {
    const t = editText.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditText("");
    Keyboard.dismiss();
    onEdit?.(t);
    onClose();
  }, [editText, onEdit, onClose]);

  // ── Layout constants ───────────────────────────────────────────────────────
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 20 : insets.bottom;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={handleClose}
    >
      <StatusBar hidden />

      {/* Full-screen dark background — fades during swipe */}
      <Animated.View style={[ss.bg, overlayStyle]}>

        {/* ── Full-screen image layer ─────────────────────────────────────── */}
        <GestureDetector gesture={composed}>
          <Animated.View style={[ss.imageWrap, imageWrapStyle]}>
            <Animated.Image
              source={{ uri: imageData }}
              style={{ width: SW, height: SH }}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>

        {/* ── Top controls (floating) ─────────────────────────────────────── */}
        <View style={[ss.topBar, { paddingTop: topPad + 10 }]} pointerEvents="box-none">
          <TouchableOpacity style={ss.iconBtn} onPress={handleClose} hitSlop={14} activeOpacity={0.70}>
            <Feather name="x" size={20} color="rgba(255,255,255,0.92)" />
          </TouchableOpacity>

          <View style={ss.topRight}>
            <TouchableOpacity style={ss.iconBtn} onPress={handleDownload} hitSlop={14} activeOpacity={0.70}>
              <Feather name="download" size={19} color="rgba(255,255,255,0.92)" />
            </TouchableOpacity>
            <TouchableOpacity style={ss.iconBtn} onPress={handleShare} hitSlop={14} activeOpacity={0.70}>
              <Feather name="share-2" size={19} color="rgba(255,255,255,0.92)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Bottom edit bar (floating, keyboard-aware) ──────────────────── */}
        {onEdit ? (
          <Animated.View style={[ss.bottomBar, { paddingBottom: btmPad + 14 }, bottomBarAnim]}>

            {/* Quick-action pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={ss.pillsRow}
            >
              {QUICK_ACTIONS.map(({ label, text }) => (
                <TouchableOpacity
                  key={label}
                  style={ss.pill}
                  onPress={() => setEditText(text)}
                  activeOpacity={0.65}
                >
                  <Text style={ss.pillLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Inline edit input */}
            <View style={ss.inputRow}>
              <TextInput
                style={ss.editInput}
                placeholder="Görseli düzenle..."
                placeholderTextColor="rgba(255,255,255,0.32)"
                value={editText}
                onChangeText={setEditText}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                maxLength={500}
                selectionColor="rgba(255,255,255,0.55)"
              />
              <TouchableOpacity
                style={[ss.sendBtn, { opacity: editText.trim() ? 1 : 0.30 }]}
                onPress={handleSend}
                activeOpacity={0.75}
                disabled={!editText.trim()}
              >
                <Feather name="arrow-up" size={16} color="#000" />
              </TouchableOpacity>
            </View>

          </Animated.View>
        ) : null}

      </Animated.View>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  // Full-screen dark background
  bg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
  },

  // Centered image wrapper — transforms applied here
  imageWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems:     "center",
  },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    position:          "absolute",
    top:               0,
    left:              0,
    right:             0,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingBottom:     12,
    zIndex:            20,
  },
  topRight: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  iconBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.14)",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Bottom bar ────────────────────────────────────────────────────────────
  bottomBar: {
    position:          "absolute",
    left:              0,
    right:             0,
    paddingHorizontal: 16,
    paddingTop:        16,
    gap:               10,
    zIndex:            20,
    // Subtle gradient-like darkening via background
    backgroundColor:   "rgba(0,0,0,0.50)",
  },

  // Quick-action pills
  pillsRow: {
    gap:         8,
    paddingRight: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      99,
    backgroundColor:   "rgba(255,255,255,0.13)",
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.20)",
  },
  pillLabel: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.90)",
    letterSpacing: -0.1,
  },

  // Edit input row
  inputRow: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius:    24,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.16)",
    paddingLeft:     16,
    paddingRight:    6,
    paddingVertical: 6,
  },
  editInput: {
    flex:            1,
    fontSize:        14,
    fontFamily:      "Inter_400Regular",
    color:           "rgba(255,255,255,0.92)",
    paddingVertical: 4,
    letterSpacing:   -0.1,
  },
  sendBtn: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: "#FFFFFF",
    alignItems:      "center",
    justifyContent:  "center",
  },
});
