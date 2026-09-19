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
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import {
  isAppleSignInAvailable,
  startAppleSignIn,
  configureOAuth,
  signOutFromProvider,
  startGoogleSignIn,
  type OAuthOutcome,
} from './oauthProvider';

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
    // Na telefonie pyta o to system, w przegladarce decyduje konfiguracja.
    set({ appleAvailable: await isAppleSignInAvailable() });

    if (!isBackendConfigured()) {
      set({ status: 'local-only' });
      return;
    }

    if (isGoogleConfigured()) {
      configureOAuth({
        googleWebClientId: GOOGLE_WEB_CLIENT_ID,
        googleIosClientId: GOOGLE_IOS_CLIENT_ID,
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
    if (!isGoogleConfigured()) {
      set({ errorKey: 'errors.googleNotConfigured' });
      return;
    }
    await runSignIn(startGoogleSignIn, set);
  },

  signInWithApple: async () => {
    await runSignIn(startAppleSignIn, set);
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
    if (isGoogleConfigured()) await signOutFromProvider();

    set({ session: null, profile: null, status: 'signed-out' });
  },

  continueWithoutAccount: () => set({ status: 'local-only', errorKey: null }),

  clearError: () => set({ errorKey: null }),
}));

type SetState = (partial: Partial<AuthState>) => void;

/** Ustala stan na podstawie sesji: brak konta, brak nazwy, albo gotowe. */
/**
 * Wspolna obsluga logowania dla obu platform i obu dostawcow.
 *
 * Rozne platformy koncza logowanie inaczej:
 *  - telefon zwraca token tozsamosci, ktory wymieniamy u Supabase na sesje,
 *  - przegladarka przekierowuje uzytkownika na strone dostawcy i wraca
 *    dopiero po zalogowaniu, juz z gotowa sesja w adresie URL.
 *
 * W drugim przypadku NIE zdejmujemy stanu "zajety" - strona za chwile
 * zniknie, a migniecie odblokowanego przycisku wygladaloby jak blad.
 */
async function runSignIn(
  start: () => Promise<OAuthOutcome>,
  set: SetState,
): Promise<void> {
  const supabase = getSupabase();
  if (supabase === null) {
    set({ errorKey: 'errors.supabaseNotConfigured' });
    return;
  }

  set({ busy: true, errorKey: null });
  try {
    const outcome = await start();

    if (outcome.kind === 'redirected') return;
    if (outcome.kind === 'cancelled') {
      set({ busy: false, errorKey: 'errors.signInCancelled' });
      return;
    }
    if (outcome.kind === 'failed') {
      set({ busy: false, errorKey: 'errors.signInFailed' });
      return;
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: outcome.provider,
      token: outcome.idToken,
    });
    if (error !== null) throw error;

    await applySession(data.session, set);
    set({ busy: false });
  } catch {
    set({ busy: false, errorKey: 'errors.signInFailed' });
  }
}
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
