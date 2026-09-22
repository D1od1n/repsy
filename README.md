# Repsy — licznik pompek z kamery

Aplikacja, która **kamerą liczy Twoje pompki**, pilnuje dziennego celu,
prowadzi serię dni (streak), pokazuje statystyki i pozwala rywalizować
ze znajomymi.

Jest w **dwóch postaciach, z jednej bazy kodu**:

| | Jak się instaluje | Dla kogo |
|---|---|---|
| **Strona / PWA** — [instrukcja](docs/WEB.md) | otwierasz link, opcjonalnie dodajesz do ekranu głównego | najprostsze; działa na iPhone, Androidzie i komputerze |
| **Aplikacja mobilna** — ten plik | plik instalacyjny (Android) lub Xcode (iPhone) | gdy chcesz powiadomienia przy zamkniętej aplikacji i wibracje na iPhone |

## 👉 Aplikacja działa tutaj

**https://d1od1n.github.io/repsy/**

Otwórz na telefonie i dodaj do ekranu głównego. Nie trzeba nic instalować
ani konfigurować — trening, licznik, cele, statystyki i streak działają od razu.

---

> Jeśli nie wiesz, którą wybrać — **zacznij od wersji webowej**. Nie wymaga
> żadnego konta deweloperskiego, płatności ani Maca.

> **Obraz z kamery nie opuszcza Twojego telefonu.** Analiza pozycji ciała dzieje się
> w całości na urządzeniu. Na serwer trafiają wyłącznie liczby: ile pompek, ile serii,
> kiedy i jak długo. Żadne zdjęcie ani nagranie nie jest zapisywane ani wysyłane.

---

## Spis treści

