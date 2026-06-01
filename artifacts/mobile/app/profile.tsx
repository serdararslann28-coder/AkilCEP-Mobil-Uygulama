/**
 * Profile — premium Apple-style profile editor.
 * Fully theme-aware: PURE / VOID.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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

import PhotoCropModal from "@/components/PhotoCropModal";
import { useTheme }   from "@/context/ThemeContext";

const defaultAvatar = require("@/assets/images/avatar.png");

const PHOTO_OPTIONS = [
  { label: "Fotoğraf Çek",         icon: "camera",  key: "camera"   },
  { label: "Galeriden Seç",        icon: "image",   key: "gallery"  },
  { label: "Varsayılan Avatarlar", icon: "grid",    key: "defaults" },
  { label: "Kaldır",               icon: "trash-2", key: "remove", danger: true },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 32 : insets.bottom;
  const { theme } = useTheme();
  const T = theme;

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [username,  setUsername]  = useState("SERDAR");
  const [email,     setEmail]     = useState("serdar@akilcep.ai");
  const [showSheet, setShowSheet] = useState(false);
  const [cropUri,   setCropUri]   = useState<string | null>(null);
  const [showCrop,  setShowCrop]  = useState(false);

  const sheetY     = useSharedValue(600);
  const sheetAlpha = useSharedValue(0);

  const openSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSheet(true);
    sheetAlpha.value = withTiming(1,  { duration: 240 });
    sheetY.value     = withSpring(0,  { damping: 26, stiffness: 220 });
  };
  const closeSheet = () => {
    sheetAlpha.value = withTiming(0,  { duration: 200 });
    sheetY.value     = withSpring(600,{ damping: 28, stiffness: 260 });
    setTimeout(() => setShowSheet(false), 220);
  };

  const sheetStyle   = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: sheetAlpha.value }));

  const handlePhotoOption = async (key: string) => {
    closeSheet();
    await new Promise(r => setTimeout(r, 300));
    if (key === "remove" || key === "defaults") { setAvatarUri(null); return; }
    const isCamera = key === "camera";
    const perm = isCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("İzin gerekli", "Lütfen ayarlardan izin verin."); return; }
    const result = isCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.92, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.92, allowsEditing: false });
    if (!result.canceled && result.assets[0]) { setCropUri(result.assets[0].uri); setShowCrop(true); }
  };

  const handleCropDone = (uri: string) => { setAvatarUri(uri); setShowCrop(false); setCropUri(null); };
  const avatarSource = avatarUri ? { uri: avatarUri } : defaultAvatar;

  // Derived dynamic colours
  const cardBg     = T.card;
  const sheetBg    = T.isDark ? "#0E0E0E" : "#F5F5F7";
  const iconBg     = T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.045)";
  const handleClr  = T.isDark ? "rgba(255,255,255,0.12)"  : "rgba(0,0,0,0.12)";
  const borderClr  = T.isDark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.07)";
  const gradColors: [string, string, string] = T.isDark
    ? ["#161616", "#111111", "#0C0C0C"]
    : ["#FFFFFF", "#F0F0F2", "#E8E8EC"];

  return (
    <View style={[ss.root, { backgroundColor: T.bg }]}>

      {/* ── Floating back button (invisible header) ───────────────────────── */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[ss.floatBack, { top: topPad + 10, backgroundColor: cardBg }]}
        hitSlop={14} activeOpacity={0.65}
      >
        <Feather name="chevron-left" size={18} color={T.fg} />
      </TouchableOpacity>

      {/* ── Floating save button ──────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.back(); }}
        style={[ss.floatSave, { top: topPad + 10, backgroundColor: T.fg }]}
        activeOpacity={0.75}
      >
        <Text style={[ss.floatSaveText, { color: T.isDark ? "#050505" : "#FFFFFF" }]}>Kaydet</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[ss.scroll, { paddingBottom: btmPad + 24, paddingTop: topPad + 56 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Avatar */}
          <View style={ss.avatarSection}>
            <TouchableOpacity onPress={openSheet} activeOpacity={0.85} style={ss.avatarTouchable}>
              <Image source={avatarSource} style={[ss.avatarLarge, { borderColor: T.isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.90)" }]} />
              <View style={[ss.cameraOverlay, { backgroundColor: T.fg, borderColor: T.bg }]}>
                <Feather name="camera" size={14} color={T.isDark ? "#050505" : "#FFFFFF"} />
              </View>
              <View style={[ss.onlineDot, { backgroundColor: T.onlineDot, borderColor: T.bg }]} />
            </TouchableOpacity>
            <Text style={[ss.avatarHint, { color: T.muted }]}>Fotoğrafı değiştir</Text>
          </View>

          {/* Identity fields */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>KİŞİSEL BİLGİLER</Text>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              <View style={ss.fieldRow}>
                <Text style={[ss.fieldLabel, { color: T.muted }]}>Ad</Text>
                <TextInput style={[ss.fieldInput, { color: T.fg }]} value={username} onChangeText={setUsername} placeholderTextColor={T.zinc} returnKeyType="next" autoCapitalize="words" />
              </View>
              <View style={[ss.divider, { backgroundColor: borderClr }]} />
              <View style={ss.fieldRow}>
                <Text style={[ss.fieldLabel, { color: T.muted }]}>E-posta</Text>
                <TextInput style={[ss.fieldInput, { color: T.fg }]} value={email} onChangeText={setEmail} placeholderTextColor={T.zinc} returnKeyType="done" keyboardType="email-address" autoCapitalize="none" />
              </View>
            </View>
          </View>

          {/* Membership */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>ÜYELİK</Text>
            <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[ss.memberCard, { borderColor: borderClr }]}>
              <View style={ss.memberLeft}>
                <View style={[ss.memberBadge, { backgroundColor: T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
                  <Feather name="star" size={10} color={T.fg} />
                  <Text style={[ss.memberBadgeText, { color: T.fg }]}>ÜCRETSİZ</Text>
                </View>
                <Text style={[ss.memberTitle, { color: T.fg }]}>Ücretsiz Plan</Text>
                <Text style={[ss.memberSub,   { color: T.muted }]}>Temel AI deneyimi</Text>
              </View>
              <TouchableOpacity style={[ss.upgradePill, { backgroundColor: T.isDark ? T.green : T.fg }]} activeOpacity={0.80} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}>
                <Text style={[ss.upgradeText, { color: T.isDark ? "#050505" : "#FFF" }]}>Premium'a Geç</Text>
                <Feather name="arrow-right" size={12} color={T.isDark ? "#050505" : "#FFF"} />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Account */}
          <View style={ss.section}>
            <Text style={[ss.sectionLabel, { color: T.zinc }]}>HESAP</Text>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              {[
                { icon: "lock",   label: "Şifre Değiştir" },
                { icon: "shield", label: "İki Faktörlü Doğrulama" },
                { icon: "bell",   label: "Bildirimler" },
              ].map((item, i, arr) => (
                <React.Fragment key={item.label}>
                  <TouchableOpacity style={ss.accountRow} activeOpacity={0.6}>
                    <View style={[ss.accountIcon, { backgroundColor: iconBg }]}>
                      <Feather name={item.icon as any} size={15} color={T.fg} />
                    </View>
                    <Text style={[ss.accountLabel, { color: T.fg }]}>{item.label}</Text>
                    <Feather name="chevron-right" size={14} color={T.zinc} />
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View style={[ss.divider, { backgroundColor: borderClr, marginLeft: 18 }]} />}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Danger */}
          <View style={ss.section}>
            <View style={[ss.card, { backgroundColor: cardBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              <TouchableOpacity style={ss.accountRow} activeOpacity={0.6} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                <View style={[ss.accountIcon, { backgroundColor: "rgba(255,59,48,0.08)" }]}>
                  <Feather name="trash-2" size={15} color="#FF3B30" />
                </View>
                <Text style={[ss.accountLabel, { color: "#FF3B30" }]}>Hesabı Sil</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Photo action sheet */}
      {showSheet && (
        <>
          <Animated.View style={[ss.sheetOverlay, overlayStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>
          <Animated.View style={[ss.actionSheet, sheetStyle, { paddingBottom: btmPad + 8, backgroundColor: sheetBg }]}>
            <View style={[ss.sheetHandle, { backgroundColor: handleClr }]} />
            <Text style={[ss.sheetTitle, { color: T.fg }]}>Profil Fotoğrafı</Text>
            {PHOTO_OPTIONS.map((opt, i) => (
              <React.Fragment key={opt.key}>
                <TouchableOpacity style={ss.sheetRow} onPress={() => handlePhotoOption(opt.key)} activeOpacity={0.6}>
                  <View style={[ss.sheetIcon, { backgroundColor: opt.danger ? "rgba(255,59,48,0.08)" : iconBg }]}>
                    <Feather name={opt.icon as any} size={16} color={opt.danger ? "#FF3B30" : T.fg} />
                  </View>
                  <Text style={[ss.sheetLabel, { color: opt.danger ? "#FF3B30" : T.fg }]}>{opt.label}</Text>
                </TouchableOpacity>
                {i < PHOTO_OPTIONS.length - 1 && <View style={[ss.divider, { backgroundColor: borderClr }]} />}
              </React.Fragment>
            ))}
            <TouchableOpacity style={[ss.cancelBtn, { backgroundColor: cardBg }]} onPress={closeSheet} activeOpacity={0.75}>
              <Text style={[ss.cancelText, { color: T.fg }]}>İptal</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      {showCrop && cropUri && (
        <PhotoCropModal uri={cropUri} onDone={handleCropDone} onCancel={() => { setShowCrop(false); setCropUri(null); }} />
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1 },

  // Floating back button (invisible header)
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

  // Floating save button (top-right)
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

  avatarSection:   { alignItems: "center", gap: 12, paddingTop: 12 },
  avatarTouchable: { width: 100, height: 100 },
  avatarLarge:     { width: 100, height: 100, borderRadius: 50, borderWidth: 2 },
  cameraOverlay:   { position: "absolute", bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  onlineDot:       { position: "absolute", top: 4, right: 4, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  avatarHint:      { fontSize: 12, fontFamily: "Inter_400Regular", letterSpacing: 0.2 },

  section:      { gap: 8 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, textTransform: "uppercase", paddingLeft: 4 },
  card:         { borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  fieldRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 18, gap: 14 },
  fieldLabel:   { width: 72, fontSize: 14, fontFamily: "Inter_400Regular" },
  fieldInput:   { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "right", padding: 0 },
  divider:      { height: StyleSheet.hairlineWidth },

  memberCard:      { borderRadius: 18, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4, borderWidth: StyleSheet.hairlineWidth },
  memberLeft:      { flex: 1, gap: 4 },
  memberBadge:     { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20, marginBottom: 2 },
  memberBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 1.4 },
  memberTitle:     { fontSize: 16, fontFamily: "Inter_600SemiBold", letterSpacing: -0.3 },
  memberSub:       { fontSize: 12, fontFamily: "Inter_400Regular" },
  upgradePill:     { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  upgradeText:     { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  accountRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  accountIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  accountLabel:{ flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },

  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.18)", zIndex: 300 },
  actionSheet:  { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 301, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 8, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 20 },
  sheetHandle:  { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle:   { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center", marginBottom: 16, letterSpacing: -0.2 },
  sheetRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 14 },
  sheetIcon:    { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sheetLabel:   { fontSize: 15, fontFamily: "Inter_400Regular" },
  cancelBtn:    { marginTop: 12, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  cancelText:   { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
