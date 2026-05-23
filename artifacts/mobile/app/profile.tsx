/**
 * Profile — premium Apple-style profile editor.
 * Avatar tap → photo action sheet → image picker → crop modal.
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

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:       "#EBEBEC",
  card:     "#FFFFFF",
  fg:       "#1C1C1E",
  muted:    "#8E8E93",
  zinc400:  "#AEAEB2",
  border:   "rgba(0,0,0,0.07)",
  red:      "#FF3B30",
  green:    "#34C759",
  panel:    "#F5F5F7",
};

const defaultAvatar = require("@/assets/images/avatar.png");

// ─── Photo action sheet options ────────────────────────────────────────────────
const PHOTO_OPTIONS = [
  { label: "Fotoğraf Çek",       icon: "camera",    key: "camera"   },
  { label: "Galeriden Seç",      icon: "image",     key: "gallery"  },
  { label: "Varsayılan Avatarlar", icon: "grid",    key: "defaults" },
  { label: "Kaldır",             icon: "trash-2",   key: "remove",  danger: true },
];

// ─── Default avatar options ────────────────────────────────────────────────────
const DEFAULT_AVATARS = [
  require("@/assets/images/avatar.png"),
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 32 : insets.bottom;

  const [avatarUri, setAvatarUri]       = useState<string | null>(null);
  const [username, setUsername]         = useState("SERDAR");
  const [email, setEmail]               = useState("serdar@akilcep.ai");
  const [showSheet, setShowSheet]       = useState(false);
  const [cropUri, setCropUri]           = useState<string | null>(null);
  const [showCrop, setShowCrop]         = useState(false);

  // ── Action sheet animation ──
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

  const sheetStyle  = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: sheetAlpha.value }));

  // ── Photo picker logic ──
  const handlePhotoOption = async (key: string) => {
    closeSheet();
    await new Promise(r => setTimeout(r, 300));

    if (key === "remove") {
      setAvatarUri(null);
      return;
    }
    if (key === "defaults") {
      setAvatarUri(null);
      return;
    }

    const isCamera = key === "camera";
    const perm = isCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert("İzin gerekli", "Lütfen ayarlardan izin verin.");
      return;
    }

    const result = isCamera
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

  const handleCropDone = (uri: string) => {
    setAvatarUri(uri);
    setShowCrop(false);
    setCropUri(null);
  };

  const avatarSource = avatarUri ? { uri: avatarUri } : defaultAvatar;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* ── Nav bar ── */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navBtn}
          hitSlop={14}
          activeOpacity={0.65}
        >
          <Feather name="chevron-left" size={20} color={C.fg} />
        </TouchableOpacity>

        <Text style={styles.navTitle}>Profil</Text>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.back();
          }}
          style={styles.saveBtn}
          activeOpacity={0.75}
        >
          <Text style={styles.saveBtnText}>Kaydet</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: btmPad + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Avatar ── */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={openSheet}
              activeOpacity={0.85}
              style={styles.avatarTouchable}
            >
              <Image source={avatarSource} style={styles.avatarLarge} />
              {/* Camera overlay */}
              <View style={styles.cameraOverlay}>
                <Feather name="camera" size={14} color="#FFFFFF" />
              </View>
              {/* Online dot */}
              <View style={styles.onlineDot} />
            </TouchableOpacity>

            <Text style={styles.avatarHint}>Fotoğrafı değiştir</Text>
          </View>

          {/* ── Identity fields ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>KİŞİSEL BİLGİLER</Text>
            <View style={styles.card}>

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Ad</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholderTextColor={C.zinc400}
                  returnKeyType="next"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>E-posta</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholderTextColor={C.zinc400}
                  returnKeyType="done"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

            </View>
          </View>

          {/* ── Membership card ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ÜYELİK</Text>
            <LinearGradient
              colors={["#FFFFFF", "#F0F0F2", "#E8E8EC"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.memberCard}
            >
              <View style={styles.memberLeft}>
                <View style={styles.memberBadge}>
                  <Feather name="star" size={10} color={C.fg} />
                  <Text style={styles.memberBadgeText}>ÜCRETSİZ</Text>
                </View>
                <Text style={styles.memberTitle}>Ücretsiz Plan</Text>
                <Text style={styles.memberSub}>Temel AI deneyimi</Text>
              </View>
              <TouchableOpacity
                style={styles.upgradePill}
                activeOpacity={0.80}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
              >
                <Text style={styles.upgradeText}>Premium'a Geç</Text>
                <Feather name="arrow-right" size={12} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* ── Account section ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>HESAP</Text>
            <View style={styles.card}>
              {[
                { icon: "lock",   label: "Şifre Değiştir" },
                { icon: "shield", label: "İki Faktörlü Doğrulama" },
                { icon: "bell",   label: "Bildirimler" },
              ].map((item, i, arr) => (
                <React.Fragment key={item.label}>
                  <TouchableOpacity style={styles.accountRow} activeOpacity={0.6}>
                    <View style={styles.accountIcon}>
                      <Feather name={item.icon as any} size={15} color={C.fg} />
                    </View>
                    <Text style={styles.accountLabel}>{item.label}</Text>
                    <Feather name="chevron-right" size={14} color={C.zinc400} />
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* ── Danger zone ── */}
          <View style={styles.section}>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.accountRow}
                activeOpacity={0.6}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <View style={[styles.accountIcon, { backgroundColor: "rgba(255,59,48,0.08)" }]}>
                  <Feather name="trash-2" size={15} color={C.red} />
                </View>
                <Text style={[styles.accountLabel, { color: C.red }]}>Hesabı Sil</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Photo action sheet ── */}
      {showSheet && (
        <>
          <Animated.View style={[styles.sheetOverlay, overlayStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>

          <Animated.View style={[styles.actionSheet, sheetStyle, { paddingBottom: btmPad + 8 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Profil Fotoğrafı</Text>

            {PHOTO_OPTIONS.map((opt, i) => (
              <React.Fragment key={opt.key}>
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => handlePhotoOption(opt.key)}
                  activeOpacity={0.6}
                >
                  <View style={[
                    styles.sheetIcon,
                    opt.danger && { backgroundColor: "rgba(255,59,48,0.08)" },
                  ]}>
                    <Feather
                      name={opt.icon as any}
                      size={16}
                      color={opt.danger ? C.red : C.fg}
                    />
                  </View>
                  <Text style={[styles.sheetLabel, opt.danger && { color: C.red }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
                {i < PHOTO_OPTIONS.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={closeSheet}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      {/* ── Photo crop modal ── */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: C.bg,
  },

  // ── Nav bar
  navBar: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingVertical:   14,
  },
  navBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: C.card,
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.06,
    shadowRadius:    8,
    elevation:       3,
  },
  navTitle: {
    fontSize:      17,
    fontFamily:    "Inter_600SemiBold",
    color:         C.fg,
    letterSpacing: -0.3,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical:   9,
    backgroundColor:   C.fg,
    borderRadius:      20,
  },
  saveBtnText: {
    fontSize:   14,
    fontFamily: "Inter_600SemiBold",
    color:      "#FFF",
  },

  // ── Scroll content
  scroll: {
    paddingHorizontal: 20,
    paddingTop:        8,
    gap:               28,
  },

  // ── Avatar section
  avatarSection: {
    alignItems:  "center",
    gap:         12,
    paddingTop:  12,
  },
  avatarTouchable: {
    width:        100,
    height:       100,
  },
  avatarLarge: {
    width:        100,
    height:       100,
    borderRadius: 50,
    borderWidth:  2,
    borderColor:  "rgba(255,255,255,0.90)",
  },
  cameraOverlay: {
    position:        "absolute",
    bottom:          2,
    right:           2,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: C.fg,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     2,
    borderColor:     C.bg,
  },
  onlineDot: {
    position:        "absolute",
    top:             4,
    right:           4,
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: C.green,
    borderWidth:     2,
    borderColor:     C.bg,
  },
  avatarHint: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    color:      C.muted,
    letterSpacing: 0.2,
  },

  // ── Sections
  section:      { gap: 8 },
  sectionLabel: {
    fontSize:      10,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 1.5,
    color:         C.zinc400,
    textTransform: "uppercase",
    paddingLeft:   4,
  },

  // ── Card container
  card: {
    backgroundColor: C.card,
    borderRadius:    18,
    overflow:        "hidden",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.04,
    shadowRadius:    10,
    elevation:       2,
  },

  // ── Field rows
  fieldRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   14,
    paddingHorizontal: 18,
    gap:               14,
  },
  fieldLabel: {
    width:      72,
    fontSize:   14,
    fontFamily: "Inter_400Regular",
    color:      C.muted,
  },
  fieldInput: {
    flex:       1,
    fontSize:   15,
    fontFamily: "Inter_400Regular",
    color:      C.fg,
    textAlign:  "right",
    padding:    0,
  },
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft:      18,
  },

  // ── Membership card
  memberCard: {
    borderRadius:   18,
    padding:        20,
    flexDirection:  "row",
    alignItems:     "center",
    gap:            16,
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 3 },
    shadowOpacity:  0.06,
    shadowRadius:   12,
    elevation:      4,
    borderWidth:    StyleSheet.hairlineWidth,
    borderColor:    "rgba(0,0,0,0.05)",
  },
  memberLeft:  { flex: 1, gap: 4 },
  memberBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    alignSelf:         "flex-start",
    backgroundColor:   "rgba(0,0,0,0.06)",
    paddingVertical:   3,
    paddingHorizontal: 8,
    borderRadius:      20,
    marginBottom:      2,
  },
  memberBadgeText: {
    fontSize:      9,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 1.4,
    color:         C.fg,
  },
  memberTitle: {
    fontSize:   16,
    fontFamily: "Inter_600SemiBold",
    color:      C.fg,
    letterSpacing: -0.3,
  },
  memberSub: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    color:      C.muted,
  },
  upgradePill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   C.fg,
    paddingVertical:   10,
    paddingHorizontal: 14,
    borderRadius:      14,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.12,
    shadowRadius:      6,
    elevation:         3,
  },
  upgradeText: {
    fontSize:   12,
    fontFamily: "Inter_600SemiBold",
    color:      "#FFF",
  },

  // ── Account rows
  accountRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   14,
    paddingHorizontal: 16,
    gap:               14,
  },
  accountIcon: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: "rgba(0,0,0,0.045)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  accountLabel: {
    flex:       1,
    fontSize:   15,
    fontFamily: "Inter_400Regular",
    color:      C.fg,
  },

  // ── Action sheet
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
    zIndex: 300,
  },
  actionSheet: {
    position:              "absolute",
    bottom:                0,
    left:                  0,
    right:                 0,
    zIndex:                301,
    backgroundColor:       C.panel,
    borderTopLeftRadius:   28,
    borderTopRightRadius:  28,
    paddingHorizontal:     20,
    paddingTop:            8,
    shadowColor:           "#000",
    shadowOffset:          { width: 0, height: -4 },
    shadowOpacity:         0.08,
    shadowRadius:          24,
    elevation:             20,
  },
  sheetHandle: {
    width:           38,
    height:          4,
    borderRadius:    2,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignSelf:       "center",
    marginBottom:    16,
  },
  sheetTitle: {
    fontSize:      15,
    fontFamily:    "Inter_600SemiBold",
    color:         C.fg,
    textAlign:     "center",
    marginBottom:  16,
    letterSpacing: -0.2,
  },
  sheetRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   14,
    gap:               14,
  },
  sheetIcon: {
    width:           36,
    height:          36,
    borderRadius:    11,
    backgroundColor: "rgba(0,0,0,0.045)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  sheetLabel: {
    fontSize:   15,
    fontFamily: "Inter_400Regular",
    color:      C.fg,
  },
  cancelBtn: {
    marginTop:         12,
    backgroundColor:   C.card,
    borderRadius:      16,
    paddingVertical:   16,
    alignItems:        "center",
  },
  cancelText: {
    fontSize:   15,
    fontFamily: "Inter_600SemiBold",
    color:      C.fg,
  },

});
