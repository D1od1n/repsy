/**
 * Przypomnienia o dziennym celu - wersja przegladarkowa.
 *
 * ============================ PRYWATNOSC ============================
 * Powiadomienia sa w calosci lokalne. Nie ma tu push notifications, nie ma
 * rejestracji urzadzenia u dostawcy push, nie ma tokenow ani zadnego ruchu
 * sieciowego. Tresc powiadomienia powstaje na urzadzeniu z danych, ktore
 * i tak sa na nim zapisane.
 * ====================================================================
 *
 * ================== UCZCIWIE O OGRANICZENIACH PRZEGLADARKI ==================
 * Na telefonie przypomnienia planuje SYSTEM OPERACYJNY - aplikacja moze byc
 * zamknieta, a powiadomienie i tak przyjdzie.
 *
 * W przegladarce NIE DA SIE tego odtworzyc. Standardowe API do planowania
 * powiadomien "na przyszlosc" bez serwera (Notification Triggers) nie weszlo
 * do zadnej przegladarki na stale, a Periodic Background Sync dziala tylko
 * w Chrome na Androidzie, po zainstalowaniu aplikacji i wedlug wlasnych regul
 * czestotliwosci. Jedyna w pelni pewna droga to serwer push - co oznaczaloby
 * utrzymywanie wlasnej infrastruktury i wysylanie na nia danych uzytkownika,
 * czyli dokladnie to, czego ten projekt unika.
 *
 * Robimy wiec najlepsza dostepna rzecz, bez udawania, ze to to samo:
 *   1. dopoki karta z aplikacja zyje (takze w tle), przypomnienia odpalaja sie
 *      o wyznaczonej godzinie przez timer;
 *   2. przegladarka w tle potrafi opozniac timery, wiec przy kazdym powrocie
 *      do aplikacji sprawdzamy, czy jakas godzina wlasnie minela, i pokazujemy
 *      zalegle przypomnienie od razu;
 *   3. gdy karta zostala zamknieta, przypomnienie NIE przyjdzie.
 *
 * To ograniczenie jest opisane w README (sekcja "Known limitations").
 * ============================================================================
 */
import { getDeviceTimeZone, type LocalDate } from '../../core/date/localDate';
import {
  localClock,
  planNotifications,
  toFireDate,
  type PlannedNotification,
} from '../../core/notifications/schedule';
import type { Reminder } from '../../core/model';
import { i18n } from '../../i18n';

/** Na ile dni do przodu planujemy powiadomienia. */
const DAYS_AHEAD = 7;

/**
 * Jak dlugo po wyznaczonej godzinie przypomnienie ma jeszcze sens.
 *
 * Powiadomienie "zrob pompki" o 12:00 pokazane o 23:50, bo uzytkownik akurat
 * wrocil do karty, byloby tylko irytujace.
 */
const CATCH_UP_WINDOW_MS = 90 * 60 * 1000;

interface ScheduledTimer {
  handle: ReturnType<typeof setTimeout>;
  fireAtMs: number;
  title: string;
  body: string;
  /** Czy juz pokazane - chroni przed podwojnym wyswietleniem. */
  shown: boolean;
}

let timers: ScheduledTimer[] = [];
let catchUpListenerAttached = false;

export function configureNotificationHandler(): void {
  // W przegladarce nie ma odpowiednika globalnego handlera z expo-notifications:
  // o tym, czy i jak pokazac powiadomienie, decyduje sam system operacyjny.
  // Funkcja istnieje, zeby kod startowy aplikacji byl wspolny dla obu platform.
}

export type PermissionResult = 'granted' | 'denied' | 'undetermined';

