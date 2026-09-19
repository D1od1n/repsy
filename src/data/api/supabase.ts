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

import { Platform } from 'react-native';
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

/**
 * Czy logowanie Google jest dostepne.
 *
 * Na telefonie aplikacja sama rozmawia z Google, wiec musi znac Client ID.
 * W przegladarce robi to za nas Supabase - identyfikator i sekret klienta leza
 * w panelu projektu, a NIE w kodzie strony (sekret nigdy nie moze trafic do
 * frontendu). Dlatego na web wystarczy skonfigurowany backend; wymaganie tam
 * zmiennej z Client ID blednie blokowaloby logowanie.
 */
export const isGoogleConfigured = (): boolean =>
  Platform.OS === 'web' ? isBackendConfigured() : GOOGLE_WEB_CLIENT_ID.includes('.apps.google');

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isBackendConfigured()) return null;

  if (client === null) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: secureStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        // Po logowaniu przez Google/Apple w przegladarce Supabase wraca na
        // nasz adres z tokenem w czesci URL. Bez tej flagi token zostalby
        // zignorowany i uzytkownik po powrocie nadal bylby wylogowany.
        // W aplikacji mobilnej takiego przekierowania nie ma - token przychodzi
        // prosto z natywnego SDK - wiec tam flaga jest wylaczona.
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    });
  }

  return client;
}
