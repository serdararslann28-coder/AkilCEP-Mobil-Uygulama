import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const aboutScreen = require("@/assets/images/about-screen.png");
const SOURCE_WIDTH = 852;
const SOURCE_HEIGHT = 1846;
const BACK_HIT_SIZE = 48;

export default function AboutScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentHeight = Math.max(height, (width * SOURCE_HEIGHT) / SOURCE_WIDTH);

  return (
    <View style={ss.root}>
      <StatusBar style="dark" />
      <ScrollView
        style={ss.scroll}
        contentContainerStyle={{ minHeight: contentHeight }}
        showsVerticalScrollIndicator={false}
        bounces
        overScrollMode="always"
      >
        <Image
          source={aboutScreen}
          style={{ width, height: (width * SOURCE_HEIGHT) / SOURCE_WIDTH }}
          resizeMode="contain"
          accessibilityLabel="AkılCEP Hakkımızda"
        />
      </ScrollView>
      <Pressable
        onPress={() => router.back()}
        style={[
          ss.backButton,
          {
            left: Math.max(insets.left + 12, 12),
            top: insets.top + 8,
          },
        ]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Geri"
      >
        <Text style={ss.backIcon}>‹</Text>
      </Pressable>
    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#EAF7FF",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#EAF7FF",
  },
  backButton: {
    position: "absolute",
    width: BACK_HIT_SIZE,
    height: BACK_HIT_SIZE,
    borderRadius: BACK_HIT_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  backIcon: {
    color: "#111111",
    fontSize: 36,
    fontWeight: "300",
    lineHeight: 38,
    marginTop: -2,
  },
});