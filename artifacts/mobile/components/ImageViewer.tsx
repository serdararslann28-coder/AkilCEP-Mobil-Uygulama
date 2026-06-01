/**
 * ImageViewer — full-screen generated-image viewer.
 *
 * Features:
 *  - Dark overlay, smooth spring open/close
 *  - Pinch-to-zoom + pan (simultaneous gestures)
 *  - Double-tap to toggle 1× ↔ 2.5× zoom
 *  - Top bar:    ✕ Close  ·  ⤓ Download  ·  📤 Share
 *  - Bottom bar: ✏️ Edit
 *  - Download saves PNG to device gallery (expo-media-library)
 *  - Share writes temp PNG then opens native share sheet
 *  - Toast on successful save
 */
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect } from "react";
import {
  Alert,
  Modal,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
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
  visible:    boolean;
  imageData:  string;          // data:image/png;base64,...
  onClose:    () => void;
  onEdit?:    (instruction: string) => void;
  onEditOpen?: () => void;     // parent triggers edit modal
}

const SPRING = { damping: 22, stiffness: 200, mass: 0.9 } as const;

export default function ImageViewer({
  visible,
  imageData,
  onClose,
  onEditOpen,
}: Props) {
  const { showToast } = useTheme();
  const insets = useSafeAreaInsets();

  // ── Overlay entrance animation ─────────────────────────────────────────────
  const overlayOp  = useSharedValue(0);
  const imgScale   = useSharedValue(0.88);

  useEffect(() => {
    if (visible) {
      overlayOp.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.ease) });
      imgScale.value  = withSpring(1, SPRING);
    } else {
      overlayOp.value = withTiming(0, { duration: 200 });
      imgScale.value  = withTiming(0.88, { duration: 180 });
    }
  }, [visible]);

  // ── Zoom + pan shared values ───────────────────────────────────────────────
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

  // Reset zoom when viewer closes
  useEffect(() => {
    if (!visible) resetTransform();
  }, [visible]);

  // ── Gestures ───────────────────────────────────────────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * e.scale, 6));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Snap back if below 1
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
      if (savedScale.value <= 1.05) return; // only pan when zoomed in
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
        // Reset to 1×
        scale.value      = withSpring(1, SPRING);
        tx.value         = withSpring(0, SPRING);
        ty.value         = withSpring(0, SPRING);
        savedScale.value = 1;
        savedTx.value    = 0;
        savedTy.value    = 0;
      } else {
        // Zoom to 2.5×
        scale.value      = withSpring(2.5, SPRING);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(
    Gesture.Race(doubleTap),
    pinchGesture,
    panGesture,
  );

  // ── Animated styles ───────────────────────────────────────────────────────
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOp.value,
  }));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: imgScale.value * scale.value },
      { translateX: tx.value },
      { translateY: ty.value },
    ],
  }));

  // ── Actions ───────────────────────────────────────────────────────────────
  const getBase64 = () => imageData.replace(/^data:image\/\w+;base64,/, "");

  const handleDownload = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (Platform.OS === "web") {
        showToast("İndirme mobil cihazlarda çalışır");
        return;
      }

      // Dynamic require so the native module doesn't crash on web
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
      // Cleanup temp file
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

      // Cleanup after a delay so share sheet has time to load the file
      setTimeout(async () => {
        try { await FileSystem.deleteAsync(fileUri, { idempotent: true }); } catch {}
      }, 8000);
    } catch {
      // User cancelled or error — silently ignore
    }
  }, [imageData]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  const handleEdit = useCallback(() => {
    onClose();
    // Brief delay so viewer closes before edit modal opens
    setTimeout(() => onEditOpen?.(), 180);
  }, [onClose, onEditOpen]);

  // ── Render ────────────────────────────────────────────────────────────────
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

        {/* ── Top bar ────────────────────────────────────────────────────── */}
        <View style={[ss.topBar, { paddingTop: topPad + 12 }]}>
          {/* Close */}
          <TouchableOpacity
            style={ss.iconBtn}
            onPress={handleClose}
            hitSlop={14}
            activeOpacity={0.70}
          >
            <Feather name="x" size={20} color="rgba(255,255,255,0.90)" />
          </TouchableOpacity>

          <View style={ss.topRight}>
            {/* Download */}
            <TouchableOpacity
              style={ss.iconBtn}
              onPress={handleDownload}
              hitSlop={14}
              activeOpacity={0.70}
            >
              <Feather name="download" size={19} color="rgba(255,255,255,0.90)" />
            </TouchableOpacity>

            {/* Share */}
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

        {/* ── Image ─────────────────────────────────────────────────────── */}
        <GestureDetector gesture={composed}>
          <Animated.Image
            source={{ uri: imageData }}
            style={[ss.image, imageStyle]}
            resizeMode="contain"
          />
        </GestureDetector>

        {/* ── Bottom bar ─────────────────────────────────────────────────── */}
        {onEditOpen ? (
          <View style={[ss.bottomBar, { paddingBottom: btmPad + 16 }]}>
            <TouchableOpacity
              style={ss.editBtn}
              onPress={handleEdit}
              activeOpacity={0.75}
            >
              <Feather name="edit-2" size={15} color="rgba(255,255,255,0.90)" />
              <Text style={ss.editLabel}>Düzenle</Text>
            </TouchableOpacity>
          </View>
        ) : null}

      </Animated.View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
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
    // Subtle gradient-like fade so controls are readable over any image
    backgroundColor:   "rgba(0,0,0,0.40)",
  },
  topRight: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },
  iconBtn: {
    width:          44,
    height:         44,
    borderRadius:   22,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems:     "center",
    justifyContent: "center",
  },

  // Image
  image: {
    width:  "100%",
    height: "100%",
  },

  // Bottom bar
  bottomBar: {
    position:      "absolute",
    bottom:        0,
    left:          0,
    right:         0,
    alignItems:    "center",
    paddingTop:    12,
    backgroundColor: "rgba(0,0,0,0.40)",
    zIndex:        10,
  },
  editBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 22,
    paddingVertical:   12,
    borderRadius:      99,
    backgroundColor:   "rgba(255,255,255,0.13)",
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.22)",
  },
  editLabel: {
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.90)",
    letterSpacing: -0.1,
  },
});
