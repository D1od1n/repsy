/**
 * Logowanie i profil uzytkownika.
 *
 * Wspieramy Google (dziala na iPhone i Androidzie, nie wymaga platnego konta
 * Apple) oraz Sign in with Apple, ktory pokazujemy tylko wtedy, gdy urzadzenie
 * faktycznie go obsluguje.
 *
 * Jest tez tryb lokalny: gdy backend nie zostal jeszcze skonfigurowany, cala
 * aplikacja dziala bez konta - trening, cele, streak i statystyki. Znikaja
 * tylko funkcje spoleczne. Dzieki temu swiezo pobrany projekt da sie uruchomic
 * i przetestowac, zanim ktokolwiek zalozy konto Supabase.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';

import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  getSupabase,
  isBackendConfigured,
  isGoogleConfigured,
} from '../../data/api/supabase';
import { fetchProfile, claimUsername } from '../../data/api/profileApi';
import type { Profile } from '../../core/model';

export type AuthStatus =
  | 'loading'
  | 'signed-out'
  /** Zalogowany, ale nie wybral jeszcze nazwy uzytkownika. */
  | 'needs-username'
  | 'ready'
  /** Backend niedostepny albo uzytkownik swiadomie zostal bez konta. */
  | 'local-only';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  /** Klucz tlumaczenia komunikatu bledu. */
  errorKey: string | null;
  busy: boolean;
  appleAvailable: boolean;

  init: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  setUsername: (username: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  continueWithoutAccount: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,
  profile: null,
  errorKey: null,
  busy: false,
  appleAvailable: false,

  init: async () => {
    const appleAvailable =
      Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
    set({ appleAvailable });

    if (!isBackendConfigured()) {
      set({ status: 'local-only' });
      return;
    }

    if (isGoogleConfigured()) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID === '' ? undefined : GOOGLE_IOS_CLIENT_ID,
        scopes: ['profile', 'email'],
      });
    }

    const supabase = getSupabase();
    if (supabase === null) {
      set({ status: 'local-only' });
      return;
    }

    const { data } = await supabase.auth.getSession();
    await applySession(data.session, set);

    supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session, set);
    });
  },

  signInWithGoogle: async () => {
    const supabase = getSupabase();
    if (supabase === null) {
      set({ errorKey: 'errors.supabaseNotConfigured' });
      return;
    }
    if (!isGoogleConfigured()) {
      set({ errorKey: 'errors.googleNotConfigured' });
      return;
    }

    set({ busy: true, errorKey: null });
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (response.type !== 'success') {
        set({ busy: false, errorKey: 'errors.signInCancelled' });
        return;
      }

      const idToken = response.data.idToken;
      if (idToken === null) {
        set({ busy: false, errorKey: 'errors.signInFailed' });
        return;
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error !== null) throw error;

      await applySession(data.session, set);
    } catch (error) {
      const cancelled =
        isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED;
      set({ errorKey: cancelled ? 'errors.signInCancelled' : 'errors.signInFailed' });
    } finally {
      set({ busy: false });
    }
  },

  signInWithApple: async () => {
    const supabase = getSupabase();
    if (supabase === null) {
      set({ errorKey: 'errors.supabaseNotConfigured' });
      return;
    }

    set({ busy: true, errorKey: null });
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken === null) {
        set({ errorKey: 'errors.signInFailed' });
        return;
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error !== null) throw error;

      await applySession(data.session, set);
    } catch (error) {
      const cancelled =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'ERR_REQUEST_CANCELED';
      set({ errorKey: cancelled ? 'errors.signInCancelled' : 'errors.signInFailed' });
    } finally {
      set({ busy: false });
    }
  },

  setUsername: async (username) => {
    const session = get().session;
    if (session === null) return false;

    set({ busy: true, errorKey: null });
    try {
      const profile = await claimUsername(session.user.id, username);
      if (profile === null) {
        set({ errorKey: 'onboarding.usernameTaken' });
        return false;
      }
      set({ profile, status: 'ready' });
      return true;
    } catch {
      set({ errorKey: 'errors.usernameFailed' });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (supabase !== null) await supabase.auth.signOut();
    if (isGoogleConfigured()) await GoogleSignin.signOut().catch(() => undefined);

    set({ session: null, profile: null, status: 'signed-out' });
  },

  continueWithoutAccount: () => set({ status: 'local-only', errorKey: null }),

  clearError: () => set({ errorKey: null }),
}));

type SetState = (partial: Partial<AuthState>) => void;

/** Ustala stan na podstawie sesji: brak konta, brak nazwy, albo gotowe. */
async function applySession(session: Session | null, set: SetState): Promise<void> {
  if (session === null) {
    set({ session: null, profile: null, status: 'signed-out' });
    return;
  }

  try {
    const profile = await fetchProfile(session.user.id);
    set({
      session,
      profile,
      status: profile === null || profile.username === '' ? 'needs-username' : 'ready',
    });
  } catch {
    // Brak internetu przy starcie nie moze blokowac aplikacji - sesja jest
    // wazna lokalnie, a profil dociagniemy przy nastepnej okazji.
    set({ session, profile: null, status: 'needs-username' });
  }
}
