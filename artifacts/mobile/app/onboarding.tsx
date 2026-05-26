/**
 * Onboarding — custom Reanimated gesture pager.
 *
 * Architecture:
 *   • Fixed atmospheric background (eclipse, stars, fog) — never moves.
 *   • Slide contents are all stacked at the same position; each cross-fades
 *     in/out via `interpolate(progress)` — no full-screen scroll track.
 *   • Parallax: headline moves at 22 % swipe speed, body at 14 % — creates depth.
 *   • Pan gesture: rubber-bands at both edges. Snaps with a tight spring.
 *   • Dot indicators animate from narrow pill (inactive) to wide pill (active).
 *   • Each slide has a unique minimal illustration.
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
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const ONBOARDING_KEY = "akilcep_onboarding_v1";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");

const { width: SW, height: SH } = Dimensions.get("window");

// ── Spring config — tight, minimal bounce. Luxury feel. ───────────────────────
const SPRING = { stiffness: 280, damping: 38, mass: 0.90 };

// ── Eclipse geometry (matches splash for visual continuity) ───────────────────
const ECLIPSE_D  = SW * 1.30;
const ECLIPSE_CY = SH * 0.72;
const ECLIPSE_X  = (SW - ECLIPSE_D) / 2;

const ECLIPSE_LAYERS = [
  { extra: 120, bw: 44, op: 0.010 },
  { extra: 70,  bw: 27, op: 0.022 },
  { extra: 36,  bw: 14, op: 0.048 },
  { extra: 16,  bw:  7, op: 0.090 },
  { extra:  5,  bw:  4, op: 0.195 },
  { extra:  0,  bw:  2, op: 0.920 },
];

const REFLECT_SCY = 0.28;
const REFLECT_OP  = 0.18;
const REFLECT_TOP = ECLIPSE_CY + ECLIPSE_D * 0.19;

// Stars — deterministic golden-angle distribution
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
  body:     string;
  cta:      string;
  final?:   boolean;
}

const SLIDES: Slide[] = [
  {
    id:       "intro",
    headline: "AkılCEP",
    body:     "Cebindeki akıl, artık hep yanında.",
    cta:      "Devam Et",
  },
  {
    id:       "voice",
    headline: "Sesinle\nKontrol Et",
    body:     "Yazmak zorunda değilsin. AkılCEP seni dinler, anlar ve cevap verir.",
    cta:      "Devam Et",
  },
  {
    id:       "speed",
    headline: "Hızlı.\nAkıllı. Sade.",
    body:     "Karmaşık değil. Sadece ihtiyacın olan yapay zeka.",
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

// ── Voice bar heights — simulates an audio waveform signature ─────────────────
const BAR_HEIGHTS = [0.42, 0.72, 0.54, 0.96, 0.62, 0.80, 0.44, 0.68, 0.38];
const SPEED_LINES  = [
  { w: 0.62, op: 0.80 },
  { w: 0.38, op: 0.50 },
  { w: 0.78, op: 0.65 },
];

// ═════════════════════════════════════════════════════════════════════════════
// FIXED ATMOSPHERIC BACKGROUND
// ═════════════════════════════════════════════════════════════════════════════
function EclipseBackground() {
  const eclipseScale = useSharedValue(1);
  const rippleX      = useSharedValue(1);
  const rippleOp     = useSharedValue(1);

  useEffect(() => {
    // Slow breathing pulse
    eclipseScale.value = withRepeat(
      withSequence(
        withTiming(1.016, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.984, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
    // Water ripple
    rippleX.value = withRepeat(
      withSequence(
        withTiming(1.014, { duration: 2100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.988, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.008, { duration: 2300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.996, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
    rippleOp.value = withRepeat(
      withSequence(
        withTiming(0.78, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.00, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);

  const eclipseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: eclipseScale.value }],
  }));

  const reflectStyle = useAnimatedStyle(() => ({
    opacity:   rippleOp.value * REFLECT_OP,
    transform: [
      { scaleY: REFLECT_SCY },
      { scaleX: rippleX.value },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">

      {/* Stars */}
      {STARS.map((s, i) => (
        <View
          key={i}
          style={[ss.star, {
            left: s.x, top: s.y,
            width: s.size, height: s.size,
            borderRadius: s.size / 2,
            opacity: s.op,
          }]}
        />
      ))}

      {/* Eclipse rings */}
      <Animated.View style={[StyleSheet.absoluteFill, eclipseStyle]}>
        {ECLIPSE_LAYERS.map((l, i) => {
          const d = ECLIPSE_D + l.extra;
          return (
            <View
              key={i}
              style={{
                position:     "absolute",
                top:          ECLIPSE_CY - d / 2,
                left:         ECLIPSE_X - l.extra / 2,
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

      {/* Reflection */}
      <Animated.View
        style={[{
          position: "absolute",
          top:      REFLECT_TOP,
          left:     ECLIPSE_X,
          width:    ECLIPSE_D,
          height:   ECLIPSE_D,
        }, reflectStyle]}
      >
        {ECLIPSE_LAYERS.map((l, i) => {
          const d = ECLIPSE_D + l.extra;
          return (
            <View
              key={i}
              style={{
                position:     "absolute",
                top:          -l.extra / 2,
                left:         -l.extra / 2,
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

      {/* Fog column behind eclipse */}
      <LinearGradient
        colors={["transparent", "rgba(255,255,255,0.016)", "rgba(255,255,255,0.032)", "transparent"]}
        locations={[0, 0.35, 0.60, 1.0]}
        style={[StyleSheet.absoluteFill, { top: SH * 0.42 }]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
      />

      {/* Landscape depth gradient */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.28)", "rgba(0,0,0,0.70)", "#000000"]}
        locations={[0.40, 0.58, 0.78, 1.0]}
        style={StyleSheet.absoluteFill}
      />

      {/* Sky vignette */}
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "transparent"]}
        locations={[0, 0.30]}
        style={StyleSheet.absoluteFill}
      />

    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE ILLUSTRATIONS
// ═════════════════════════════════════════════════════════════════════════════
function IntroIllustration() {
  const FEATURES = [
    { icon: "message-circle" as const, label: "Sor."    },
    { icon: "mic"            as const, label: "Konuş."  },
    { icon: "star"           as const, label: "Üret."   },
  ];
  return (
    <View style={ss.illustration}>
      <View style={ss.featureRow}>
        {FEATURES.map(f => (
          <View key={f.label} style={ss.featureChip}>
            <Feather name={f.icon} size={18} color="rgba(255,255,255,0.72)" />
            <Text style={ss.featureLabel}>{f.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function VoiceIllustration({ active }: { active: boolean }) {
  const bars = BAR_HEIGHTS.map((h, i) => {
    const sv = useSharedValue(h);
    useEffect(() => {
      if (active) {
        sv.value = withDelay(i * 90,
          withRepeat(
            withSequence(
              withTiming(h * 0.38, { duration: 380 + i * 40, easing: Easing.inOut(Easing.ease) }),
              withTiming(h,        { duration: 420 + i * 30, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, false,
          ),
        );
      } else {
        sv.value = withTiming(h, { duration: 400 });
      }
    }, [active]);
    const barStyle = useAnimatedStyle(() => ({
      height: sv.value * 56,
    }));
    return (
      <Animated.View
        key={i}
        style={[ss.voiceBar, barStyle, { opacity: 0.55 + (h - 0.38) * 0.55 }]}
      />
    );
  });
  return (
    <View style={ss.illustration}>
      <View style={ss.voiceBarsWrap}>{bars}</View>
    </View>
  );
}

function SpeedIllustration() {
  return (
    <View style={ss.illustration}>
      <View style={ss.speedLines}>
        {SPEED_LINES.map((l, i) => (
          <View
            key={i}
            style={[
              ss.speedLine,
              { width: SW * l.w, opacity: l.op },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function ReadyIllustration() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.94, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  return (
    <View style={ss.illustration}>
      <Animated.View style={logoStyle}>
        <Image
          source={leafLogo}
          style={ss.readyLogo}
          tintColor="rgba(255,255,255,0.88)"
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE CONTENT — cross-fades + parallax via progress interpolation
// ═════════════════════════════════════════════════════════════════════════════
function SlideContent({
  slide,
  index,
  progress,
  active,
}: {
  slide:    Slide;
  index:    number;
  progress: SharedValue<number>;
  active:   boolean;
}) {
  // Fade: full at center (index), 0 at ±0.65 away
  const contentStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = interpolate(p, [index - 0.65, index, index + 0.65], [0, 1, 0], "clamp");
    // Parallax: content drifts slightly opposite to swipe direction
    const px = interpolate(p, [index - 1, index, index + 1], [SW * 0.22, 0, -SW * 0.22], "clamp");
    return { opacity, transform: [{ translateX: px }] };
  });

  // Body text parallax — slower than headline
  const bodyStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = interpolate(p, [index - 0.55, index, index + 0.55], [0, 1, 0], "clamp");
    const px = interpolate(p, [index - 1, index, index + 1], [SW * 0.14, 0, -SW * 0.14], "clamp");
    return { opacity, transform: [{ translateX: px }] };
  });

  return (
    <View style={ss.slideAbs} pointerEvents="none">
      <View style={ss.slideInner}>

        {/* Illustration */}
        <Animated.View style={contentStyle}>
          {slide.id === "intro"  && <IntroIllustration />}
          {slide.id === "voice"  && <VoiceIllustration active={active} />}
          {slide.id === "speed"  && <SpeedIllustration />}
          {slide.id === "ready"  && <ReadyIllustration />}
        </Animated.View>

        {/* Headline — faster parallax */}
        <Animated.Text style={[ss.headline, contentStyle]}>
          {slide.headline}
        </Animated.Text>

        {/* Body — slower parallax, slightly delayed feel */}
        <Animated.Text style={[ss.body, bodyStyle]}>
          {slide.body}
        </Animated.Text>

      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ANIMATED DOT INDICATORS
// ═════════════════════════════════════════════════════════════════════════════
function DotsIndicator({ progress }: { progress: SharedValue<number> }) {
  return (
    <View style={ss.dots}>
      {SLIDES.map((_, i) => {
        const dotStyle = useAnimatedStyle(() => {
          const w  = interpolate(progress.value, [i - 1, i, i + 1], [5, 22, 5], "clamp");
          const op = interpolate(progress.value, [i - 1, i, i + 1], [0.28, 1, 0.28], "clamp");
          return { width: w, opacity: op };
        });
        return (
          <Animated.View key={i} style={[ss.dot, dotStyle]} />
        );
      })}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [currentPage, setCurrentPage] = useState(0);

  // ── Pager state ────────────────────────────────────────────────────────────
  // offset = committed page offset (multiples of -SW)
  // drag   = live drag delta (0 when not dragging)
  // progress = fractional page position (0 = page 0, 1 = page 1 ...)
  const offset   = useSharedValue(0);
  const drag     = useSharedValue(0);
  const progress = useDerivedValue(() => -(offset.value + drag.value) / SW);

  // ── Entry animation ────────────────────────────────────────────────────────
  const entryOp = useSharedValue(0);
  useEffect(() => {
    entryOp.value = withDelay(
      180,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) }),
    );
  }, []);
  const entryStyle = useAnimatedStyle(() => ({ opacity: entryOp.value }));

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const complete = useCallback(async () => {
    try { await AsyncStorage.setItem(ONBOARDING_KEY, "true"); } catch {}
    router.replace("/(tabs)");
  }, []);

  const goToPage = useCallback((page: number) => {
    Haptics.selectionAsync();
    offset.value = withSpring(-page * SW, SPRING);
    setCurrentPage(page);
  }, []);

  const handleCTA = useCallback(() => {
    if (currentPage < SLIDES.length - 1) {
      goToPage(currentPage + 1);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      complete();
    }
  }, [currentPage, goToPage, complete]);

  // ── Pan gesture ────────────────────────────────────────────────────────────
  const pan = Gesture.Pan()
    .activeOffsetX([-9, 9])
    .failOffsetY([-18, 18])
    .onUpdate(e => {
      "worklet";
      const raw     = offset.value + e.translationX;
      const minX    = -(SLIDES.length - 1) * SW;
      const clamped = Math.max(minX, Math.min(0, raw));
      const excess  = raw - clamped;
      drag.value    = clamped - offset.value + excess * 0.22;
    })
    .onEnd(e => {
      "worklet";
      const total   = offset.value + drag.value;
      const page    = Math.max(0, Math.min(
        SLIDES.length - 1,
        Math.round((-total - e.velocityX * 0.10) / SW),
      ));
      offset.value = withSpring(-page * SW, SPRING);
      drag.value   = withSpring(0, SPRING);
      runOnJS(setCurrentPage)(page);
    });

  const isFinalSlide = currentPage === SLIDES.length - 1;

  return (
    <View style={ss.root}>
      <StatusBar style="light" />

      {/* ── FIXED ATMOSPHERE ── */}
      <EclipseBackground />

      {/* ── ENTRY FADE WRAPPER ── */}
      <Animated.View style={[StyleSheet.absoluteFill, entryStyle]}>

        {/* Skip button — top-right, only when not on final slide */}
        {!isFinalSlide && (
          <View style={[ss.topBar, { paddingTop: topPad + 10 }]}>
            <TouchableOpacity
              style={ss.skipBtn}
              onPress={complete}
              hitSlop={16}
              activeOpacity={0.60}
            >
              <Text style={ss.skipText}>Atla</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── GESTURE LAYER (covers slides area) ── */}
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill}>
            {/* Slide contents — stacked, cross-fade by progress */}
            {SLIDES.map((slide, i) => (
              <SlideContent
                key={slide.id}
                slide={slide}
                index={i}
                progress={progress}
                active={currentPage === i}
              />
            ))}
          </View>
        </GestureDetector>

        {/* ── BOTTOM BAR (above gesture) ── */}
        <View style={[ss.bottom, { paddingBottom: btmPad + 18 }]}>

          <DotsIndicator progress={progress} />

          <TouchableOpacity
            style={[ss.cta, isFinalSlide ? ss.ctaFilled : ss.ctaGhost]}
            onPress={handleCTA}
            activeOpacity={0.80}
            hitSlop={4}
          >
            <Text style={[ss.ctaText, isFinalSlide ? ss.ctaTextDark : ss.ctaTextLight]}>
              {SLIDES[currentPage]?.cta}
            </Text>
            <Feather
              name="arrow-right"
              size={15}
              color={isFinalSlide ? "#000000" : "rgba(255,255,255,0.85)"}
            />
          </TouchableOpacity>

        </View>

      </Animated.View>

    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════
const ss = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#000000",
  },

  // Stars
  star: {
    position:        "absolute",
    backgroundColor: "#FFFFFF",
  },

  // Top bar
  topBar: {
    position:          "absolute",
    top:               0,
    right:             0,
    zIndex:            20,
    paddingHorizontal: 24,
    paddingBottom:     10,
    alignItems:        "flex-end",
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical:   6,
  },
  skipText: {
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.38)",
    letterSpacing: -0.1,
  },

  // Slide layout
  slideAbs: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingBottom:  182, // above bottom bar
  },
  slideInner: {
    paddingHorizontal: 32,
    gap:               20,
  },

  // Typography
  headline: {
    fontSize:      40,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -1.1,
    lineHeight:    48,
  },
  body: {
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.52)",
    lineHeight:    24,
    letterSpacing: -0.1,
  },

  // ── Illustrations ──────────────────────────────────────────────────────────
  illustration: {
    marginBottom: 4,
  },

  // Intro — feature chips
  featureRow: {
    flexDirection: "row",
    gap:           10,
  },
  featureChip: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius:    99,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.055)",
  },
  featureLabel: {
    fontSize:   13,
    fontFamily: "Inter_500Medium",
    color:      "rgba(255,255,255,0.58)",
  },

  // Voice — animated waveform bars
  voiceBarsWrap: {
    flexDirection:  "row",
    alignItems:     "flex-end",
    gap:            5,
    height:         58,
  },
  voiceBar: {
    width:        4,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.80)",
  },

  // Speed — horizontal lines
  speedLines: {
    gap: 10,
  },
  speedLine: {
    height:          2,
    borderRadius:    1,
    backgroundColor: "#FFFFFF",
  },

  // Ready — logo
  readyLogo: {
    width:  64,
    height: 64,
  },

  // ── Dots ───────────────────────────────────────────────────────────────────
  dots: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            5,
    marginBottom:   4,
  },
  dot: {
    height:          3,
    borderRadius:    99,
    backgroundColor: "#FFFFFF",
  },

  // ── CTA button ─────────────────────────────────────────────────────────────
  bottom: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 28,
    gap:               20,
    zIndex:            20,
  },
  cta: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               10,
    paddingVertical:   17,
    borderRadius:      60,
  },
  ctaGhost: {
    borderWidth:     1.2,
    borderColor:     "rgba(255,255,255,0.22)",
    backgroundColor: "transparent",
  },
  ctaFilled: {
    backgroundColor: "#FFFFFF",
    borderWidth:     0,
  },
  ctaText: {
    fontSize:      17,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.3,
  },
  ctaTextLight: {
    color: "rgba(255,255,255,0.90)",
  },
  ctaTextDark: {
    color: "#000000",
  },
});
