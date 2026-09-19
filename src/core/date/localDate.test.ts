/**
 * Testy dat lokalnych.
 *
 * Najwazniejsze przypadki to granica polnocy i zmiana czasu (DST) - tam
 * naiwna arytmetyka na milisekundach cicho gubi albo dubluje dni.
 */
import {
  addDays,
  datesBetween,
  diffDays,
  endOfMonth,
  endOfWeek,
  isoWeekday,
  periodRange,
  startOfMonth,
  startOfWeek,
  toLocalDate,
} from './localDate';

describe('toLocalDate - granica polnocy', () => {
  it('trening przed polnoca w Warszawie liczy sie do dnia lokalnego, nie do UTC', () => {
    // 22:30 UTC = 00:30 nastepnego dnia w Warszawie (lato, UTC+2).
    const instant = new Date('2026-09-18T22:30:00Z');

    expect(toLocalDate(instant, 'Europe/Warsaw')).toBe('2026-09-19');
    expect(toLocalDate(instant, 'UTC')).toBe('2026-09-18');
  });

  it('dziala takze dla stref na zachod od UTC', () => {
    // 02:00 UTC = 22:00 poprzedniego dnia w Nowym Jorku.
    const instant = new Date('2026-09-19T02:00:00Z');

    expect(toLocalDate(instant, 'America/New_York')).toBe('2026-09-18');
    expect(toLocalDate(instant, 'UTC')).toBe('2026-09-19');
  });

  it('zima w Warszawie uzywa przesuniecia +1', () => {
    const instant = new Date('2026-01-15T23:30:00Z');
    expect(toLocalDate(instant, 'Europe/Warsaw')).toBe('2026-01-16');
  });
});

describe('zmiana czasu (DST)', () => {
  // W 2026 r. w Polsce: zmiana na letni 29 marca, na zimowy 25 pazdziernika.
  it('doba 23-godzinna nie gubi dnia', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('doba 25-godzinna nie dubluje dnia', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('zakres dni przez zmiane czasu ma poprawna dlugosc', () => {
    const range = datesBetween('2026-10-23', '2026-10-27');
    expect(range).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
  });
});

describe('arytmetyka kalendarzowa', () => {
  it('przechodzi przez granice miesiaca i roku', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('obsluguje rok przestepny', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
  });

  it('liczy dni tygodnia wedlug ISO (poniedzialek = 1)', () => {
    expect(isoWeekday('2026-09-14')).toBe(1); // poniedzialek
    expect(isoWeekday('2026-09-20')).toBe(7); // niedziela
  });

  it('tydzien zaczyna sie w poniedzialek', () => {
    expect(startOfWeek('2026-09-19')).toBe('2026-09-14');
    expect(endOfWeek('2026-09-19')).toBe('2026-09-20');
    // Niedziela nalezy jeszcze do tygodnia rozpoczetego w poniedzialek.
    expect(startOfWeek('2026-09-20')).toBe('2026-09-14');
  });

  it('wyznacza granice miesiaca', () => {
    expect(startOfMonth('2026-09-19')).toBe('2026-09-01');
    expect(endOfMonth('2026-09-19')).toBe('2026-09-30');
  });
});

describe('periodRange', () => {
  it('zwraca poprawne zakresy dla dnia, tygodnia i miesiaca', () => {
    expect(periodRange('day', '2026-09-19')).toEqual({ from: '2026-09-19', to: '2026-09-19' });
    expect(periodRange('week', '2026-09-19')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
    expect(periodRange('month', '2026-09-19')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
});
