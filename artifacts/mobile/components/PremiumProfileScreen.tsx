import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import PhotoCropModal from "@/components/PhotoCropModal";
import colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const defaultAvatar = require("@/assets/images/avatar.png");
const C = colors.light;

type RowProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
};

function MenuRow({ icon, label, value, onPress, last }: RowProps) {
  return (
    <TouchableOpacity
      style={[ss.row, !last && ss.rowDivider]}
      onPress={onPress}
      activeOpacity={onPress ? 0.62 : 1}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <Feather name={icon} size={17} color={C.zinc600} />
      <Text style={ss.rowLabel}>{label}</Text>
      <View style={ss.rowEnd}>
        {value ? <Text style={ss.rowValue}>{value}</Text> : null}
        {onPress ? <Feather name="chevron-right" size={17} color={C.zinc400} /> : null}
      </View>
    </TouchableOpacity>
  );
}

function EditableRow({
  label,
  value,
  onChangeText,
  inputRef,
  onSubmitEditing,
  autoCapitalize,
  last,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  inputRef?: React.RefObject<TextInput | null>;
  onSubmitEditing?: () => void;
  autoCapitalize?: "none" | "words";
  last?: boolean;
}) {
  return (
    <View style={[ss.editRow, !last && ss.rowDivider]}>
      <View style={ss.editCopy}>
        <Text style={ss.editLabel}>{label}</Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={last ? "done" : "next"}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          placeholder={label}
          placeholderTextColor={C.zinc400}
          style={ss.editInput}
        />
      </View>
      <Feather name="chevron-right" size={17} color={C.zinc400} />
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={ss.section}>
      <Text style={ss.sectionTitle}>{title}</Text>
      <View style={ss.card}>{children}</View>
    </View>
  );
}

