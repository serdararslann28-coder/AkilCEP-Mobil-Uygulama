/**
 * Onboarding — 4-page swipeable intro.
 *
 * Each artwork image is used as a true fullscreen background (resizeMode cover).
 * Artwork is never modified. Functional chrome is layered on top:
 * animated dot indicators, Skip button, action buttons.
 */
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  ImageSourcePropType,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── AsyncStorage key — imported by splash.tsx and auth.tsx ───────────────────
export const ONBOARDING_KEY = "@akilcep_onboarding_done";

// ── Screen artwork (4 individual portrait images) ─────────────────────────────
const IMAGES: ImageSourcePropType[] = [
  require("../assets/images/onboarding-1.jpg"),
  require("../assets/images/onboarding-2.jpg"),
  require("../assets/images/onboarding-3.jpg"),
  require("../assets/images/onboarding-4.jpg"),
];

const NUM_SCREENS               = IMAGES.length;
const { width: SW, height: SH } = Dimensions.get("window");

// ── Per-screen UI config ──────────────────────────────────────────────────────
interface ScreenCfg {
  showSkip:     boolean;
  buttonLabel?: string;
  isFinal?:     boolean;
}

const SCREENS: ScreenCfg[] = [
  { showSkip: true,  buttonLabel: "Devam Et" },
  { showSkip: true,  buttonLabel: "Devam Et" },
  { showSkip: true,  buttonLabel: "Devam Et" },
  { showSkip: false, buttonLabel: "AkılCEP'e Gir", isFinal: true },
];

// ── Animated dot ──────────────────────────────────────────────────────────────
function Dot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const r    = [(index - 1) * SW, index * SW, (index + 1) * SW];
    const size = interpolate(scrollX.value, r, [7, 9, 7],       Extrapolation.CLAMP);
    const opac = interpolate(scrollX.value, r, [0.28, 1, 0.28], Extrapolation.CLAMP);
    return { width: size, height: size, opacity: opac };
  });
  return <Animated.View style={[ss.dot, style]} />;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const insets  = useSafeAreaInsets();
  const listRef = useRef<FlatList<number>>(null);
  const [idx, setIdx] = useState(0);
  const scrollX = useSharedValue(0);

  const goNext = useCallback(() => {
    if (idx < NUM_SCREENS - 1)
      listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
  }, [idx]);

  const goSkip = useCallback(() => {
    listRef.current?.scrollToIndex({ index: NUM_SCREENS - 1, animated: true });
  }, []);

  const goApp = useCallback(() => {
    router.replace("/chat");
  }, []);

  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) setIdx(viewableItems[0].index ?? 0);
    },
    [],
  );

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      scrollX.value = e.nativeEvent.contentOffset.x;
    },
    [scrollX],
  );

  const renderItem = useCallback(
    ({ item: pageIdx }: { item: number }) => {
      const cfg    = SCREENS[pageIdx];
      const topPad = Platform.OS === "web" ? 20 : insets.top;
      const btmPad = Platform.OS === "web" ? 34 : insets.bottom;

      return (
        <View style={ss.page}>

          {/* Fullscreen artwork — cover fills and centers on every screen size */}
          <Image
            source={IMAGES[pageIdx]}
            style={ss.image}
            resizeMode="cover"
          />

          {/* Skip — top right */}
          {cfg.showSkip && (
            <TouchableOpacity
              style={[ss.skip, { top: topPad + 14 }]}
              onPress={goSkip}
              hitSlop={14}
              activeOpacity={0.55}
            >
              <Text style={ss.skipText}>Atla</Text>
            </TouchableOpacity>
          )}

          {/* Button — anchored to safe-area bottom */}
          <View style={[ss.btnBar, { bottom: btmPad + 20 }]}>
            {cfg.isFinal ? (
              <TouchableOpacity style={ss.btnOutlined} onPress={goApp} activeOpacity={0.80}>
                <Text style={ss.btnLabelOutlined}>{cfg.buttonLabel}</Text>
                <Text style={ss.btnArrowOutlined}> →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={ss.btnSolid} onPress={goNext} activeOpacity={0.80}>
                <Text style={ss.btnLabelSolid}>{cfg.buttonLabel}</Text>
                <Text style={ss.btnArrowSolid}> →</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Dots — 46px above button top edge (BTN_H≈56 + 46 gap = 102) */}
          <View style={[ss.dotsBar, { bottom: btmPad + 20 + 56 + 46 }]}>
            {SCREENS.map((_, i) => (
              <Dot key={i} index={i} scrollX={scrollX} />
            ))}
          </View>

          {/* Scrim — only behind button + dots zone, not over description */}
          <View style={[ss.scrim, { height: btmPad + 20 + 56 + 46 + 9 + 28 }]} />

        </View>
      );
    },
    [insets, scrollX, goNext, goSkip, goApp],
  );

  return (
    <FlatList
      ref={listRef}
      data={Array.from({ length: NUM_SCREENS }, (_, i) => i)}
      renderItem={renderItem}
      keyExtractor={(i) => String(i)}
      horizontal
      pagingEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const BUTTON_W = SW - 56;

const ss = StyleSheet.create({

  page: {
    width:           SW,
    height:          SH,
    overflow:        "hidden",
    backgroundColor: "#000000",
  },

  // Explicit pixel dimensions + cover = perfectly centered on every device.
  image: {
    position: "absolute",
    top:      0,
    left:     0,
    width:    SW,
    height:   SH,
  },

  skip: {
    position: "absolute",
    right:    22,
    zIndex:   10,
  },
  skipText: {
    fontSize:      15,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.85)",
    letterSpacing: -0.1,
  },

  // Button row — absolute, bottom edge anchored to safe area
  btnBar: {
    position:       "absolute",
    left:           0,
    right:          0,
    alignItems:     "center",
  },

  // Dots row — absolute, sits exactly 46px above the button top edge
  dotsBar: {
    position:       "absolute",
    left:           0,
    right:          0,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
  },

  dot: {
    borderRadius:    99,
    backgroundColor: "#FFFFFF",
  },

  // Scrim covers only the button + dots zone — description stays unobscured
  scrim: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: "rgba(0,0,0,0.30)",
  },

  btnSolid: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    backgroundColor:   "#FFFFFF",
    borderRadius:      50,
    paddingHorizontal: 32,
    paddingVertical:   16,
    width:             BUTTON_W,
  },
  btnLabelSolid: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#000000",
    letterSpacing: -0.3,
  },
  btnArrowSolid: {
    fontSize:   16,
    fontFamily: "Inter_600SemiBold",
    color:      "#000000",
  },

  btnOutlined: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    backgroundColor:   "rgba(0,0,0,0.40)",
    borderWidth:       1.5,
    borderColor:       "rgba(255,255,255,0.75)",
    borderRadius:      50,
    paddingHorizontal: 32,
    paddingVertical:   16,
    width:             BUTTON_W,
  },
  btnLabelOutlined: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#FFFFFF",
    letterSpacing: -0.3,
  },
  btnArrowOutlined: {
    fontSize:   16,
    fontFamily: "Inter_600SemiBold",
    color:      "#FFFFFF",
  },
});
