/**
 * AkılCEP — Register Screen
 *
 * Pure white, Apple HIG. Optional avatar, five form fields,
 * "Hesap Oluştur" black pill → /interests.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";

// ── Reusable field ────────────────────────────────────────────────────────────
interface FieldProps {
  label:            string;
  value:            string;
  onChange:         (v: string) => void;
  placeholder?:     string;
  secure?:          boolean;
  showingSecure?:   boolean;
  onToggleSecure?:  () => void;
  keyboardType?:    "default" | "email-address";
  autoCapitalize?:  "none" | "sentences" | "words";
  returnKeyType?:   "next" | "done";
  onSubmitEditing?: () => void;
  inputRef?:        React.RefObject<TextInput | null>;
}

function Field({
  label, value, onChange, placeholder,
  secure, showingSecure, onToggleSecure,
  keyboardType, autoCapitalize, returnKeyType, onSubmitEditing, inputRef,
}: FieldProps) {
  return (
    <View style={fs.wrap}>
      <Text style={fs.label}>{label}</Text>
      <View style={fs.row}>
        <TextInput
          ref={inputRef}
          style={fs.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#C4C4C4"
          secureTextEntry={secure && !showingSecure}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "sentences"}
          autoCorrect={false}
          returnKeyType={returnKeyType ?? "next"}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={returnKeyType === "done"}
        />
        {onToggleSecure && (
          <TouchableOpacity onPress={onToggleSecure} style={fs.eyeBtn} hitSlop={8}>
            <Feather
              name={showingSecure ? "eye-off" : "eye"}
              size={17}
              color="#BBBBBB"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const insets                        = useSafeAreaInsets();
  const { signUpWithEmail, updateAvatar } = useAuth();

  const [avatar,          setAvatar]          = useState<string | null>(null);
  const [fullName,        setFullName]        = useState("");
  const [username,        setUsername]        = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);

  // Input refs for focus-chain
  const refUsername = useRef<TextInput | null>(null);
  const refEmail    = useRef<TextInput | null>(null);
  const refPass     = useRef<TextInput | null>(null);
  const refConfirm  = useRef<TextInput | null>(null);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("İzin Gerekli", "Fotoğraf seçmek için galeri iznine ihtiyaç var.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
    }
  };

  const validate = (): string | null => {
    if (!fullName.trim())                                                        return "Ad Soyad gerekli.";
    if (username.trim().length > 0 && username.trim().length < 3)               return "Kullanıcı adı en az 3 karakter olmalı.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))                                   return "Geçerli bir e-posta adresi girin.";
    if (password.length < 6)                                                     return "Şifre en az 6 karakter olmalı.";
    if (password !== confirmPassword)                                            return "Şifreler eşleşmiyor.";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { Alert.alert("Hata", err); return; }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLoading(true);
    try {
      await signUpWithEmail({
        email:    email.trim(),
        password,
        fullName: fullName.trim(),
        username: username.trim().toLowerCase().replace(/\s+/g, "_"),
      });
      if (avatar) await updateAvatar(avatar);
      router.replace("/ready");
    } catch (e: unknown) {
      Alert.alert("Kayıt Hatası", e instanceof Error ? e.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={ss.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        style={ss.flex}
        contentContainerStyle={[
          ss.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity style={ss.back} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#000000" />
        </TouchableOpacity>

        <Text style={ss.pageTitle}>Hesap Oluştur</Text>

        {/* Avatar picker */}
        <TouchableOpacity style={ss.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={ss.avatar} />
          ) : (
            <View style={ss.avatarEmpty}>
              <Feather name="camera" size={26} color="#CCCCCC" />
            </View>
          )}
          <View style={ss.avatarBadge}>
            <Feather name="plus" size={13} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
        <Text style={ss.avatarHint}>Fotoğraf ekle (isteğe bağlı)</Text>

        {/* Form */}
        <View style={ss.form}>
          <Field
            label="Ad Soyad"
            value={fullName}
            onChange={setFullName}
            placeholder="Adınız Soyadınız"
            autoCapitalize="words"
            onSubmitEditing={() => refUsername.current?.focus()}
          />
          <View>
            <Field
              label="Kullanıcı Adı (İsteğe Bağlı)"
              value={username}
              onChange={setUsername}
              placeholder="kullanici_adi"
              autoCapitalize="none"
              inputRef={refUsername}
              onSubmitEditing={() => refEmail.current?.focus()}
            />
            <Text style={ss.helperText}>
              Kullanıcı adı isteğe bağlıdır. Daha sonra profil ayarlarından ekleyebilir veya değiştirebilirsin.
            </Text>
          </View>
          <Field
            label="E-posta"
            value={email}
            onChange={setEmail}
            placeholder="ornek@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            inputRef={refEmail}
            onSubmitEditing={() => refPass.current?.focus()}
          />
          <Field
            label="Şifre"
            value={password}
            onChange={setPassword}
            placeholder="En az 6 karakter"
            secure
            showingSecure={showPass}
            onToggleSecure={() => setShowPass(v => !v)}
            inputRef={refPass}
            onSubmitEditing={() => refConfirm.current?.focus()}
          />
          <Field
            label="Şifre Tekrar"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Şifreyi tekrar girin"
            secure
            showingSecure={showConfirm}
            onToggleSecure={() => setShowConfirm(v => !v)}
            returnKeyType="done"
            inputRef={refConfirm}
            onSubmitEditing={handleSubmit}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[ss.btn, loading && ss.btnOff]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={ss.btnText}>
            {loading ? "Hesap Oluşturuluyor..." : "Hesap Oluştur"}
          </Text>
        </TouchableOpacity>

        {/* Link to login */}
        <TouchableOpacity
          onPress={() => router.replace("/login")}
          style={ss.link}
        >
          <Text style={ss.linkText}>
            {"Zaten hesabın var mı? "}
            <Text style={ss.linkBold}>Giriş yap</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  flex:  { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingHorizontal: 24 },

  back: {
    width:           44,
    height:          44,
    alignItems:      "center",
    justifyContent:  "center",
    marginLeft:      -10,
    marginBottom:    8,
  },
  pageTitle: {
    fontFamily:    "Inter_700Bold",
    fontSize:      32,
    letterSpacing: -1.2,
    color:         "#000000",
    marginBottom:  32,
  },

  // Avatar
  avatarWrap: {
    alignSelf:      "center",
    marginBottom:   8,
    position:       "relative",
  },
  avatar: {
    width:        96,
    height:       96,
    borderRadius: 48,
  },
  avatarEmpty: {
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: "#F6F6F6",
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     "#E8E8E8",
    borderStyle:     "dashed",
  },
  avatarBadge: {
    position:        "absolute",
    bottom:          0,
    right:           0,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: "#000000",
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     2,
    borderColor:     "#FFFFFF",
  },
  avatarHint: {
    fontFamily:    "Inter_400Regular",
    fontSize:      13,
    color:         "#000000",
    opacity:       0.32,
    textAlign:     "center",
    marginBottom:  28,
  },

  // Form
  form: { gap: 16, marginBottom: 28 },

  // Button
  btn: {
    backgroundColor: "#000000",
    height:          56,
    borderRadius:    28,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    16,
  },
  btnOff: { opacity: 0.38 },
  btnText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      16,
    color:         "#FFFFFF",
    letterSpacing: -0.2,
  },

  // Login link
  link:     { alignItems: "center", paddingVertical: 8 },
  linkText: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#000000", opacity: 0.42 },
  linkBold: { fontFamily: "Inter_600SemiBold", opacity: 1, color: "#000000" },

  helperText: {
    fontFamily:    "Inter_400Regular",
    fontSize:      12,
    color:         "#000000",
    opacity:       0.38,
    lineHeight:    17,
    marginTop:     6,
    paddingHorizontal: 4,
  },
});

// ── Field styles (separate namespace) ─────────────────────────────────────────
const fs = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontFamily:    "Inter_500Medium",
    fontSize:      13,
    color:         "#000000",
    opacity:       0.55,
    letterSpacing: -0.1,
  },
  row: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: "#F7F7F7",
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     "#EFEFEF",
    paddingHorizontal: 16,
    height:          52,
  },
  input: {
    flex:          1,
    fontFamily:    "Inter_400Regular",
    fontSize:      16,
    color:         "#000000",
    letterSpacing: -0.1,
  },
  eyeBtn: { paddingLeft: 8 },
});
