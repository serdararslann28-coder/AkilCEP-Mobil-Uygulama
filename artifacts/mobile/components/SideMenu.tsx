/**
 * SideMenu — Premium AkılCEP side drawer.
 *
 * Layout: fixed safe-area header, scrollable conversation history,
 * and fixed safe-area bottom actions.
 *
 * Visual: edge-to-edge, card-free conversation history.
 * Gesture: Swipe-left closes the drawer.
 */
import { Feather }   from "@expo/vector-icons";
import {
  BookOpen,
  Clock,
  Folder,
  Grid,
} from "lucide-react-native";
import * as Haptics  from "expo-haptics";
import { router }    from "expo-router";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Image,
  Modal,
  PanResponder,
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
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChat }     from "@/context/ChatContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme }    from "@/context/ThemeContext";
import ProfileMenu     from "@/components/ProfileMenu";

// ─── Constants ─────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");
const MENU_W = Math.min(Math.round(SCREEN_W * 0.80), 360);

const leafLogo      = require("@/assets/images/leaf-only-transparent.png");
const defaultAvatar = require("@/assets/images/avatar.png");

// ─── Date grouping helpers (createdAt is a number/ms timestamp) ────────────────
function getDateGroup(ts: number, t: (k: string) => string): string {
  const now  = new Date();
  const date = new Date(ts);
  const isSameDay =
    now.getDate()     === date.getDate()     &&
    now.getMonth()    === date.getMonth()    &&
    now.getFullYear() === date.getFullYear();
  if (isSameDay) return t("sidebar.today");
  const diffDays = (now.getTime() - date.getTime()) / 86_400_000;
  if (diffDays < 2)  return t("sidebar.yesterday");
  if (diffDays < 7)  return t("sidebar.thisWeek");
  if (diffDays < 30) return t("sidebar.thisMonth");
  return t("sidebar.earlier");
}

interface ConversationRowProps {
  title: string;
  isActive: boolean;
  foreground: string;
  onSelect: () => void;
  onRequestDelete: () => void;
}

