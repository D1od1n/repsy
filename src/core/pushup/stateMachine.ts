/**
 * Maszyna stanow liczaca pompki.
 *
 * Czysta funkcja: (stan, probka) -> (nowy stan, zdarzenia).
 * Zero zaleznosci od Reacta, kamery i telefonu - dzieki temu caly algorytm
 * testujemy syntetycznymi sekwencjami punktow, deterministycznie i w milisekundy.
 *
 *   NO_POSE / BAD_SETUP -> CALIBRATING -> TOP -> DESCENDING -> BOTTOM -> ASCENDING -> (+1) -> TOP
 *
 * Powtorzenie liczy sie WYLACZNIE po pelnym cyklu gora -> dol -> gora.
 * Samo poruszenie rekami nic nie daje.
 */
import { clamp, median } from '../pose/geometry';
import type { SetupIssue } from '../pose/quality';
import type { PushupMetrics } from './metric';

export type RepPhase =
  | 'NO_POSE'
  | 'BAD_SETUP'
  | 'CALIBRATING'
  | 'TOP'
  | 'DESCENDING'
  | 'BOTTOM'
  | 'ASCENDING';

export type CounterEvent =
  | { type: 'REP'; index: number; durationMs: number; depth: number }
  | { type: 'TOO_SHALLOW'; reached: number }
  | { type: 'CALIBRATED'; hTop: number }
  | { type: 'LOST' };

export interface PushupConfig {
  /** Postep, powyzej ktorego uznajemy, ze ruch w dol sie zaczal. */
  downEnter: number;
  /** Postep wymagany, zeby uznac dolna pozycje za osiagnieta (1 = pelna glebokosc). */
  bottomEnter: number;
  /** Postep, ponizej ktorego uznajemy, ze uzytkownik rusza w gore. */
  bottomExit: number;
  /** Postep, ponizej ktorego jestesmy z powrotem na gorze. */
  topEnter: number;
  /** O ile musi spasc postep, zeby uznac to za zawrocenie (a nie szum). */
  reversalDelta: number;
  /** Minimalny postep, ponizej ktorego nie zawracamy uwagi komunikatem. */
  shallowMin: number;
  /** Ponizej tego czasu cykl jest fizycznie niemozliwy - to drgania. */
  minCycleMs: number;
  /** Powyzej tego czasu uznajemy, ze uzytkownik przerwal w polowie. */
  maxCycleMs: number;
  /** Minimalna przerwa miedzy zaliczeniami. */
  repCooldownMs: number;
  /** Po tylu ms bez wiarygodnej klatki przerywamy biezacy cykl. */
  lossTimeoutMs: number;
  /** Po tylu ms bez detekcji wymuszamy ponowna kalibracje. */
  recalibrateAfterMs: number;
  /** Jak czesto maksymalnie pokazujemy "Zejdz nizej". */
  warningCooldownMs: number;
  /** Ile probek zbieramy do kalibracji gornej pozycji. */
  calibrationWindow: number;
  /** Maksymalny rozrzut probek, zeby uznac pozycje za stabilna. */
  calibrationSpread: number;
  /** Startowa wymagana glebokosc (w jednostkach szerokosci barkow). */
  defaultDepth: number;
  minDepth: number;
  maxDepth: number;
  /** Kat lokcia potwierdzajacy dol; null w metrykach = pomijamy warunek. */
  elbowBottomMax: number;
}

export const DEFAULT_PUSHUP_CONFIG: PushupConfig = {
  downEnter: 0.3,
  bottomEnter: 1.0,
  bottomExit: 0.8,
  topEnter: 0.25,
  reversalDelta: 0.08,
  shallowMin: 0.4,
  minCycleMs: 500,
  maxCycleMs: 10_000,
  repCooldownMs: 350,
  lossTimeoutMs: 400,
  recalibrateAfterMs: 2_000,
  warningCooldownMs: 4_000,
  calibrationWindow: 15,
  calibrationSpread: 0.12,
  defaultDepth: 0.55,
  minDepth: 0.3,
  maxDepth: 1.2,
  elbowBottomMax: 110,
};

export interface CounterState {
  phase: RepPhase;
  reps: number;
  /** Wartosc h w gornej pozycji, ustalana przy kalibracji. */
  hTop: number | null;
  /** Aktualnie wymagana glebokosc, dostrajana do uzytkownika. */
  depthRequired: number;
  /** Postep biezacego powtorzenia 0..1 (do UI). */
  progress: number;
  issue: SetupIssue | null;

  // --- stan wewnetrzny ---
  calibrationSamples: number[];
  cycleStartedAt: number | null;
  cycleMaxDepth: number;
  awaitingTop: boolean;
  lastRepAt: number | null;
  lastWarningAt: number | null;
  lastValidAt: number | null;
  acceptedDepths: number[];
  shallowPeaks: number[];
}

