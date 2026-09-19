/**
 * Klient Supabase.
 *
 * Konfiguracja pochodzi z pliku .env (przez app.config.js), wiec w repozytorium
 * nie ma zadnych kluczy. Klucz `anon` jest publiczny z zalozenia - o tym, kto co
 * moze przeczytac i zapisac, decyduja reguly RLS po stronie bazy, a nie klient.
 *
 * ============================ PRYWATNOSC ============================
 * Tym kanalem plyna WYLACZNIE liczby i daty: wyniki treningow, cele, streak
 * i lista znajomych. Obraz z kamery nigdy tu nie trafia - nie ma nawet kodu,
 * ktory móglby go wyslac.
 * ====================================================================
 */
import 'react-native-url-polyfill/auto';

import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { secureStorageAdapter } from './secureStorage';

interface Extra {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  googleWebClientId?: string;
  googleIosClientId?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const SUPABASE_URL = extra.supabaseUrl ?? '';
export const SUPABASE_ANON_KEY = extra.supabaseAnonKey ?? '';
export const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId ?? '';
export const GOOGLE_IOS_CLIENT_ID = extra.googleIosClientId ?? '';

/**
 * Czy backend jest skonfigurowany. Gdy nie jest, aplikacja nadal dziala
 * w trybie lokalnym (trening, cele, statystyki) - znikaja tylko funkcje
 * wymagajace konta. To celowe: chcemy, zeby swiezo sklonowany projekt dalo
 * sie uruchomic i przetestowac jeszcze przed zalozeniem konta Supabase.
 */
export const isBackendConfigured = (): boolean =>
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;

export const isGoogleConfigured = (): boolean => GOOGLE_WEB_CLIENT_ID.includes('.apps.google');

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isBackendConfigured()) return null;

  if (client === null) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: secureStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        // W aplikacji mobilnej nie ma adresu URL z tokenem do przechwycenia.
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}
