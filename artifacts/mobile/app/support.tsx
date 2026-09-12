import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "@/context/LanguageContext";

type SupportItem = {
  icon: React.ComponentProps<typeof Feather>["name"];
  tr: string;
  en: string;
  route?: "/about";
};

const ITEMS: SupportItem[] = [
  { icon: "help-circle", tr: "Yardım Merkezi", en: "Help Center" },
  { icon: "message-circle", tr: "Sık Sorulan Sorular", en: "Frequently Asked Questions" },
  { icon: "mail", tr: "Bize Ulaşın", en: "Contact Us" },
  { icon: "alert-triangle", tr: "Sorun Bildir", en: "Report a Problem" },
  { icon: "message-square", tr: "Geri Bildirim Gönder", en: "Send Feedback" },
  { icon: "info", tr: "AkılCEP Hakkında", en: "About AkılCEP", route: "/about" },
];

export default function SupportScreen() {
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 20 : insets.top;

  return (
    <View style={[ss.root, { paddingTop: top }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={ss.back}
        hitSlop={12}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={lang === "tr" ? "Geri" : "Back"}
      >
        <Feather name="chevron-left" size={20} color="#111111" />
      </TouchableOpacity>
      <Text style={ss.title}>{lang === "tr" ? "Destek" : "Support"}</Text>
      <View style={ss.list}>
        {ITEMS.map((item, index) => (
          <TouchableOpacity
            key={item.tr}
            style={[ss.row, index < ITEMS.length - 1 && ss.divider]}
            onPress={() => item.route && router.push(item.route)}
            activeOpacity={0.58}
          >
            <Feather name={item.icon} size={17} color="#555A60" />
            <Text style={ss.label}>{lang === "tr" ? item.tr : item.en}</Text>
            <Feather name="chevron-right" size={16} color="#B7BBC0" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  back: {
    width: 40,
    height: 40,
    marginLeft: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#F4F4F5",
  },
  title: {
    marginTop: 8,
    marginHorizontal: 20,
    marginBottom: 18,
    color: "#111111",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
  },
  list: { marginHorizontal: 20 },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5E7",
  },
  label: {
    flex: 1,
    color: "#171719",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});