/**
 * PhotoCropModal — circular crop tool, Apple Photos-inspired.
 * Pinch/pan image inside a circular mask, zoom slider, confirm/cancel.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Svg, { Defs, Mask, Rect, Circle } from "react-native-svg";

const { width: W, height: H } = Dimensions.get("window");
const CROP_SIZE  = W * 0.78;
const HALF_CROP  = CROP_SIZE / 2;
const IMG_BASE   = CROP_SIZE * 1.1;

interface Props {
  uri:      string;
  onDone:   (uri: string) => void;
  onCancel: () => void;
}

export default function PhotoCropModal({ uri, onDone, onCancel }: Props) {

  const scale  = useSharedValue(1);
  const savedS = useSharedValue(1);
  const transX = useSharedValue(0);
  const transY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const [zoom, setZoom] = useState(0); // 0..1

  // ── Pinch gesture ──
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(4, savedS.value * e.scale));
    })
    .onEnd(() => {
      savedS.value = scale.value;
    });

  // ── Pan gesture ──
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      transX.value = savedX.value + e.translationX;
      transY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = transX.value;
      savedY.value = transY.value;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: transX.value },
      { translateY: transY.value },
      { scale: scale.value },
    ],
  }));

  // ── Slider-driven zoom ──
  const handleZoomSlider = (val: number) => {
    setZoom(val);
    const s = 1 + val * 3;
    scale.value  = withSpring(s, { damping: 20, stiffness: 180 });
    savedS.value = s;
  };

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDone(uri);
  };

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFillObject}>
      <View style={styles.root}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onCancel} style={styles.topBtn} hitSlop={14}>
            <Text style={styles.topBtnText}>İptal</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Kırp</Text>
          <TouchableOpacity onPress={handleDone} style={styles.topBtnActive} hitSlop={14}>
            <Text style={styles.topBtnActiveText}>Seç</Text>
          </TouchableOpacity>
        </View>

        {/* ── Crop area ── */}
        <View style={styles.cropArea}>

          {/* Gesture-driven image */}
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.imgWrap, imgStyle]}>
              <Image
                source={{ uri }}
                style={{ width: IMG_BASE, height: IMG_BASE }}
                resizeMode="cover"
              />
            </Animated.View>
          </GestureDetector>

          {/* SVG circular mask overlay */}
          <View style={styles.maskOverlay} pointerEvents="none">
            <Svg width={W} height={W}>
              <Defs>
                <Mask id="hole">
                  <Rect width={W} height={W} fill="white" />
                  <Circle
                    cx={W / 2}
                    cy={W / 2}
                    r={HALF_CROP - 1}
                    fill="black"
                  />
                </Mask>
              </Defs>
              <Rect
                width={W}
                height={W}
                fill="rgba(0,0,0,0.55)"
                mask="url(#hole)"
              />
            </Svg>
            {/* Circle border */}
            <Svg
              style={StyleSheet.absoluteFillObject}
              width={W}
              height={W}
            >
              <Circle
                cx={W / 2}
                cy={W / 2}
                r={HALF_CROP - 1}
                stroke="rgba(255,255,255,0.6)"
                strokeWidth={1}
                fill="none"
              />
            </Svg>
          </View>

        </View>

        {/* ── Hint ── */}
        <Text style={styles.hint}>Yakınlaştır ve konumlandır</Text>

        {/* ── Zoom slider ── */}
        <View style={styles.sliderWrap}>
          <Feather name="minimize-2" size={14} color="rgba(255,255,255,0.5)" />
          <View style={styles.sliderTrack}>
            <TouchableOpacity
              style={[styles.sliderFill, { width: `${zoom * 100}%` }]}
              activeOpacity={1}
            />
            <View
              style={[styles.sliderThumb, { left: `${zoom * 100}%` }]}
            />
            {/* Tap zones for coarse adjustment */}
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.sliderZone, { left: `${v * 100}%` }]}
                onPress={() => handleZoomSlider(v)}
                hitSlop={12}
              />
            ))}
          </View>
          <Feather name="maximize-2" size={14} color="rgba(255,255,255,0.5)" />
        </View>

        {/* ── Bottom CTA ── */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={handleDone}
          activeOpacity={0.80}
        >
          <Text style={styles.doneBtnText}>Fotoğrafı Kullan</Text>
        </TouchableOpacity>

      </View>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#111111",
    zIndex:          500,
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingTop:      60,
    paddingBottom:   52,
  },

  // ── Top bar
  topBar: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    width:             "100%",
    paddingHorizontal: 24,
    marginBottom:      24,
  },
  topBtn: {
    paddingHorizontal: 4,
    paddingVertical:   6,
    minWidth:          56,
  },
  topBtnText: {
    fontSize:   15,
    fontFamily: "Inter_400Regular",
    color:      "rgba(255,255,255,0.70)",
  },
  topTitle: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#FFFFFF",
    letterSpacing: -0.2,
  },
  topBtnActive: {
    paddingHorizontal: 4,
    paddingVertical:   6,
    minWidth:          56,
    alignItems:        "flex-end",
  },
  topBtnActiveText: {
    fontSize:   15,
    fontFamily: "Inter_600SemiBold",
    color:      "#FFFFFF",
  },

  // ── Crop area
  cropArea: {
    width:          W,
    height:         W,
    alignItems:     "center",
    justifyContent: "center",
    overflow:       "hidden",
  },
  imgWrap: {
    position: "absolute",
  },
  maskOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
  },

  // ── Hint
  hint: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.45)",
    letterSpacing: 0.3,
    marginTop:     16,
  },

  // ── Zoom slider
  sliderWrap: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 32,
    gap:               14,
    width:             "100%",
    marginTop:         12,
  },
  sliderTrack: {
    flex:            1,
    height:          3,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius:    2,
    position:        "relative",
    justifyContent:  "center",
  },
  sliderFill: {
    position:        "absolute",
    left:            0,
    top:             0,
    height:          3,
    backgroundColor: "#FFFFFF",
    borderRadius:    2,
  },
  sliderThumb: {
    position:        "absolute",
    top:             -7,
    marginLeft:      -8,
    width:           17,
    height:          17,
    borderRadius:    9,
    backgroundColor: "#FFFFFF",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.30,
    shadowRadius:    4,
    elevation:       4,
  },
  sliderZone: {
    position: "absolute",
    width:    2,
    height:   20,
    top:      -9,
    marginLeft: -1,
  },

  // ── Done button
  doneBtn: {
    backgroundColor:   "#FFFFFF",
    paddingVertical:   16,
    paddingHorizontal: 52,
    borderRadius:      30,
    marginTop:         20,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.20,
    shadowRadius:      12,
    elevation:         6,
  },
  doneBtnText: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#111111",
    letterSpacing: -0.2,
  },

});
