# Repsy w przeglądarce (PWA)

Ten dokument opisuje **wersję webową** — stronę, którą otwiera się na iPhonie
w Safari, na Androidzie w Chrome i na komputerze, a którą można dodać do ekranu
głównego i używać jak zwykłej aplikacji.

Wersja mobilna (pliki instalacyjne na iPhone'a i Androida) jest opisana
w [README.md](../README.md). **To jedna baza kodu, nie dwa projekty** — różnice
między platformami to siedem plików.

---

## Spis treści

1. [Jak to działa — architektura](#jak-to-działa--architektura)
2. [Co się zmieniło wobec wersji mobilnej](#co-się-zmieniło-wobec-wersji-mobilnej)
3. [Uruchomienie lokalne](#uruchomienie-lokalne)
4. [Zmienne środowiskowe](#zmienne-środowiskowe)
5. [Wdrożenie na GitHub Pages](#wdrożenie-na-github-pages)
6. [Konfiguracja logowania](#konfiguracja-logowania)
7. [PWA — instalacja i tryb offline](#pwa--instalacja-i-tryb-offline)
8. [Jak sprawdzić kamerę](#jak-sprawdzić-kamerę)
9. [Prywatność](#prywatność)
10. [Bezpieczeństwo](#bezpieczeństwo)
11. [Security limitations](#security-limitations)
12. [Rozwiązywanie problemów](#rozwiązywanie-problemów)

---

## Jak to działa — architektura

```
PRZEGLĄDARKA (telefon lub komputer)
├── Kamera .............. getUserMedia → element <video>
├── Model sylwetki ...... TensorFlow.js + MoveNet, liczone na GPU (WebGL)
├── Algorytm pompek ..... ten sam kod TypeScript co w wersji mobilnej
├── Baza lokalna ........ SQLite (sql.js, WebAssembly) → zrzut w IndexedDB
└── Service Worker ...... tryb offline, cache TYLKO plików własnych
                 │
                 │  wyłącznie liczby: powtórzenia, serie, daty, cele
                 ▼
SUPABASE (darmowy plan)
├── PostgreSQL z Row Level Security
├── Logowanie Google / Apple
└── Triggery liczące statystyki dzienne po stronie serwera
```

**Obraz z kamery nigdy nie przekracza pierwszej ramki.** Do algorytmu trafia
51 liczb (17 punktów ciała × x, y, pewność), a do Supabase — same wyniki.

### Hosting

| Warstwa | Gdzie | Koszt |
|---|---|---|
| Strona | GitHub Pages | 0 zł |
| Backend | Supabase, plan darmowy | 0 zł |
| Model sylwetki | razem ze stroną (4,6 MB) | 0 zł |

---

## Co się zmieniło wobec wersji mobilnej

Zasada była jedna: **nie przepisywać niczego, czego nie trzeba.** Metro (bundler
Expo) wybiera plik `nazwa.web.ts` zamiast `nazwa.ts`, gdy buduje wersję webową —
więc różnice sprowadzają się do siedmiu plików.

| Warstwa | Telefon | Przeglądarka |
|---|---|---|
| Kamera + model | VisionCamera + TensorFlow Lite | `getUserMedia` + TensorFlow.js |
| Baza lokalna | expo-sqlite | sql.js (WebAssembly) + IndexedDB |
| Sesja | Keychain / EncryptedSharedPreferences | `localStorage` |
| Logowanie | natywne SDK zwraca token | przekierowanie OAuth (PKCE) |
| Wibracja | expo-haptics | `navigator.vibrate` |
| Przypomnienia | planuje system operacyjny | timery + nadrabianie po powrocie |
| Zaproszenie | link `repsy://` | zwykły link `https://` |

**Bez zmian zostało wszystko inne**: algorytm liczenia pompek wraz z wystrojonymi
progami, repozytoria, migracje SQL, statystyki, streak, cele, synchronizacja,
tłumaczenia, motywy i wszystkie 19 ekranów.

### Model rozpoznawania sylwetki

Ten sam **MoveNet SinglePose Lightning** i te same 17 punktów COCO, tylko
w formacie TensorFlow.js zamiast TensorFlow Lite. Dzięki temu progi detekcji
przenoszą się co do liczby i licznik zachowuje się identycznie.

Analiza działa **15 razy na sekundę** — tyle samo co na telefonie, bo przy tym
tempie strojone były progi czasowe w maszynie stanów.

---

## Uruchomienie lokalne

```bash
npm install
```

To pobierze zależności, **model rozpoznawania sylwetki** (~9 MB w dwóch
formatach), wygeneruje ikony i skopiuje silnik bazy danych.

```bash
npx expo start --web
```

Strona otworzy się pod `http://localhost:8081`.

> **Kamera działa tylko po HTTPS albo na `localhost`.** To wymaganie przeglądarek,
> nie projektu. Jeśli otworzysz stronę przez adres IP w sieci lokalnej
> (np. `http://192.168.0.10:8081`), kamera będzie niedostępna.

Żeby sprawdzić dokładnie to, co trafi na serwer:

```bash
npm run build:web
```

Wynik ląduje w `dist/`. Jest to zwykły zestaw plików statycznych — można go
położyć na dowolnym hostingu.

---

## Zmienne środowiskowe

Skopiuj `.env.example` jako `.env` i uzupełnij. **Puste wartości są bezpieczne** —
aplikacja uruchomi się wtedy w trybie lokalnym (trening, cele, statystyki,
streak działają; znika logowanie i znajomi).

| Zmienna | Jawna czy tajna | Gdzie ustawić | Do czego |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | **jawna** | `.env` + GitHub Actions *Variables* | adres Twojego projektu Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **jawna** | `.env` + GitHub Actions *Variables* | klucz publiczny klienta |
| `EXPO_PUBLIC_BASE_PATH` | **jawna** | `.env` (lokalnie); w CI ustawia się sam | podkatalog na GitHub Pages |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | **jawna** | `.env` | tylko wersja mobilna |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | **jawna** | `.env` | tylko wersja na iPhone |
| `GOOGLE_IOS_URL_SCHEME` | **jawna** | `.env` | tylko wersja na iPhone |
| `EAS_PROJECT_ID` | **jawna** | `.env` | tylko budowanie plików instalacyjnych |

### Dlaczego klucz `anon` nie jest sekretem

Klucz `anon` **z założenia** trafia do kodu strony i każdy może go odczytać —
tak działa Supabase. Bezpieczeństwo nie stoi na jego tajności, tylko na regułach
**Row Level Security** w bazie: one decydują, kto co może przeczytać i zapisać,
i działają niezależnie od tego, kto zna klucz.

Dlatego w GitHub Actions używamy **Variables**, a nie **Secrets**. Trzymanie go
w sekretach sugerowałoby, że ochrona na nim polega — a to złudzenie byłoby
groźniejsze niż sam jawny klucz.

### Co NIGDY nie może trafić do repozytorium ani do kodu strony

| Sekret | Gdzie go znajdziesz | Co daje w złych rękach |
|---|---|---|
| `service_role` key | Supabase → Project Settings → API Keys | **pełny dostęp do wszystkich danych, z pominięciem RLS** |
| Google client **secret** | Google Cloud Console | podszycie się pod aplikację przy logowaniu |
| Apple private key (`.p8`) | Apple Developer | podszycie się pod aplikację przy logowaniu |

Wszystkie trzy wpisuje się **wyłącznie w panelu Supabase**, nigdzie indziej.
Plik `.env` jest w `.gitignore`, a przepływ CI sprawdza przy każdej zmianie,
czy nie trafił do historii repozytorium.

---

## Wdrożenie na GitHub Pages

### Raz, na początku

1. **Wrzuć projekt na GitHuba** (repozytorium może być prywatne).
2. W repozytorium: **Settings → Pages → Source: GitHub Actions**.
3. W repozytorium: **Settings → Secrets and variables → Actions → zakładka
   Variables → New repository variable**. Dodaj dwie:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

   Jeśli ich nie dodasz, strona i tak się zbuduje — po prostu zadziała
   w trybie lokalnym, bez kont i znajomych.

### Każde kolejne wdrożenie

```bash
git push
```

Przepływ `deploy.yml` sam sprawdzi typy, lint i testy, zbuduje stronę
i opublikuje ją. Adres zobaczysz w zakładce **Actions**, zwykle:

```
https://TWOJA-NAZWA.github.io/Push-ups/
```

> Po wdrożeniu **koniecznie uzupełnij adresy powrotu w Supabase** — bez tego
> logowanie Google nie zadziała. Patrz sekcja niżej.

### Dlaczego strona stoi w podkatalogu

GitHub Pages serwuje projekt pod `/nazwa-repozytorium/`, a nie w korzeniu domeny.
Przepływ wdrożeniowy ustawia `EXPO_PUBLIC_BASE_PATH` automatycznie na podstawie
nazwy repozytorium, więc nie trzeba niczego pilnować ręcznie.

Gdybyś budował lokalnie i wgrywał ręcznie, ustaw tę zmienną sam — inaczej
dostaniesz **białą stronę**, bo przeglądarka będzie szukać plików w korzeniu.
Przepływ ma na to osobną kontrolę i przerwie wdrożenie, zamiast opublikować
zepsutą stronę.

---

## Konfiguracja logowania

### Google (zalecane — działa wszędzie)

1. W panelu Supabase: **Authentication → Providers → Google** i włącz.
2. Supabase pokaże **Callback URL** — skopiuj go.
3. W [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   utwórz **OAuth client ID** typu *Web application* i wklej tam ten adres
   jako *Authorized redirect URI*.
4. Client ID i **client secret** z Google wklej z powrotem do Supabase.
   Secret zostaje w Supabase — **nigdy w `.env` ani w repozytorium**.
5. W panelu Supabase: **Authentication → URL Configuration** dodaj do
   *Redirect URLs* adres swojej strony:
   ```
   https://TWOJA-NAZWA.github.io/Push-ups/
   ```
   Bez tego Supabase odrzuci powrót z logowania. To zabezpieczenie po stronie
   serwera i nie da się go obejść z poziomu przeglądarki — i dobrze.

### Sign in with Apple

Wymaga **płatnego konta Apple Developer** (99 USD/rok), bo trzeba założyć
*Services ID*. Bez niego przycisk jest ukryty — patrz `EXPO_PUBLIC_APPLE_SIGN_IN`
w `oauthProvider.web.ts`. Google działa na iPhonie tak samo dobrze.

---

## PWA — instalacja i tryb offline

### Dodanie do ekranu głównego

- **Android (Chrome)**: aplikacja sama pokaże przycisk *Zainstaluj*, który
  otwiera **prawdziwe** okno przeglądarki. Nie podrabiamy instalatora systemowego.
- **iPhone (Safari)**: brak takiego API — aplikacja pokazuje instrukcję:
  *Udostępnij → Do ekranu początkowego*.
- **Komputer**: Chrome i Edge proponują instalację same, ikoną w pasku adresu.

### Co działa bez internetu

| Funkcja | Offline |
|---|---|
| Trening, licznik, kamera | **tak** |
| Cele, streak, statystyki | **tak** |
| Zapis wyniku | **tak** (lokalnie, wyśle się później) |
| Znajomi i ranking | nie — to dane z serwera |

Niewysłane treningi czekają w kolejce i synchronizują się po odzyskaniu sieci.
Synchronizacja używa identyfikatorów tworzonych na urządzeniu, więc **ponowne
wysłanie nigdy nie zduplikuje treningu** (pokryte testem).

Pierwsze otwarcie musi być online — wtedy Service Worker zapisuje aplikację
i model. Od drugiego razu wystarczy samo urządzenie.

---

## Jak sprawdzić kamerę

1. Otwórz stronę na telefonie (**musi być https**).
2. Ustawienia → włącz **„Pokaż dane techniczne"**.
3. Rozpocznij trening i zezwól na dostęp do kamery.
4. Postaw telefon **przed sobą**, oprzyj o coś stabilnego, tak żeby w kadrze
   były barki i dłonie.
5. Zrób 10 pompek i porównaj z licznikiem.

Na ekranie zobaczysz na żywo `h` (głębokość), `p` (postęp powtórzenia), fazę
i wykryty problem. Jeśli licznik się myli, te liczby od razu pokazują, który
próg poprawić — w `src/core/pushup/stateMachine.ts`.

### Sprawdzenie, że kamera naprawdę gaśnie

Wyjdź z ekranu treningu i spójrz na wskaźnik kamery (kropka na pasku stanu
w iOS/Androidzie, ikona w pasku adresu na komputerze). Powinien zgasnąć
natychmiast. To samo po przełączeniu karty.

---

## Prywatność

Obraz z kamery **nie jest** zapisywany, wysyłany ani przechowywany. Nie jest to
tylko deklaracja — jest to wymuszone konstrukcją i sprawdzane testami.

| Zasada | Jak jest egzekwowana |
|---|---|
| Brak nagrywania | w całym projekcie nie występuje `MediaRecorder`, `toDataURL`, `toBlob`, `captureStream`, `ImageCapture` — pilnuje tego `src/core/privacy.test.ts` |
| Brak wysyłki obrazu | moduł kamery nie zawiera `fetch`, `XMLHttpRequest`, `sendBeacon` ani `WebSocket` (test) |
| Brak mikrofonu | `getUserMedia` wołane z `audio: false` (test) |
| Kamera gaśnie | zatrzymanie **wszystkich** ścieżek strumienia przy wyjściu z ekranu, wyłączeniu analizy i ukryciu karty (test) |
| Brak obrazu w bazie | schemat nie ma kolumny, w której mógłby się znaleźć (test) |
| Brak obrazu w synchronizacji | payload zawiera wyłącznie znany zestaw pól liczbowych (test) |
| Brak obrazu w cache | Service Worker nie zapisuje odpowiedzi spoza własnej domeny (test) |
| Model lokalny | wczytywany z `public/models/`, liczony na GPU urządzenia |

Do Supabase trafiają wyłącznie: liczba powtórzeń, liczba serii, czas trwania,
data, cel dzienny, nazwa użytkownika, kod znajomego i lista znajomych.

---

## Bezpieczeństwo

Założenie: **frontend nie jest zaufany.** Cały kod JavaScript jest jawny, każdy
może podejrzeć zapytania, zmienić je i wysłać własne.

### Kontrola dostępu (po stronie bazy)

- **Row Level Security** na wszystkich tabelach: użytkownik czyta i zmienia
  wyłącznie swoje wiersze.
- **`daily_stats` liczy wyłącznie trigger w bazie.** Klient nie ma na tej tabeli
  żadnej polityki zapisu, więc nie wpisze sobie wyniku do rankingu.
- Wyszukiwanie znajomych idzie przez funkcję zwracającą **tylko** identyfikator,
  nazwę i emoji — nigdy historii treningów ani celów.
- Ranking zwraca wyłącznie sumę powtórzeń. Nie pobiera profili wszystkich
  użytkowników.
- Funkcje bazodanowe mają **jawnie odebrane** uprawnienia rolom `public` i `anon`
  (PostgreSQL nadaje je domyślnie — patrz `0002_web_hardening.sql`).

### Walidacja i limity

- Wyniki treningu sprawdza trigger: brak dat z przyszłości, tempo nie szybsze
  niż 0,4 s na powtórzenie, dzienny limit.
- Kody znajomych generuje `gen_random_bytes()`, a nie zwykły `random()`.
- **Rate limiting** na wyszukiwaniu użytkowników (20/min), zaproszeniach (10/h)
  i wyborze nazwy (15/10 min) — bez tego kody można by zgadywać w nieskończoność.
- Zakres dat w rankingu jest ograniczony po stronie serwera.

### Zabezpieczenia strony

- **Content-Security-Policy** z `default-src 'self'`, bez `unsafe-inline`
  dla skryptów. Skrypt inline generowany przez Expo jest dopuszczony
  **skrótem SHA-256** liczonym po każdym budowaniu.
- `connect-src` wskazuje konkretny projekt Supabase, a nie wszystkie domeny.
- Logowanie przez **PKCE**; adres powrotu budowany wyłącznie z adresu strony,
  nigdy z parametru w URL-u (ochrona przed open redirect).
- Kod zaproszenia z adresu jest sprawdzany wzorcem przed użyciem i usuwany
  z paska adresu po obsłużeniu.
- Aplikacja renderuje wyłącznie tekst — nigdzie nie ma `dangerouslySetInnerHTML`
  ani wstawiania HTML od użytkownika.

---

## Security limitations

Nie twierdzę, że aplikacji nie da się zaatakować. Poniżej uczciwa lista rzeczy,
których w aplikacji webowej **nie da się zagwarantować** — i dlaczego.

### 1. Token sesji jest dostępny dla JavaScriptu

W przeglądarce nie ma odpowiednika Keychain. Każdy magazyn dostępny z JS
(`localStorage`, `sessionStorage`, IndexedDB, zmienna w pamięci) jest tak samo
czytelny dla skryptu wykonanego w tym samym origin. Jedyna droga odporna
na odczyt to ciasteczko `httpOnly`, które wymaga własnego serwera — przy
statycznym hostingu jest nieosiągalne.

**Co robimy zamiast:** strict CSP, żeby obcy skrypt w ogóle się nie wykonał.

### 2. GitHub Pages nie ustawia nagłówków HTTP

To ograniczenie hostingu, nie do obejścia. Skutki:

| Nagłówek | Stan |
|---|---|
| `Content-Security-Policy` | działa przez `<meta>`, **bez** `frame-ancestors` |
| `X-Frame-Options` | **niedostępny** |
| `Strict-Transport-Security` | domena `github.io` jest na liście HSTS preload, więc w praktyce wymuszone |
| `Permissions-Policy` | przez `<meta>`, obsługa zależna od przeglądarki |

Ochronę przed osadzeniem w cudzej ramce realizuje skrypt
(`public/frame-guard.js`), który jest **słabszy** od nagłówka: działa dopiero
po wykonaniu JavaScriptu i da się go wyłączyć atrybutem `sandbox`.

**Jeśli chcesz pełne nagłówki:** wdróż to samo repozytorium na **Cloudflare
Pages** (też za darmo). Plik `public/_headers` jest już przygotowany — wystarczy
podmienić w nim adres projektu Supabase.

### 3. Anti-cheat jest podstawowy

Odrzucamy niemożliwe tempo, wyniki z przyszłości i absurdalne liczby,
a statystyki liczy serwer. Nie powstrzyma to kogoś zdeterminowanego: aplikacja
działa na cudzym urządzeniu, więc zawsze da się wysłać zapytanie ręcznie.
Pełna szczelność wymagałaby przesyłania nagrania do weryfikacji — czyli
dokładnie tego, czego ten projekt nie robi i robić nie będzie.

### 4. Czego nie zweryfikowałem

- **Progów wykrywania na żywym człowieku.** Są wyprowadzone z geometrii
  i pokryte testami na ruchu syntetycznym, ale pierwszy realny trening może
  wymagać korekty. Od tego jest ekran z danymi technicznymi.
- **Service Workera w działaniu.** Wbudowana przeglądarka, w której testowałem,
  nie pozwala rejestrować Service Workerów (sprawdzone: nawet trywialny
  przykład jest odrzucany). Kod jest przejrzany, ale trybu offline nie
  uruchomiłem realnie.
- **Migracji SQL na żywej bazie.** Plik `0002_web_hardening.sql` jest napisany
  i przejrzany, ale nie wykonany na działającym Postgresie.
- **Logowania Google od początku do końca** — wymaga prawdziwego projektu
  Supabase i konta Google.

### 5. Powiadomienia w przeglądarce są słabsze

Na telefonie planuje je system i przychodzą przy zamkniętej aplikacji.
W przeglądarce **nie da się** tego odtworzyć bez serwera push. Przypomnienia
działają, dopóki karta z aplikacją żyje, plus nadrabiamy zaległe przy powrocie.
Po zamknięciu karty nie przyjdą.

Na iPhonie powiadomienia działają **dopiero po dodaniu do ekranu głównego**
(iOS 16.4+) — to ograniczenie Safari.

### 6. Wibracja nie działa na iPhonie

Safari nie obsługuje `navigator.vibrate` i nic na to nie poradzimy.
Na iPhonie potwierdzenie powtórzenia jest wyłącznie wzrokowe. Aplikacja
sprawdza dostępność i nie udaje, że wibruje.

---

## Rozwiązywanie problemów

**Biała strona po wdrożeniu**
Najczęściej brak `EXPO_PUBLIC_BASE_PATH` albo brak pliku `.nojekyll`. Otwórz
narzędzia deweloperskie → Network: jeśli pliki z `_expo/` zwracają 404, to jest
to. Przepływ wdrożeniowy ma na to kontrolę — sprawdź logi w zakładce Actions.

**Kamera nie startuje**
Sprawdź, czy adres zaczyna się od `https://`. Przez `http://` (poza `localhost`)
przeglądarka nie udostępni kamery i nic tego nie zmieni.

**„Nie udało się otworzyć lokalnej bazy danych"**
Tryb prywatny albo zablokowane dane witryn. W trybie prywatnym Safari blokuje
IndexedDB.

**Logowanie Google wraca na stronę, ale nie loguje**
Brakuje adresu strony w Supabase → Authentication → URL Configuration →
Redirect URLs. Musi być dokładnie ten sam adres, łącznie z ukośnikiem na końcu.

**Licznik nie liczy albo liczy źle**
Włącz „Pokaż dane techniczne" w Ustawieniach. Jeśli `p` nie dochodzi do 1,0
przy pełnej pompce, zmniejsz `defaultDepth` w `src/core/pushup/stateMachine.ts`.

**Aplikacja nie proponuje instalacji na Androidzie**
Chrome pokazuje tę opcję dopiero po kilku wizytach i tylko po HTTPS. Zawsze
można użyć menu przeglądarki → *Dodaj do ekranu głównego*.
