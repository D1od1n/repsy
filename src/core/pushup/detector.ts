/**
 * Zlozenie calego potoku wykrywania pompek w jedna klase.
 *
 *   punkty ciala -> wygladzanie (One Euro) -> ocena ustawienia -> metryki -> maszyna stanow
 *
 * Aplikacja i testy uzywaja DOKLADNIE tego samego kodu. Dzieki temu test, ktory
 * przechodzi, mowi cos o tym, co naprawde pojedzie na telefonie - a nie o
 * uproszczonej atrapie potoku.
 *
 * ============================ PRYWATNOSC ============================
 * Wejsciem sa wylacznie wspolrzedne punktow ciala (liczby). Ta klasa nigdy nie
 * widzi pikseli i niczego nie zapisuje na dysku ani nie wysyla do sieci.
 * ====================================================================
 */
import { DEFAULT_ONE_EURO, OneEuroFilter, type OneEuroConfig } from '../pose/oneEuro';
import { assessSetup, DEFAULT_QUALITY, type QualityConfig, type SetupIssue } from '../pose/quality';
import { KEYPOINT_ORDER, type Keypoint, type KeypointName, type Landmarks } from '../pose/types';
import { computeMetrics, DEFAULT_METRIC, type MetricConfig, type PushupMetrics } from './metric';
import {
  createInitialState,
  DEFAULT_PUSHUP_CONFIG,
  step,
  type CounterEvent,
  type CounterState,
  type PushupConfig,
} from './stateMachine';

export interface DetectorConfig {
  pushup: PushupConfig;
  quality: QualityConfig;
  metric: MetricConfig;
  smoothing: OneEuroConfig;
}

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  pushup: DEFAULT_PUSHUP_CONFIG,
  quality: DEFAULT_QUALITY,
  metric: DEFAULT_METRIC,
  smoothing: DEFAULT_ONE_EURO,
};

export interface DetectionResult {
  state: CounterState;
  events: CounterEvent[];
  /** Metryki po wygladzeniu - przydatne do ekranu diagnostycznego. */
  metrics: PushupMetrics | null;
  issue: SetupIssue | null;
}

export class PushupDetector {
  private state: CounterState;
  private readonly config: DetectorConfig;
  private readonly filters = new Map<KeypointName, { x: OneEuroFilter; y: OneEuroFilter }>();

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = { ...DEFAULT_DETECTOR_CONFIG, ...config };
    this.state = createInitialState(this.config.pushup);
  }

  /**
   * Przetwarza jedna klatke.
   * @param landmarks punkty ciala, albo null gdy model nikogo nie znalazl
   * @param t         czas klatki w ms (monotoniczny)
   */
  process(landmarks: Landmarks | null, t: number): DetectionResult {
    if (landmarks === null) {
      const result = step(this.state, { t, metrics: null, issue: 'NO_POSE' }, this.config.pushup);
      this.state = result.state;
      return { state: result.state, events: result.events, metrics: null, issue: 'NO_POSE' };
    }

    const smoothed = this.smooth(landmarks, t);
    const issue = assessSetup(smoothed, this.config.quality);
    const metrics = issue === null ? computeMetrics(smoothed, this.config.metric) : null;

    const result = step(this.state, { t, metrics, issue }, this.config.pushup);
    this.state = result.state;

    return { state: result.state, events: result.events, metrics, issue };
  }

  getState(): CounterState {
    return this.state;
  }

  /** Czysci filtry i stan - uzywane przy starcie nowego treningu. */
  reset(): void {
    this.filters.clear();
    this.state = createInitialState(this.config.pushup);
  }

  private smooth(landmarks: Landmarks, t: number): Landmarks {
    const out = {} as Landmarks;

    for (const name of KEYPOINT_ORDER) {
      const kp = landmarks[name];
      let filter = this.filters.get(name);
      if (!filter) {
        filter = {
          x: new OneEuroFilter(this.config.smoothing),
          y: new OneEuroFilter(this.config.smoothing),
        };
        this.filters.set(name, filter);
      }

      // Punktow niepewnych nie wygladzamy - wpuscilyby smieci do filtra
      // i "ciagnelyby" wynik jeszcze dlugo po tym, jak detekcja wrocila.
      if (kp.score < this.config.metric.minScore) {
        out[name] = kp;
        continue;
      }

      const smoothedKp: Keypoint = {
        x: filter.x.filter(kp.x, t),
        y: filter.y.filter(kp.y, t),
        score: kp.score,
      };
      out[name] = smoothedKp;
    }

    return out;
  }
}
