/**
 * AuthContext — authentication state for AkılCEP.
 *
 * When EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY are set,
 * uses real Supabase auth (email/password, OAuth).
 * Otherwise, uses a local-only session stored in AsyncStorage.
 * Guest mode always works locally — no backend required.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import * as WebBrowser from "expo-web-browser";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:          string;
  email:       string | null;
  fullName:    string | null;
  firstName:   string | null;
  username:    string | null;
  avatarUrl:   string | null;
  isGuest:     boolean;
  interests:   string[];
  memberSince: string | null;
}

export interface SignUpParams {
  email:    string;
  password: string;
  fullName: string;
  username: string;
}

export interface UpdateProfileParams {
  fullName: string;
  username: string;
}

interface AuthContextValue {
  user:            AuthUser | null;
  loading:         boolean;
  signUpWithEmail: (params: SignUpParams) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut:         () => Promise<void>;
  updateInterests: (interests: string[]) => Promise<void>;
  updateProfile:   (params: UpdateProfileParams) => Promise<void>;
  resetPassword:   (email: string) => Promise<void>;
  updateAvatar:    (uri: string) => Promise<void>;
}

// ─── Storage key ─────────────────────────────────────────────────────────────
const LOCAL_USER_KEY = "@akilcep_local_user";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function firstName(fullName: string | null): string | null {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0] ?? null;
}

function guestUser(): AuthUser {
  return {
    id:          "guest_" + Date.now(),
    email:       null,
    fullName:    "Misafir",
    firstName:   "Misafir",
    username:    null,
    avatarUrl:   null,
    isGuest:     true,
    interests:   [],
    memberSince: new Date().toISOString(),
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue>({
  user:            null,
  loading:         true,
  signUpWithEmail: async () => {},
  signInWithEmail: async () => {},
  continueAsGuest: async () => {},
  signOut:         async () => {},
  updateInterests: async () => {},
  updateProfile:   async () => {},
  resetPassword:   async () => {},
  updateAvatar:    async () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Load session on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        if (isSupabaseConfigured) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await loadSupabaseProfile(session.user.id, session.user.email ?? null);
          }
        }
        // Restore local guest/mock session
        const stored = await AsyncStorage.getItem(LOCAL_USER_KEY);
        if (stored && !user) {
          setUser(JSON.parse(stored) as AuthUser);
        }
      } catch { /* ignore */ }
      finally   { setLoading(false); }
    })();

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (session?.user) {
            await loadSupabaseProfile(session.user.id, session.user.email ?? null);
          } else {
            const stored = await AsyncStorage.getItem(LOCAL_USER_KEY);
            setUser(stored ? JSON.parse(stored) as AuthUser : null);
          }
        },
      );
      unsubscribe = () => subscription.unsubscribe();
    }

    return () => unsubscribe?.();
  }, []);

  const loadSupabaseProfile = async (id: string, email: string | null) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      const u: AuthUser = {
        id,
        email,
        fullName:    data?.full_name  ?? null,
        firstName:   firstName(data?.full_name ?? null),
        username:    data?.username   ?? null,
        avatarUrl:   data?.avatar_url ?? null,
        isGuest:     false,
        interests:   data?.interests  ?? [],
        memberSince: data?.created_at ?? new Date().toISOString(),
      };
      setUser(u);
    } catch {
      // profiles table not yet migrated — set minimal user object
      setUser({
        id, email,
        fullName: null, firstName: null, username: null,
        avatarUrl: null, isGuest: false, interests: [], memberSince: null,
      });
    }
  };

  const saveLocal = async (u: AuthUser) => {
    setUser(u);
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u));
  };

  // ── Sign up ───────────────────────────────────────────────────────────────
  const signUpWithEmail = useCallback(async ({
    email, password, fullName, username,
  }: SignUpParams) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, username } },
      });
      if (error) throw new Error(error.message);
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name:  fullName,
          username,
          email,
          created_at: new Date().toISOString(),
        });
        await loadSupabaseProfile(data.user.id, email);
      }
    } else {
      // Local fallback — works without Supabase credentials
      const u: AuthUser = {
        id:          "local_" + Date.now(),
        email,
        fullName,
        firstName:   firstName(fullName),
        username,
        avatarUrl:   null,
        isGuest:     false,
        interests:   [],
        memberSince: new Date().toISOString(),
      };
      await saveLocal(u);
    }
  }, []);

  // ── Sign in ───────────────────────────────────────────────────────────────
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase yapılandırılmamış. Lütfen ortam değişkenlerini ekleyin.");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  // ── Guest ─────────────────────────────────────────────────────────────────
  const continueAsGuest = useCallback(async () => {
    await saveLocal(guestUser());
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && !user?.isGuest) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    await AsyncStorage.removeItem(LOCAL_USER_KEY);
    setUser(null);
  }, [user]);

  // ── Interests ─────────────────────────────────────────────────────────────
  const updateInterests = useCallback(async (interests: string[]) => {
    if (!user) return;
    const updated: AuthUser = { ...user, interests };
    setUser(updated);
    if (isSupabaseConfigured && !user.isGuest) {
      await supabase.from("profiles").update({ interests }).eq("id", user.id);
    } else {
      await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updated));
    }
  }, [user]);

  // ── Update profile ────────────────────────────────────────────────────────
  const updateProfile = useCallback(async ({ fullName, username }: UpdateProfileParams) => {
    if (!user) return;
    const fn = firstName(fullName);
    const updated: AuthUser = { ...user, fullName, firstName: fn, username: username || null };
    setUser(updated);
    if (isSupabaseConfigured && !user.isGuest) {
      await supabase.from("profiles")
        .update({ full_name: fullName, username: username || null })
        .eq("id", user.id);
    } else {
      await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updated));
    }
  }, [user]);

  // ── Password reset ────────────────────────────────────────────────────────
  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase yapılandırılmamış.");
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  }, []);

  // ── Update avatar ─────────────────────────────────────────────────────────
  const updateAvatar = useCallback(async (uri: string) => {
    if (!user) return;
    const updated: AuthUser = { ...user, avatarUrl: uri };
    setUser(updated);
    if (isSupabaseConfigured && !user.isGuest) {
      try {
        const ext  = uri.split(".").pop() ?? "jpg";
        const path = `avatars/${user.id}.${ext}`;
        const resp = await fetch(uri);
        const blob = await resp.blob();
        await supabase.storage.from("avatars").upload(path, blob, { upsert: true });
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        const publicUrl = data.publicUrl;
        await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
        setUser({ ...updated, avatarUrl: publicUrl });
      } catch { /* fall back to local URI */ }
    } else {
      await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updated));
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, loading,
      signUpWithEmail, signInWithEmail,
      continueAsGuest, signOut,
      updateInterests, updateProfile, resetPassword, updateAvatar,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
