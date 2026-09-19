/**
 * Planowanie przypomnien.
 *
 * Powiadomienia sa LOKALNE - planuje je telefon, nic nie wychodzi na serwer.
 *
 * Kluczowa zasada: jesli dzisiejszy cel jest juz osiagniety, nie wysylamy
 * dzis nic wiecej. Nikt nie chce dostac "zostalo Ci 20 pompek" pol godziny
 * po tym, jak zrobil cala setke.
 *
 * Planujemy w kroczacym oknie kilku dni do przodu i przeliczamy je po kazdym
 * treningu oraz przy wejsciu do aplikacji. Dzieki temu tresc ("zostalo Ci X")
 * jest aktualna, mimo ze system operacyjny wymaga podania jej z gory.
 */
import { addDays, toLocalDate, type LocalDate } from '../date/localDate';
import type { Reminder } from '../model';

export interface PlannedNotification {
  reminderId: string;
  date: LocalDate;
  hour: number;
  minute: number;
  /** Ile powtorzen brakuje; null = uzyj ogolnego komunikatu. */
  remaining: number | null;
  /** Wlasna tresc uzytkownika, jesli ja ustawil. */
  customMessage: string;
}

export interface PlanInput {
  reminders: readonly Reminder[];
  /** Dzisiejsza data lokalna uzytkownika. */
  today: LocalDate;
  /** Aktualna godzina i minuta u uzytkownika. */
  nowHour: number;
  nowMinute: number;
  /** Na ile dni do przodu planujemy. */
  daysAhead: number;
  goalFor: (date: LocalDate) => number;
  /** Liczba powtorzen wykonanych danego dnia. */
  totalFor: (date: LocalDate) => number;
  /** Globalny przelacznik przypomnien. */
  enabled: boolean;
}

export function planNotifications(input: PlanInput): PlannedNotification[] {
  if (!input.enabled) return [];

  const active = input.reminders.filter((reminder) => reminder.enabled);
  if (active.length === 0) return [];

  const planned: PlannedNotification[] = [];

  for (let dayOffset = 0; dayOffset <= input.daysAhead; dayOffset += 1) {
    const date = addDays(input.today, dayOffset);
    const isToday = dayOffset === 0;

    const goal = input.goalFor(date);
    const done = isToday ? input.totalFor(date) : 0;

    // Cel na dzis zrobiony - na dzisiaj konczymy z przypomnieniami.
    if (isToday && done >= goal) continue;

    for (const reminder of active) {
      // Godziny, ktore dzis juz minely, pomijamy.
      if (isToday && isInThePast(reminder, input.nowHour, input.nowMinute)) continue;

      planned.push({
        reminderId: reminder.id,
        date,
        hour: reminder.hour,
        minute: reminder.minute,
        // Dla przyszlych dni nie znamy jeszcze wyniku, wiec komunikat ogolny.
        remaining: isToday ? Math.max(0, goal - done) : null,
        customMessage: reminder.customMessage,
      });
    }
  }

  return planned.sort(compareByTime);
}

function isInThePast(reminder: Reminder, nowHour: number, nowMinute: number): boolean {
  return (
    reminder.hour < nowHour || (reminder.hour === nowHour && reminder.minute <= nowMinute)
  );
}

function compareByTime(a: PlannedNotification, b: PlannedNotification): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.hour !== b.hour) return a.hour - b.hour;
  return a.minute - b.minute;
}

/** Konkretna chwila, w ktorej ma sie pojawic powiadomienie. */
export function toFireDate(notification: PlannedNotification): Date {
  const [year, month, day] = notification.date.split('-').map(Number);
  return new Date(
    year ?? 1970,
    (month ?? 1) - 1,
    day ?? 1,
    notification.hour,
    notification.minute,
    0,
    0,
  );
}

/** Aktualna godzina i minuta w strefie czasowej uzytkownika. */
export function localClock(
  now: Date,
  timeZone: string,
): { today: LocalDate; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return { today: toLocalDate(now, timeZone), hour: get('hour'), minute: get('minute') };
}