export interface CounterInput {
  /** Czas klatki w milisekundach (monotoniczny). */
  t: number;
  /** Metryki z klatki, albo null gdy klatka jest nieuzyteczna. */
  metrics: PushupMetrics | null;
  /** Problem z ustawieniem, albo null gdy wszystko OK. */
  issue: SetupIssue | null;
}

export function createInitialState(
  config: PushupConfig = DEFAULT_PUSHUP_CONFIG,
): CounterState {
  return {
    phase: 'NO_POSE',
    reps: 0,
    hTop: null,
    depthRequired: config.defaultDepth,
    progress: 0,
    issue: null,
    calibrationSamples: [],
    cycleStartedAt: null,
    cycleMaxDepth: 0,
    awaitingTop: false,
    lastRepAt: null,
    lastWarningAt: null,
    lastValidAt: null,
    acceptedDepths: [],
    shallowPeaks: [],
  };
}

export interface StepResult {
  state: CounterState;
  events: CounterEvent[];
}

export function step(
  prev: CounterState,
  input: CounterInput,
  config: PushupConfig = DEFAULT_PUSHUP_CONFIG,
): StepResult {
  const events: CounterEvent[] = [];
  const state: CounterState = { ...prev };

  // ---------------------------------------------------------------- brak danych
  if (input.metrics === null || input.issue !== null) {
    return handleInvalidFrame(state, input, config, events);
  }

  const { h, elbowAngle } = input.metrics;
  state.issue = null;
  state.lastValidAt = input.t;

  // ------------------------------------------------------------------ kalibracja
  if (state.hTop === null || state.phase === 'CALIBRATING') {
    return calibrate(state, h, config, events);
  }

  // Gorna pozycja to z definicji najwieksze h. Jesli uzytkownik wszedl wyzej niz
  // przy kalibracji (np. telefon sie przesunal), podnosimy odniesienie.
  if (state.phase === 'TOP' && h > state.hTop) {
    state.hTop = state.hTop + (h - state.hTop) * 0.25;
  }

  const rawDepth = state.hTop - h;
  const progress = rawDepth / state.depthRequired;
  state.progress = clamp(progress, 0, 1);

  // Powolne dostrajanie odniesienia, gdy uzytkownik spoczywa na gorze.
  if (state.phase === 'TOP' && progress < 0.15) {
    state.hTop = state.hTop + (h - state.hTop) * 0.05;
  }

  // Po przerwanym cyklu czekamy, az uzytkownik faktycznie wroci na gore.
  if (state.awaitingTop) {
    if (progress <= config.topEnter) state.awaitingTop = false;
    state.phase = 'TOP';
    return { state, events };
  }

  // Cykl trwajacy zbyt dlugo = uzytkownik zatrzymal sie w polowie.
  if (state.cycleStartedAt !== null && input.t - state.cycleStartedAt > config.maxCycleMs) {
    abortCycle(state);
    return { state, events };
  }

  switch (state.phase) {
    case 'TOP': {
      if (progress >= config.downEnter) {
        state.phase = 'DESCENDING';
        state.cycleStartedAt = input.t;
        state.cycleMaxDepth = rawDepth;
      }
      break;
    }

    case 'DESCENDING': {
      state.cycleMaxDepth = Math.max(state.cycleMaxDepth, rawDepth);
      const peakProgress = state.cycleMaxDepth / state.depthRequired;

      const elbowConfirms = elbowAngle === null || elbowAngle <= config.elbowBottomMax;

      if (progress >= config.bottomEnter && elbowConfirms) {
        state.phase = 'BOTTOM';
      } else if (progress < peakProgress - config.reversalDelta) {
        // Zawrocil, zanim zszedl wystarczajaco nisko - to polpompka.
        if (peakProgress >= config.shallowMin) {
          maybeWarn(state, input.t, peakProgress, config, events);
          rescueDepthIfStuck(state, config);
        }
        abortCycle(state);
      }
      break;
    }

    case 'BOTTOM': {
      state.cycleMaxDepth = Math.max(state.cycleMaxDepth, rawDepth);
      if (progress <= config.bottomExit) state.phase = 'ASCENDING';
      break;
    }

    case 'ASCENDING': {
      if (progress <= config.topEnter) {
        completeRep(state, input.t, config, events);
      }
      break;
    }

    default:
      state.phase = 'TOP';
  }

  return { state, events };
}

// --------------------------------------------------------------------- pomocnicze

