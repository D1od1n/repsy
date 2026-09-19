/**
 * Logowanie zewnetrznym dostawca - wersja natywna (iOS / Android).
 *
 * Ten modul istnieje po to, zeby authStore nie musial wiedziec, czy dziala na
 * telefonie, czy w przegladarce. Na telefonie natywne SDK zwraca token
 * tozsamosci, ktory wymieniamy u Supabase. W przegladarce dzieje sie cos
 * zupelnie innego (przekierowanie) - patrz oauthProvider.web.ts.
 *
 * Metro wybiera automatycznie wlasciwy plik dla budowanej platformy.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';

/**
 * Wynik proby logowania.
 *
 * 'redirected' nie wystepuje na telefonie, ale jest czescia wspolnego typu,
 * bo w przegladarce logowanie konczy sie opuszczeniem strony.
 */
export type OAuthOutcome =
  | { kind: 'token'; provider: 'google' | 'apple'; idToken: string }
  | { kind: 'redirected' }
  | { kind: 'cancelled' }
  | { kind: 'failed' };

/** Czy na tym urzadzeniu w ogole da sie pokazac przycisk Apple. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function startGoogleSignIn(): Promise<OAuthOutcome> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (response.type !== 'success') return { kind: 'cancelled' };

    const idToken = response.data.idToken;
    if (idToken === null) return { kind: 'failed' };

    return { kind: 'token', provider: 'google', idToken };
  } catch (error) {
    const cancelled = isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED;
    return cancelled ? { kind: 'cancelled' } : { kind: 'failed' };
  }
}

export async function startAppleSignIn(): Promise<OAuthOutcome> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (credential.identityToken === null) return { kind: 'failed' };

    return { kind: 'token', provider: 'apple', idToken: credential.identityToken };
  } catch (error) {
    const cancelled =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'ERR_REQUEST_CANCELED';
    return cancelled ? { kind: 'cancelled' } : { kind: 'failed' };
  }
}

/**
 * Jednorazowa konfiguracja natywnego SDK Google.
 *
 * Musi sie wykonac zanim uzytkownik kliknie "Zaloguj". webClientId jest
 * wymagany zawsze - to nim Supabase weryfikuje otrzymany token.
 */
export function configureOAuth(options: {
  googleWebClientId: string;
  googleIosClientId: string;
}): void {
  GoogleSignin.configure({
    webClientId: options.googleWebClientId,
    iosClientId: options.googleIosClientId === '' ? undefined : options.googleIosClientId,
    scopes: ['profile', 'email'],
  });
}

/**
 * Wylogowanie po stronie dostawcy.
 *
 * Bez tego natywne SDK pamieta konto i kolejne logowanie omijaloby wybor
 * uzytkownika - co przy wspoldzielonym telefonie byloby mylace.
 */
export async function signOutFromProvider(): Promise<void> {
  await GoogleSignin.signOut().catch(() => undefined);
}
