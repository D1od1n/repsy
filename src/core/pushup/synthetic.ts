/**
 * Generator syntetycznych sekwencji punktow ciala.
 *
 * Pozwala przetestowac algorytm liczenia pompek bez kamery i bez telefonu:
 * budujemy ruch o zadanej glebokosci, tempie, szumie i zanikach detekcji,
 * a potem sprawdzamy, ile powtorzen naliczyl detektor.
 *
 * Model ruchu odpowiada ujeciu Z PRZODU: dlonie leza nieruchomo na podlodze,
 * a barki poruszaja sie w pionie. Lokcie rozchodza sie na boki tym mocniej,
 * im glebiej schodzi uzytkownik - dzieki temu kat lokcia zmienia sie
 * realistycznie (ok. 165 stopni na gorze, ok. 60 stopni na dole).
 */
import type { Keypoint, KeypointName, Landmarks } from '../pose/types';

export interface SimOptions {
  /** Wartosc h w gornej pozycji. */
  hTop: number;
  /** Szerokosc barkow w znormalizowanych jednostkach - nasza miarka skali. */
  shoulderWidth: number;
  /** Pionowe polozenie dloni (podloga). */
  wristY: number;
  /** Klatek na sekunde. */
  fps: number;
  /** Amplituda szumu dodawanego do kazdego punktu. */
  noise: number;
  /** Ziarno generatora pseudolosowego - testy maja byc powtarzalne. */
  seed: number;
  /** Pewnosc detekcji przypisywana widocznym punktom. */
  score: number;
}

export const DEFAULT_SIM: SimOptions = {
  hTop: 1.2,
  shoulderWidth: 0.25,
  wristY: 0.85,
  fps: 20,
  noise: 0,
  seed: 1,
  score: 0.9,
};

export type Segment =
  /** Bezruch w gornej pozycji (albo na zadanej wysokosci). */
  | { kind: 'hold'; durationMs: number; depth?: number }
  /** Ruch: zejscie, przytrzymanie na dole, powrot. */
  | { kind: 'move'; amplitude: number; downMs: number; holdMs: number; upMs: number }
  /** Plynne przejscie miedzy dwiema glebokosciami - pozwala zlozyc ruch z kawalkow. */
  | { kind: 'ramp'; from: number; to: number; durationMs: number }
  /** Calkowita utrata detekcji. */
  | { kind: 'lost'; durationMs: number };

export interface SimFrame {
  t: number;
  landmarks: Landmarks | null;
}

/** Pelne powtorzenie o zadanej glebokosci i czasie trwania. */
export function rep(amplitude: number, durationMs: number): Segment {
  return { kind: 'move', amplitude, downMs: durationMs / 2, holdMs: 0, upMs: durationMs / 2 };
}

/** Deterministyczny generator pseudolosowy (mulberry32). */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wygladzone przejscie 0 -> 1 (polowa cosinusa), bez skokow predkosci. */
function ease(u: number): number {
  const clamped = Math.min(1, Math.max(0, u));
  return (1 - Math.cos(Math.PI * clamped)) / 2;
}

/**
 * Zamienia liste segmentow na klatki z punktami ciala.
 * `null` w polu landmarks oznacza klatke, na ktorej model nikogo nie wykryl.
 */
export function buildSequence(
  segments: readonly Segment[],
  options: Partial<SimOptions> = {},
): SimFrame[] {
  const opts: SimOptions = { ...DEFAULT_SIM, ...options };
  const random = makeRandom(opts.seed);
  const dt = 1000 / opts.fps;

  const frames: SimFrame[] = [];
  let t = 0;

  for (const segment of segments) {
    if (segment.kind === 'lost') {
      for (let elapsed = 0; elapsed < segment.durationMs; elapsed += dt) {
        frames.push({ t, landmarks: null });
        t += dt;
      }
      continue;
    }

    if (segment.kind === 'hold') {
      const depth = segment.depth ?? 0;
      for (let elapsed = 0; elapsed < segment.durationMs; elapsed += dt) {
        frames.push({ t, landmarks: landmarksAtDepth(depth, opts, random) });
        t += dt;
      }
      continue;
    }

    if (segment.kind === 'ramp') {
      const { from, to, durationMs } = segment;
      for (let elapsed = 0; elapsed < durationMs; elapsed += dt) {
        const depth = from + (to - from) * ease(elapsed / durationMs);
        frames.push({ t, landmarks: landmarksAtDepth(depth, opts, random) });
        t += dt;
      }
      continue;
    }

    const { amplitude, downMs, holdMs, upMs } = segment;

    for (let elapsed = 0; elapsed < downMs; elapsed += dt) {
      frames.push({ t, landmarks: landmarksAtDepth(amplitude * ease(elapsed / downMs), opts, random) });
      t += dt;
    }
    for (let elapsed = 0; elapsed < holdMs; elapsed += dt) {
      frames.push({ t, landmarks: landmarksAtDepth(amplitude, opts, random) });
      t += dt;
    }
    for (let elapsed = 0; elapsed < upMs; elapsed += dt) {
      frames.push({
        t,
        landmarks: landmarksAtDepth(amplitude * (1 - ease(elapsed / upMs)), opts, random),
      });
      t += dt;
    }
  }

  return frames;
}