0. **[Wersja webowa / PWA — osobny dokument](docs/WEB.md)**
1. [Co potrafi aplikacja](#co-potrafi-aplikacja)
2. [Czego potrzebujesz](#czego-potrzebujesz)
3. [Szybki start — 5 minut](#szybki-start--5-minut)
4. [Konfiguracja backendu (Supabase)](#konfiguracja-backendu-supabase)
5. [Konfiguracja logowania Google](#konfiguracja-logowania-google)
6. [Konfiguracja Sign in with Apple](#konfiguracja-sign-in-with-apple)
7. [Uruchomienie na Androidzie](#uruchomienie-na-androidzie)
8. [Uruchomienie na iPhone](#uruchomienie-na-iphone)
9. [Powiadomienia](#powiadomienia)
10. [Testy i kontrola jakości](#testy-i-kontrola-jakości)
11. [Jak ustawić telefon do treningu](#jak-ustawić-telefon-do-treningu)
12. [Struktura projektu](#struktura-projektu)
13. [Prywatność — jak jest egzekwowana](#prywatność--jak-jest-egzekwowana)
14. [Rozwiązywanie problemów](#rozwiązywanie-problemów)
15. [Znane ograniczenia](#znane-ograniczenia)

---

## Co potrafi aplikacja

- **Liczy pompki kamerą** — telefon stoi przed Tobą, aplikacja wykrywa barki, łokcie
  i nadgarstki, i zalicza tylko pełne powtórzenia.
- **Odrzuca półpompki** i pokazuje komunikat „Zejdź niżej".
- **Wibruje** po każdym zaliczonym powtórzeniu.
- **Sama wykrywa serie** — dłuższa przerwa kończy serię, kolejne pompki zaczynają nową.
- **Dzienny cel** (domyślnie 100) + możliwość ustawienia innego celu na konkretny dzień.
- **Streak** — ile dni z rzędu osiągnąłeś cel, z kamieniami milowymi.
- **Statystyki** dzienne, tygodniowe i miesięczne + rekordy życiowe.
- **Znajomi i ranking** — dziś / tydzień / miesiąc, tylko Ty i Twoi znajomi.
- **Przypomnienia** o niezrobionym celu (nie przyjdą, jeśli cel już zrobiony).
- **Polski i angielski**, tryb jasny i ciemny.
- **Działa offline** — trening zapisuje się lokalnie i synchronizuje później.

---

## Czego potrzebujesz

| Do czego | Co jest potrzebne | Koszt |
|---|---|---|
| Uruchomienie kodu | [Node.js 20+](https://nodejs.org) | darmowe |
| Android | telefon z Androidem 8+ | darmowe |
| iPhone | iPhone z iOS 16.4+ **oraz** Mac z Xcode *lub* konto Apple Developer | 0 zł / 99 USD rocznie |
| Konta i ranking | konto [Supabase](https://supabase.com) | darmowe |
| Logowanie Google | projekt w [Google Cloud Console](https://console.cloud.google.com) | darmowe |

> **Aplikacja działa też bez żadnych kont.** Jeśli pominiesz konfigurację Supabase,
> dostaniesz w pełni działający licznik pompek, cele, streak i statystyki — offline,
> tylko na tym telefonie. Znikają jedynie znajomi i ranking. Dzięki temu możesz
> najpierw wszystko przetestować, a konta założyć później.

---

## Szybki start — 5 minut

```bash
npm install
```

To pobierze zależności **oraz model rozpoznawania sylwetki** (~4,6 MB) do
`assets/models/`. Gdyby pobieranie się nie udało, uruchom ponownie:

```bash
npm run fetch-model
```

Następnie skopiuj plik z przykładową konfiguracją:

```bash
cp .env.example .env
```

Możesz na razie zostawić go niewypełniony — aplikacja uruchomi się w trybie lokalnym.

Sprawdź, czy wszystko działa:

```bash
npm test
```

Teraz przejdź do sekcji [Android](#uruchomienie-na-androidzie) albo
[iPhone](#uruchomienie-na-iphone), żeby zainstalować aplikację na telefonie.

---

## Konfiguracja backendu (Supabase)

Potrzebna tylko do znajomych, rankingu i synchronizacji między urządzeniami.

1. Załóż darmowe konto na [supabase.com](https://supabase.com) i kliknij **New project**.
   Zapamiętaj hasło do bazy (nie będzie potrzebne w aplikacji, ale przyda się później).
2. Poczekaj ok. 2 minut, aż projekt się utworzy.
3. Wejdź w **SQL Editor** (ikona w lewym menu) → **New query**.
4. Otwórz plik [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
   skopiuj **całą** jego zawartość, wklej do edytora i kliknij **Run**.
   Powinno pojawić się „Success. No rows returned".
5. Wejdź w **Project Settings → Data API** i skopiuj **Project URL**.
6. Wejdź w **Project Settings → API Keys** i skopiuj klucz **anon / public**.
7. Wklej oba do pliku `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://twoj-projekt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> Klucz `anon` jest **publiczny z założenia** — nie jest sekretem. O tym, kto co może
> przeczytać i zapisać, decydują reguły RLS w bazie, które właśnie wgrałeś.

### Co robi ten skrypt SQL

- Tworzy tabele: profile, treningi, serie, cele dzienne, statystyki, znajomi, zaproszenia.
- Włącza **Row Level Security** — każdy widzi tylko swoje dane i wyniki znajomych.
- Ustawia **trigger**, który liczy statystyki dzienne **po stronie serwera**.
  Klient nie ma prawa zapisu do tej tabeli, więc nie wpisze sobie wyniku do rankingu.
- Dodaje podstawową walidację wiarygodności (tempo, limity dzienne, daty z przyszłości).

---

## Konfiguracja logowania Google

Google działa **i na iPhonie, i na Androidzie** i nie wymaga płatnego konta Apple —
dlatego to główna droga logowania.

### 1. Włącz dostawcę w Supabase

**Authentication → Sign In / Providers → Google** → włącz.

### 2. Utwórz dane logowania w Google Cloud

1. Wejdź na [console.cloud.google.com](https://console.cloud.google.com) → utwórz projekt.
2. **APIs & Services → OAuth consent screen** → typ **External** → wypełnij nazwę
   aplikacji i swój e-mail. W sekcji **Test users** dodaj adresy e-mail całej trójki
   (bez tego tylko Ty się zalogujesz).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.

Utwórz **trzy** identyfikatory:

| Typ | Po co | Co wpisać |
|---|---|---|
| **Web application** | Supabase weryfikuje nim token | Authorized redirect URI: `https://<twoj-projekt>.supabase.co/auth/v1/callback` |
| **Android** | logowanie na Androidzie | Package name: `com.repsy.app`, SHA-1 — patrz niżej |
| **iOS** | logowanie na iPhonie | Bundle ID: `com.repsy.app` |

**Skąd wziąć SHA-1 dla Androida:** po pierwszym buildzie EAS uruchom
`npx eas credentials` → Android → wybierz profil → pokaże się odcisk SHA-1.
Przy buildzie lokalnym: `cd android && ./gradlew signingReport`.

### 3. Uzupełnij `.env`

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abc.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-xyz.apps.googleusercontent.com
GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.123456789-xyz
```

`GOOGLE_IOS_URL_SCHEME` to **odwrócony** iOS Client ID (zamieniona kolejność członów).

### 4. Wklej Web Client ID do Supabase

W **Authentication → Providers → Google** wklej **Web Client ID** i **Client Secret**.

---

## Konfiguracja Sign in with Apple

> **Wymaga płatnego konta Apple Developer (99 USD/rok).** Włączenie tej funkcji
> odbywa się w Apple Developer Console, do której darmowe konto nie ma dostępu.
>
> **Bez tego aplikacja działa normalnie** — przycisk Apple po prostu się nie pokazuje,
> a wszyscy logują się przez Google (na iPhonie działa równie dobrze). Kod jest już
> gotowy i zapali się sam, gdy konto się pojawi.

Gdy masz płatne konto:

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**
   → **Identifiers** → App ID `com.repsy.app` → zaznacz **Sign In with Apple**.
2. Utwórz **Services ID** (np. `com.repsy.app.signin`) i też zaznacz Sign In with Apple.
3. Utwórz klucz **Sign in with Apple** (plik `.p8`) i pobierz go.
4. W Supabase: **Authentication → Providers → Apple** → wpisz Services ID, Team ID,
   Key ID i zawartość pliku `.p8`.
   > Ważne: w polu **Client IDs** ustaw Services ID jako **pierwszy** wpis.

---

## Uruchomienie na Androidzie

Android jest najprostszy — nie potrzebujesz żadnego płatnego konta.

### Wariant A: build w chmurze (zalecany, działa z Windowsa)

Potrzebujesz tylko darmowego konta na [expo.dev](https://expo.dev/signup).

**1. Zaloguj się:**

```bash
npx eas-cli login
```

**2. Powiąż katalog z projektem w chmurze:**

```bash
npx eas-cli init
```

Polecenie wypisze **Project ID** (długi ciąg typu `a1b2c3d4-...`). Ponieważ ten
projekt używa konfiguracji dynamicznej (`app.config.js`), EAS nie zapisze go sam —
wklej go do pliku `.env`:

```
EAS_PROJECT_ID=a1b2c3d4-tutaj-twoj-identyfikator
```

**3. Zbuduj APK:**

```bash
npx eas-cli build --platform android --profile preview
```

Po kilkunastu minutach dostaniesz **link do pliku APK**. Otwórz go na telefonie,
pozwól na instalację z nieznanych źródeł i gotowe. Ten sam link możesz wysłać znajomemu —
link działa też bez konta Expo.

> Pierwszy build możesz zrobić z pustym `.env` (poza `EAS_PROJECT_ID`). Aplikacja
> zadziała wtedy w trybie lokalnym: trening, cele, statystyki i streak działają,
> nie ma tylko logowania i znajomych. To najszybszy sposób, żeby sprawdzić
> **najważniejszą rzecz — czy licznik pompek dobrze liczy na Twoim telefonie.**

### Wariant B: build lokalny

Wymaga Android Studio i **JDK 17** (Twoja obecna Java 8 jest za stara).

```bash
npx expo run:android
```

### Praca nad kodem (hot reload)

Po zainstalowaniu buildu `development`:

```bash
eas build --platform android --profile development   # raz
npm start                                            # przy każdej pracy
```

Telefon i komputer muszą być w tej samej sieci Wi-Fi.

---

## Uruchomienie na iPhone

Instalacja na iPhonie wymaga podpisania aplikacji certyfikatem Apple.
Masz dwie drogi.

### Ścieżka 1: Mac znajomego (0 zł)

Na Macu, z zainstalowanym Xcode:

```bash
git clone <adres-repozytorium>
cd Push-ups
npm install
npx expo prebuild --platform ios
cd ios && pod install && cd ..
open ios/Repsy.xcworkspace
```

W Xcode:
1. Zaznacz projekt **Repsy** → zakładka **Signing & Capabilities**.
2. W **Team** wybierz swój darmowy Apple ID (*Add an Account…* jeśli trzeba).
3. Zmień **Bundle Identifier** na unikalny, np. `com.twojenazwisko.repsy`.
4. Podłącz iPhone kablem, wybierz go u góry i kliknij ▶.

**Ograniczenia tej ścieżki — warto wiedzieć zawczasu:**
- Certyfikat **wygasa po 7 dniach**. Aplikacja przestanie się uruchamiać i trzeba
  ją wgrać ponownie z Maca. Przy dwóch użytkownikach iPhone'a to co tydzień.
- **Sign in with Apple nie zadziała** — zostaje logowanie Google.
- Każdy iPhone trzeba fizycznie podłączyć do tego Maca.

### Ścieżka 2: konto Apple Developer (99 USD/rok)

Buduje się **z Windowsa**, bez Maca — EAS robi to na swoich maszynach macOS.

```bash
eas build --platform ios --profile preview
```

EAS zapyta o dane Apple i sam wygeneruje certyfikaty. Przy pierwszym buildzie
dodaj urządzenia:

```bash
eas device:create
```

Znajomi otwierają wysłany link na iPhonie i instalują aplikację bezprzewodowo.
**Build jest ważny rok**, nie tydzień.

Alternatywnie TestFlight (wygodniejszy przy kilku osobach):

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

---

## Powiadomienia

Działają **lokalnie na telefonie** — nie ma serwera push ani tokenów urządzeń.

- Włącz je w **Ustawienia → Przypomnienia** (aplikacja poprosi o zgodę systemową).
- Dodaj dowolną liczbę godzin, np. 14:00, 18:00, 21:00.
- Możesz wpisać własną treść albo zostawić domyślną.
- **Jeśli cel na dziś jest już osiągnięty, przypomnienia tego dnia nie przyjdą.**
- Treść typu „Zostało Ci 50 pompek" jest przeliczana po każdym treningu
  i przy każdym wejściu do aplikacji.

Jeśli odmówisz zgody na powiadomienia, aplikacja pokaże o tym komunikat
i będzie działać normalnie — bez przypomnień.

---

## Testy i kontrola jakości

```bash
npm test          # wszystkie testy (142)
npm run test:core # sama logika, bez React Native — ~3 sekundy
npm run typecheck # sprawdzenie typów TypeScript
npm run lint      # ESLint
```

Testy pokrywają między innymi:

**Algorytm liczenia pompek** (na syntetycznych sekwencjach ruchu, bez telefonu):
pełne powtórzenie, półpompka, bardzo szybki ruch, zatrzymanie w połowie,
powrót bez zejścia, przypadkowe drgania, krótka i długa utrata detekcji,
seria 10 pompek, odstęp między komunikatami „Zejdź niżej".

**Reszta logiki:** streak (w tym „dziś jeszcze nie zrobione"), cele dzienne
z wyjątkami, statystyki dzień/tydzień/miesiąc, daty i strefy czasowe
(północ, zmiana czasu), synchronizacja bez duplikatów, komplet tłumaczeń,
baza danych i kolejka wysyłki, komponenty interfejsu w obu motywach.

Sprawdzenie, czy aplikacja się poprawnie pakuje:

```bash
npx expo export --platform android
npx expo export --platform ios
```

---

## Jak ustawić telefon do treningu

1. Postaw telefon **przed sobą**, ekranem w swoją stronę — *nie z boku*.
2. Oprzyj go o ścianę, książkę albo butelkę, tak aby stał stabilnie.
3. Odległość: mniej więcej **metr przed dłońmi**.
4. Sprawdź, czy w kadrze widać **barki, ręce i głowę**.
5. Przyjmij pozycję i chwilę nie ruszaj się — aplikacja kalibruje pozycję górną.
6. Gdy zobaczysz trzy zielone znaczniki, naciśnij **Zacznij liczyć**.

Aplikacja **nie zacznie liczyć**, dopóki warunki nie są wystarczająco dobre —
zamiast zmyślać wyniki, poprosi o poprawienie ustawienia.

### Gdy detekcja kaprysi

Włącz **Ustawienia → Pokaż dane techniczne podczas treningu**. Na ekranie treningu
pojawi się linijka z aktualnymi wartościami (`h`, `p`, faza, problem). Dzięki niej
widać dokładnie, co algorytm „widzi", i można dostroić progi w pliku
[`src/core/pushup/stateMachine.ts`](src/core/pushup/stateMachine.ts)
(stała `DEFAULT_PUSHUP_CONFIG`).

---

## Struktura projektu

```
app/                      ekrany (nawigacja po plikach, expo-router)
  (onboarding)/           powitanie, logowanie, wybór nazwy użytkownika
  (tabs)/                 Home, Statystyki, Znajomi, Profil
  workout/                ekran kamery + podsumowanie
  settings/               ustawienia, cele, przypomnienia, prywatność

src/
  core/                   CZYSTY TypeScript — bez React Native, w pełni testowalny
    pose/                 filtr One Euro, geometria, ocena ustawienia
    pushup/               metryka głębokości, maszyna stanów, detektor
    workout/              wykrywanie serii
    stats/ streak/ goals/ notifications/ sync/ date/
  data/
    db/                   SQLite: migracje, sterowniki, repozytoria
    api/                  Supabase: profil, znajomi, sesja
  features/               logika ekranów (kamera, store'y, powiadomienia)
  components/ theme/ i18n/

assets/models/            model MoveNet dla telefonu (pobierany skryptem)
public/                   pliki serwowane w wersji webowej:
                          manifest PWA, ikony, service worker, model, SQLite
supabase/migrations/      schemat bazy + reguły bezpieczeństwa
scripts/                  pobieranie modelu, generowanie ikon, domykanie CSP
.github/workflows/        kontrola jakości i wdrożenie na GitHub Pages
docs/WEB.md               instrukcja wersji webowej
```

**Dlaczego taki podział:** wszystko, co decyduje o poprawności (liczenie pompek,
streak, statystyki, synchronizacja), leży w `src/core/` i nie importuje ani Reacta,
ani niczego natywnego. Dlatego testy uruchamiają się w sekundy i sprawdzają
dokładnie ten sam kod, który potem działa na telefonie i w przeglądarce.

### Jak jedna baza kodu obsługuje dwie platformy

Metro (bundler Expo) wybiera plik `nazwa.web.ts` zamiast `nazwa.ts`, gdy buduje
wersję webową. Dzięki temu **nie ma drugiego projektu ani zduplikowanej logiki** —
różnice sprowadzają się do siedmiu par plików:

```
usePoseDetection.tsx      / .web.tsx    kamera i model
openDriver.ts             / .web.ts     silnik lokalnej bazy
secureStorage.ts          / .web.ts     przechowywanie sesji
oauthProvider.ts          / .web.ts     logowanie
haptics.ts                / .web.ts     wibracja
notificationService.ts    / .web.ts     przypomnienia
invite.ts, useInviteLink  / .web.ts     zaproszenia dla znajomych
InstallHint.tsx           / .web.tsx    dodanie do ekranu głównego
```

Wszystkie **19 ekranów**, komponenty, motywy, tłumaczenia, repozytoria,
migracje SQL i cały algorytm są wspólne i nie wiedzą, na czym działają.

---

## Prywatność — jak jest egzekwowana

To nie jest tylko deklaracja w regulaminie — wynika z budowy aplikacji:

- Kamera jest skonfigurowana **bez wyjścia foto i wideo**. Aplikacja technicznie
  nie jest w stanie zrobić zdjęcia ani nagrania.
- Klatka istnieje wyłącznie wewnątrz funkcji `onFrame`, na osobnym wątku,
  i jest zwalniana natychmiast po analizie.
- Przez granicę do reszty aplikacji przechodzi **51 liczb** — współrzędne
  17 punktów ciała. Nic więcej.
- W schemacie bazy (lokalnej i serwerowej) **nie ma ani jednej kolumny** na obraz,
  klatkę, nagranie czy ścieżkę do pliku.
- Uprawnienia do nagrywania dźwięku i dostępu do galerii są **jawnie zablokowane**
  w konfiguracji Androida.
- Sesja użytkownika trzymana jest w Keychain / EncryptedSharedPreferences,
  a nie w zwykłym magazynie.

Dwa testy pilnują tego automatycznie: jeden sprawdza, że schemat bazy nie zawiera
kolumn na dane obrazowe, drugi — że dane wysyłane na serwer składają się wyłącznie
ze znanego zestawu pól liczbowych.

Ustawienia, motyw, język i godziny przypomnień **zostają na telefonie** i nie są
nigdzie wysyłane.

---

## Rozwiązywanie problemów

**`npm install` kończy się błędem o zależnościach**
Usuń `node_modules` i `package-lock.json`, potem `npm install` jeszcze raz.

**„Brakuje pliku modelu" na ekranie treningu**
Uruchom `npm run fetch-model` i zbuduj aplikację ponownie.

**Aplikacja nie widzi sylwetki**
Sprawdź oświetlenie (światło ma padać na Ciebie, nie w obiektyw), odległość
i czy telefon stoi pionowo, przodem do Ciebie. Włącz dane techniczne w ustawieniach.

**Pompki nie są liczone, ciągle „Zejdź niżej"**
Przy nietypowym ustawieniu kamery sygnał bywa ściśnięty. Aplikacja sama obniży
próg po kilku próbach, ale możesz też zmniejszyć `defaultDepth`
w `src/core/pushup/stateMachine.ts`.

**Logowanie Google: „DEVELOPER_ERROR"**
Odcisk SHA-1 nie zgadza się z tym w Google Cloud Console. Pobierz aktualny przez
`npx eas credentials` i dodaj go do Android OAuth Client.

**Aplikacja na iPhonie przestała się otwierać po tygodniu**
To darmowy certyfikat Apple — wygasa po 7 dniach. Trzeba wgrać ponownie z Maca
albo przejść na konto Apple Developer.

**Ranking pusty mimo dodanych znajomych**
Ranking pokazuje dane po synchronizacji. Pociągnij ekran w dół, żeby odświeżyć,
i upewnij się, że obie osoby mają internet.

---

## Znane ograniczenia

1. **Progi wykrywania nie zostały sprawdzone na żywym człowieku.** Są wyprowadzone
   z geometrii ujęcia i pokryte testami na syntetycznym ruchu, ale pierwszy realny
   trening może wymagać drobnej korekty — od tego jest ekran z danymi technicznymi.
2. **Sign in with Apple wymaga płatnego konta** (99 USD/rok). Do tego czasu
   logowanie odbywa się przez Google.
3. **Darmowy certyfikat iOS wygasa co 7 dni** i wymaga ponownej instalacji z Maca.
4. **Model rozpoznaje jedną osobę.** Jeśli w kadrze pojawi się ktoś jeszcze,
   detekcja może przeskoczyć na niego.
5. **Link zapraszający** (`repsy://`) zadziała u kogoś, kto ma już aplikację —
   dlatego zaproszenie zawsze zawiera też kod do wpisania ręcznie.
6. **Treść przypomnień** jest ustalana w chwili planowania. Przeliczamy ją po każdym
   treningu i przy wejściu do aplikacji, więc w praktyce jest aktualna.
7. **Anti-cheat jest podstawowy.** Odrzuca niemożliwe tempo, wyniki z przyszłości
   i absurdalne liczby, a statystyki liczy serwer. Nie powstrzyma kogoś zdeterminowanego —
   przy kamerze na własnym telefonie nie da się tego zrobić w pełni.
8. **Nadpisania celu na konkretny dzień działają tylko lokalnie.** Na serwer trafia
   cel domyślny, więc kolumna `goal` w `daily_stats` może się różnić od tego, co
   widzisz w aplikacji. Nie ma to dziś żadnego widocznego skutku — ranking znajomych
   sortuje wyłącznie po sumie powtórzeń i nie pokazuje cudzych celów. Gdyby kiedyś
   miał je pokazywać, trzeba najpierw dodać synchronizację tabeli `daily_goals`.

---

## Co warto dodać w kolejnej wersji

- Inne ćwiczenia (przysiady, podciągnięcia) — ta sama maszyna stanów, inne metryki.
- Tryb Thunder dla mocniejszych telefonów (wystarczy podmienić plik modelu).
- Eksport danych do CSV.
- Widget na ekranie głównym.
- Integracja z Apple Health / Google Fit.

---

## Licencja

Projekt prywatny, do użytku własnego.
Model MoveNet pochodzi od Google i jest udostępniony na licencji Apache 2.0.
