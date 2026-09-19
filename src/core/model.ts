/**
 * Model danych aplikacji.
 *
 * ============================ PRYWATNOSC ============================
 * Zwroc uwage, czego tu NIE MA: zadnych klatek, zdjec, nagran ani sciezek do
 * plikow z kamery. Aplikacja przechowuje wylacznie liczby i daty. To jest
 * granica, ktorej obraz z kamery nigdy nie przekracza.
 * ====================================================================
 */
import type { LocalDate } from './date/localDate';

/** Skad wziely sie powtorzenia - z kamery czy z recznego dopisania. */
export type WorkoutSource = 'camera' | 'manual';

export interface WorkoutSet {
  /** Numer serii w treningu, liczony od 1. */
  index: number;
  reps: number;
  /** Znaczniki czasu w ms (epoch). */
  startedAt: number;
  endedAt: number;
}

export interface Workout {
  /** UUID generowany na urzadzeniu - to on zapewnia brak duplikatow przy synchronizacji. */
  id: string;
  /** Dzien kalendarzowy uzytkownika, do ktorego liczy sie ten trening. */
  localDate: LocalDate;
  startedAt: number;
  endedAt: number;
  totalReps: number;
  durationS: number;
  source: WorkoutSource;
  sets: WorkoutSet[];
}

export interface DailySummary {
  date: LocalDate;
  totalReps: number;
  goal: number;
  achieved: boolean;
  workouts: number;
  sets: number;
  durationS: number;
}

export interface StreakInfo {
  current: number;
  longest: number;
  completedDays: number;
  /** Najblizszy kamien milowy (np. 7, 30, 100 dni). */
  nextMilestone: number;
  daysToMilestone: number;
}

export interface PersonalRecords {
  bestDay: number;
  bestWorkout: number;
  bestSet: number;
  longestStreak: number;
  totalReps: number;
  totalWorkouts: number;
}

export type ThemePreference = 'system' | 'light' | 'dark';
export type LanguagePreference = 'system' | 'pl' | 'en';

export interface Reminder {
  id: string;
  /** Godzina 0-23. */
  hour: number;
  /** Minuta 0-59. */
  minute: number;
  enabled: boolean;
  /** Pusty tekst = uzyj domyslnego komunikatu z tlumaczen. */
  customMessage: string;
}

export interface UserSettings {
  defaultGoal: number;
  theme: ThemePreference;
  language: LanguagePreference;
  remindersEnabled: boolean;
  hapticsEnabled: boolean;
  /** Ekran diagnostyczny podczas treningu - do strojenia progow na telefonie. */
  debugOverlay: boolean;
  /** Czy uzytkownik przeszedl juz powitanie (wybor celu i ustawienie telefonu). */
  onboardingDone: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultGoal: 100,
  theme: 'system',
  language: 'system',
  remindersEnabled: true,
  hapticsEnabled: true,
  debugOverlay: false,
  onboardingDone: false,
};

export interface Profile {
  id: string;
  username: string;
  friendCode: string;
  avatarEmoji: string;
  defaultGoal: number;
}

export interface Friend {
  id: string;
  username: string;
  avatarEmoji: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarEmoji: string;
  total: number;
  isMe: boolean;
}
