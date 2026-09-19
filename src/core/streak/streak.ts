/**
 * Streak - ile dni z rzedu uzytkownik osiagnal swoj cel.
 *
 * Zasada, ktora latwo przeoczyc: dzisiejszy dzien jeszcze trwa. Jesli cel na
 * dzis nie jest jeszcze zrobiony, streak NIE jest zerowany - liczymy go od
 * wczoraj. Zerowanie nastapi dopiero, gdy dzien minie bez osiagniecia celu.
 * Inaczej kazdego ranka uzytkownik widzialby streak 0, co byloby po prostu
 * nieprawda.
 */
import { addDays, compareDates, type LocalDate } from '../date/localDate';
import type { StreakInfo } from '../model';

/** Kamienie milowe pokazywane uzytkownikowi. */
export const MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 300, 365, 500, 1000] as const;

export interface DayOutcome {
  date: LocalDate;
  achieved: boolean;
}

/**
 * @param days   dni z informacja, czy cel zostal osiagniety (kolejnosc dowolna)
 * @param today  dzisiejsza data lokalna uzytkownika
 */
export function computeStreak(days: readonly DayOutcome[], today: LocalDate): StreakInfo {
  const achievedDates = new Set(days.filter((d) => d.achieved).map((d) => d.date));

  const current = countCurrentStreak(achievedDates, today);
  const longest = Math.max(current, countLongestStreak(achievedDates));
  const completedDays = achievedDates.size;

  const nextMilestone = findNextMilestone(current);

  return {
    current,
    longest,
    completedDays,
    nextMilestone,
    daysToMilestone: Math.max(0, nextMilestone - current),
  };
}

/**
 * Liczy dni wstecz od dzisiaj. Dzisiejszy dzien, jesli jeszcze nie zrobiony,
 * jest pomijany zamiast przerywac serie.
 */
function countCurrentStreak(achieved: ReadonlySet<LocalDate>, today: LocalDate): number {
  let cursor = achieved.has(today) ? today : addDays(today, -1);
  let streak = 0;

  while (achieved.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function countLongestStreak(achieved: ReadonlySet<LocalDate>): number {
  const sorted = [...achieved].sort(compareDates);

  let longest = 0;
  let run = 0;
  let previous: LocalDate | null = null;

  for (const date of sorted) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  return longest;
}

function findNextMilestone(current: number): number {
  for (const milestone of MILESTONES) {
    if (milestone > current) return milestone;
  }
  // Powyzej ostatniego kamienia milowego odmierzamy kolejne pelne tysiace.
  return Math.ceil((current + 1) / 1000) * 1000;
}
