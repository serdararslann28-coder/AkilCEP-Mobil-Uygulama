import React from "react";
import Svg, { Path } from "react-native-svg";

/**
 * AkılCEP brand leaf — three-petal lotus mark drawn as pure SVG paths.
 * No image file, no internal text, no cropping required.
 */
interface LeafIconProps {
  size?: number;
  color?: string;
}

export default function LeafIcon({ size = 40, color = "#111111" }: LeafIconProps) {
  const w = size;
  const h = size * 1.35;

  return (
    <Svg width={w} height={h} viewBox="0 0 60 81">
      {/* Center petal — tall, narrow, points straight up */}
      <Path
        d="M30 76 C24 58 21 40 30 6 C39 40 36 58 30 76Z"
        fill={color}
      />
      {/* Left petal — medium height, sweeps upper-left */}
      <Path
        d="M30 62 C22 56 8 44 5 24 C17 31 26 46 30 62Z"
        fill={color}
      />
      {/* Right petal — mirror of left */}
      <Path
        d="M30 62 C38 56 52 44 55 24 C43 31 34 46 30 62Z"
        fill={color}
      />
    </Svg>
  );
}
