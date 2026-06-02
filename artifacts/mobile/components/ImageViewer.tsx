/**
 * ImageViewer — full-screen generated-image viewer with inline editing.
 *
 * Features:
 *  - Dark overlay, smooth spring open/close
 *  - Pinch-to-zoom + pan (simultaneous gestures)
 *  - Double-tap to toggle 1× ↔ 2.5× zoom
 *  - Top bar:    ✕ Close  ·  ⬇ Download  ·  ↗ Share
 *  - Bottom bar: quick-edit action pills + "Görseli düzenle..." inline input
 *  - Keyboard-aware: bottom bar slides up with keyboard
 *  - Download saves PNG to device gallery (expo-media-library)
 *  - Share writes temp PNG then opens native share sheet
 */
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
  imageData: string;          // data:image/png;base64,...
  onClose:   () => void;
  onEdit?:   (instruction: string) => void;
}

const SPRING = { damping: 22, stiffness: 200, mass: 0.9 } as const;

// Quick-action pills that pre-fill the edit input
const QUICK_ACTIONS = [
  { label: "Alanları Seç",            text: "Şu alanı değiştir: " },
  { label: "En-Boy Oranını Değiştir", text: "En-boy oranını değiştir: " },
  { label: "Arka Planı Kaldır",       text: "Arka planı kaldır" },
];

