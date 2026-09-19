/**
 * Cele dzienne.
 *
 * Uzytkownik ma jeden cel domyslny (np. 100 pompek), ale moze ustawic inny cel
 * na konkretny dzien - np. 40 na dzis, bo jest chory, i 150 na sobote.
 * Po takim wyjatkowym dniu aplikacja sama wraca do celu domyslnego, bo
 * nadpisania sa zapisywane osobno dla kazdej daty i nie zmieniaja ustawienia
 * globalnego.
 */
import type { LocalDate } from '../date/localDate';

export const GOAL_PRESETS = [50, 100, 150, 200] as const;

export const MIN_GOAL = 1;
export const MAX_GOAL = 2000;

/** Nadpisania celu dla konkretnych dni: data -> liczba powtorzen. */
export type GoalOverrides = Readonly<Record<LocalDate, number>>;

/**
 * Cel obowiazujacy danego dnia: nadpisanie, jesli istnieje, w przeciwnym razie
 * cel domyslny.
 */
export function resolveGoal(
  date: LocalDate,
  defaultGoal: number,
  overrides: GoalOverrides = {},
): number {
  const override = overrides[date];
  return override === undefined ? defaultGoal : override;
}

/** Przycina cel do sensownego zakresu - zabezpiecza przed 0 i absurdami. */
export function normalizeGoal(goal: number): number {
  if (!Number.isFinite(goal)) return MIN_GOAL;
  return Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(goal)));
}

/** Ile powtorzen zostalo do celu (nigdy ponizej zera). */
export function remainingToGoal(totalReps: number, goal: number): number {
  return Math.max(0, goal - totalReps);
}

/** Procent realizacji celu, zaokraglony, ograniczony z gory do 100. */
export function goalProgressPercent(totalReps: number, goal: number): number {
  if (goal <= 0) return 100;
  return Math.min(100, Math.round((totalReps / goal) * 100));
}

export function isGoalAchieved(totalReps: number, goal: number): boolean {
  return totalReps >= goal;
}
