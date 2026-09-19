import { computeRecords, summarizeDay, summarizePeriod } from './stats';
import { goalProgressPercent, remainingToGoal, resolveGoal, normalizeGoal } from '../goals/goals';
import { periodRange } from '../date/localDate';
import type { LocalDate } from '../date/localDate';
import type { Workout } from '../model';

let counter = 0;

function workout(localDate: LocalDate, sets: number[], durationS = 300): Workout {
  counter += 1;
  const startedAt = Date.parse(`${localDate}T10:00:00Z`);
  return {
    id: `w-${counter}`,
    localDate,
    startedAt,
    endedAt: startedAt + durationS * 1000,
    totalReps: sets.reduce((a, b) => a + b, 0),
    durationS,
    source: 'camera',
    sets: sets.map((reps, index) => ({
      index: index + 1,
      reps,
      startedAt: startedAt + index * 60_000,
      endedAt: startedAt + index * 60_000 + 40_000,
    })),
  };
}

describe('cele dzienne', () => {
  it('uzywa celu domyslnego, gdy nie ma nadpisania', () => {
    expect(resolveGoal('2026-09-19', 100, {})).toBe(100);
  });

  it('nadpisanie dotyczy tylko swojego dnia', () => {
    const overrides = { '2026-09-19': 40, '2026-09-21': 150 };

    expect(resolveGoal('2026-09-19', 100, overrides)).toBe(40);
    expect(resolveGoal('2026-09-20', 100, overrides)).toBe(100); // powrot do domyslnego
    expect(resolveGoal('2026-09-21', 100, overrides)).toBe(150);
  });

  it('przycina niepoprawne wartosci celu', () => {
    expect(normalizeGoal(0)).toBe(1);
    expect(normalizeGoal(-5)).toBe(1);
    expect(normalizeGoal(99999)).toBe(2000);
    expect(normalizeGoal(100.4)).toBe(100);
  });

  it('liczy pozostale powtorzenia i procent', () => {
    expect(remainingToGoal(60, 100)).toBe(40);
    expect(remainingToGoal(120, 100)).toBe(0);
    expect(goalProgressPercent(50, 100)).toBe(50);
    expect(goalProgressPercent(120, 100)).toBe(100);
  });
});

describe('statystyki dnia', () => {
  it('sumuje treningi, serie i czas', () => {
    const workouts = [workout('2026-09-19', [20, 25]), workout('2026-09-19', [30, 25])];

    const summary = summarizeDay(workouts, '2026-09-19', 100);

    expect(summary.totalReps).toBe(100);
    expect(summary.workouts).toBe(2);
    expect(summary.sets).toBe(4);
    expect(summary.achieved).toBe(true);
  });

  it('ignoruje treningi z innych dni', () => {
    const workouts = [workout('2026-09-19', [50]), workout('2026-09-18', [80])];
    expect(summarizeDay(workouts, '2026-09-19', 100).totalReps).toBe(50);
  });

  it('oznacza dzien jako niezrobiony ponizej celu', () => {
    expect(summarizeDay([workout('2026-09-19', [40])], '2026-09-19', 100).achieved).toBe(false);
  });
});

describe('statystyki tygodnia', () => {
  const workouts = [
    workout('2026-09-14', [30, 30]),
    workout('2026-09-16', [50]),
    workout('2026-09-18', [40, 45]),
    workout('2026-09-19', [20]),
  ];

  it('sumuje caly tydzien i rozklada na dni', () => {
    const { from, to } = periodRange('week', '2026-09-19');
    const summary = summarizePeriod(workouts, from, to, () => 100, '2026-09-19');

    expect(summary.totalReps).toBe(215);
    expect(summary.workouts).toBe(4);
    expect(summary.sets).toBe(6);
    expect(summary.byDay).toHaveLength(7);
  });

  it('znajduje najlepszy dzien i rekord serii', () => {
    const { from, to } = periodRange('week', '2026-09-19');
    const summary = summarizePeriod(workouts, from, to, () => 100, '2026-09-19');

    expect(summary.bestDay).toEqual({ date: '2026-09-18', totalReps: 85 });
    expect(summary.bestSet).toBe(50);
  });

  it('srednia dzienna liczy sie po dniach, ktore juz minely', () => {
    const { from, to } = periodRange('week', '2026-09-19');
    // Tydzien trwa do niedzieli, ale dzis jest sobota - minelo 6 dni.
    const summary = summarizePeriod(workouts, from, to, () => 100, '2026-09-19');

    expect(summary.dailyAverage).toBe(Math.round(215 / 6));
  });
});

describe('statystyki miesiaca', () => {
  it('uwzglednia rozne cele w roznych dniach', () => {
    const workouts = [workout('2026-09-01', [40]), workout('2026-09-02', [100])];
    const goals: Record<string, number> = { '2026-09-01': 40 };

    const { from, to } = periodRange('month', '2026-09-01');
    const summary = summarizePeriod(
      workouts,
      from,
      to,
      (date) => goals[date] ?? 100,
      '2026-09-02',
    );

    const day1 = summary.byDay.find((d) => d.date === '2026-09-01');
    const day2 = summary.byDay.find((d) => d.date === '2026-09-02');

    // 40 powtorzen przy celu 40 = dzien zrobiony.
    expect(day1?.achieved).toBe(true);
    expect(day2?.achieved).toBe(true);
    expect(summary.byDay).toHaveLength(30);
  });

  it('pusty okres nie wywraca sie na dzieleniu przez zero', () => {
    const { from, to } = periodRange('month', '2026-09-01');
    const summary = summarizePeriod([], from, to, () => 100, '2026-09-15');

    expect(summary.totalReps).toBe(0);
    expect(summary.dailyAverage).toBe(0);
    expect(summary.bestDay).toBeNull();
    expect(summary.bestSet).toBe(0);
  });
});

describe('rekordy zyciowe', () => {
  it('wyznacza rekord dnia, treningu i serii', () => {
    const workouts = [
      workout('2026-09-17', [20, 25, 30]), // trening 75
      workout('2026-09-17', [10]), // ten sam dzien -> dzien 85
      workout('2026-09-18', [60, 20]), // trening 80
    ];

    const records = computeRecords(workouts, 12);

    expect(records.bestDay).toBe(85);
    expect(records.bestWorkout).toBe(80);
    expect(records.bestSet).toBe(60);
    expect(records.longestStreak).toBe(12);
    expect(records.totalReps).toBe(165);
    expect(records.totalWorkouts).toBe(3);
  });

  it('brak treningow daje same zera', () => {
    const records = computeRecords([], 0);
    expect(records).toEqual({
      bestDay: 0,
      bestWorkout: 0,
      bestSet: 0,
      longestStreak: 0,
      totalReps: 0,
      totalWorkouts: 0,
    });
  });
});
