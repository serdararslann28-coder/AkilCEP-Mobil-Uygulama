/**
 * AkılCEP — Profile Screen
 *
 * Apple HIG, theme-aware (PURE / VOID). Sections:
 *   - Avatar + editable Full Name + editable Username
 *   - Email (read-only) + member since
 *   - Preferences: Language, Appearance, Notifications, Privacy
 *   - Account: Logout, Delete Account
 *
 * Edits are saved on "Kaydet" tap via AuthContext.updateProfile.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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

import PhotoCropModal         from "@/components/PhotoCropModal";
import { useAuth }            from "@/context/AuthContext";
import { useLanguage }        from "@/context/LanguageContext";
import { useTheme }           from "@/context/ThemeContext";
import { STARTUP_SOUND_KEY }  from "@/app/splash";

const defaultAvatar = require("@/assets/images/avatar.png");

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { year: "numeric", month: "long" });
}

// ── Settings row ──────────────────────────────────────────────────────────────
function SettingsRow({
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
        <Text style={[rs.value, { color: T.zinc }]} numberOfLines={1}>{value}</Text>
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
  value: { fontSize: 14, fontFamily: "Inter_400Regular", maxWidth: 140 },
});

// ── Profile field ─────────────────────────────────────────────────────────────
function ProfileField({
  label, value, onChange, placeholder, autoCapitalize, inputRef, onSubmitEditing, returnKeyType,
}: {
  label:            string;
  value:            string;
  onChange:         (v: string) => void;
  placeholder?:     string;
  autoCapitalize?:  "none" | "words" | "sentences";
  inputRef?:        React.RefObject<TextInput | null>;
  onSubmitEditing?: () => void;
  returnKeyType?:   "next" | "done";
}) {
  const { theme: T } = useTheme();
  const borderClr = T.isDark ? "rgba(255,255,255,0.1)" : "#EFEFEF";
  const bgClr     = T.isDark ? "rgba(255,255,255,0.05)" : "#F8F8F8";

  return (
    <View style={pf.wrap}>
      <Text style={[pf.label, { color: T.zinc }]}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={[pf.input, { color: T.fg, backgroundColor: bgClr, borderColor: borderClr }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.isDark ? "rgba(255,255,255,0.2)" : "#C4C4C4"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        autoCorrect={false}
        returnKeyType={returnKeyType ?? "next"}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

const pf = StyleSheet.create({
  wrap:  { gap: 6 },
  label: {
    fontFamily:    "Inter_500Medium",
    fontSize:      12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft:   4,
  },
  input: {
    fontFamily:        "Inter_400Regular",
    fontSize:          16,
    letterSpacing:     -0.1,
    borderRadius:      14,
    borderWidth:       1,
    paddingHorizontal: 16,
    height:            52,
  },
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets                                  = useSafeAreaInsets();
  const { theme: T }                            = useTheme();
  const { t }                                   = useLanguage();
  const { user, signOut, updateAvatar, updateProfile } = useAuth();

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 32 : insets.bottom;

  // ── Editable profile fields ───────────────────────────────────────────────
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [saving,   setSaving]   = useState(false);
  const refUsername = useRef<TextInput | null>(null);

  // Keep fields in sync if auth user changes
  useEffect(() => {
    setFullName(user?.fullName ?? "");
    setUsername(user?.username ?? "");
  }, [user?.fullName, user?.username]);

  // ── Avatar ────────────────────────────────────────────────────────────────
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [cropUri,   setCropUri]   = useState<string | null>(null);
  const [showCrop,  setShowCrop]  = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  useEffect(() => {
    if (user?.avatarUrl) setAvatarUri(user.avatarUrl);
  }, [user?.avatarUrl]);

  // ── Startup sound ─────────────────────────────────────────────────────────
  const [startupSound, setStartupSound] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(STARTUP_SOUND_KEY)
      .then(val => { if (val === "off") setStartupSound(false); })
      .catch(() => {});
  }, []);

  const toggleStartupSound = async (value: boolean) => {
    setStartupSound(value);
    try { await AsyncStorage.setItem(STARTUP_SOUND_KEY, value ? "on" : "off"); } catch {}
    Haptics.selectionAsync();
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("Hata", "Ad Soyad boş bırakılamaz.");
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
    } catch (e: unknown) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  // ── Photo sheet animation ─────────────────────────────────────────────────
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

    if (key === "remove") {
      setAvatarUri(null);
      updateAvatar("").catch(() => {});
      return;
    }

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

  // ── Account actions ───────────────────────────────────────────────────────
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
            try { await signOut(); router.replace("/onboarding"); } catch {}
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
            try { await signOut(); router.replace("/onboarding"); } catch {}
          },
        },
      ],
    );
  };

  // ── Derived colours ───────────────────────────────────────────────────────
  const cardBg    = T.card;
  const sheetBg   = T.isDark ? "#0E0E0E" : "#F5F5F7";
  const handleClr = T.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const borderClr = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  const PHOTO_OPTIONS = [
    { label: t("profile.takePhoto"),         icon: "camera",  key: "camera"  },
    { label: t("profile.chooseFromLibrary"), icon: "image",   key: "gallery" },
    { label: t("profile.remove"),            icon: "trash-2", key: "remove", danger: true },
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
        onPress={handleSave}
        disabled={saving}
        style={[ss.floatSave, { top: topPad + 10, backgroundColor: T.fg, opacity: saving ? 0.5 : 1 }]}
        activeOpacity={0.75}
      >
        <Text style={[ss.floatSaveText, { color: T.isDark ? "#050505" : "#FFFFFF" }]}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            ss.scroll,
            { paddingBottom: btmPad + 24, paddingTop: topPad + 72 },
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
                  { borderColor: T.isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.9)" },
                ]}
              />
              <View style={[ss.cameraOverlay, { backgroundColor: T.fg, borderColor: T.bg }]}>
                <Feather name="camera" size={14} color={T.isDark ? "#050505" : "#FFFFFF"} />
              </View>
            </TouchableOpacity>
            <Text style={[ss.avatarHint, { color: T.zinc }]}>Fotoğraf Değiştir</Text>

            {user?.isGuest && (
              <View style={[ss.guestBadge, { backgroundColor: T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" }]}>
                <Text style={[ss.guestBadgeText, { color: T.zinc }]}>Misafir</Text>
              </View>
            )}
          </View>

          {/* ── Profil Bilgileri (editable) ─────────────────────────────────── */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>Profil Bilgileri</Text>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0, padding: 16, gap: 16 }]}>
              <ProfileField
                label="Ad Soyad"
                value={fullName}
                onChange={setFullName}
                placeholder="Adınız Soyadınız"
                autoCapitalize="words"
                onSubmitEditing={() => refUsername.current?.focus()}
                returnKeyType="next"
              />
              <ProfileField
                label="Kullanıcı Adı (İsteğe Bağlı)"
                value={username}
                onChange={setUsername}
                placeholder="kullanici_adi"
                autoCapitalize="none"
                inputRef={refUsername}
                onSubmitEditing={handleSave}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* ── Hesap Bilgileri (read-only) ──────────────────────────────────── */}
          {(user?.email || user?.memberSince) && (
            <View style={ss.section}>
              <Text style={[ss.sectionLabel, { color: T.zinc }]}>Hesap</Text>
              <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
                {user?.email && (
                  <>
                    <SettingsRow icon="mail" label="E-posta" value={user.email} />
                    {user?.memberSince && (
                      <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 62 }]} />
                    )}
                  </>
                )}
                {user?.memberSince && (
                  <SettingsRow icon="calendar" label="Üyelik Tarihi" value={formatDate(user.memberSince)} />
                )}
              </View>
            </View>
          )}

          {/* ── Tercihler ───────────────────────────────────────────────────── */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>Tercihler</Text>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              <SettingsRow
                icon="globe"
                label="Dil"
                value={t("language.current") ?? "Türkçe"}
                onPress={() => router.push("/language")}
              />
              <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 62 }]} />
              <SettingsRow
                icon="moon"
                label="Görünüm"
                value={T.isDark ? "Koyu" : "Açık"}
                onPress={() => {}}
              />
              <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 62 }]} />
              <SettingsRow icon="bell"   label="Bildirimler" onPress={() => {}} />
              <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 62 }]} />
              <SettingsRow icon="shield" label="Gizlilik"    onPress={() => {}} />
            </View>
          </View>

          {/* ── Ses ─────────────────────────────────────────────────────────── */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>Ses</Text>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              <SettingsRow
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

          {/* ── Hesap işlemleri ─────────────────────────────────────────────── */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>Hesap İşlemleri</Text>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              <SettingsRow
                icon="log-out"
                label="Çıkış Yap"
                onPress={handleLogout}
              />
              <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 62 }]} />
              <SettingsRow
                icon="trash-2"
                label="Hesabı Sil"
                onPress={handleDeleteAccount}
                danger
              />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Photo action sheet ─────────────────────────────────────────────── */}
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
                  <View style={[ss.sheetIcon, {
                    backgroundColor: opt.danger
                      ? "rgba(255,59,48,0.08)"
                      : T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.045)",
                  }]}>
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
    paddingHorizontal: 18,
    paddingVertical:   8,
    borderRadius:      20,
  },
  floatSaveText: {
    fontSize:   14,
    fontFamily: "Inter_600SemiBold",
  },

  scroll: { paddingHorizontal: 20, gap: 24 },

  // Avatar
  avatarSection:   { alignItems: "center", gap: 8, paddingTop: 4 },
  avatarTouchable: { width: 96, height: 96, position: "relative" },
  avatarLarge: {
    width:        96,
    height:       96,
    borderRadius: 48,
    borderWidth:  2,
  },
  cameraOverlay: {
    position:       "absolute",
    bottom:         2,
    right:          2,
    width:          28,
    height:         28,
    borderRadius:   14,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    2,
  },
  avatarHint: {
    fontFamily: "Inter_400Regular",
    fontSize:   13,
  },
  guestBadge: {
    paddingHorizontal: 12,
    paddingVertical:   4,
    borderRadius:      12,
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
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.18)",
    zIndex:          300,
  },
  actionSheet: {
    position:             "absolute",
    bottom:               0,
    left:                 0,
    right:                0,
    zIndex:               301,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingHorizontal:    20,
    paddingTop:           8,
    shadowColor:          "#000",
    shadowOffset:         { width: 0, height: -4 },
    shadowOpacity:        0.08,
    shadowRadius:         24,
    elevation:            20,
  },
  sheetHandle: {
    width:        38,
    height:       4,
    borderRadius: 2,
    alignSelf:    "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize:      15,
    fontFamily:    "Inter_600SemiBold",
    textAlign:     "center",
    marginBottom:  16,
    letterSpacing: -0.2,
  },
  sheetRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 14 },
  sheetIcon:  { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sheetLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  cancelBtn:  { marginTop: 12, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
