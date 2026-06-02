/**
 * Onboarding — 5-page swipeable intro.
 *
 * The composite artwork image is sliced horizontally: each page shows
 * its 1/5 section as a true fullscreen background. The artwork is never
 * altered — only UI chrome is added (dots, buttons, skip).
 *
 * Slice logic:
 *   - Source: 5 portrait phone screens side-by-side in one PNG.
 *   - Scale the full image so each 1/5 section equals screen width.
 *   - Per-page: translate the image left by (SW × pageIndex) to reveal
 *     the correct section inside an overflow:hidden container.
 */
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
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

// ── AsyncStorage key (imported by splash.tsx and auth.tsx) ───────────────────
export const ONBOARDING_KEY = "@akilcep_onboarding_done";

// ── Composite artwork ─────────────────────────────────────────────────────────
const SOURCE = require("../assets/images/onboarding-composite.png");

const NUM_SCREENS                       = 5;
const { width: SW, height: SH }        = Dimensions.get("window");

// ── Per-screen config ─────────────────────────────────────────────────────────
interface ScreenCfg {
  showSkip:    boolean;
  showButton:  boolean;
  buttonLabel?: string;
  isFinal?:    boolean;
}

const SCREENS: ScreenCfg[] = [
  { showSkip: false, showButton: false },
  { showSkip: false, showButton: true,  buttonLabel: "Devam Et" },
  { showSkip: true,  showButton: true,  buttonLabel: "Devam Et" },
  { showSkip: true,  showButton: true,  buttonLabel: "Devam Et" },
  { showSkip: false, showButton: true,  buttonLabel: "AkılCEP'e Gir", isFinal: true },
];

// ── Animated dot ──────────────────────────────────────────────────────────────
function Dot({
  index,
  scrollX,
}: {
  index:   number;
  scrollX: SharedValue<number>;
}) {
  const anim = useAnimatedStyle(() => {
    const range  = [(index - 1) * SW, index * SW, (index + 1) * SW];
    const width  = interpolate(scrollX.value, range, [6, 24, 6],    Extrapolation.CLAMP);
    const opac   = interpolate(scrollX.value, range, [0.28, 1, 0.28], Extrapolation.CLAMP);
    return { width, opacity: opac };
  });
  return <Animated.View style={[ss.dot, anim]} />;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Onboarding() {
  const insets      = useSafeAreaInsets();
  const listRef     = useRef<FlatList<number>>(null);
  const [idx, setIdx] = useState(0);
  const scrollX     = useSharedValue(0);

  // Resolve source dimensions from bundled asset metadata (synchronous).
  const asset   = Image.resolveAssetSource(SOURCE);
  const IMG_W   = asset.width  || 1600;
  const IMG_H   = asset.height || 700;

  // Scale so each 1/5 section fills screen width.
  const scale    = SW / (IMG_W / NUM_SCREENS);
  const scaledW  = IMG_W * scale;
  const scaledH  = IMG_H * scale;
  // Vertical offset to center the scaled image on the screen.
  const topOff   = (SH - scaledH) / 2;

  // ── Actions ───────────────────────────────────────────────────────────────
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

  // ── Viewability ───────────────────────────────────────────────────────────
  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) setIdx(viewableItems[0].index ?? 0);
    },
    [],
  );
  const viewConfig = { viewAreaCoveragePercentThreshold: 50 };

  // ── Scroll → SharedValue ──────────────────────────────────────────────────
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

          {/* Artwork slice — full-screen, no modifications */}
          <View style={StyleSheet.absoluteFillObject}>
            <Image
              source={SOURCE}
              style={[
                ss.artwork,
                {
                  width:  scaledW,
                  height: scaledH,
                  left:   -(SW * pageIdx),
                  top:    topOff,
                },
              ]}
              resizeMode="stretch"
            />
          </View>

          {/* Skip */}
          {cfg.showSkip && (
            <TouchableOpacity
              style={[ss.skip, { top: topPad + 14 }]}
              onPress={goSkip}
              hitSlop={12}
              activeOpacity={0.60}
            >
              <Text style={ss.skipText}>Atla</Text>
            </TouchableOpacity>
          )}

          {/* Dots + button */}
          <View style={[ss.bottom, { paddingBottom: btmPad + 24 }]}>
            <View style={ss.dots}>
              {SCREENS.map((_, i) => (
                <Dot key={i} index={i} scrollX={scrollX} />
              ))}
            </View>

            {cfg.showButton && (
              <TouchableOpacity
                style={ss.btn}
                onPress={cfg.isFinal ? goApp : goNext}
                activeOpacity={0.82}
              >
                <Text style={ss.btnLabel}>{cfg.buttonLabel}</Text>
                <Text style={ss.btnArrow}> →</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      );
    },
    [insets, scaledW, scaledH, topOff, scrollX, goNext, goSkip, goApp],
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
const ss = StyleSheet.create({
  page: {
    width:    SW,
    height:   SH,
    overflow: "hidden",
  },

  // Positioned absolutely; left + top set per page via inline style.
  artwork: {
    position: "absolute",
  },

  // Skip button — top right
  skip: {
    position: "absolute",
    right:    22,
    zIndex:   10,
  },
  skipText: {
    fontSize:      15,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.78)",
    letterSpacing: -0.2,
  },

  // Bottom chrome
  bottom: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    alignItems:      "center",
    gap:             20,
    paddingTop:      28,
    // Subtle dark scrim so dots/button stay legible over any artwork
    backgroundColor: "rgba(0,0,0,0.22)",
  },

  // Dots row
  dots: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            7,
  },
  dot: {
    height:          6,
    borderRadius:    3,
    backgroundColor: "#FFFFFF",
  },

  // Action button — white pill, black text (matches the artwork design)
  btn: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    backgroundColor:   "#FFFFFF",
    borderRadius:      50,
    paddingHorizontal: 36,
    paddingVertical:   16,
    width:             SW - 56,
  },
  btnLabel: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#000000",
    letterSpacing: -0.3,
  },
  btnArrow: {
    fontSize:   16,
    fontFamily: "Inter_600SemiBold",
    color:      "#000000",
  },
});
