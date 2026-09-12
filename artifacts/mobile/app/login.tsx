/**
 * AkılCEP — Login Screen
 *
 * Pure white, Apple HIG. Email + password form,
 * forgot password link, "Giriş Yap" black pill → /chat.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
  Alert,
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
import { useLanguage } from "@/context/LanguageContext";

export default function LoginScreen() {
  const insets                           = useSafeAreaInsets();
  const { signInWithEmail, resetPassword } = useAuth();
  const { t }                            = useLanguage();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const refPassword = useRef<TextInput | null>(null);

  const handleLogin = async () => {
    if (!email.trim())    { Alert.alert(t("common.error"), t("auth.emailRequired")); return; }
    if (!password.trim()) { Alert.alert(t("common.error"), t("auth.passwordRequired")); return; }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      router.replace("/chat");
    } catch (e: unknown) {
      Alert.alert(t("auth.loginError"), e instanceof Error ? e.message : t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      Alert.alert(t("auth.forgotPassword"), t("auth.emailFirst"));
      return;
    }
    try {
      await resetPassword(email.trim());
      Alert.alert(
        t("auth.emailSent"),
        t("auth.resetEmailSent"),
      );
    } catch (e: unknown) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : t("auth.genericError"));
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

        <Text style={ss.pageTitle}>{t("auth.signIn")}</Text>
        <Text style={ss.pageSub}>{t("auth.signInSubtitle")}</Text>

        {/* E-posta */}
        <View style={ss.fieldWrap}>
          <Text style={ss.label}>{t("auth.email")}</Text>
          <TextInput
            style={ss.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            placeholderTextColor="#C4C4C4"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => refPassword.current?.focus()}
          />
        </View>

        {/* Şifre */}
        <View style={ss.fieldWrap}>
          <View style={ss.labelRow}>
            <Text style={ss.label}>{t("auth.password")}</Text>
            <TouchableOpacity onPress={handleForgot} hitSlop={8}>
              <Text style={ss.forgotText}>{t("auth.forgotPassword")}</Text>
            </TouchableOpacity>
          </View>
          <View style={ss.passRow}>
            <TextInput
              ref={refPassword}
              style={ss.passInput}
              value={password}
              onChangeText={setPassword}
               placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor="#C4C4C4"
              secureTextEntry={!showPass}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              onPress={() => setShowPass(v => !v)}
              style={ss.eyeBtn}
              hitSlop={8}
            >
              <Feather
                name={showPass ? "eye-off" : "eye"}
                size={17}
                color="#BBBBBB"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[ss.btn, loading && ss.btnOff]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={ss.btnText}>
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </Text>
        </TouchableOpacity>

        {/* Register link */}
        <TouchableOpacity
          onPress={() => router.replace("/register")}
          style={ss.link}
        >
          <Text style={ss.linkText}>
            {t("auth.noAccount")}{" "}
            <Text style={ss.linkBold}>{t("auth.createAccountShort")}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ss = StyleSheet.create({
  flex:  { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingHorizontal: 24 },

  back: {
    width:          44,
    height:         44,
    alignItems:     "center",
    justifyContent: "center",
    marginLeft:     -10,
    marginBottom:   8,
  },
  pageTitle: {
    fontFamily:    "Inter_700Bold",
    fontSize:      36,
    letterSpacing: -1.5,
    color:         "#000000",
    marginBottom:  6,
  },
  pageSub: {
    fontFamily:    "Inter_400Regular",
    fontSize:      16,
    color:         "#000000",
    opacity:       0.38,
    letterSpacing: -0.1,
    marginBottom:  40,
  },

  fieldWrap: { gap: 6, marginBottom: 20 },
  label: {
    fontFamily:    "Inter_500Medium",
    fontSize:      13,
    color:         "#000000",
    opacity:       0.55,
    letterSpacing: -0.1,
  },
  labelRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  forgotText: {
    fontFamily:    "Inter_400Regular",
    fontSize:      13,
    color:         "#000000",
    opacity:       0.38,
  },
  input: {
    backgroundColor: "#F7F7F7",
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     "#EFEFEF",
    paddingHorizontal: 16,
    height:          52,
    fontFamily:      "Inter_400Regular",
    fontSize:        16,
    color:           "#000000",
  },
  passRow: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: "#F7F7F7",
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     "#EFEFEF",
    paddingHorizontal: 16,
    height:          52,
  },
  passInput: {
    flex:          1,
    fontFamily:    "Inter_400Regular",
    fontSize:      16,
    color:         "#000000",
  },
  eyeBtn: { paddingLeft: 8 },

  btn: {
    backgroundColor: "#000000",
    height:          56,
    borderRadius:    28,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    16,
    marginTop:       8,
  },
  btnOff: { opacity: 0.38 },
  btnText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      16,
    color:         "#FFFFFF",
    letterSpacing: -0.2,
  },

  link:     { alignItems: "center", paddingVertical: 8 },
  linkText: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#000000", opacity: 0.42 },
  linkBold: { fontFamily: "Inter_600SemiBold", opacity: 1, color: "#000000" },
});
