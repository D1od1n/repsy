/**
 * Statystyki: dzien, tydzien, miesiac oraz rekordy zyciowe.
 *
 * Wszystko liczymy z listy treningow, ktora juz ma przypisany lokalny dzien
 * (`localDate`). Dzieki temu grupowanie jest zwykla arytmetyka kalendarzowa -
 * bez stref czasowych i bez pulapek zmiany czasu.
 */
import { datesBetween, diffDays, compareDates, type LocalDate } from '../date/localDate';
import { isGoalAchieved } from '../goals/goals';
import type { DailySummary, PersonalRecords, Workout } from '../model';

export interface DayBucket {
  date: LocalDate;
  totalReps: number;
  goal: number;
  achieved: boolean;
}

export interface PeriodSummary {
  from: LocalDate;
  to: LocalDate;
  totalReps: number;
  workouts: number;
  sets: number;
  durationS: number;
  /** Srednia dzienna liczona po dniach, ktore juz minely. */
  dailyAverage: number;
  bestDay: { date: LocalDate; totalReps: number } | null;
  /** Rekord pojedynczej serii w tym okresie. */
  bestSet: number;
  byDay: DayBucket[];
}

/** Funkcja zwracajaca cel obowiazujacy danego dnia. */
export type GoalResolver = (date: LocalDate) => number;

export function summarizeDay(
  workouts: readonly Workout[],
  date: LocalDate,
  goal: number,
): DailySummary {
  const ofDay = workouts.filter((w) => w.localDate === date);

  const totalReps = sum(ofDay.map((w) => w.totalReps));
  const sets = sum(ofDay.map((w) => w.sets.length));
  const durationS = sum(ofDay.map((w) => w.durationS));

  return {
    date,
    totalReps,
    goal,
    achieved: isGoalAchieved(totalReps, goal),
    workouts: ofDay.length,
    sets,
    durationS,
  };
}

export function summarizePeriod(
  workouts: readonly Workout[],
  from: LocalDate,
  to: LocalDate,
  goalFor: GoalResolver,
  today: LocalDate = to,
): PeriodSummary {
  const inRange = workouts.filter(
    (w) => compareDates(w.localDate, from) >= 0 && compareDates(w.localDate, to) <= 0,
  );

  const byDay: DayBucket[] = datesBetween(from, to).map((date) => {
    const totalReps = sum(
      inRange.filter((w) => w.localDate === date).map((w) => w.totalReps),
    );
    const goal = goalFor(date);
    return { date, totalReps, goal, achieved: isGoalAchieved(totalReps, goal) };
  });

  const totalReps = sum(byDay.map((d) => d.totalReps));

  // Srednia liczona po dniach, ktore juz minely - inaczej trwajacy miesiac
  // zawsze wygladalby zle, bo dzielilibysmy przez dni z przyszlosci.
  const lastCountedDay = compareDates(today, to) < 0 ? today : to;
  const elapsedDays = Math.max(1, diffDays(from, lastCountedDay) + 1);

  const daysWithData = byDay.filter((d) => d.totalReps > 0);
  const bestDay = daysWithData.reduce<{ date: LocalDate; totalReps: number } | null>(
    (best, day) =>
      best === null || day.totalReps > best.totalReps
        ? { date: day.date, totalReps: day.totalReps }
        : best,
    null,
  );

  const allSets = inRange.flatMap((w) => w.sets.map((s) => s.reps));

  return {
    from,
    to,
    totalReps,
    workouts: inRange.length,
    sets: sum(inRange.map((w) => w.sets.length)),
    durationS: sum(inRange.map((w) => w.durationS)),
    dailyAverage: Math.round(totalReps / elapsedDays),
    bestDay,
    bestSet: allSets.length > 0 ? Math.max(...allSets) : 0,
    byDay,
  };
}

export function computeRecords(
  workouts: readonly Workout[],
  longestStreak: number,
): PersonalRecords {
  const byDate = new Map<LocalDate, number>();
  for (const workout of workouts) {
    byDate.set(workout.localDate, (byDate.get(workout.localDate) ?? 0) + workout.totalReps);
  }

  const dayTotals = [...byDate.values()];
  const workoutTotals = workouts.map((w) => w.totalReps);
  const setTotals = workouts.flatMap((w) => w.sets.map((s) => s.reps));

  return {
    bestDay: dayTotals.length > 0 ? Math.max(...dayTotals) : 0,
    bestWorkout: workoutTotals.length > 0 ? Math.max(...workoutTotals) : 0,
    bestSet: setTotals.length > 0 ? Math.max(...setTotals) : 0,
    longestStreak,
    totalReps: sum(workoutTotals),
    totalWorkouts: workouts.length,
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