function handleInvalidFrame(
  state: CounterState,
  input: CounterInput,
  config: PushupConfig,
  events: CounterEvent[],
): StepResult {
  state.issue = input.issue ?? 'LOW_CONFIDENCE';

  const since = state.lastValidAt === null ? Infinity : input.t - state.lastValidAt;

  // Krotkie mrugniecie detekcji ignorujemy - cykl trwa dalej.
  if (since <= config.lossTimeoutMs) return { state, events };

  const wasMidCycle =
    state.phase === 'DESCENDING' ||
    state.phase === 'BOTTOM' ||
    state.phase === 'ASCENDING';

  if (wasMidCycle) events.push({ type: 'LOST' });

  // Przerywamy cykl: zadnych "duchowych" powtorzen po odzyskaniu detekcji.
  abortCycle(state);
  state.phase = state.issue === 'NO_POSE' ? 'NO_POSE' : 'BAD_SETUP';
  state.progress = 0;

  // Dluga utrata = telefon mogl sie przesunac, kalibrujemy od nowa.
  if (since > config.recalibrateAfterMs) {
    state.hTop = null;
    state.calibrationSamples = [];
  }

  return { state, events };
}

function calibrate(
  state: CounterState,
  h: number,
  config: PushupConfig,
  events: CounterEvent[],
): StepResult {
  state.phase = 'CALIBRATING';
  state.progress = 0;

  const samples = [...state.calibrationSamples, h];
  if (samples.length > config.calibrationWindow) samples.shift();
  state.calibrationSamples = samples;

  if (samples.length >= config.calibrationWindow) {
    const spread = Math.max(...samples) - Math.min(...samples);
    if (spread <= config.calibrationSpread) {
      const hTop = median(samples);
      state.hTop = hTop;
      state.phase = 'TOP';
      state.awaitingTop = false;
      state.calibrationSamples = [];
      events.push({ type: 'CALIBRATED', hTop });
    }
  }

  return { state, events };
}

function completeRep(
  state: CounterState,
  t: number,
  config: PushupConfig,
  events: CounterEvent[],
): void {
  const startedAt = state.cycleStartedAt;
  const durationMs = startedAt === null ? 0 : t - startedAt;

  const tooFast = durationMs < config.minCycleMs;
  const tooSoon = state.lastRepAt !== null && t - state.lastRepAt < config.repCooldownMs;

  if (!tooFast && !tooSoon) {
    state.reps += 1;
    state.lastRepAt = t;

    const depths = [...state.acceptedDepths, state.cycleMaxDepth].slice(-5);
    state.acceptedDepths = depths;
    state.shallowPeaks = [];

    // Dostrajamy wymagana glebokosc do faktycznego zakresu ruchu uzytkownika.
    if (depths.length >= 3) {
      state.depthRequired = clamp(median(depths) * 0.8, config.minDepth, config.maxDepth);
    }

    events.push({
      type: 'REP',
      index: state.reps,
      durationMs,
      depth: state.cycleMaxDepth,
    });
  }

  state.phase = 'TOP';
  state.cycleStartedAt = null;
  state.cycleMaxDepth = 0;
}

function abortCycle(state: CounterState): void {
  state.phase = 'TOP';
  state.cycleStartedAt = null;
  state.cycleMaxDepth = 0;
  state.awaitingTop = true;
}

function maybeWarn(
  state: CounterState,
  t: number,
  peakProgress: number,
  config: PushupConfig,
  events: CounterEvent[],
): void {
  const ready =
    state.lastWarningAt === null || t - state.lastWarningAt >= config.warningCooldownMs;
  if (!ready) return;

  state.lastWarningAt = t;
  events.push({ type: 'TOO_SHALLOW', reached: clamp(peakProgress, 0, 1) });
}

/**
 * Ratunek dla nietypowego ustawienia kamery.
 *
 * Jesli uzytkownik jeszcze ani razu nie zaliczyl powtorzenia, a kilka prob z rzedu
 * konczylo sie tak samo plytko, to najprawdopodobniej nie robi polpompek - tylko
 * kat kamery sciska nasz sygnal. Obnizamy wtedy prog do jego realnego zakresu
 * ruchu, zamiast w nieskonczonosc wyswietlac "Zejdz nizej".
 *
 * Dziala WYLACZNIE przed pierwszym zaliczonym powtorzeniem, wiec nie sluzy
 * do stopniowego rozluzniania wymagan w trakcie treningu.
 */
function rescueDepthIfStuck(state: CounterState, config: PushupConfig): void {
  if (state.reps > 0) return;

  const peaks = [...state.shallowPeaks, state.cycleMaxDepth].slice(-6);
  state.shallowPeaks = peaks;

  if (peaks.length >= 5) {
    state.depthRequired = clamp(median(peaks) * 0.85, config.minDepth, config.maxDepth);
    state.shallowPeaks = [];
  }
}
