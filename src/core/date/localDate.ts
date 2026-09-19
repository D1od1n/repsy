/**
 * Daty lokalne uzytkownika.
 *
 * Kluczowa decyzja: dzien treningowy zapisujemy jako TEKST 'YYYY-MM-DD'
 * wyliczony w strefie czasowej urzadzenia, a nie jako znacznik czasu UTC.
 *
 * Dlaczego to wazne:
 *  - trening o 23:30 ma trafic do dzisiejszego dnia, a nie do jutrzejszego UTC,
 *  - po zmianie czasu (DST) doba ma 23 albo 25 godzin - arytmetyka na
 *    milisekundach zaczyna wtedy gubic dni,
 *  - po przelocie do innej strefy dawne treningi maja zostac w swoich dniach.
 *
 * Gdy raz zamienimy chwile na dzien kalendarzowy, dalsze grupowanie
 * (tydzien, miesiac, streak) jest juz czysta arytmetyka kalendarzowa,
 * calkowicie odporna na strefy czasowe i DST.
 */

/** Dzien kalendarzowy w formacie 'YYYY-MM-DD'. */
export type LocalDate = string;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): value is LocalDate {
  return DATE_PATTERN.test(value);
}

/** Strefa czasowa urzadzenia (np. 'Europe/Warsaw'). */
export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Zamienia konkretna chwile na dzien kalendarzowy w podanej strefie czasowej.
 * Uzywamy Intl, bo tylko ono zna reguly DST kazdej strefy.
 */
export function toLocalDate(instant: Date, timeZone: string = getDeviceTimeZone()): LocalDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function todayLocal(
  timeZone: string = getDeviceTimeZone(),
  now: Date = new Date(),
): LocalDate {
  return toLocalDate(now, timeZone);
}

/**
 * Rozklada 'YYYY-MM-DD' na liczby. Swiadomie NIE uzywamy new Date(string),
 * bo jego zachowanie zalezy od przegladarki i strefy.
 */
function parts(date: LocalDate): { year: number; month: number; day: number } {
  const [y, m, d] = date.split('-');
  return { year: Number(y), month: Number(m), day: Number(d) };
}

/**
 * Pomocniczy punkt w czasie: poludnie UTC danego dnia.
 * Poludnie (a nie polnoc) daje 12 h zapasu w obie strony, wiec zadne
 * przesuniecie strefy nie przerzuci nas na sasiedni dzien.
 */
function toUtcNoon(date: LocalDate): Date {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function fromUtcNoon(instant: Date): LocalDate {
  const year = instant.getUTCFullYear();
  const month = String(instant.getUTCMonth() + 1).padStart(2, '0');
  const day = String(instant.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const noon = toUtcNoon(date);
  noon.setUTCDate(noon.getUTCDate() + days);
  return fromUtcNoon(noon);
}

/** Liczba dni od `from` do `to` (dodatnia, gdy `to` jest pozniej). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  const ms = toUtcNoon(to).getTime() - toUtcNoon(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Dzien tygodnia: 1 = poniedzialek ... 7 = niedziela (ISO-8601). */
export function isoWeekday(date: LocalDate): number {
  const day = toUtcNoon(date).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Poniedzialek tygodnia, w ktorym lezy `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -(isoWeekday(date) - 1));
}

export function endOfWeek(date: LocalDate): LocalDate {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date: LocalDate): LocalDate {
  const { year, month } = parts(date);
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function endOfMonth(date: LocalDate): LocalDate {
  const { year, month } = parts(date);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/** Wszystkie dni od `from` do `to` wlacznie. */
export function datesBetween(from: LocalDate, to: LocalDate): LocalDate[] {
  const result: LocalDate[] = [];
  const total = diffDays(from, to);
  if (total < 0) return result;

  for (let i = 0; i <= total; i += 1) result.push(addDays(from, i));
  return result;
}

/**
 * Zakres dni dla wybranego okresu statystyk, liczony wzgledem dnia `anchor`.
 */
export function periodRange(
  period: 'day' | 'week' | 'month',
  anchor: LocalDate,
): { from: LocalDate; to: LocalDate } {
  switch (period) {
    case 'day':
      return { from: anchor, to: anchor };
    case 'week':
      return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
    case 'month':
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }
}
