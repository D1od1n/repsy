/**
 * Sesja treningowa: zamiana pojedynczych powtorzen na serie.
 *
 * Serii nie deklaruje uzytkownik - wykrywamy je z rytmu cwiczenia. Gdy przez
 * kilkanascie sekund nie pojawi sie kolejne powtorzenie, uznajemy, ze seria
 * sie skonczyla i nastepne powtorzenie rozpocznie nowa.
 *
 * Czysta logika, bez Reacta i timerow - dzieki temu da sie ja przetestowac
 * podajac po prostu kolejne znaczniki czasu.
 */
import { newId } from '../id';
import type { LocalDate } from '../date/localDate';
import type { Workout, WorkoutSet } from '../model';

export interface SessionConfig {
  /** Po tylu ms bez powtorzenia zamykamy biezaca serie. */
  setIdleTimeoutMs: number;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  setIdleTimeoutMs: 12_000,
};

export interface SessionState {
  startedAt: number;
  totalReps: number;
  /** Serie juz zamkniete. */
  sets: WorkoutSet[];
  currentSetReps: number;
  currentSetStartedAt: number | null;
  lastRepAt: number | null;
}

export type SessionEvent = { type: 'SET_COMPLETED'; set: WorkoutSet };

export interface SessionResult {
  state: SessionState;
  events: SessionEvent[];
}

export function createSession(startedAt: number): SessionState {
  return {
    startedAt,
    totalReps: 0,
    sets: [],
    currentSetReps: 0,
    currentSetStartedAt: null,
    lastRepAt: null,
  };
}

/** Rejestruje zaliczone powtorzenie. */
export function registerRep(
  prev: SessionState,
  t: number,
  config: SessionConfig = DEFAULT_SESSION_CONFIG,
): SessionResult {
  // Najpierw sprawdzamy, czy przerwa przed tym powtorzeniem nie zamknela serii.
  const { state, events } = tick(prev, t, config);

  return {
    state: {
      ...state,
      totalReps: state.totalReps + 1,
      currentSetReps: state.currentSetReps + 1,
      currentSetStartedAt: state.currentSetStartedAt ?? t,
      lastRepAt: t,
    },
    events,
  };
}

/**
 * Uplyw czasu bez powtorzenia. Wolane cyklicznie przez ekran treningu -
 * to ono zamyka serie, gdy uzytkownik robi przerwe.
 */
export function tick(
  prev: SessionState,
  t: number,
  config: SessionConfig = DEFAULT_SESSION_CONFIG,
): SessionResult {
  const idleTooLong =
    prev.lastRepAt !== null && t - prev.lastRepAt >= config.setIdleTimeoutMs;

  if (!idleTooLong || prev.currentSetReps === 0) {
    return { state: prev, events: [] };
  }

  return closeSet(prev, prev.lastRepAt ?? t);
}

/** Zamyka trening i zwraca gotowy rekord do zapisania. */
export function finishSession(
  prev: SessionState,
  t: number,
  localDate: LocalDate,
): { state: SessionState; workout: Workout | null } {
  const { state } = prev.currentSetReps > 0 ? closeSet(prev, t) : { state: prev };

  if (state.totalReps === 0) return { state, workout: null };

  return {
    state,
    workout: {
      id: newId(),
      localDate,
      startedAt: state.startedAt,
      endedAt: t,
      totalReps: state.totalReps,
      durationS: Math.max(0, Math.round((t - state.startedAt) / 1000)),
      source: 'camera',
      sets: state.sets,
    },
  };
}

function closeSet(prev: SessionState, endedAt: number): SessionResult {
  // Seria bez powtorzen nie jest seria - po prostu ja pomijamy.
  if (prev.currentSetReps === 0) {
    return {
      state: { ...prev, currentSetReps: 0, currentSetStartedAt: null },
      events: [],
    };
  }

  const set: WorkoutSet = {
    index: prev.sets.length + 1,
    reps: prev.currentSetReps,
    startedAt: prev.currentSetStartedAt ?? endedAt,
    endedAt,
  };

  return {
    state: {
      ...prev,
      sets: [...prev.sets, set],
      currentSetReps: 0,
      currentSetStartedAt: null,
    },
    events: [{ type: 'SET_COMPLETED', set }],
  };
}
