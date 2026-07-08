/**
 * AkilMic — custom premium microphone icon for AkılCEP.
 *
 * Geometry: filled capsule body + open U-arch mount + stem + base bar.
 * All strokes use round linecaps; proportions tuned for 24×24 optical balance.
 *
 * Animations (all on the UI thread via Reanimated worklets):
 *   idle      — slow sinusoidal breath ±2.5 %, 3.2 s cycle
 *   press     — spring to 0.94 on pressIn, spring back on pressOut
 *   listening — two concentric rings expand outward and fade out
 *               icon body adds a subtle extra pulse ±3.5 %
 *   stop      — everything eases back to rest in ~300 ms
 */

import React, { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path, Rect } from "react-native-svg";

interface AkilMicProps {
  listening: boolean;
  color?: string;
  size?: number;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  hitSlop?: number;
}

const SPRING_IN  = { mass: 1, stiffness: 400, damping: 26 } as const;
const SPRING_OUT = { mass: 1, stiffness: 260, damping: 30 } as const;
const RING_DUR   = 1300;
const RING_DELAY = 480;

export function AkilMic({
  listening,
  color    = "#000000",
  size     = 24,
  onPress,
  onPressIn,
  onPressOut,
  hitSlop  = 8,
}: AkilMicProps) {

  // Idle breath — oscillates between 0 and 1 on a sinusoidal curve
  const breathSV = useSharedValue(0);

  // Press — 0 = rest, 1 = fully pressed
  const pressSV = useSharedValue(0);

  // Listening rings — 0 = origin, 1 = fully expanded & faded
  const ring1SV = useSharedValue(0);
  const ring2SV = useSharedValue(0);

  // Body pulse during listening — 0 = rest, 1 = peak
  const pulseSV = useSharedValue(0);

  // Start idle breathing loop immediately
  useEffect(() => {
    breathSV.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  // Start / stop listening animations
  useEffect(() => {
    if (listening) {
      ring1SV.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: RING_DUR, easing: Easing.out(Easing.cubic) }),
        ),
        -1,
        false,
      );
      ring2SV.value = withDelay(
        RING_DELAY,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1, { duration: RING_DUR, easing: Easing.out(Easing.cubic) }),
          ),
          -1,
          false,
        ),
      );
      pulseSV.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 650, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(ring1SV);
      cancelAnimation(ring2SV);
      cancelAnimation(pulseSV);
      ring1SV.value = withTiming(0, { duration: 280 });
      ring2SV.value = withTiming(0, { duration: 280 });
      pulseSV.value = withTiming(0, { duration: 280 });
    }
  }, [listening]);

  // Icon container — combines breath + body pulse + press scale
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{
      scale:
        (1 + breathSV.value * 0.025)
        * interpolate(pulseSV.value, [0, 1], [1.0, 1.035])
        * interpolate(pressSV.value, [0, 1], [1.0, 0.94]),
    }],
  }));

  // Ring 1 — expands and fades
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring1SV.value, [0, 1], [0.7, 2.1]) }],
    opacity:   interpolate(ring1SV.value, [0, 0.15, 1], [0, 0.55, 0]),
  }));

  // Ring 2 — slightly softer peak opacity
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring2SV.value, [0, 1], [0.7, 2.1]) }],
    opacity:   interpolate(ring2SV.value, [0, 0.15, 1], [0, 0.38, 0]),
  }));

  return (
    <Pressable
      style={ss.pressable}
      onPressIn={() => {
        pressSV.value = withSpring(1, SPRING_IN);
        onPressIn?.();
      }}
      onPressOut={() => {
        pressSV.value = withSpring(0, SPRING_OUT);
        onPressOut?.();
      }}
      onPress={onPress}
      hitSlop={hitSlop}
    >
      {/* Icon wrapper — all motion lives here; rings are children so they scale from center */}
      <Animated.View style={[ss.iconWrap, iconStyle]}>

        {/* Sound-wave rings — expand outward from icon center */}
        <Animated.View
          style={[ss.ring, ring1Style, { borderColor: color }]}
          pointerEvents="none"
        />
        <Animated.View
          style={[ss.ring, ring2Style, { borderColor: color }]}
          pointerEvents="none"
        />

        {/* Apple-style thin outline microphone (24×24 viewBox)
            Body:  stroke-only rounded capsule — no fill
            Arch:  open downward U-arc from body sides
            Stem:  thin vertical line from arch base to base bar
            Base:  thin horizontal bar — optical anchor
            All strokes: 1.45 px, round linecaps, no fills                           */}
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {/* Capsule body — outline only */}
          <Rect
            x="8.25"
            y="2"
            width="7.5"
            height="13"
            rx="3.75"
            fill="none"
            stroke={color}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          {/* Downward-opening arch from body sides */}
          <Path
            d="M 6.5 12.5 A 5.5 5.5 0 0 0 17.5 12.5"
            stroke={color}
            strokeWidth="1.45"
            strokeLinecap="round"
            fill="none"
          />
          {/* Vertical stem */}
          <Line
            x1="12" y1="18"
            x2="12" y2="21"
            stroke={color}
            strokeWidth="1.45"
            strokeLinecap="round"
          />
          {/* Horizontal base bar */}
          <Line
            x1="8.5"  y1="21"
            x2="15.5" y2="21"
            stroke={color}
            strokeWidth="1.45"
            strokeLinecap="round"
          />
        </Svg>

      </Animated.View>
    </Pressable>
  );
}

const ss = StyleSheet.create({
  pressable: {
    width:          36,
    height:         36,
    alignItems:     "center",
    justifyContent: "center",
  },
  // All animation transforms originate from this element's center
  iconWrap: {
    width:          24,
    height:         24,
    alignItems:     "center",
    justifyContent: "center",
  },
  // Concentric ring — same size as icon, scales outward
  ring: {
    position:     "absolute",
    width:        24,
    height:       24,
    borderRadius: 12,
    borderWidth:  0.9,
  },
});
