/**
 * Logowanie zewnetrznym dostawca - wersja przegladarkowa.
 *
 * Roznica wobec telefonu jest zasadnicza: nie ma natywnego SDK, ktore zwroci
 * token tozsamosci. Zamiast tego przegladarka WYCHODZI z naszej strony na
 * strone dostawcy i wraca po zalogowaniu. Dlatego funkcje ponizej zwracaja
 * 'redirected' - nie ma czego czekac, bo za chwile strona przestanie istniec.
 * Sesje przechwytuje po powrocie klient Supabase (detectSessionInUrl).
 *
 * ============================ BEZPIECZENSTWO ============================
 * Uzywamy przeplywu PKCE (ustawionego w data/api/supabase.ts). Adres powrotu
 * budujemy WYLACZNIE z window.location.origin i sciezki bazowej aplikacji -
 * nigdy z parametru w URL-u. Gdyby adres powrotu dalo sie podac z zewnatrz,
 * ktos moglby podsunac link, ktory po zalogowaniu odsyla kod autoryzacyjny
 * na obca domene (open redirect). Dodatkowo Supabase odrzuca adresy powrotu
 * spoza listy skonfigurowanej w panelu projektu - to druga, niezalezna bariera.
 * ========================================================================
 */
import Constants from 'expo-constants';

import { getSupabase } from '../../data/api/supabase';

export type OAuthOutcome =
  | { kind: 'token'; provider: 'google' | 'apple'; idToken: string }
  | { kind: 'redirected' }
  | { kind: 'cancelled' }
  | { kind: 'failed' };

/**
 * Sign in with Apple w przegladarce wymaga Services ID zalozonego w Apple
 * Developer Console, a to oznacza platne konto. Nie da sie tego wykryc
 * z poziomu przegladarki, wiec przycisk pokazujemy tylko wtedy, gdy ktos
 * swiadomie wlaczy go zmienna srodowiskowa. Domyslnie jest ukryty, zeby
 * uzytkownik nie klikal w cos, co skonczy sie bledem.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  const extra = Constants.expoConfig?.extra as { appleSignInEnabled?: boolean } | undefined;
  return extra?.appleSignInEnabled === true;
}

/**
 * Adres, pod ktory dostawca ma odeslac uzytkownika.
 *
 * Bierzemy origin biezacej strony i sciezke bazowa aplikacji (na GitHub Pages
 * strona stoi w podkatalogu /nazwa-repozytorium/). Swiadomie NIE uzywamy
 * window.location.href - zawieralby biezace parametry i fragment.
 */
function redirectTarget(): string {
  const { origin, pathname } = window.location;

  // Sciezka bazowa konczy sie ukosnikiem; przy starcie z podstrony obcinamy
  // wszystko za ostatnim ukosnikiem, zeby wrocic do korzenia aplikacji.
  const basePath = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl;
  if (typeof basePath === 'string' && basePath !== '') {
    return `${origin}${basePath.endsWith('/') ? basePath : `${basePath}/`}`;
  }
  return `${origin}${pathname.endsWith('/') ? pathname : `${pathname.slice(0, pathname.lastIndexOf('/') + 1)}`}`;
}

async function startOAuth(provider: 'google' | 'apple'): Promise<OAuthOutcome> {
  const supabase = getSupabase();
  if (supabase === null) return { kind: 'failed' };

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTarget(),
        // Bez tego Supabase sam wykonalby przekierowanie; wolimy dostac adres
        // i przejsc pod niego jawnie, zeby bylo widac, co sie dzieje.
        skipBrowserRedirect: false,
      },
    });

    if (error !== null) return { kind: 'failed' };

    // Jesli tu dotarlismy, przegladarka wlasnie opuszcza strone.
    return { kind: 'redirected' };
  } catch {
    return { kind: 'failed' };
  }
}

export async function startGoogleSignIn(): Promise<OAuthOutcome> {
  return startOAuth('google');
}

export async function startAppleSignIn(): Promise<OAuthOutcome> {
  return startOAuth('apple');
}

/**
 * W przegladarce nie ma czego konfigurowac.
 *
 * Identyfikator i sekret klienta Google leza w panelu Supabase, a nie w kodzie
 * strony - i tak wlasnie ma byc, bo sekret w frontendzie byloby jawnym bledem
 * bezpieczenstwa. Funkcja istnieje tylko po to, zeby authStore mial ten sam
 * ksztalt na obu platformach.
 */
export function configureOAuth(_options: {
  googleWebClientId: string;
  googleIosClientId: string;
}): void {
  // celowo puste
}

/**
 * Wylogowanie po stronie dostawcy.
 *
 * W przegladarce nie trzymamy zadnej osobnej sesji Google - wystarczy
 * supabase.auth.signOut(), ktore authStore wywoluje samo. Swiadomie NIE
 * wylogowujemy uzytkownika z jego konta Google w calej przegladarce, bo
 * aplikacja nie ma do tego prawa: to jedno konto na wiele innych stron.
 */
export async function signOutFromProvider(): Promise<void> {
  // celowo puste
}
