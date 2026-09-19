/**
 * Formatowanie liczb i czasu do wyswietlenia.
 */

/** Czas treningu: "4:35" albo "1:04:35" przy dluzszych sesjach. */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  const pad = (value: number): string => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/** Godzina treningu w formacie 24-godzinnym, np. "18:05". */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Skrot dnia tygodnia do podpisow na wykresie. */
export function weekdayLabel(localDate: string, language: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12));

  return new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-GB', {
    weekday: 'short',
    timeZone: 'UTC',
  })
    .format(date)
    .replace('.', '');
}

/** Numer dnia miesiaca - podpis na wykresie miesiecznym. */
export function dayOfMonthLabel(localDate: string): string {
  return String(Number(localDate.split('-')[2] ?? '1'));
}