function formatMemberDate(iso: string | null | undefined) {
  if (!iso) return "Eylül 2026";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Eylül 2026";
  return date.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

export default function PremiumProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user, updateAvatar, updateProfile } = useAuth();
  const usernameRef = useRef<TextInput | null>(null);

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  useEffect(() => {
    setFullName(user?.fullName ?? "");
    setUsername(user?.username ?? "");
  }, [user?.fullName, user?.username]);

  useEffect(() => {
    setAvatarUri(user?.avatarUrl ?? null);
  }, [user?.avatarUrl]);

  const sheetY = useSharedValue(600);
  const sheetOpacity = useSharedValue(0);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
  }));

  const openPhotoMenu = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowSheet(true);
    sheetOpacity.value = withTiming(1, { duration: 200 });
    sheetY.value = withSpring(0, { damping: 25, stiffness: 230 });
  };

  const closePhotoMenu = useCallback(() => {
    sheetOpacity.value = withTiming(0, { duration: 180 });
    sheetY.value = withSpring(600, { damping: 28, stiffness: 260 });
    setTimeout(() => setShowSheet(false), 200);
  }, [sheetOpacity, sheetY]);

  const handlePhotoOption = async (key: "camera" | "gallery" | "remove") => {
    closePhotoMenu();
    await new Promise(resolve => setTimeout(resolve, 260));

    if (key === "remove") {
      setAvatarUri(null);
      await updateAvatar("");
      return;
    }

    const permission = key === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(t("profile.permRequired.title"), t("profile.permRequired.msg"));
      return;
    }

    const result = key === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.92,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.92,
          allowsEditing: false,
        });

    if (!result.canceled && result.assets[0]) {
      setCropUri(result.assets[0].uri);
      setShowCrop(true);
    }
  };

  const handleCropDone = async (uri: string) => {
    setAvatarUri(uri);
    setCropUri(null);
    setShowCrop(false);
    await updateAvatar(uri);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert(t("common.error"), t("profileScreen.nameRequired"));
      return;
    }
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase().replace(/\s+/g, "_"),
      });
      router.back();
    } catch (error: unknown) {
      Alert.alert(t("common.error"), error instanceof Error ? error.message : t("profileScreen.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const unavailable = (title: string) =>
    Alert.alert(title, t("profileScreen.comingSoon"));

  const displayName = fullName.trim() || user?.fullName || t("profileScreen.guest");
  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 28 : insets.bottom;
  const avatarSource = avatarUri ? { uri: avatarUri } : defaultAvatar;

  return (
    <View style={ss.root}>
      <StatusBar style="dark" />

      <View style={[ss.header, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={ss.backButton}
          hitSlop={12}
          activeOpacity={0.62}
        >
          <Feather name="chevron-left" size={19} color={C.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[ss.saveButton, saving && ss.disabled]}
          activeOpacity={0.76}
        >
          <Text style={ss.saveText}>{saving ? t("common.saving") : t("common.save")}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollViewCompat
        style={ss.scrollView}
        contentContainerStyle={[
          ss.scrollContent,
          { paddingTop: topInset + 78, paddingBottom: bottomInset + 28 },
        ]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={ss.hero}>
          <TouchableOpacity
            onPress={openPhotoMenu}
            activeOpacity={0.82}
            style={ss.avatarWrap}
          >
            <Image source={avatarSource} style={ss.avatar} />
            <View style={ss.cameraButton}>
              <Feather name="camera" size={14} color={C.foreground} />
            </View>
          </TouchableOpacity>
          <Text style={ss.name}>{displayName}</Text>
          <Text style={ss.subtitle}>{t("profileScreen.accountSubtitle")}</Text>
        </View>

        <Section title={t("profileScreen.profileInfo")}>
          <EditableRow
            label={t("profileScreen.fullName")}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            onSubmitEditing={() => usernameRef.current?.focus()}
          />
          <EditableRow
            label={t("profileScreen.username")}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            inputRef={usernameRef}
            onSubmitEditing={handleSave}
            last
          />
        </Section>

        <Section title={t("profileScreen.account")}>
          <MenuRow
            icon="calendar"
            label={t("profileScreen.membershipDate")}
            value={formatMemberDate(user?.memberSince)}
          />
          <MenuRow
            icon="lock"
            label={t("profileScreen.accountSecurity")}
            onPress={() => unavailable(t("profileScreen.accountSecurity"))}
            last
          />
        </Section>

        <Section title={t("profileScreen.preferences")}>
          <MenuRow icon="bell" label={t("settings.notifications")} onPress={() => router.push("/settings")} />
          <MenuRow icon="sun" label={t("settings.appearance")} onPress={() => router.push("/settings")} />
          <MenuRow icon="globe" label={t("settings.language")} onPress={() => router.push("/language")} last />
        </Section>

        <Section title={t("profileScreen.support")}>
          <MenuRow icon="info" label={t("profileScreen.about")} onPress={() => router.push("/about")} />
          <MenuRow icon="message-circle" label={t("settings.support")} onPress={() => router.push("/support")} />
          <MenuRow icon="shield" label={t("profileScreen.privacyPolicy")} onPress={() => router.push("/privacy")} />
          <MenuRow
            icon="file-text"
            label={t("profileScreen.terms")}
            onPress={() => unavailable(t("profileScreen.terms"))}
            last
          />
        </Section>

        <Text style={ss.version}>AkılCEP v1.0.0</Text>
      </KeyboardAwareScrollViewCompat>

      {showSheet ? (
        <>
          <Animated.View style={[ss.sheetOverlay, overlayStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closePhotoMenu} />
          </Animated.View>
          <Animated.View
            style={[
              ss.actionSheet,
              sheetStyle,
              { paddingBottom: bottomInset + 10 },
            ]}
          >
            <View style={ss.sheetHandle} />
            <Text style={ss.sheetTitle}>{t("profile.profilePhoto")}</Text>
            {([
              ["camera", "camera", t("profile.takePhoto")],
              ["gallery", "image", t("profile.chooseFromLibrary")],
              ["remove", "trash-2", t("profile.remove")],
            ] as const).map(([key, icon, label]) => (
              <TouchableOpacity
                key={key}
                style={ss.sheetRow}
                onPress={() => handlePhotoOption(key)}
                activeOpacity={0.62}
              >
                <Feather
                  name={icon}
                  size={17}
                  color={key === "remove" ? C.destructive : C.foreground}
                />
                <Text style={[ss.sheetRowText, key === "remove" && ss.destructive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={ss.cancelButton} onPress={closePhotoMenu}>
              <Text style={ss.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      ) : null}

      {showCrop && cropUri ? (
        <PhotoCropModal
          uri={cropUri}
          onDone={handleCropDone}
          onCancel={() => {
            setShowCrop(false);
            setCropUri(null);
          }}
        />
      ) : null}
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryForeground },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  saveButton: {
    minWidth: 82,
    height: 38,
    paddingHorizontal: 17,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.primary,
  },
  saveText: { color: C.primaryForeground, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  disabled: { opacity: 0.45 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, gap: 24 },
  hero: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  avatarWrap: { width: 104, height: 104, position: "relative" },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: C.primaryForeground,
    backgroundColor: C.zinc100,
  },
  cameraButton: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.zinc100,
    borderWidth: 2,
    borderColor: C.primaryForeground,
  },
  name: {
    marginTop: 15,
    color: C.foreground,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.65,
  },
  subtitle: {
    marginTop: 5,
    color: C.zinc500,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  section: { gap: 9 },
  sectionTitle: {
    paddingLeft: 4,
    color: C.zinc500,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  card: {
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  row: {
    minHeight: 58,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  rowDivider: { borderBottomWidth: 0, borderBottomColor: "transparent" },
  rowLabel: {
    flex: 1,
    color: C.foreground,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    letterSpacing: -0.15,
  },
  rowEnd: { flexDirection: "row", alignItems: "center", gap: 7, maxWidth: "48%" },
  rowValue: { color: C.zinc500, fontSize: 14, fontFamily: "Inter_400Regular" },
  editRow: {
    minHeight: 70,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
  },
  editCopy: { flex: 1, paddingVertical: 10 },
  editLabel: { color: C.foreground, fontSize: 14, fontFamily: "Inter_500Medium" },
  editInput: {
    minHeight: 28,
    marginTop: 1,
    marginRight: 10,
    padding: 0,
    color: C.zinc500,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  version: {
    color: C.zinc400,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  actionSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 101,
    paddingTop: 9,
    paddingHorizontal: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: C.primaryForeground,
    shadowColor: C.foreground,
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 18,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    backgroundColor: C.zinc300,
  },
  sheetTitle: {
    marginTop: 15,
    marginBottom: 8,
    color: C.foreground,
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  sheetRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  sheetRowText: { color: C.foreground, fontSize: 15, fontFamily: "Inter_400Regular" },
  destructive: { color: C.destructive },
  cancelButton: {
    marginTop: 12,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.zinc100,
  },
  cancelText: { color: C.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" },
});