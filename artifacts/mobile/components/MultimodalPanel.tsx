import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { File as ExpoFile } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  Alert,
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useKeyboardContext } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

const SCREEN_WIDTH = Dimensions.get("window").width;
const PANEL_LEFT = SCREEN_WIDTH * 0.04;
const PANEL_WIDTH = Math.min(300, SCREEN_WIDTH - PANEL_LEFT - 16);
const PANEL_GAP = 6;
const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN = Easing.in(Easing.ease);
const PANEL_SPRING = { damping: 30, stiffness: 260, mass: 0.9 };

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
  index,
  open,
  isDark,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  index: number;
  open: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(6);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (open) {
      opacity.value = withDelay(index * 35, withTiming(1, { duration: 170, easing: EASE_OUT }));
      translateY.value = withDelay(index * 35, withTiming(0, { duration: 190, easing: EASE_OUT }));
    } else {
      opacity.value = withTiming(0, { duration: 100 });
      translateY.value = withTiming(5, { duration: 100 });
      pressScale.value = 1;
    }
  }, [open]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: pressScale.value },
    ],
  }));

  const iconBg = isDark ? "rgba(255,255,255,0.10)" : "#F2F3F5";
  const iconColor = isDark ? "rgba(255,255,255,0.88)" : "#222222";
  const labelColor = isDark ? "rgba(255,255,255,0.94)" : "#171717";
  const chevronColor = isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.24)";

  return (
    <Pressable
      onPressIn={() => {
        pressScale.value = withTiming(0.98, { duration: 80 });
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        pressScale.value = withTiming(1, { duration: 160, easing: EASE_OUT });
      }}
      onPress={onPress}
    >
      <Animated.View style={[ss.actionRow, animatedStyle]}>
        <View style={[ss.iconWrap, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={19} color={iconColor} />
        </View>
        <Text style={[ss.actionLabel, { color: labelColor }]}>{label}</Text>
        <Feather name="chevron-right" size={16} color={chevronColor} />
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

  const panelOpacity = useSharedValue(0);
  const panelY = useSharedValue(12);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (open) {
      backdropOpacity.value = withTiming(1, { duration: 150 });
      panelOpacity.value = withTiming(1, { duration: 180, easing: EASE_OUT });
      panelY.value = withSpring(0, PANEL_SPRING);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 130 });
      panelOpacity.value = withTiming(0, { duration: 130 });
      panelY.value = withTiming(10, { duration: 140, easing: EASE_IN });
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
  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    bottom: bottomOffset + PANEL_GAP,
    transform: [{ translateY: panelY.value + kbH.value }],
  }));

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

  const panelColor = T.isDark ? "rgba(24,24,26,0.97)" : "rgba(255,255,255,0.98)";
  const borderColor = T.isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)";
  const dividerColor = T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

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
          panelStyle,
          { shadowOpacity: T.isDark ? 0.28 : 0.10 },
        ]}
        pointerEvents={open ? "auto" : "none"}
      >
        <View style={[ss.panelSurface, { backgroundColor: panelColor, borderColor }]}>
          <BlurView
            style={StyleSheet.absoluteFill}
            tint={T.isDark ? "dark" : "light"}
            intensity={Platform.OS === "android" ? 35 : 65}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: panelColor }]} />
          {actions.map((action, index) => (
            <React.Fragment key={action.id}>
              <ActionRow
                icon={action.icon}
                label={action.label}
                index={index}
                open={open}
                isDark={T.isDark}
                onPress={action.handler}
              />
              {index < actions.length - 1 && (
                <View style={[ss.divider, { backgroundColor: dividerColor }]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </Animated.View>
    </>
  );
}

const ss = StyleSheet.create({
  backdrop: {
    zIndex: 150,
    backgroundColor: "rgba(0,0,0,0.025)",
  },
  panelShadow: {
    position: "absolute",
    zIndex: 160,
    left: PANEL_LEFT,
    width: PANEL_WIDTH,
    borderRadius: 22,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 18,
    elevation: 10,
  },
  panelSurface: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionRow: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 58,
  },
});