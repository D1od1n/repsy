import { localClock, planNotifications, type PlanInput } from './schedule';
import type { Reminder } from '../model';

const reminders: Reminder[] = [
  { id: 'r1', hour: 14, minute: 0, enabled: true, customMessage: '' },
  { id: 'r2', hour: 18, minute: 0, enabled: true, customMessage: '' },
  { id: 'r3', hour: 21, minute: 0, enabled: true, customMessage: '' },
];

function plan(overrides: Partial<PlanInput> = {}) {
  return planNotifications({
    reminders,
    today: '2026-09-19',
    nowHour: 10,
    nowMinute: 0,
    daysAhead: 0,
    goalFor: () => 100,
    totalFor: () => 0,
    enabled: true,
    ...overrides,
  });
}

describe('planowanie przypomnien', () => {
  it('planuje wszystkie godziny, gdy dzien dopiero sie zaczal', () => {
    expect(plan().map((n) => n.hour)).toEqual([14, 18, 21]);
  });

  it('pomija godziny, ktore juz minely', () => {
    expect(plan({ nowHour: 19, nowMinute: 30 }).map((n) => n.hour)).toEqual([21]);
  });

  it('godzina dokladnie teraz jest juz przeszloscia', () => {
    expect(plan({ nowHour: 14, nowMinute: 0 }).map((n) => n.hour)).toEqual([18, 21]);
  });

  it('nie planuje niczego, gdy cel na dzis jest osiagniety', () => {
    expect(plan({ totalFor: () => 100 })).toHaveLength(0);
  });

  it('nie planuje niczego po przekroczeniu celu', () => {
    expect(plan({ totalFor: () => 150 })).toHaveLength(0);
  });

  it('planuje dalej, gdy do celu jeszcze brakuje', () => {
    const result = plan({ totalFor: () => 60 });
    expect(result).toHaveLength(3);
    expect(result[0]?.remaining).toBe(40);
  });

  it('respektuje wylaczony przelacznik globalny', () => {
    expect(plan({ enabled: false })).toHaveLength(0);
  });

  it('pomija wylaczone pojedyncze przypomnienia', () => {
    const result = plan({
      reminders: [
        { id: 'r1', hour: 14, minute: 0, enabled: false, customMessage: '' },
        { id: 'r2', hour: 18, minute: 0, enabled: true, customMessage: '' },
      ],
    });
    expect(result.map((n) => n.hour)).toEqual([18]);
  });

  it('brak przypomnien daje pusty plan', () => {
    expect(plan({ reminders: [] })).toHaveLength(0);
  });
});

describe('okno kilku dni do przodu', () => {
  it('planuje takze kolejne dni', () => {
    const result = plan({ daysAhead: 2 });

    expect(result).toHaveLength(9); // 3 godziny x 3 dni
    expect(new Set(result.map((n) => n.date))).toEqual(
      new Set(['2026-09-19', '2026-09-20', '2026-09-21']),
    );
  });

  it('dla przyszlych dni nie podaje liczby brakujacych powtorzen', () => {
    const result = plan({ daysAhead: 1, totalFor: () => 30 });

    const today = result.filter((n) => n.date === '2026-09-19');
    const tomorrow = result.filter((n) => n.date === '2026-09-20');

    expect(today[0]?.remaining).toBe(70);
    // Jutrzejszego wyniku jeszcze nie znamy - komunikat musi byc ogolny.
    expect(tomorrow[0]?.remaining).toBeNull();
  });

  it('osiagniety cel dzis nie blokuje przypomnien na jutro', () => {
    const result = plan({ daysAhead: 1, totalFor: () => 100 });

    expect(result.every((n) => n.date === '2026-09-20')).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('uwzglednia inny cel ustawiony na konkretny dzien', () => {
    const goals: Record<string, number> = { '2026-09-19': 40 };
    const result = plan({
      daysAhead: 1,
      goalFor: (date) => goals[date] ?? 100,
      totalFor: () => 40,
    });

    // Dzis cel 40 jest zrobiony, wiec zostaja tylko jutrzejsze przypomnienia.
    expect(result.every((n) => n.date === '2026-09-20')).toBe(true);
  });

  it('plan jest posortowany chronologicznie', () => {
    const result = plan({ daysAhead: 2 });
    const keys = result.map((n) => `${n.date} ${String(n.hour).padStart(2, '0')}`);

    expect(keys).toEqual([...keys].sort());
  });
});

describe('zegar lokalny', () => {
  it('odczytuje godzine w strefie uzytkownika', () => {
    // 12:30 UTC to 14:30 w Warszawie (czas letni).
    const clock = localClock(new Date('2026-09-19T12:30:00Z'), 'Europe/Warsaw');

    expect(clock.today).toBe('2026-09-19');
    expect(clock.hour).toBe(14);
    expect(clock.minute).toBe(30);
  });

  it('poprawnie obsluguje przejscie przez polnoc', () => {
    // 22:30 UTC to 00:30 nastepnego dnia w Warszawie.
    const clock = localClock(new Date('2026-09-19T22:30:00Z'), 'Europe/Warsaw');

    expect(clock.today).toBe('2026-09-20');
    expect(clock.hour).toBe(0);
    expect(clock.minute).toBe(30);
  });
});
