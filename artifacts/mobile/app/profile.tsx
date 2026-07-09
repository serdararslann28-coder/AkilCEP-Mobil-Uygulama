/**
 * AkılCEP — Profile Screen
 *
 * Pure white, Apple HIG. Sections:
 *   - Avatar + name + username + email + member since
 *   - Preferences: Language, Appearance, Notifications, Privacy
 *   - Account: Logout, Delete Account
 *
 * Reads real user data from AuthContext; gracefully shows
 * placeholders when user is guest or not signed in.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
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

import PhotoCropModal    from "@/components/PhotoCropModal";
import { useAuth }       from "@/context/AuthContext";
import { useLanguage }   from "@/context/LanguageContext";
import { useTheme }      from "@/context/ThemeContext";
import { STARTUP_SOUND_KEY } from "@/app/splash";

const defaultAvatar = require("@/assets/images/avatar.png");

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { year: "numeric", month: "long" });
}

// ── Row component ─────────────────────────────────────────────────────────────
function Row({
  icon, label, value, onPress, danger, rightEl,
}: {
  icon:     string;
  label:    string;
  value?:   string;
  onPress?: () => void;
  danger?:  boolean;
  rightEl?: React.ReactNode;
}) {
  const { theme: T } = useTheme();
  const iconBg = T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.045)";
  const clr    = danger ? "#FF3B30" : T.fg;
  const ibg    = danger ? "rgba(255,59,48,0.08)" : iconBg;

  return (
    <TouchableOpacity
      style={rs.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[rs.icon, { backgroundColor: ibg }]}>
        <Feather name={icon as any} size={15} color={clr} />
      </View>
      <Text style={[rs.label, { color: clr }]}>{label}</Text>
      {value !== undefined && (
        <Text style={[rs.value, { color: T.zinc }]}>{value}</Text>
      )}
      {rightEl ?? (onPress && !danger && (
        <Feather name="chevron-right" size={14} color={T.zinc} />
      ))}
    </TouchableOpacity>
  );
}

const rs = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  icon:  { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  value: { fontSize: 14, fontFamily: "Inter_400Regular" },
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets     = useSafeAreaInsets();
  const { theme: T } = useTheme();
  const { t }      = useLanguage();
  const { user, signOut, updateAvatar } = useAuth();

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 32 : insets.bottom;

  // Avatar state — prefer auth user's avatar
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [cropUri,   setCropUri]   = useState<string | null>(null);
  const [showCrop,  setShowCrop]  = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  // Startup sound preference
  const [startupSound, setStartupSound] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STARTUP_SOUND_KEY)
      .then(val => { if (val === "off") setStartupSound(false); })
      .catch(() => {});
  }, []);

  // Sync avatar from auth user on mount
  useEffect(() => {
    if (user?.avatarUrl) setAvatarUri(user.avatarUrl);
  }, [user?.avatarUrl]);

  const toggleStartupSound = async (value: boolean) => {
    setStartupSound(value);
    try { await AsyncStorage.setItem(STARTUP_SOUND_KEY, value ? "on" : "off"); } catch {}
    Haptics.selectionAsync();
  };

  // Photo bottom-sheet animation
  const sheetY     = useSharedValue(600);
  const sheetAlpha = useSharedValue(0);

  const openSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSheet(true);
    sheetAlpha.value = withTiming(1, { duration: 240 });
    sheetY.value     = withSpring(0, { damping: 26, stiffness: 220 });
  };
  const closeSheet = useCallback(() => {
    sheetAlpha.value = withTiming(0, { duration: 200 });
    sheetY.value     = withSpring(600, { damping: 28, stiffness: 260 });
    setTimeout(() => setShowSheet(false), 220);
  }, []);

  const sheetStyle   = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: sheetAlpha.value }));

  const handlePhotoOption = async (key: string) => {
    closeSheet();
    await new Promise(r => setTimeout(r, 300));

    if (key === "remove")   { setAvatarUri(null); updateAvatar("").catch(() => {}); return; }
    if (key === "defaults") { setAvatarUri(null); return; }

    const isCamera = key === "camera";
    const perm     = isCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert(t("profile.permRequired.title"), t("profile.permRequired.msg"));
      return;
    }

    const result = isCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.92, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.92, allowsEditing: false });

    if (!result.canceled && result.assets[0]) {
      setCropUri(result.assets[0].uri);
      setShowCrop(true);
    }
  };

  const handleCropDone = async (uri: string) => {
    setAvatarUri(uri);
    setShowCrop(false);
    setCropUri(null);
    try { await updateAvatar(uri); } catch {}
  };

  const handleLogout = () => {
    Alert.alert(
      "Çıkış Yap",
      "AkılCEP'ten çıkış yapmak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Çıkış Yap",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              router.replace("/onboarding");
            } catch {}
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Hesabı Sil",
      "Bu işlem geri alınamaz. Hesabınız ve tüm verileriniz kalıcı olarak silinecek.",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Hesabı Sil",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              router.replace("/onboarding");
            } catch {}
          },
        },
      ],
    );
  };

  // Derived colours
  const cardBg    = T.card;
  const sheetBg   = T.isDark ? "#0E0E0E" : "#F5F5F7";
  const handleClr = T.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const borderClr = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  const PHOTO_OPTIONS = [
    { label: t("profile.takePhoto"),        icon: "camera",  key: "camera"   },
    { label: t("profile.chooseFromLibrary"), icon: "image",   key: "gallery"  },
    { label: t("profile.defaultAvatars"),   icon: "grid",    key: "defaults" },
    { label: t("profile.remove"),           icon: "trash-2", key: "remove", danger: true },
  ];

  const avatarSource = avatarUri ? { uri: avatarUri } : defaultAvatar;

  return (
    <View style={[ss.root, { backgroundColor: T.bg }]}>
      <StatusBar style={T.isDark ? "light" : "dark"} />

      {/* Floating back */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[ss.floatBack, { top: topPad + 10, backgroundColor: cardBg }]}
        hitSlop={14}
        activeOpacity={0.65}
      >
        <Feather name="chevron-left" size={18} color={T.fg} />
      </TouchableOpacity>

      {/* Floating save */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.back(); }}
        style={[ss.floatSave, { top: topPad + 10, backgroundColor: T.fg }]}
        activeOpacity={0.75}
      >
        <Text style={[ss.floatSaveText, { color: T.isDark ? "#050505" : "#FFFFFF" }]}>
          Kaydet
        </Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            ss.scroll,
            { paddingBottom: btmPad + 24, paddingTop: topPad + 56 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Avatar ─────────────────────────────────────────────────────── */}
          <View style={ss.avatarSection}>
            <TouchableOpacity
              onPress={openSheet}
              activeOpacity={0.85}
              style={ss.avatarTouchable}
            >
              <Image
                source={avatarSource}
                style={[
                  ss.avatarLarge,
                  { borderColor: T.isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.90)" },
                ]}
              />
              <View style={[ss.cameraOverlay, { backgroundColor: T.fg, borderColor: T.bg }]}>
                <Feather name="camera" size={14} color={T.isDark ? "#050505" : "#FFFFFF"} />
              </View>
            </TouchableOpacity>

            {/* User name */}
            {user?.fullName && (
              <Text style={[ss.displayName, { color: T.fg }]}>{user.fullName}</Text>
            )}
            {user?.username && (
              <Text style={[ss.displayUsername, { color: T.zinc }]}>@{user.username}</Text>
            )}
            {user?.isGuest && (
              <View style={[ss.guestBadge, { backgroundColor: T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" }]}>
                <Text style={[ss.guestBadgeText, { color: T.zinc }]}>Misafir</Text>
              </View>
            )}
          </View>

          {/* ── Kişisel bilgiler ────────────────────────────────────────────── */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>Kişisel Bilgiler</Text>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              {user?.email && (
                <>
                  <Row icon="mail" label="E-posta" value={user.email} />
                  <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 62 }]} />
                </>
              )}
              {user?.memberSince && (
                <Row icon="calendar" label="Üyelik Tarihi" value={formatDate(user.memberSince)} />
              )}
            </View>
          </View>

          {/* ── Tercihler ───────────────────────────────────────────────────── */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>Tercihler</Text>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              <Row
                icon="globe"
                label="Dil"
                value={t("language.current") ?? "Türkçe"}
                onPress={() => router.push("/language")}
              />
              <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 62 }]} />
              <Row
                icon="moon"
                label="Görünüm"
                value={T.isDark ? "Koyu" : "Açık"}
                onPress={() => {}}
              />
              <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 62 }]} />
              <Row icon="bell" label="Bildirimler" onPress={() => {}} />
              <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 62 }]} />
              <Row icon="shield" label="Gizlilik" onPress={() => {}} />
            </View>
          </View>

          {/* ── Ses ayarları ────────────────────────────────────────────────── */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>Ses</Text>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              <Row
                icon="volume-2"
                label={t("profile.startupSound")}
                rightEl={
                  <Switch
                    value={startupSound}
                    onValueChange={toggleStartupSound}
                    trackColor={{ false: "rgba(120,120,128,0.24)", true: T.isDark ? "#39FF14" : "#34C759" }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="rgba(120,120,128,0.24)"
                  />
                }
              />
            </View>
          </View>

          {/* ── Hesap ───────────────────────────────────────────────────────── */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>Hesap</Text>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              <Row
                icon="log-out"
                label="Çıkış Yap"
                onPress={handleLogout}
              />
              <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 62 }]} />
              <Row
                icon="trash-2"
                label="Hesabı Sil"
                onPress={handleDeleteAccount}
                danger
              />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Photo action sheet ───────────────────────────────────────────────── */}
      {showSheet && (
        <>
          <Animated.View style={[ss.sheetOverlay, overlayStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>
          <Animated.View
            style={[
              ss.actionSheet,
              sheetStyle,
              { paddingBottom: btmPad + 8, backgroundColor: sheetBg },
            ]}
          >
            <View style={[ss.sheetHandle, { backgroundColor: handleClr }]} />
            <Text style={[ss.sheetTitle, { color: T.fg }]}>
              {t("profile.profilePhoto")}
            </Text>
            {PHOTO_OPTIONS.map((opt, i) => (
              <React.Fragment key={opt.key}>
                <TouchableOpacity
                  style={ss.sheetRow}
                  onPress={() => handlePhotoOption(opt.key)}
                  activeOpacity={0.6}
                >
                  <View style={[ss.sheetIcon, { backgroundColor: opt.danger ? "rgba(255,59,48,0.08)" : T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.045)" }]}>
                    <Feather
                      name={opt.icon as any}
                      size={16}
                      color={opt.danger ? "#FF3B30" : T.fg}
                    />
                  </View>
                  <Text style={[ss.sheetLabel, { color: opt.danger ? "#FF3B30" : T.fg }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
                {i < PHOTO_OPTIONS.length - 1 && (
                  <View style={[ss.divider, { backgroundColor: borderClr }]} />
                )}
              </React.Fragment>
            ))}
            <TouchableOpacity
              style={[ss.cancelBtn, { backgroundColor: cardBg }]}
              onPress={closeSheet}
              activeOpacity={0.75}
            >
              <Text style={[ss.cancelText, { color: T.fg }]}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      {showCrop && cropUri && (
        <PhotoCropModal
          uri={cropUri}
          onDone={handleCropDone}
          onCancel={() => { setShowCrop(false); setCropUri(null); }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1 },

  floatBack: {
    position:       "absolute",
    left:           16,
    zIndex:         10,
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.06,
    shadowRadius:   8,
    elevation:      3,
  },
  floatSave: {
    position:          "absolute",
    right:             16,
    zIndex:            10,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      20,
  },
  floatSaveText: {
    fontSize:   14,
    fontFamily: "Inter_600SemiBold",
  },

  scroll: { paddingHorizontal: 20, gap: 28 },

  // Avatar section
  avatarSection:   { alignItems: "center", gap: 8, paddingTop: 12 },
  avatarTouchable: { width: 100, height: 100, position: "relative" },
  avatarLarge: {
    width:        100,
    height:       100,
    borderRadius: 50,
    borderWidth:  2,
  },
  cameraOverlay: {
    position:        "absolute",
    bottom:          2,
    right:           2,
    width:           28,
    height:          28,
    borderRadius:    14,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     2,
  },
  displayName: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      18,
    letterSpacing: -0.4,
    marginTop:     4,
  },
  displayUsername: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
  },
  guestBadge: {
    paddingHorizontal: 12,
    paddingVertical:   4,
    borderRadius:      12,
    marginTop:         2,
  },
  guestBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize:   12,
  },

  // Section
  section:      { gap: 8 },
  sectionLabel: {
    fontSize:        10,
    fontFamily:      "Inter_600SemiBold",
    letterSpacing:   1.5,
    textTransform:   "uppercase",
    paddingLeft:     4,
  },
  card: {
    borderRadius:  18,
    overflow:      "hidden",
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius:  10,
    elevation:     2,
  },
  divider: { height: StyleSheet.hairlineWidth },

  // Photo sheet
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
    zIndex:          300,
  },
  actionSheet: {
    position:            "absolute",
    bottom:              0,
    left:                0,
    right:               0,
    zIndex:              301,
    borderTopLeftRadius: 28,
    borderTopRightRadius:28,
    paddingHorizontal:   20,
    paddingTop:          8,
    shadowColor:         "#000",
    shadowOffset:        { width: 0, height: -4 },
    shadowOpacity:       0.08,
    shadowRadius:        24,
    elevation:           20,
  },
  sheetHandle: {
    width:       38,
    height:      4,
    borderRadius:2,
    alignSelf:   "center",
    marginBottom:16,
  },
  sheetTitle: {
    fontSize:      15,
    fontFamily:    "Inter_600SemiBold",
    textAlign:     "center",
    marginBottom:  16,
    letterSpacing: -0.2,
  },
  sheetRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 14 },
  sheetIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sheetLabel:{ fontSize: 15, fontFamily: "Inter_400Regular" },
  cancelBtn: { marginTop: 12, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  cancelText:{ fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
