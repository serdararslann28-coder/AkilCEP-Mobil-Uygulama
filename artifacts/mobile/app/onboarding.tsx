/**
 * Onboarding — 5-page swipeable intro.
 *
 * Each of the 5 artwork images is used as a true fullscreen background
 * (resizeMode "cover"). No artwork is modified. Functional chrome is layered
 * on top: animated dot indicators, Skip button, action buttons.
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

// ── Screen artwork (individual portrait images) ───────────────────────────────
const IMAGES: ImageSourcePropType[] = [
  require("../assets/images/onboarding-1.jpg"),
  require("../assets/images/onboarding-2.jpg"),
  require("../assets/images/onboarding-3.jpg"),
  require("../assets/images/onboarding-4.jpg"),
  require("../assets/images/onboarding-5.jpg"),
];

const NUM_SCREENS                   = IMAGES.length;
const { width: SW, height: SH }    = Dimensions.get("window");

// ── Per-screen UI config ──────────────────────────────────────────────────────
interface ScreenCfg {
  showSkip:     boolean;
  buttonLabel?: string;
  isFinal?:     boolean;   // uses outlined button style
}

const SCREENS: ScreenCfg[] = [
  { showSkip: true },
  { showSkip: true,  buttonLabel: "Devam Et" },
  { showSkip: true,  buttonLabel: "Devam Et" },
  { showSkip: true,  buttonLabel: "Devam Et" },
  { showSkip: false, buttonLabel: "AkılCEP'e Gir", isFinal: true },
];

// ── Dot indicator ─────────────────────────────────────────────────────────────
function Dot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const range  = [(index - 1) * SW, index * SW, (index + 1) * SW];
    const size   = interpolate(scrollX.value, range, [7, 9, 7],     Extrapolation.CLAMP);
    const opac   = interpolate(scrollX.value, range, [0.30, 1, 0.30], Extrapolation.CLAMP);
    return {
      width:    size,
      height:   size,
      opacity:  opac,
    };
  });
  return <Animated.View style={[ss.dot, style]} />;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Onboarding() {
  const insets   = useSafeAreaInsets();
  const listRef  = useRef<FlatList<number>>(null);
  const [idx, setIdx] = useState(0);
  const scrollX  = useSharedValue(0);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (idx < NUM_SCREENS - 1) {
      listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
    }
  }, [idx]);

  const goSkip = useCallback(() => {
    listRef.current?.scrollToIndex({ index: NUM_SCREENS - 1, animated: true });
  }, []);

  const goApp = useCallback(() => {
    router.replace("/chat");
  }, []);

  // ── FlatList callbacks ────────────────────────────────────────────────────
  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) setIdx(viewableItems[0].index ?? 0);
    },
    [],
  );

  const viewConfig = { viewAreaCoveragePercentThreshold: 50 };

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      scrollX.value = e.nativeEvent.contentOffset.x;
    },
    [scrollX],
  );

  // ── Page renderer ─────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item: pageIdx }: { item: number }) => {
      const cfg    = SCREENS[pageIdx];
      const topPad = Platform.OS === "web" ? 20 : insets.top;
      const btmPad = Platform.OS === "web" ? 34 : insets.bottom;

      return (
        <View style={ss.page}>

          {/* Full-screen artwork — unchanged, cover fills the entire screen */}
          <Image
            source={IMAGES[pageIdx]}
            style={StyleSheet.absoluteFillObject}
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

          {/* Bottom chrome — dots + optional action button */}
          <View style={[ss.bottom, { paddingBottom: btmPad + 20 }]}>

            {/* Dot indicators */}
            <View style={ss.dots}>
              {SCREENS.map((_, i) => (
                <Dot key={i} index={i} scrollX={scrollX} />
              ))}
            </View>

            {/* Action button — only shown when configured */}
            {cfg.buttonLabel && (
              cfg.isFinal ? (
                // Screen 5: outlined dark pill
                <TouchableOpacity
                  style={ss.btnOutlined}
                  onPress={goApp}
                  activeOpacity={0.78}
                >
                  <Text style={ss.btnLabelOutlined}>{cfg.buttonLabel}</Text>
                  <Text style={ss.btnArrowOutlined}> →</Text>
                </TouchableOpacity>
              ) : (
                // Screens 2–4: solid white pill
                <TouchableOpacity
                  style={ss.btnSolid}
                  onPress={goNext}
                  activeOpacity={0.78}
                >
                  <Text style={ss.btnLabelSolid}>{cfg.buttonLabel}</Text>
                  <Text style={ss.btnArrowSolid}> →</Text>
                </TouchableOpacity>
              )
            )}

          </View>

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
      viewabilityConfig={viewConfig}
      getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const BUTTON_W = SW - 56;

const ss = StyleSheet.create({

  // Each page is exactly screen-sized; image fills it with cover.
  page: {
    width:    SW,
    height:   SH,
    overflow: "hidden",
  },

  // Skip — top right corner
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

  // Bottom chrome wrapper
  bottom: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    alignItems:      "center",
    gap:             18,
    paddingTop:      24,
    // Subtle scrim so dots/button read well on any artwork
    backgroundColor: "rgba(0,0,0,0.18)",
  },

  // Dots row
  dots: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
  },
  dot: {
    borderRadius:    99,
    backgroundColor: "#FFFFFF",
  },

  // Solid white pill (screens 2–4)
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

  // Outlined dark pill (screen 5 — "AkılCEP'e Gir")
  btnOutlined: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    backgroundColor:   "rgba(0,0,0,0.35)",
    borderWidth:       1.5,
    borderColor:       "rgba(255,255,255,0.80)",
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
