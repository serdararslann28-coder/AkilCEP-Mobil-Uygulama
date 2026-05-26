/**
 * Onboarding — "Silent Intelligence" cinematic intro.
 *
 * Visual system:
 *   • Pure black (#000) background — no surface color
 *   • Glowing eclipse: multi-layer concentric rings simulate soft white bloom
 *     (no shadow* dependency — cross-platform via nested border Views)
 *   • Water reflection: vertically mirrored eclipse at reduced opacity below horizon
 *   • Mountain silhouette: dark gradient overlay builds the landscape depth
 *   • Stars: 32 deterministic dots in the upper sky
 *   • All text and UI lives above the atmospheric layer
 *
 * 4 slides — horizontal FlatList with pagingEnabled.
 * After last slide: AsyncStorage flag + router.replace("/(tabs)").
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const ONBOARDING_KEY = "akilcep_onboarding_v1";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");

const { width: SW, height: SH } = Dimensions.get("window");

// ── Eclipse geometry ──────────────────────────────────────────────────────────
// Ring is 130% of screen width — extends beyond both edges for immersion.
// Center sits at 68% down the screen (below the content, above bottom edge).
const ECLIPSE_D   = SW * 1.30;
const ECLIPSE_CY  = SH * 0.70;   // center Y of eclipse circle
const ECLIPSE_TOP = ECLIPSE_CY - ECLIPSE_D / 2;
const ECLIPSE_X   = (SW - ECLIPSE_D) / 2;

// Multi-layer ring array — creates cross-platform soft bloom without shadow props
// Each entry: how much LARGER than ECLIPSE_D, border-width, border opacity
const ECLIPSE_LAYERS = [
  { extra: 120, bw: 45, op: 0.012 }, // outermost, wide soft haze
  { extra: 70,  bw: 28, op: 0.025 },
  { extra: 36,  bw: 14, op: 0.050 },
  { extra: 16,  bw:  7, op: 0.095 },
  { extra:  5,  bw:  4, op: 0.200 },
  { extra:  0,  bw:  2, op: 0.920 }, // crisp main ring
];

// Reflection: same ring set but below the center line, compressed + faded
const REFLECT_Y   = ECLIPSE_CY + ECLIPSE_D * 0.20; // top of reflected ring
const REFLECT_SCY = 0.28; // vertical compression
const REFLECT_OP  = 0.18; // overall opacity multiplier

// ── Stars ─────────────────────────────────────────────────────────────────────
// 32 deterministic positions in the upper 48% of the screen
const STARS = Array.from({ length: 32 }, (_, i) => ({
  x:    ((i * 137.508) % 100) / 100 * SW,
  y:    (20 + (i * 79.3 + 13) % 42) / 100 * SH,
  size: i % 6 < 2 ? 1.0 : i % 6 < 4 ? 1.5 : 2.0,
  op:   0.12 + (i % 7) * 0.065,
}));

// ── Slide data ────────────────────────────────────────────────────────────────
type SlideId = "intro" | "voice" | "speed" | "ready";

interface Slide {
  id:       SlideId;
  headline: string;
  body?:    string;
  tagline?: string;
  cta:      string;
  final?:   boolean;
}

const SLIDES: Slide[] = [
  {
    id:       "intro",
    headline: "AkılCEP",
    body:     "Cebindeki akıl,\nartık hep yanında.",
    tagline:  "Yapay zekayı doğal hisset.",
    cta:      "Devam Et",
  },
  {
    id:       "voice",
    headline: "Sesinle\nKontrol Et",
    body:     "Yazmak zorunda değilsin.\nAkılCEP seni dinler, anlar\nve cevap verir.",
    cta:      "Devam Et",
  },
  {
    id:       "speed",
    headline: "Hızlı.\nAkıllı. Sade.",
    body:     "Karmaşık değil. Sadece\nihtiyacın olan yapay zeka.",
    cta:      "Devam Et",
  },
  {
    id:       "ready",
    headline: "Hazırsın",
    body:     "Yeni nesil deneyim başlıyor.",
    cta:      "AkılCEP'e Gir",
    final:    true,
  },
];

// ── Feature row on intro slide ────────────────────────────────────────────────
const FEATURES = [
  { icon: "message-circle" as const, label: "Sor."    },
  { icon: "mic"            as const, label: "Konuş."  },
  { icon: "star"           as const, label: "Üret."   },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 20 : insets.top;
  const btmPad  = Platform.OS === "web" ? 34 : insets.bottom;

  const listRef     = useRef<FlatList>(null);
  const [active, setActive] = useState(0);

  // ── Eclipse breathing — scale + glow ────────────────────────────────────────
  const eclipseScale = useSharedValue(1);
  const eclipseOp    = useSharedValue(0);

  useEffect(() => {
    // Fade in eclipse
    eclipseOp.value = withDelay(400, withTiming(1, { duration: 1200 }));
    // Breathing pulse
    eclipseScale.value = withDelay(600, withRepeat(
      withSequence(
        withTiming(1.018, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.982, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    ));
  }, []);

  const eclipseStyle = useAnimatedStyle(() => ({
    opacity:   eclipseOp.value,
    transform: [{ scale: eclipseScale.value }],
  }));

  // ── Slide tracking ──────────────────────────────────────────────────────────
  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setActive(viewableItems[0].index ?? 0);
  });
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  // ── Navigation ──────────────────────────────────────────────────────────────
  const complete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    } catch {}
    router.replace("/(tabs)");
  }, []);

  const next = useCallback(() => {
    Haptics.selectionAsync();
    if (active < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: active + 1, animated: true });
    } else {
      complete();
    }
  }, [active, complete]);

  const skip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    complete();
  }, [complete]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>
      <StatusBar style="light" />

      {/* ── ATMOSPHERIC BACKGROUND (shared, position:absolute) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">

        {/* Stars */}
        {STARS.map((s, i) => (
          <View
            key={i}
            style={[
              ss.star,
              {
                left:    s.x,
                top:     s.y,
                width:   s.size,
                height:  s.size,
                borderRadius: s.size / 2,
                opacity: s.op,
              },
            ]}
          />
        ))}

        {/* Eclipse + reflection */}
        <Animated.View style={[ss.eclipseWrap, eclipseStyle]}>

          {/* Reflection first (below horizon) */}
          <View style={[
            ss.reflectWrap,
            {
              top:  REFLECT_Y,
              left: ECLIPSE_X,
              width: ECLIPSE_D,
              height: ECLIPSE_D,
              transform: [{ scaleY: REFLECT_SCY }],
              opacity: REFLECT_OP,
            },
          ]}>
            {ECLIPSE_LAYERS.map((l, i) => {
              const d  = ECLIPSE_D + l.extra;
              const off = -l.extra / 2;
              return (
                <View
                  key={i}
                  style={{
                    position:     "absolute",
                    top:          off,
                    left:         off,
                    width:        d,
                    height:       d,
                    borderRadius: d / 2,
                    borderWidth:  l.bw,
                    borderColor:  `rgba(255,255,255,${l.op})`,
                  }}
                />
              );
            })}
          </View>

          {/* Main eclipse rings */}
          {ECLIPSE_LAYERS.map((l, i) => {
            const d  = ECLIPSE_D + l.extra;
            const off = ECLIPSE_X - l.extra / 2;
            return (
              <View
                key={i}
                style={{
                  position:     "absolute",
                  top:          ECLIPSE_TOP - l.extra / 2,
                  left:         off,
                  width:        d,
                  height:       d,
                  borderRadius: d / 2,
                  borderWidth:  l.bw,
                  borderColor:  `rgba(255,255,255,${l.op})`,
                }}
              />
            );
          })}

        </Animated.View>

        {/* Landscape gradient — builds the dark mountain silhouette feel */}
        <LinearGradient
          colors={[
            "transparent",
            "rgba(0,0,0,0.30)",
            "rgba(0,0,0,0.72)",
            "#000000",
          ]}
          locations={[0.40, 0.60, 0.78, 1.0]}
          style={StyleSheet.absoluteFill}
        />

        {/* Sky vignette — darkens edges for cinematic framing */}
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent", "transparent"]}
          locations={[0, 0.28, 1]}
          style={StyleSheet.absoluteFill}
        />

      </View>

      {/* ── TOP CONTROLS: skip button ── */}
      <View style={[ss.topBar, { paddingTop: topPad + 8 }]}>
        <View style={{ flex: 1 }} />
        {active < SLIDES.length - 1 && (
          <TouchableOpacity
            style={ss.skipBtn}
            onPress={skip}
            hitSlop={16}
            activeOpacity={0.60}
          >
            <Text style={ss.skipText}>Atla</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── SLIDES ── */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={s => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEnabled
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfig.current}
        style={ss.list}
        renderItem={({ item, index }) => (
          <SlideContent
            slide={item}
            index={index}
            active={active}
            topPad={topPad}
          />
        )}
      />

      {/* ── BOTTOM: dots + CTA ── */}
      <View style={[ss.bottom, { paddingBottom: btmPad + 16 }]}>

        {/* Dot indicators */}
        <View style={ss.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                ss.dot,
                i === active ? ss.dotActive : ss.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity
          style={[
            ss.cta,
            SLIDES[active]?.final ? ss.ctaFinal : ss.ctaGhost,
          ]}
          onPress={next}
          activeOpacity={0.80}
        >
          <Text style={[
            ss.ctaText,
            SLIDES[active]?.final ? ss.ctaTextFinal : ss.ctaTextGhost,
          ]}>
            {SLIDES[active]?.cta}
          </Text>
          <Feather
            name="arrow-right"
            size={16}
            color={SLIDES[active]?.final ? "#000000" : "rgba(255,255,255,0.90)"}
          />
        </TouchableOpacity>

      </View>

    </View>
  );
}

// ─── SlideContent ─────────────────────────────────────────────────────────────
// Each slide's text content. Fades in when it becomes the active slide.
function SlideContent({
  slide,
  index,
  active,
}: {
  slide:   Slide;
  index:   number;
  active:  number;
  topPad:  number;
}) {
  const op = useSharedValue(index === 0 ? 0 : 0);
  const ty = useSharedValue(index === 0 ? 16 : 16);

  useEffect(() => {
    if (index === active) {
      op.value = withDelay(60,  withTiming(1,  { duration: 520, easing: Easing.out(Easing.ease) }));
      ty.value = withDelay(60,  withTiming(0,  { duration: 480, easing: Easing.out(Easing.cubic) }));
    } else {
      op.value = withTiming(0, { duration: 200 });
      ty.value = withTiming(16, { duration: 200 });
    }
  }, [active]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity:   op.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <View style={ss.slide}>
      <Animated.View style={[ss.slideInner, contentStyle]}>

        {/* ── SLIDE: intro ── */}
        {slide.id === "intro" && (
          <>
            <Text style={ss.headlineXL}>{slide.headline}</Text>
            <Text style={ss.bodyLg}>{slide.body}</Text>

            {/* Feature row */}
            <View style={ss.featureRow}>
              {FEATURES.map((f) => (
                <View key={f.label} style={ss.featureItem}>
                  <View style={ss.featureIconWrap}>
                    <Feather name={f.icon} size={20} color="rgba(255,255,255,0.82)" />
                  </View>
                  <Text style={ss.featureLabel}>{f.label}</Text>
                </View>
              ))}
            </View>

            {slide.tagline && (
              <Text style={ss.tagline}>{slide.tagline}</Text>
            )}
          </>
        )}

        {/* ── SLIDE: voice or speed ── */}
        {(slide.id === "voice" || slide.id === "speed") && (
          <>
            <Text style={ss.headlineXL}>{slide.headline}</Text>
            {slide.body && <Text style={ss.bodyMd}>{slide.body}</Text>}
          </>
        )}

        {/* ── SLIDE: ready ── */}
        {slide.id === "ready" && (
          <>
            <Image
              source={leafLogo}
              style={ss.readyLogo}
              tintColor="rgba(255,255,255,0.90)"
              resizeMode="contain"
            />
            <Text style={ss.headlineXL}>{slide.headline}</Text>
            {slide.body && <Text style={ss.bodyMd}>{slide.body}</Text>}
          </>
        )}

      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#000000",
  },

  // ── Stars
  star: {
    position:        "absolute",
    backgroundColor: "#FFFFFF",
  },

  // ── Eclipse container — full-screen absolute
  eclipseWrap: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Reflection wrapper
  reflectWrap: {
    position:     "absolute",
    transformOrigin: "top center",  // pivot from top so it appears below horizon
  },

  // ── Top bar
  topBar: {
    position:          "absolute",
    top:               0,
    left:              0,
    right:             0,
    zIndex:            10,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 24,
    paddingBottom:     10,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  skipText: {
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.42)",
    letterSpacing: -0.1,
  },

  // ── FlatList
  list: {
    flex: 1,
  },

  // ── Each slide
  slide: {
    width:           SW,
    flex:            1,
    justifyContent:  "flex-end",
    paddingBottom:   180,   // content sits above CTA area
  },
  slideInner: {
    paddingHorizontal: 32,
    gap:               18,
  },

  // ── Typography
  headlineXL: {
    fontSize:      42,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -1.2,
    lineHeight:    50,
  },
  bodyLg: {
    fontSize:      18,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.60)",
    lineHeight:    28,
    letterSpacing: -0.2,
  },
  bodyMd: {
    fontSize:      16,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.55)",
    lineHeight:    26,
    letterSpacing: -0.1,
  },
  tagline: {
    fontSize:      15,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.38)",
    letterSpacing: -0.1,
    marginTop:     4,
  },

  // ── Feature row (intro slide)
  featureRow: {
    flexDirection: "row",
    gap:           28,
    marginTop:     6,
    marginBottom:  4,
  },
  featureItem: {
    alignItems: "center",
    gap:        8,
  },
  featureIconWrap: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.12)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  featureLabel: {
    fontSize:   13,
    fontFamily: "Inter_500Medium",
    color:      "rgba(255,255,255,0.55)",
  },

  // ── Ready slide logo
  readyLogo: {
    width:       64,
    height:      64,
    marginBottom: 4,
  },

  // ── Bottom area
  bottom: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 28,
    gap:               24,
    zIndex:            10,
  },

  // ── Dot indicators
  dots: {
    flexDirection:  "row",
    justifyContent: "center",
    gap:            6,
  },
  dot: {
    height:       3,
    borderRadius: 2,
  },
  dotActive: {
    width:           24,
    backgroundColor: "rgba(255,255,255,0.90)",
  },
  dotInactive: {
    width:           6,
    backgroundColor: "rgba(255,255,255,0.22)",
  },

  // ── CTA button
  cta: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               10,
    paddingVertical:   17,
    borderRadius:      60,
  },
  ctaGhost: {
    backgroundColor: "rgba(255,255,255,0.00)",
    borderWidth:     1.2,
    borderColor:     "rgba(255,255,255,0.32)",
  },
  ctaFinal: {
    backgroundColor: "#FFFFFF",
    borderWidth:     0,
  },
  ctaText: {
    fontSize:      17,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.2,
  },
  ctaTextGhost: {
    color: "rgba(255,255,255,0.88)",
  },
  ctaTextFinal: {
    color: "#000000",
  },
});
