import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

const leafIcon = require("@/assets/images/leaf-only-transparent.png");

interface BrandHeaderProps {
  color?: string;
}

/**
 * AkılCEP brand header — leaf icon + real typography.
 * Icon and text are completely separate elements.
 */
export default function BrandHeader({ color = "#111111" }: BrandHeaderProps) {
  return (
    <View style={styles.row}>
      <Image
        source={leafIcon}
        style={styles.icon}
        resizeMode="contain"
      />
      <Text style={[styles.wordmark, { color }]}>AkılCEP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  icon: {
    width: 44,
    height: 44,
  },
  wordmark: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.8,
    includeFontPadding: false,
    lineHeight: 54,
  },
});