export default function ImageViewer({
  visible,
  imageData,
  onClose,
  onEdit,
}: Props) {
  const { showToast } = useTheme();
  const insets = useSafeAreaInsets();

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editText, setEditText] = useState("");

  // ── Keyboard height tracking ───────────────────────────────────────────────
  const kbOffset = useSharedValue(0);

  useEffect(() => {
    const SHOW = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const HIDE = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(SHOW, (e) => {
      kbOffset.value = withTiming(e.endCoordinates.height, { duration: 280 });
    });
    const hideSub = Keyboard.addListener(HIDE, () => {
      kbOffset.value = withTiming(0, { duration: 280 });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const bottomBarAnim = useAnimatedStyle(() => ({
    bottom: kbOffset.value,
  }));

  // ── Overlay entrance animation ─────────────────────────────────────────────
  const overlayOp = useSharedValue(0);
  const imgScale  = useSharedValue(0.88);

  useEffect(() => {
    if (visible) {
      overlayOp.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.ease) });
      imgScale.value  = withSpring(1, SPRING);
    } else {
      overlayOp.value = withTiming(0, { duration: 200 });
      imgScale.value  = withTiming(0.88, { duration: 180 });
      // Clear edit text when viewer closes
      setEditText("");
    }
  }, [visible]);

  // ── Zoom + pan ─────────────────────────────────────────────────────────────
  const scale      = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx         = useSharedValue(0);
  const ty         = useSharedValue(0);
  const savedTx    = useSharedValue(0);
  const savedTy    = useSharedValue(0);

  const resetTransform = useCallback(() => {
    scale.value      = withSpring(1, SPRING);
    tx.value         = withSpring(0, SPRING);
    ty.value         = withSpring(0, SPRING);
    savedScale.value = 1;
    savedTx.value    = 0;
    savedTy.value    = 0;
  }, []);

  useEffect(() => {
    if (!visible) resetTransform();
  }, [visible]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * e.scale, 6));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value      = withSpring(1, SPRING);
        tx.value         = withSpring(0, SPRING);
        ty.value         = withSpring(0, SPRING);
        savedScale.value = 1;
        savedTx.value    = 0;
        savedTy.value    = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value <= 1.05) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.1) {
        scale.value      = withSpring(1, SPRING);
        tx.value         = withSpring(0, SPRING);
        ty.value         = withSpring(0, SPRING);
        savedScale.value = 1;
        savedTx.value    = 0;
        savedTy.value    = 0;
      } else {
        scale.value      = withSpring(2.5, SPRING);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(
    Gesture.Race(doubleTap),
    pinchGesture,
    panGesture,
  );

  // ── Animated styles ────────────────────────────────────────────────────────
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOp.value }));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: imgScale.value * scale.value },
      { translateX: tx.value },
      { translateY: ty.value },
    ],
  }));

  // ── Actions ────────────────────────────────────────────────────────────────
  const getBase64 = () => imageData.replace(/^data:image\/\w+;base64,/, "");

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleDownload = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (Platform.OS === "web") {
        showToast("İndirme mobil cihazlarda çalışır");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const MediaLibrary = require("expo-media-library") as typeof import("expo-media-library");
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("İzin Gerekli", "Galeriye kaydetmek için izin gereklidir.");
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}akilcep-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(fileUri, getBase64(), {
        encoding: FileSystem.EncodingType.Base64,
      });
      await MediaLibrary.saveToLibraryAsync(fileUri);
      try { await FileSystem.deleteAsync(fileUri, { idempotent: true }); } catch {}

      showToast("Görsel kaydedildi");
    } catch {
      showToast("Kaydetme başarısız");
    }
  }, [imageData]);

  const handleShare = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (Platform.OS === "web") {
        showToast("Paylaşım mobil cihazlarda çalışır");
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}akilcep-share-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(fileUri, getBase64(), {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Share.share(
        Platform.OS === "ios"
          ? { url: fileUri }
          : { message: fileUri, title: "AkılCEP Görseli" },
      );

      setTimeout(async () => {
        try { await FileSystem.deleteAsync(fileUri, { idempotent: true }); } catch {}
      }, 8000);
    } catch {
      // User cancelled or error
    }
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

  // ── Layout ─────────────────────────────────────────────────────────────────
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

      <Animated.View style={[ss.overlay, overlayStyle]}>

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <View style={[ss.topBar, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity
            style={ss.iconBtn}
            onPress={handleClose}
            hitSlop={14}
            activeOpacity={0.70}
          >
            <Feather name="x" size={20} color="rgba(255,255,255,0.90)" />
          </TouchableOpacity>

          <View style={ss.topRight}>
            <TouchableOpacity
              style={ss.iconBtn}
              onPress={handleDownload}
              hitSlop={14}
              activeOpacity={0.70}
            >
              <Feather name="download" size={19} color="rgba(255,255,255,0.90)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={ss.iconBtn}
              onPress={handleShare}
              hitSlop={14}
              activeOpacity={0.70}
            >
              <Feather name="share-2" size={19} color="rgba(255,255,255,0.90)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Image (zoom + pan) ───────────────────────────────────────────── */}
        <GestureDetector gesture={composed}>
          <Animated.Image
            source={{ uri: imageData }}
            style={[ss.image, imageStyle]}
            resizeMode="contain"
          />
        </GestureDetector>

        {/* ── Bottom bar: quick actions + edit input (keyboard-aware) ─────── */}
        {onEdit ? (
          <Animated.View
            style={[ss.bottomBar, { paddingBottom: btmPad + 16 }, bottomBarAnim]}
          >
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

            {/* Inline edit input + send */}
            <View style={ss.inputRow}>
              <TextInput
                style={ss.editInput}
                placeholder="Görseli düzenle..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={editText}
                onChangeText={setEditText}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                maxLength={500}
                selectionColor="rgba(255,255,255,0.50)"
              />
              <TouchableOpacity
                style={[ss.sendBtn, { opacity: editText.trim() ? 1 : 0.32 }]}
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
  overlay: {
    flex:            1,
    backgroundColor: "#000",
    justifyContent:  "center",
    alignItems:      "center",
  },

  // Top bar
  topBar: {
    position:          "absolute",
    top:               0,
    left:              0,
    right:             0,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 18,
    paddingBottom:     12,
    zIndex:            10,
    backgroundColor:   "rgba(0,0,0,0.42)",
  },
  topRight: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },
  iconBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // Full-screen image
  image: {
    width:  "100%",
    height: "100%",
  },

  // Bottom bar
  bottomBar: {
    position:          "absolute",
    left:              0,
    right:             0,
    paddingHorizontal: 16,
    paddingTop:        14,
    gap:               10,
    backgroundColor:   "rgba(0,0,0,0.52)",
    zIndex:            10,
  },

  // Quick-action pills row
  pillsRow: {
    gap:            8,
    paddingRight:   4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      99,
    backgroundColor:   "rgba(255,255,255,0.14)",
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.22)",
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
    gap:             10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius:    22,
    paddingLeft:     16,
    paddingRight:    6,
    paddingVertical: 6,
  },
  editInput: {
    flex:       1,
    fontSize:   14,
    fontFamily: "Inter_400Regular",
    color:      "rgba(255,255,255,0.90)",
    paddingVertical: 4,
    letterSpacing: -0.1,
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
