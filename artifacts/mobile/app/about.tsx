import { router } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

const aboutScreen = require("@/assets/images/about-screen.png");
const SOURCE_WIDTH = 852;
const SOURCE_HEIGHT = 1846;
const BACK_CENTER_X = 72;
const BACK_CENTER_Y = 72;
const BACK_HIT_SIZE = 48;

export default function AboutScreen() {
  const { width, height } = useWindowDimensions();
  const contentHeight = Math.max(height, (width * SOURCE_HEIGHT) / SOURCE_WIDTH);
  const scale = Math.max(width / SOURCE_WIDTH, contentHeight / SOURCE_HEIGHT);
  const renderedWidth = SOURCE_WIDTH * scale;
  const renderedHeight = SOURCE_HEIGHT * scale;
  const offsetX = (width - renderedWidth) / 2;
  const offsetY = (contentHeight - renderedHeight) / 2;
  const backLeft = Math.max(
    0,
    Math.min(
      width - BACK_HIT_SIZE,
      offsetX + BACK_CENTER_X * scale - BACK_HIT_SIZE / 2,
    ),
  );
  const backTop = Math.max(
    0,
    Math.min(
      contentHeight - BACK_HIT_SIZE,
      offsetY + BACK_CENTER_Y * scale - BACK_HIT_SIZE / 2,
    ),
  );

  return (
    <ScrollView
      style={ss.root}
      contentContainerStyle={{ height: contentHeight }}
      showsVerticalScrollIndicator={false}
      bounces
      overScrollMode="always"
    >
      <View style={[ss.imageContainer, { height: contentHeight }]}>
        <Image
          source={aboutScreen}
          style={ss.image}
          resizeMode="cover"
          accessibilityLabel="AkılCEP Hakkımızda"
        />
        <Pressable
          onPress={() => router.back()}
          style={[
            ss.backHitArea,
            {
              left: backLeft,
              top: backTop,
            },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        />
      </View>
    </ScrollView>
  );
}

const ss = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#EAF7FF",
  },
  imageContainer: {
    width: "100%",
    overflow: "hidden",
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  backHitArea: {
    position: "absolute",
    width: BACK_HIT_SIZE,
    height: BACK_HIT_SIZE,
    borderRadius: BACK_HIT_SIZE / 2,
  },
});