function ConversationRow({
  title,
  isActive,
  foreground,
  onSelect,
  onRequestDelete,
}: ConversationRowProps) {
  const suppressPressRef = useRef(false);
  const longPressConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (longPressConfirmTimerRef.current) {
      clearTimeout(longPressConfirmTimerRef.current);
    }
  }, []);

  const horizontalDragResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.6,
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.6,
      onPanResponderGrant: () => {
        suppressPressRef.current = true;
        if (longPressConfirmTimerRef.current) {
          clearTimeout(longPressConfirmTimerRef.current);
          longPressConfirmTimerRef.current = null;
        }
      },
      onPanResponderRelease: () => {
        suppressPressRef.current = true;
      },
    }),
  ).current;

  return (
    <View
      {...horizontalDragResponder.panHandlers}
    >
      <TouchableOpacity
        style={ss.convRow}
        onPress={() => {
          if (suppressPressRef.current) {
            suppressPressRef.current = false;
            return;
          }
          onSelect();
        }}
        onLongPress={() => {
          longPressConfirmTimerRef.current = setTimeout(() => {
            longPressConfirmTimerRef.current = null;
            if (!suppressPressRef.current) onRequestDelete();
          }, 150);
        }}
        delayLongPress={500}
        activeOpacity={0.68}
      >
        <Feather
          name="message-square"
          size={16}
          color={foreground}
          style={{ opacity: isActive ? 0.72 : 0.48, flexShrink: 0 }}
        />
        <Text
          style={[
            ss.convTitle,
            { color: foreground, opacity: isActive ? 1 : 0.88 },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Feather
          name="chevron-right"
          size={15}
          color={foreground}
          style={{ opacity: 0.32, flexShrink: 0 }}
        />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
interface Props { visible: boolean; onClose: () => void; onOpen: () => void; }
type DeletePrompt = { id: string } | null;

export interface SideMenuHandle {
  updateOpeningGesture: (distance: number) => void;
  finishOpeningGesture: (distance: number, velocity: number) => void;
}

const SideMenu = forwardRef<SideMenuHandle, Props>(function SideMenu(
  { visible, onClose, onOpen },
  ref,
) {
  const { theme: T } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 34 : insets.bottom;
  const isDark = T.isDark;
  const drawerForeground = "#111111";
  const drawerMuted = "rgba(17,17,17,0.42)";

  const {
    conversations,
    currentConversation,
    loadConversation,
    startNewConversation,
    deleteConversation,
  } = useChat();

  // UI state
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletePrompt, setDeletePrompt] = useState<DeletePrompt>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const panelPointerStartRef = useRef({ x: 0, y: 0 });
  const panelPointerSwipingRef = useRef(false);

  // ── Slide-in animation ────────────────────────────────────────────────────────
  const translateX = useSharedValue(-MENU_W);
  const backdropOp = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateX.value = withSpring(0, { damping: 26, stiffness: 200, mass: 0.9 });
      backdropOp.value = withTiming(1, { duration: 280 });
    } else {
      setSearchOpen(false);
      setSearchQuery("");
      translateX.value = withTiming(-MENU_W, { duration: 260, easing: Easing.in(Easing.ease) });
      backdropOp.value = withTiming(0, { duration: 230 });
    }
  }, [visible]);

  const panelAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const backdropAnim = useAnimatedStyle(() => ({
    opacity: backdropOp.value,
  }));

  const onOpenRef = useRef(onOpen);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);

  useImperativeHandle(ref, () => ({
    updateOpeningGesture: (distance) => {
      const progress = Math.min(Math.max(distance, 0), MENU_W);
      translateX.value = -MENU_W + progress;
      backdropOp.value = progress / MENU_W;
    },
    finishOpeningGesture: (distance, velocity) => {
      const openDistance = Math.min(MENU_W * 0.28, 32);
      if (distance >= openDistance || velocity > 0.55) {
        onOpenRef.current();
      } else {
        translateX.value = withSpring(-MENU_W, { damping: 26, stiffness: 220 });
        backdropOp.value = withTiming(0, { duration: 180 });
      }
    },
  }), []);

  // ── Swipe-left-to-close gesture ───────────────────────────────────────────────
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const panelPointerHandlers = {
    onPointerDownCapture: (event: {
      nativeEvent: { clientX: number; clientY: number };
    }) => {
      if (Platform.OS !== "web") return;
      panelPointerStartRef.current = {
        x: event.nativeEvent.clientX,
        y: event.nativeEvent.clientY,
      };
      panelPointerSwipingRef.current = false;
    },
    onPointerMoveCapture: (event: {
      nativeEvent: { clientX: number; clientY: number };
    }) => {
      if (Platform.OS !== "web") return;
      const dx = event.nativeEvent.clientX - panelPointerStartRef.current.x;
      const dy = event.nativeEvent.clientY - panelPointerStartRef.current.y;
      panelPointerSwipingRef.current =
        dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.8;
    },
    onPointerUpCapture: (event: {
      nativeEvent: { clientX: number };
    }) => {
      if (Platform.OS !== "web" || !panelPointerSwipingRef.current) return;
      const dx = event.nativeEvent.clientX - panelPointerStartRef.current.x;
      panelPointerSwipingRef.current = false;
      if (dx < -20) onCloseRef.current();
    },
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.8,
      onPanResponderMove: (_, { dx }) => {
        if (dx < 0) {
          translateX.value = Math.max(dx, -MENU_W);
          backdropOp.value = 1 - Math.min(Math.abs(dx) / MENU_W, 1);
        }
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx < -(MENU_W * 0.28) || vx < -0.55) {
          onCloseRef.current();
        } else {
          translateX.value = withSpring(0, { damping: 26, stiffness: 220 });
          backdropOp.value = withTiming(1, { duration: 180 });
        }
      },
    })
  ).current;

  // ── Filtered & grouped conversations ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  // ── Navigate helpers ──────────────────────────────────────────────────────────
  function go(path: string) {
    onClose();
    setTimeout(() => router.push(path as any), 180);
  }

  function handleNewChat() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startNewConversation();
    onClose();
    setTimeout(() => router.push("/chat"), 180);
  }

  function confirmDeleteConversation(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeletePrompt({ id });
  }

  function cancelDelete() {
    setDeletePrompt(null);
  }

  function applyDelete() {
    if (deletePrompt) deleteConversation(deletePrompt.id);
    setDeletePrompt(null);
  }

  // ── Derived color tokens ──────────────────────────────────────────────────────
  const muted         = drawerMuted;
  const inputBg       = "rgba(0,0,0,0.05)";
  const ghostSurface  = "#FFFFFF";

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <>
      <Animated.View
        style={[ss.backdrop, backdropAnim]}
        pointerEvents={visible ? "auto" : "none"}
        {...panResponder.panHandlers}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[ss.panel, { width: MENU_W, backgroundColor: ghostSurface }, panelAnim]}
        pointerEvents={visible ? "auto" : "none"}
        {...panelPointerHandlers}
        {...panResponder.panHandlers}
      >
        <View style={[ss.ghostHeaderCard, { paddingTop: topPad + 18 }]}>
          <View style={ss.header}>
            <View pointerEvents="none" style={ss.brandOverlay}>
              <Image
                source={leafLogo}
                style={[ss.brandLogo, { tintColor: drawerForeground }]}
                resizeMode="contain"
              />
              <Text style={[ss.brandName, { color: drawerForeground }]}>AkılCEP</Text>
            </View>

            <View style={ss.headerIcons}>
              <TouchableOpacity
                style={ss.iconBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchOpen(v => !v);
                  if (searchOpen) setSearchQuery("");
                }}
                hitSlop={10}
                activeOpacity={0.65}
              >
                <Feather name={searchOpen ? "x" : "search"} size={18} color={drawerForeground} />
              </TouchableOpacity>

            </View>
          </View>

          {searchOpen && (
            <View style={ss.searchBar}>
              <Feather name="search" size={14} color={muted} />
              <TextInput
                style={[ss.searchInput, { color: drawerForeground, backgroundColor: inputBg }]}
                placeholder={t("sidebar.searchPlaceholder")}
                placeholderTextColor={muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={10}>
                  <Feather name="x-circle" size={15} color={muted} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <ScrollView
          style={ss.scroll}
          contentContainerStyle={ss.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
        >
          <View style={ss.navGroup}>
            <TouchableOpacity style={ss.navRow} activeOpacity={0.62}>
              <BookOpen size={20} color={drawerForeground} strokeWidth={1.8} />
              <Text style={[ss.navText, { color: drawerForeground }]}>Kitaplık</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.navRow} activeOpacity={0.62}>
              <Folder size={20} color={drawerForeground} strokeWidth={1.8} />
              <Text style={[ss.navText, { color: drawerForeground }]}>Projeler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.navRow} activeOpacity={0.62}>
              <Clock size={20} color={drawerForeground} strokeWidth={1.8} />
              <Text style={[ss.navText, { color: drawerForeground }]}>Zamanlandı</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.navRow} activeOpacity={0.62}>
              <Grid size={20} color={drawerForeground} strokeWidth={1.8} />
              <Text style={[ss.navText, { color: drawerForeground }]}>Eklentiler</Text>
            </TouchableOpacity>
          </View>

          <Text style={[ss.historySectionTitle, { color: drawerForeground }]}>
            Geçmiş Sohbetler
          </Text>
          {filtered.length === 0 ? (
            <Text style={[ss.emptyText, { color: muted }]}>
              {searchQuery.trim() ? t("sidebar.noResults") : t("sidebar.emptyHistory")}
            </Text>
          ) : (
            filtered.map(conv => {
              const isActive = conv.id === currentConversation?.id;
              return (
                <ConversationRow
                  key={conv.id}
                  title={conv.title}
                  isActive={isActive}
                  foreground={drawerForeground}
                  onSelect={() => {
                    Haptics.selectionAsync();
                    loadConversation(conv.id);
                    onClose();
                    setTimeout(() => router.push("/chat"), 160);
                  }}
                  onRequestDelete={() => confirmDeleteConversation(conv.id)}
                />
              );
            })
          )}
        </ScrollView>

        <View
          style={[
            ss.bottomArea,
            { paddingBottom: btmPad },
          ]}
        >
          <View style={ss.bottomActions}>
            <TouchableOpacity
              style={ss.fab}
              onPress={handleNewChat}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={t("sidebar.newChat")}
            >
              <Feather name="edit-3" size={22} color={drawerForeground} />
              <Text style={[ss.fabLabel, { color: drawerForeground }]}>Sohbet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ss.avatarButton}
              onPress={() => setProfileMenuOpen(true)}
              activeOpacity={0.76}
              accessibilityRole="button"
              accessibilityLabel={t("profileMenu.profile")}
            >
              <Image source={defaultAvatar} style={ss.bottomAvatar} resizeMode="cover" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <Modal
        visible={deletePrompt !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={cancelDelete}
      >
        <View style={ss.confirmOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cancelDelete} />
          <View
            style={[
              ss.confirmCard,
              {
                backgroundColor: isDark ? "#171719" : "#FFFFFF",
                borderColor: isDark
                  ? "rgba(255,255,255,0.10)"
                  : "rgba(0,0,0,0.08)",
              },
            ]}
          >
            <Text style={[ss.confirmTitle, { color: T.fg }]}>
              {t("sidebar.deleteConversationTitle")}
            </Text>
            <Text style={[ss.confirmMessage, { color: T.fgSoft }]}>
              {t("sidebar.deleteConversationMessage")}
            </Text>
            <View style={ss.confirmActions}>
              <TouchableOpacity
                style={ss.confirmCancel}
                onPress={cancelDelete}
                activeOpacity={0.65}
              >
                <Text style={[ss.confirmCancelText, { color: T.fg }]}>
                  {t("sidebar.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={ss.confirmDelete}
                onPress={applyDelete}
                activeOpacity={0.78}
              >
                <Text style={ss.confirmDeleteText}>
                  {t("sidebar.delete")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ProfileMenu
        visible={profileMenuOpen}
        onClose={() => setProfileMenuOpen(false)}
      />
    </>
  );
});

export default SideMenu;

// ─── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  backdrop: {
    position:        "absolute",
    top:             0,
    right:           0,
    bottom:          0,
    left:            0,
    zIndex:          400,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  // Full-screen menu surface
  panel: {
    position:  "absolute",
    top:       0,
    bottom:    0,
    left:      0,
    zIndex:    401,
  },

  ghostHeaderCard: {
    flexShrink:      0,
    opacity:         1,
    backgroundColor: "transparent",
    borderWidth:     0,
    borderColor:     "transparent",
    borderRadius:    0,
    shadowColor:     "transparent",
    shadowOpacity:   0,
    shadowRadius:    0,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       0,
    boxShadow:       "none",
  },

  header: {
    position:          "relative",
    height:            46,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "flex-end",
    paddingHorizontal: 20,
  },

  brandOverlay: {
    position:      "absolute",
    left:          0,
    right:         0,
    top:           0,
    bottom:        0,
    flexDirection: "row",
    alignItems:    "center",
    justifyContent:"center",
    gap:           9,
  },

  brandLogo: {
    width:  30,
    height: 30,
  },

  brandName: {
    fontSize:      18,
    fontFamily:    "Inter_700Bold",
    letterSpacing: 1.8,
  },

  brandSub: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.1,
    marginLeft:    30,
  },

  headerIcons: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    zIndex:        1,
  },

  iconBtn: {
    width:          34,
    height:         34,
    borderRadius:   17,
    alignItems:     "center",
    justifyContent: "center",
  },

  // ── Search bar ───────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingVertical:   10,
    gap:               8,
  },

  searchInput: {
    flex:          1,
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
    paddingHorizontal: 10,
    paddingVertical:   7,
    borderRadius:  10,
  },

  navGroup: {
    paddingHorizontal: 20,
    paddingTop:        0,
    paddingBottom:     8,
    gap:               2,
  },

  navRow: {
    minHeight:      44,
    flexDirection:  "row",
    alignItems:     "center",
    gap:            14,
  },

  navText: {
    fontSize:      16,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.2,
  },

  // ── Profile card ─────────────────────────────────────────────────────────────
  profileCard: {
    flexDirection:     "row",
    alignItems:        "center",
    marginHorizontal:  14,
    marginTop:         14,
    marginBottom:      4,
    paddingHorizontal: 14,
    paddingVertical:   13,
    borderRadius:      16,
    borderWidth:       StyleSheet.hairlineWidth,
    gap:               12,
    zIndex:            2,
  },

  profileAvatar: {
    width:        44,
    height:       44,
    borderRadius: 22,
    flexShrink:   0,
  },

  profileInfo: {
    flex:            1,
    justifyContent:  "center",
  },

  profileName: {
    fontSize:      15,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.2,
  },

  statusRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           5,
  },

  statusDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },

  statusLabel: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
  },

  // Full-width hairline
  fullDivider: {
    height:          StyleSheet.hairlineWidth,
    marginTop:       12,
    marginBottom:    2,
  },

  // ── Scroll area ──────────────────────────────────────────────────────────────
  scroll: {
    flex:       1,
    minHeight:  0,
    overflow:   "scroll",
    zIndex:     1,
  },

  scrollContent: {
    paddingTop:    0,
    paddingBottom: 6,
  },

  historySectionTitle: {
    fontSize:          11,
    fontFamily:        "Inter_500Medium",
    letterSpacing:     0.8,
    textTransform:     "uppercase",
    paddingHorizontal: 20,
    paddingTop:        18,
    paddingBottom:     8,
  },

  // Group
  group: {
    marginBottom: 4,
  },

  groupLabel: {
    fontSize:          11,
    fontFamily:        "Inter_500Medium",
    letterSpacing:     0.6,
    textTransform:     "uppercase",
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     4,
  },

  // Conversation row
  convRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 20,
    minHeight:         52,
    paddingVertical:   14,
    gap:               12,
    position:          "relative",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },

  convTitle: {
    flex:          1,
    fontSize:      16,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.2,
  },

  // Empty state
  emptyText: {
    fontSize:          14,
    fontFamily:        "Inter_400Regular",
    letterSpacing:     -0.1,
    paddingHorizontal: 20,
    paddingTop:        24,
    fontStyle:         "italic",
  },

  confirmOverlay: {
    flex:            1,
    alignItems:      "center",
    justifyContent:  "center",
    paddingHorizontal: 28,
    backgroundColor: "rgba(0,0,0,0.34)",
  },

  confirmCard: {
    width:           "100%",
    maxWidth:        330,
    borderRadius:    20,
    borderWidth:     StyleSheet.hairlineWidth,
    padding:         20,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 12 },
    shadowOpacity:   0.18,
    shadowRadius:    28,
    elevation:       12,
  },

  confirmTitle: {
    fontSize:      17,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.25,
  },

  confirmMessage: {
    marginTop:     8,
    fontSize:      13.5,
    lineHeight:    20,
    fontFamily:    "Inter_400Regular",
  },

  confirmActions: {
    marginTop:      20,
    flexDirection:  "row",
    justifyContent: "flex-end",
    gap:            10,
  },

  confirmCancel: {
    minWidth:        82,
    height:          42,
    borderRadius:    12,
    alignItems:      "center",
    justifyContent:  "center",
    paddingHorizontal: 14,
  },

  confirmCancelText: {
    fontSize:   13.5,
    fontFamily: "Inter_500Medium",
  },

  confirmDelete: {
    minWidth:        82,
    height:          42,
    borderRadius:    12,
    alignItems:      "center",
    justifyContent:  "center",
    paddingHorizontal: 14,
    backgroundColor: "#C83E3E",
  },

  confirmDeleteText: {
    color:      "#FFFFFF",
    fontSize:   13.5,
    fontFamily: "Inter_600SemiBold",
  },

  // ── Bottom area ───────────────────────────────────────────────────────────────
  bottomArea: {
    flexShrink:        0,
    paddingHorizontal: 16,
    zIndex:            2,
  },

  bottomActions: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    width:             "100%",
  },

  fab: {
    flexShrink:      0,
    height:          46,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "flex-start",
    paddingHorizontal: 2,
    gap:             8,
  },

  fabLabel: {
    fontSize:      16,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.2,
  },

  avatarButton: {
    width:          44,
    height:         44,
    borderRadius:   22,
    overflow:       "hidden",
  },

  bottomAvatar: {
    width:        "100%",
    height:       "100%",
    borderRadius: 22,
  },

});
