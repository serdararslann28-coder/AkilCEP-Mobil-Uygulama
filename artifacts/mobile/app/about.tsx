import { router } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

const aboutScreen = require("@/assets/images/about-screen.png");
const SOURCE_WIDTH = 1024;
const SOURCE_HEIGHT = 1536;
const BACK_CENTER_X = 98;
const BACK_CENTER_Y = 102;
const BACK_HIT_SIZE = 48;

export default function AboutScreen() {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / SOURCE_WIDTH, height / SOURCE_HEIGHT);
  const renderedWidth = SOURCE_WIDTH * scale;
  const renderedHeight = SOURCE_HEIGHT * scale;
  const offsetX = (width - renderedWidth) / 2;
  const offsetY = (height - renderedHeight) / 2;

  return (
    <View style={ss.root}>
      <Image
        source={aboutScreen}
        style={ss.image}
        resizeMode="contain"
        accessibilityLabel="AkılCEP Hakkımızda"
      />
      <Pressable
        onPress={() => router.back()}
        style={[
          ss.backHitArea,
          {
            left: offsetX + BACK_CENTER_X * scale - BACK_HIT_SIZE / 2,
            top: offsetY + BACK_CENTER_Y * scale - BACK_HIT_SIZE / 2,
          },
        ]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Geri"
      />
    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  backHitArea: {
    position: "absolute",
    width: BACK_HIT_SIZE,
    height: BACK_HIT_SIZE,
    borderRadius: BACK_HIT_SIZE / 2,
  },
});