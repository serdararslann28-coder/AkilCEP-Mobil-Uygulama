/**
 * Supabase client for AkılCEP.
 *
 * Credentials are read from EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * If not set, isSupabaseConfigured is false and AuthContext uses a local-only fallback.
 * The app works fully in both modes — guest mode never requires Supabase.
 */
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// True only when real project credentials are present
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;

// Always create a client — calls fail gracefully when using placeholder values
export const supabase = createClient(
  SUPABASE_URL      || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder_anon_key_akilcep",
  {
    auth: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storage:            AsyncStorage as any,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
    },
  },
);