function notificationsAvailable(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (!notificationsAvailable()) return 'undetermined';

  try {
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';

    const result = await Notification.requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'undetermined';
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (!notificationsAvailable()) return false;
  return Notification.permission === 'granted';
}

/**
 * Pokazuje powiadomienie.
 *
 * Kolejnosc prob nie jest przypadkowa: Chrome na Androidzie ZABRANIA tworzenia
 * powiadomien przez `new Notification()` i rzuca wyjatkiem - tam dziala
 * wylacznie droga przez Service Workera. Na komputerze dzialaja obie.
 */
async function show(title: string, body: string): Promise<void> {
  if (!(await hasNotificationPermission())) return;

  const options: NotificationOptions = {
    body,
    // Wspolny tag sprawia, ze nowe przypomnienie zastepuje poprzednie zamiast
    // budowac stos powiadomien.
    tag: 'repsy-reminder',
    silent: false,
  };

  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration !== undefined) {
        await registration.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch {
    // Brak powiadomien nie moze wywrocic aplikacji.
  }
}

function clearTimers(): void {
  for (const timer of timers) clearTimeout(timer.handle);
  timers = [];
}

/**
 * Sprawdza, czy ktores przypomnienie wlasnie minelo.
 *
 * Potrzebne, bo przegladarka mocno spowalnia timery w kartach w tle -
 * bez tego przypomnienie z 12:00 potrafiloby sie pokazac grubo pozniej
 * albo wcale.
 */
function runCatchUp(): void {
  const now = Date.now();
  for (const timer of timers) {
    if (timer.shown) continue;
    if (timer.fireAtMs <= now && now - timer.fireAtMs <= CATCH_UP_WINDOW_MS) {
      timer.shown = true;
      void show(timer.title, timer.body);
    }
  }
}

function attachCatchUpListener(): void {
  if (catchUpListenerAttached || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runCatchUp();
  });
  catchUpListenerAttached = true;
}

interface RescheduleInput {
  reminders: readonly Reminder[];
  enabled: boolean;
  goalFor: (date: LocalDate) => number;
  totalFor: (date: LocalDate) => number;
}

/**
 * Przelicza i ustawia wszystkie przypomnienia.
 *
 * Plan powstaje DOKLADNIE ta sama funkcja co na telefonie
 * (core/notifications/schedule.ts), wiec godziny, pomijanie dni z osiagnietym
 * celem i tresci sa identyczne. Rozni sie tylko sposob doreczenia.
 */
export async function rescheduleReminders(input: RescheduleInput): Promise<number> {
  try {
    clearTimers();

    if (!input.enabled) return 0;
    if (!(await hasNotificationPermission())) return 0;

    const timeZone = getDeviceTimeZone();
    const clock = localClock(new Date(), timeZone);

    const planned = planNotifications({
      reminders: input.reminders,
      today: clock.today,
      nowHour: clock.hour,
      nowMinute: clock.minute,
      daysAhead: DAYS_AHEAD,
      goalFor: input.goalFor,
      totalFor: input.totalFor,
      enabled: input.enabled,
    });

    const title = i18n.t('notifications.defaultTitle');

    for (const notification of planned) {
      const fireAtMs = toFireDate(notification).getTime();
      const delay = fireAtMs - Date.now();
      if (delay <= 0) continue;

      const entry: ScheduledTimer = {
        fireAtMs,
        title,
        body: bodyFor(notification),
        shown: false,
        handle: setTimeout(() => {
          entry.shown = true;
          void show(entry.title, entry.body);
        }, delay),
      };
      timers.push(entry);
    }

    attachCatchUpListener();
    return timers.length;
  } catch {
    return 0;
  }
}

function bodyFor(notification: PlannedNotification): string {
  if (notification.customMessage.trim() !== '') return notification.customMessage;

  // Liczbe brakujacych powtorzen znamy tylko dla dzisiaj.
  if (notification.remaining !== null && notification.remaining > 0) {
    return i18n.t('notifications.reminderRemaining', { count: notification.remaining });
  }

  return i18n.t('notifications.reminderGeneric');
}

export async function cancelAllReminders(): Promise<void> {
  clearTimers();
}
