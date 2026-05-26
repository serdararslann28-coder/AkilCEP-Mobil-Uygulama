/**
 * Onboarding — "Silent Intelligence" reference design.
 *
 * Slide layout:
 *   1. Intro   — left-aligned hero, feature chips, tagline. No skip.
 *   2. Voice   — centered, audio-bars icon badge, skip button.
 *   3. Speed   — centered, sparkle icon badge, skip button.
 *   4. Ready   — centered, leaf logo above title, no skip.
 *
 * All CTA buttons use a white-fill pill with dark text.
 * Fixed eclipse background with breathing pulse + water shimmer.
 * Content cross-fades + parallax via Reanimated progress interpolation.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
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

// Tight spring — luxury feel, minimal bounce
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
type SlideId    = "intro" | "voice" | "speed" | "ready";
type SlideIcon  = "voice" | "sparkle";
type SlideAlign = "left" | "center";

interface Slide {
  id:          SlideId;
  headline:    string;
  subtitle?:   string;    // intro only — appears right after headline
  tagline?:    string;    // intro only — appears after feature chips
  body?:       string;    // voice / speed / ready
  boldPhrase?: string;    // substring of body to render in semibold
  cta:         string;
  final?:      boolean;
  align:       SlideAlign;
  icon?:       SlideIcon;
}

const SLIDES: Slide[] = [
  {
    id:       "intro",
    headline: "AkılCEP",
    subtitle: "Cebindeki akıl,\nartık hep yanında.",
    tagline:  "Yapay zekayı\ndoğal hisset.",
    cta:      "Devam Et",
    align:    "left",
  },
  {
    id:         "voice",
    headline:   "Sesinle\nKontrol Et",
    body:       "Yazmak zorunda değilsin. AkılCEP seni dinler, anlar ve cevap verir.",
    boldPhrase: "dinler, anlar ve cevap verir.",
    cta:        "Devam Et",
    align:      "center",
    icon:       "voice",
  },
  {
    id:         "speed",
    headline:   "Hızlı.\nAkıllı. Sade.",
    body:       "Karmaşık değil. Sadece ihtiyacın olan yapay zeka.",
    boldPhrase: "ihtiyacın olan",
    cta:        "Devam Et",
    align:      "center",
    icon:       "sparkle",
  },
  {
    id:       "ready",
    headline: "Hazırsın",
    body:     "Yeni nesil\ndeneyim başlıyor.",
    cta:      "AkılCEP'e Gir",
    final:    true,
    align:    "center",
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// HELPER: body text with one highlighted bold phrase
// ═════════════════════════════════════════════════════════════════════════════
function BodyText({
  text,
  boldPhrase,
  style,
}: {
  text:        string;
  boldPhrase?: string;
  style?:      object;
}) {
  if (!boldPhrase || !text.includes(boldPhrase)) {
    return <Text style={style}>{text}</Text>;
  }
  const idx = text.indexOf(boldPhrase);
  return (
    <Text style={style}>
      {text.slice(0, idx)}
      <Text style={ss.boldPhrase}>{boldPhrase}</Text>
      {text.slice(idx + boldPhrase.length)}
    </Text>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AUDIO BARS ICON — 4 thin bars for the voice slide badge
// ═════════════════════════════════════════════════════════════════════════════
function AudioBarsIcon() {
  return (
    <View style={ss.audioBarsRow}>
      {[0.44, 1.0, 0.66, 0.82].map((h, i) => (
        <View key={i} style={[ss.audioBar, { height: Math.round(h * 16) }]} />
      ))}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ICON BADGE — small circle with icon for voice / speed slides
// ═════════════════════════════════════════════════════════════════════════════
function IconBadge({ icon }: { icon: SlideIcon }) {
  return (
    <View style={ss.iconBadge}>
      {icon === "voice" ? (
        <AudioBarsIcon />
      ) : (
        // 4-pointed sparkle character — accurate to reference
        <Text style={ss.sparkleChar}>{"\u2726"}</Text>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FEATURE CHIPS — intro slide: "Sor.", "Konuş.", "Üret."
// ═════════════════════════════════════════════════════════════════════════════
function FeatureChips() {
  const CHIPS = [
    { icon: "message-circle" as const, label: "Sor."   },
    { icon: "mic"            as const, label: "Konuş." },
    { icon: "star"           as const, label: "Üret."  },
  ];
  return (
    <View style={ss.chipsRow}>
      {CHIPS.map(c => (
        <View key={c.label} style={ss.chip}>
          <Feather name={c.icon} size={16} color="rgba(255,255,255,0.60)" />
          <Text style={ss.chipLabel}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// READY LOGO — pulsing leaf for the final slide
// ═════════════════════════════════════════════════════════════════════════════
function ReadyLogo() {
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
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  return (
    <Animated.View style={[ss.readyLogoWrap, style]}>
      <Image
        source={leafLogo}
        style={ss.readyLogoImg}
        tintColor="rgba(255,255,255,0.90)"
        resizeMode="contain"
      />
    </Animated.View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FIXED ATMOSPHERIC BACKGROUND — eclipse + stars + fog
// ═════════════════════════════════════════════════════════════════════════════
function EclipseBackground() {
  const eclipseScale = useSharedValue(1);
  const rippleX      = useSharedValue(1);
  const rippleOp     = useSharedValue(1);

  useEffect(() => {
    eclipseScale.value = withRepeat(
      withSequence(
        withTiming(1.016, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.984, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
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
    transform: [{ scaleY: REFLECT_SCY }, { scaleX: rippleX.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
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

      {/* Fog column */}
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
// SLIDE CONTENT — cross-fade + horizontal parallax via progress
// ═════════════════════════════════════════════════════════════════════════════
function SlideContent({
  slide,
  index,
  progress,
  topInset,
}: {
  slide:    Slide;
  index:    number;
  progress: SharedValue<number>;
  topInset: number;
}) {
  // Upper block (icon/logo + headline): faster parallax
  const upperStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = interpolate(p, [index - 0.65, index, index + 0.65], [0, 1, 0], "clamp");
    const px      = interpolate(p, [index - 1, index, index + 1], [SW * 0.20, 0, -SW * 0.20], "clamp");
    return { opacity, transform: [{ translateX: px }] };
  });

  // Lower block (body/subtitle/chips): slower parallax
  const lowerStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = interpolate(p, [index - 0.55, index, index + 0.55], [0, 1, 0], "clamp");
    const px      = interpolate(p, [index - 1, index, index + 1], [SW * 0.12, 0, -SW * 0.12], "clamp");
    return { opacity, transform: [{ translateX: px }] };
  });

  const isCenter = slide.align === "center";

  // Per-slide vertical start positions
  const upperTop: Record<SlideId, number> = {
    intro: topInset + 52,
    voice: topInset + 80,
    speed: topInset + 80,
    ready: topInset + 72,
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">

      {/* ── Upper block ── */}
      <Animated.View
        style={[
          ss.block,
          isCenter ? ss.blockCenter : ss.blockLeft,
          { top: upperTop[slide.id] },
          upperStyle,
        ]}
      >
        {/* Icon badge (voice / speed) */}
        {slide.icon && <IconBadge icon={slide.icon} />}

        {/* Pulsing leaf logo (ready) */}
        {slide.id === "ready" && <ReadyLogo />}

        {/* Headline */}
        <Text
          style={[
            ss.headline,
            isCenter ? ss.headlineCenter : ss.headlineLeft,
            slide.id === "intro"  && ss.headlineIntro,
            slide.id === "ready"  && ss.headlineReady,
          ]}
        >
          {slide.headline}
        </Text>

        {/* Intro: subtitle directly below headline */}
        {slide.subtitle && (
          <Text style={ss.introSubtitle}>{slide.subtitle}</Text>
        )}
      </Animated.View>

      {/* ── Lower block ── */}
      <Animated.View
        style={[
          ss.block,
          isCenter ? ss.blockCenter : ss.blockLeft,
          { top: upperTop[slide.id] + (slide.id === "intro" ? 148 : 200) },
          lowerStyle,
        ]}
      >
        {/* Intro: feature chips + tagline */}
        {slide.id === "intro" && (
          <>
            <FeatureChips />
            {slide.tagline && (
              <Text style={ss.introTagline}>{slide.tagline}</Text>
            )}
          </>
        )}

        {/* Voice / Speed / Ready: body with optional bold phrase */}
        {slide.body && slide.id !== "intro" && (
          <BodyText
            text={slide.body}
            boldPhrase={slide.boldPhrase}
            style={[ss.bodyText, isCenter && ss.bodyCenter]}
          />
        )}
      </Animated.View>

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
          const w  = interpolate(progress.value, [i - 1, i, i + 1], [5, 20, 5], "clamp");
          const op = interpolate(progress.value, [i - 1, i, i + 1], [0.25, 1, 0.25], "clamp");
          return { width: w, opacity: op };
        });
        return <Animated.View key={i} style={[ss.dot, dotStyle]} />;
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

  const offset   = useSharedValue(0);
  const drag     = useSharedValue(0);
  const progress = useDerivedValue(() => -(offset.value + drag.value) / SW);

  // Entry fade
  const entryOp = useSharedValue(0);
  useEffect(() => {
    entryOp.value = withDelay(
      180,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) }),
    );
  }, []);
  const entryStyle = useAnimatedStyle(() => ({ opacity: entryOp.value }));

  const complete = useCallback(() => {
    // AsyncStorage key is set by auth screen after successful sign-in
    router.replace("/auth");
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

  // Pan gesture — rubber-bands at edges, snaps with spring
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
      const total = offset.value + drag.value;
      const page  = Math.max(0, Math.min(
        SLIDES.length - 1,
        Math.round((-total - e.velocityX * 0.10) / SW),
      ));
      offset.value = withSpring(-page * SW, SPRING);
      drag.value   = withSpring(0, SPRING);
      runOnJS(setCurrentPage)(page);
    });

  const isFinalSlide = currentPage === SLIDES.length - 1;
  // Skip only visible on middle slides (not intro, not ready)
  const showSkip = currentPage > 0 && !isFinalSlide;

  return (
    <View style={ss.root}>
      <StatusBar style="light" />

      {/* Fixed atmospheric background */}
      <EclipseBackground />

      {/* Entry fade wrapper */}
      <Animated.View style={[StyleSheet.absoluteFill, entryStyle]}>

        {/* Skip button — top-right, only on slides 2 & 3 */}
        {showSkip && (
          <View style={[ss.topBar, { paddingTop: topPad + 10 }]}>
            <TouchableOpacity
              style={ss.skipBtn}
              onPress={complete}
              hitSlop={16}
              activeOpacity={0.55}
            >
              <Text style={ss.skipText}>Atla</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Gesture layer covering full screen */}
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill}>
            {SLIDES.map((slide, i) => (
              <SlideContent
                key={slide.id}
                slide={slide}
                index={i}
                progress={progress}
                topInset={topPad}
              />
            ))}
          </View>
        </GestureDetector>

        {/* Bottom bar — dots + CTA button */}
        <View style={[ss.bottom, { paddingBottom: btmPad + 20 }]}>
          <DotsIndicator progress={progress} />

          <TouchableOpacity
            style={ss.cta}
            onPress={handleCTA}
            activeOpacity={0.80}
            hitSlop={4}
          >
            <Text style={ss.ctaText}>{SLIDES[currentPage]?.cta}</Text>
            <Feather name="arrow-right" size={15} color="#0A0A0A" />
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

  star: {
    position:        "absolute",
    backgroundColor: "#FFFFFF",
  },

  // Skip button
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
    paddingHorizontal: 8,
    paddingVertical:   6,
  },
  skipText: {
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.36)",
    letterSpacing: -0.1,
  },

  // Slide content blocks
  block: {
    position:          "absolute",
    left:              0,
    right:             0,
    paddingHorizontal: 32,
    gap:               16,
  },
  blockLeft: {
    alignItems: "flex-start",
  },
  blockCenter: {
    alignItems: "center",
  },

  // Headline variants
  headline: {
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -1.2,
    lineHeight:    52,
  },
  headlineLeft: {
    fontSize:   54,
    lineHeight: 60,
    textAlign:  "left",
  },
  headlineCenter: {
    fontSize:   44,
    lineHeight: 52,
    textAlign:  "center",
  },
  headlineIntro: {
    fontSize:      58,
    lineHeight:    64,
    letterSpacing: -2.0,
  },
  headlineReady: {
    fontSize:      52,
    lineHeight:    58,
    letterSpacing: -1.6,
    marginTop:     8,
  },

  // Intro subtitle ("Cebindeki akıl...")
  introSubtitle: {
    fontSize:      17,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.50)",
    letterSpacing: -0.2,
    lineHeight:    24,
    marginTop:     -4,
  },

  // Feature chips row
  chipsRow: {
    flexDirection: "row",
    gap:           20,
    marginTop:     4,
  },
  chip: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            7,
  },
  chipLabel: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.55)",
    letterSpacing: -0.1,
  },

  // Intro tagline ("Yapay zekayı doğal hisset.")
  introTagline: {
    fontSize:      16,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.72)",
    letterSpacing: -0.2,
    lineHeight:    22,
    marginTop:     4,
  },

  // Body text (voice / speed / ready)
  bodyText: {
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.48)",
    letterSpacing: -0.1,
    lineHeight:    22,
  },
  bodyCenter: {
    textAlign: "center",
  },
  boldPhrase: {
    fontFamily: "Inter_600SemiBold",
    color:      "rgba(255,255,255,0.82)",
  },

  // Icon badge (voice / speed slides)
  iconBadge: {
    width:           48,
    height:          48,
    borderRadius:    24,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  audioBarsRow: {
    flexDirection: "row",
    alignItems:    "flex-end",
    gap:           3,
    height:        18,
  },
  audioBar: {
    width:           3,
    borderRadius:    2,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  sparkleChar: {
    fontSize:   18,
    color:      "rgba(255,255,255,0.80)",
    lineHeight: 20,
  },

  // Ready slide leaf logo
  readyLogoWrap: {
    alignItems: "center",
    marginBottom: 4,
  },
  readyLogoImg: {
    width:  68,
    height: 68,
  },

  // Dot indicators
  dots: {
    flexDirection:  "row",
    gap:            6,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   20,
  },
  dot: {
    height:          5,
    borderRadius:    3,
    backgroundColor: "#FFFFFF",
  },

  // CTA button — always white fill, dark text
  bottom: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 24,
  },
  cta: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             10,
    height:          56,
    borderRadius:    28,
    backgroundColor: "#FFFFFF",
  },
  ctaText: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#0A0A0A",
    letterSpacing: -0.2,
  },

});