/**
 * Buduje komplet 17 punktow dla zadanej glebokosci zejscia.
 * @param depth o ile spadlo h wzgledem pozycji gornej
 */
export function landmarksAtDepth(
  depth: number,
  options: Partial<SimOptions> = {},
  random: () => number = () => 0.5,
): Landmarks {
  const opts: SimOptions = { ...DEFAULT_SIM, ...options };
  const { shoulderWidth: sw, wristY, score } = opts;

  const h = opts.hTop - depth;
  const shoulderY = wristY - h * sw;

  // Im glebiej, tym bardziej lokcie rozchodza sie na boki.
  const elbowFlare = 0.02 + 0.12 * Math.min(1, Math.max(0, depth / 0.65));

  const jitter = (): number => (opts.noise === 0 ? 0 : (random() - 0.5) * 2 * opts.noise);
  const kp = (x: number, y: number, s: number = score): Keypoint => ({
    x: x + jitter(),
    y: y + jitter(),
    score: s,
  });

  const cx = 0.5;
  const shoulderDx = sw / 2;
  const wristDx = 0.18;

  const leftShoulderX = cx - shoulderDx;
  const rightShoulderX = cx + shoulderDx;
  const leftWristX = cx - wristDx;
  const rightWristX = cx + wristDx;

  const elbowY = (shoulderY + wristY) / 2;

  const points: Record<KeypointName, Keypoint> = {
    nose: kp(cx, shoulderY - 0.08, 0.7),
    leftEye: kp(cx - 0.03, shoulderY - 0.1, 0.6),
    rightEye: kp(cx + 0.03, shoulderY - 0.1, 0.6),
    leftEar: kp(cx - 0.06, shoulderY - 0.09, 0.5),
    rightEar: kp(cx + 0.06, shoulderY - 0.09, 0.5),
    leftShoulder: kp(leftShoulderX, shoulderY),
    rightShoulder: kp(rightShoulderX, shoulderY),
    leftElbow: kp((leftShoulderX + leftWristX) / 2 - elbowFlare, elbowY),
    rightElbow: kp((rightShoulderX + rightWristX) / 2 + elbowFlare, elbowY),
    leftWrist: kp(leftWristX, wristY),
    rightWrist: kp(rightWristX, wristY),
    // W ujeciu z przodu biodra sa mocno skrocone perspektywicznie i leza
    // niewiele nizej niz barki.
    leftHip: kp(cx - 0.09, shoulderY + 0.05, 0.6),
    rightHip: kp(cx + 0.09, shoulderY + 0.05, 0.6),
    // Nogi sa zwykle zaslonienie przez tulow - model zwraca niska pewnosc.
    leftKnee: kp(cx - 0.07, shoulderY + 0.1, 0.15),
    rightKnee: kp(cx + 0.07, shoulderY + 0.1, 0.15),
    leftAnkle: kp(cx - 0.06, shoulderY + 0.14, 0.1),
    rightAnkle: kp(cx + 0.06, shoulderY + 0.14, 0.1),
  };

  return points;
}

/** Punkty osoby stojacej przed telefonem - do testu wykrywania zlej pozycji. */
export function standingLandmarks(options: Partial<SimOptions> = {}): Landmarks {
  const opts: SimOptions = { ...DEFAULT_SIM, ...options };
  const base = landmarksAtDepth(0, opts);

  // Na stojaco biodra sa daleko ponizej barkow (a nie tuz pod nimi).
  return {
    ...base,
    leftHip: { ...base.leftHip, y: base.leftShoulder.y + opts.shoulderWidth * 2.2 },
    rightHip: { ...base.rightHip, y: base.rightShoulder.y + opts.shoulderWidth * 2.2 },
  };
}
