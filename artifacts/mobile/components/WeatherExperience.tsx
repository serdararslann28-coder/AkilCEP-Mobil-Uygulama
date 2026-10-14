import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Linking, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import WeatherAtmosphere from "@/components/WeatherAtmosphere";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { searchWeatherCities, reportWeatherError, weatherErrorMessage, WeatherError, type WeatherPlace } from "@/lib/weather";
import type { useWeatherAtmosphere } from "@/hooks/useWeatherAtmosphere";

type Props = {
  weather: ReturnType<typeof useWeatherAtmosphere>;
  isDark: boolean; bottomInset: number; enabled: boolean;
};
type Status = "idle" | "loading" | "done" | "error";

export default function WeatherExperience({ weather, isDark, bottomInset, enabled }: Props) {
  const ink = isDark ? "#F2F0EC" : "#111111";
  const soft = isDark ? "rgba(242,240,236,0.62)" : "rgba(17,17,17,0.58)";
  const line = isDark ? "rgba(255,255,255,0.12)" : "rgba(17,17,17,0.09)";
  const sheet = isDark ? "#1E1E20" : "#FAFAFB";
  const open = enabled && weather.needsCity;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherPlace[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [serviceError, setServiceError] = useState("");
  const [searchAttempt, setSearchAttempt] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    const q = query.trim();
    if (!open || q.length < 2) { setResults([]); setStatus("idle"); return; }
    setResults([]); setStatus("loading"); setServiceError("");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchWeatherCities(q, controller.signal).then(list => {
        if (id !== seq.current || controller.signal.aborted) return;
        setResults(list); setStatus("done");
      }).catch(error => {
        if (id !== seq.current || controller.signal.aborted) return;
        reportWeatherError("city-search", error);
        if (error instanceof WeatherError && error.code.startsWith("provider_"))
          setServiceError(weatherErrorMessage(error));
        setResults([]); setStatus("error");
      });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, searchAttempt]);

  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const stateText = weather.loading ? "Hava durumu yükleniyor..."
    : weather.locating ? "Konumun bulunuyor..."
    : weather.error ? weather.error
    : status === "loading" ? "Aranıyor..."
    : status === "done" && results.length === 0 ? "Bu isimle bir yer bulamadık. Farklı yazmayı dene."
    : status === "error" ? serviceError || "Şehir araması yapılamadı. İnternet bağlantını kontrol edip yeniden ara."
    : query.trim().length < 2 ? "Şehir adını yazmaya başla." : "";
  const locate = weather.useDeviceLocation;

  return (
    <>
      <WeatherAtmosphere data={enabled ? weather.atmosphereData : null} active={enabled && weather.active}
        isDark={isDark} firstDailyEntry={weather.firstDailyEntry} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={weather.dismissCity} statusBarTranslucent>
        <KeyboardAvoidingView behavior="padding" style={styles.fill}>
          <Pressable style={styles.backdrop} onPress={weather.dismissCity} accessibilityLabel="Kapat" />
          <View style={[styles.sheet, { backgroundColor: sheet, paddingBottom: bottomInset + 16, borderColor: line }]}>
            <ScrollView style={{ minHeight: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 22, paddingBottom: 6 }}>
              <Text style={[styles.title, { color: ink }]}>Hava durumunu nerede görelim?</Text>
              <Text style={[styles.body, { color: soft }]}>
                Arka plan, bulunduğun yerin havasına göre hafifçe değişir. Konum seçersen yalnızca yaklaşık (kabaca 1 km) koordinatlar hava durumu hizmetine gönderilir; takip edilmezsin.
              </Text>
              <Pressable testID="weather-location-button" accessibilityRole="button" disabled={weather.locating || weather.loading}
                onPress={() => { void locate(); }} style={[styles.row, { borderColor: line, opacity: weather.locating || weather.loading ? 0.6 : 1 }]}>
                <Feather name="navigation" size={16} color={ink} />
                <Text style={[styles.rowText, { color: ink }]}>Mevcut konumumu kullan</Text>
              </Pressable>
              <TextInput testID="weather-city-input" value={query} onChangeText={value => { setQuery(value); weather.clearError(); }} placeholder="Şehir ara"
                onSubmitEditing={() => { weather.clearError(); setSearchAttempt(attempt => attempt + 1); }}
                placeholderTextColor={soft} autoCorrect={false} autoCapitalize="words" returnKeyType="search"
                accessibilityLabel="Şehir ara" style={[styles.input, { color: ink, borderColor: line }]} />
              <View testID="weather-city-search-state" accessibilityLiveRegion="polite" style={styles.state}>
                {(status === "loading" || weather.locating || weather.loading) && <ActivityIndicator size="small" color={soft} />}
                {stateText ? <Text style={[styles.hint, { color: soft }]}>{stateText}</Text> : null}
              </View>
              <View testID="weather-city-options">
                {results.map((r, i) => (
                  <Pressable key={`${r.latitude},${r.longitude}`} testID={`weather-city-result-${i}`} accessibilityRole="button"
                    disabled={weather.loading || weather.locating}
                    onPress={() => { void weather.selectPlace(r); }} style={[styles.row, { borderColor: line }]}>
                    <Feather name="map-pin" size={15} color={soft} />
                    <Text style={[styles.rowText, { color: ink }]} numberOfLines={2}>{r.name}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.foot}>
                <Pressable accessibilityRole="link" accessibilityLabel="Veri kaynağı ve lisans, yeni sayfada açılır" hitSlop={8}
                  onPress={() => { void Linking.openURL("https://open-meteo.com/en/docs/geocoding-api#attribution"); }}>
                  <Text style={[styles.hint, { color: soft, textDecorationLine: "underline" }]}>Veri kaynağı ve lisans</Text>
                </Pressable>
                <Pressable testID="weather-city-dismiss" accessibilityRole="button" hitSlop={10} onPress={weather.dismissCity}>
                  <Text style={[styles.rowText, { color: soft }]}>Daha sonra</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.28)" },
  sheet: { maxHeight: "86%", minHeight: 0, flexShrink: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0 },
  title: { fontSize: 19, fontWeight: "600", marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { fontSize: 15, flexShrink: 1 },
  input: { marginTop: 14, height: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 16 },
  state: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 8 },
  hint: { fontSize: 13, lineHeight: 18 },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16 },
});
