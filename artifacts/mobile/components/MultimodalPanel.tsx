import { Feather } from "@expo/vector-icons";
import { File as ExpoFile } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useKeyboardContext } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

const PANEL_LEFT = 12;
const PANEL_MAX_WIDTH = 252;
const PANEL_GAP = 7;
const ROW_HEIGHT = 48;
const PANEL_PAD = 6;
const CONTENT_HEIGHT = ROW_HEIGHT * 4 + PANEL_PAD * 2;
const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN = Easing.in(Easing.ease);

type ActionId = "camera" | "photos" | "files" | "location";

function inferFileMimeType(name: string, nativeType: string): string {
  if (nativeType) return nativeType;
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "txt") return "text/plain";
  return "application/octet-stream";
}

function ActionRow({
  icon,
  label,
  isDark,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  isDark: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const iconColor = isDark ? "rgba(255,255,255,0.86)" : "#262626";
  const labelColor = isDark ? "rgba(255,255,255,0.94)" : "#171717";
  const chevronColor = isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.26)";

  return (
    <Pressable
      onPressIn={() => {
        pressScale.value = withTiming(0.985, { duration: 80 });
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        pressScale.value = withTiming(1, { duration: 140, easing: EASE_OUT });
      }}
      onPress={onPress}
    >
      <Animated.View style={[ss.actionRow, animatedStyle]}>
        <Feather name={icon} size={18} color={iconColor} />
        <Text style={[ss.actionLabel, { color: labelColor }]} numberOfLines={1}>{label}</Text>
        <Feather name="chevron-right" size={15} color={chevronColor} />
      </Animated.View>
    </Pressable>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImagesPicked?: (assets: ImagePicker.ImagePickerAsset[]) => void;
  onFilesPicked?: (files: { uri: string; name: string; mimeType?: string; size?: number }[]) => void;
  onLocationPicked?: (location: { latitude: number; longitude: number }) => void;
  bottomOffset: number;
}

export default function MultimodalPanel({
  open,
  onClose,
  onImagesPicked,
  onFilesPicked,
  onLocationPicked,
  bottomOffset,
}: Props) {
  const { theme: T } = useTheme();
  const { t } = useLanguage();
  const { reanimated } = useKeyboardContext();
  const kbH = reanimated.height;
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const panelWidth = Math.min(PANEL_MAX_WIDTH, winW - PANEL_LEFT * 2);

  const panelOpacity = useSharedValue(0);
  const panelY = useSharedValue(8);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (open) {
      backdropOpacity.value = withTiming(1, { duration: 150 });
      panelOpacity.value = withTiming(1, { duration: 160, easing: EASE_OUT });
      panelY.value = withTiming(0, { duration: 160, easing: EASE_OUT });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 130 });
      panelOpacity.value = withTiming(0, { duration: 130 });
      panelY.value = withTiming(8, { duration: 120, easing: EASE_IN });
    }
  }, [open]);

  useEffect(() => {
    if (Platform.OS === "web" || !open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [open, onClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const panelStyle = useAnimatedStyle(() => {
    const reveal = Math.min(1, Math.abs(kbH.value) / 48);
    const bottom = bottomOffset - insets.bottom * reveal + 10 * reveal + PANEL_GAP;
    const maxHeight = Math.max(
      ROW_HEIGHT,
      Math.min(CONTENT_HEIGHT, winH - insets.top - bottom - Math.abs(kbH.value) - 8),
    );
    return {
      opacity: panelOpacity.value,
      bottom,
      maxHeight,
      transform: [{ translateY: panelY.value + kbH.value }],
    };
  });

  const handleCamera = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    setTimeout(() => router.push("/vision"), 180);
  }, [onClose]);

  const handlePhotos = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.88,
      allowsMultipleSelection: true,
    });
    if (!result.canceled && result.assets.length) {
      onImagesPicked?.(result.assets);
      onClose();
    }
  }, [onImagesPicked, onClose]);

  const handleFiles = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    try {
      const picked = await ExpoFile.pickFileAsync({
        multipleFiles: true,
        mimeTypes: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "*/*",
        ],
      });
      if (picked.canceled) return;
      onFilesPicked?.(picked.result.map((file) => ({
        uri: file.uri,
        name: file.name,
        mimeType: inferFileMimeType(file.name, file.type),
        size: file.size,
      })));
      onClose();
    } catch (error) {
      console.warn("[multimodal] file picker:", error);
      Alert.alert(t("multimodal.file.errorTitle"), t("multimodal.file.errorMessage"));
    }
  }, [onClose, onFilesPicked, t]);

  const handleLocation = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert(t("multimodal.location.errorTitle"), t("multimodal.location.mobileOnly"));
      return;
    }
    Haptics.selectionAsync();
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("multimodal.location.permissionTitle"), t("multimodal.location.permissionMessage"));
      return;
    }
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onLocationPicked?.({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      onClose();
    } catch (error) {
      console.warn("[multimodal] location:", error);
      Alert.alert(t("multimodal.location.errorTitle"), t("multimodal.location.errorMessage"));
    }
  }, [onClose, onLocationPicked, t]);

  const actions: {
    id: ActionId;
    icon: React.ComponentProps<typeof Feather>["name"];
    label: string;
    handler: () => void;
  }[] = [
    { id: "camera", icon: "camera", label: "Kamera", handler: handleCamera },
    { id: "photos", icon: "image", label: "Fotoğraflar", handler: handlePhotos },
    { id: "files", icon: "paperclip", label: "Dosyalar", handler: handleFiles },
    { id: "location", icon: "map-pin", label: "Konum", handler: handleLocation },
  ];

  const panelColor = T.isDark ? "#1F1F22" : "#FFFFFF";

  return (
    <>
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.backdrop, backdropStyle]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          ss.panelShadow,
          { width: panelWidth, backgroundColor: panelColor, shadowOpacity: T.isDark ? 0.4 : 0.12 },
          panelStyle,
        ]}
        pointerEvents={open ? "auto" : "none"}
      >
        <View style={[ss.panelSurface, { backgroundColor: panelColor }]}>
          <ScrollView
            style={ss.scroll}
            contentContainerStyle={ss.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {actions.map((action) => (
              <ActionRow
                key={action.id}
                icon={action.icon}
                label={action.label}
                isDark={T.isDark}
                onPress={action.handler}
              />
            ))}
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
}

const ss = StyleSheet.create({
  backdrop: {
    zIndex: 150,
    backgroundColor: "transparent",
  },
  panelShadow: {
    position: "absolute",
    zIndex: 160,
    left: PANEL_LEFT,
    borderRadius: 20,
    shadowColor: "#1A1A1A",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 6,
  },
  panelSurface: {
    flexShrink: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingVertical: PANEL_PAD, paddingHorizontal: 6 },
  actionRow: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    letterSpacing: -0.1,
    lineHeight: 20,
  },
});
