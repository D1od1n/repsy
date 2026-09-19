/**
 * Testy algorytmu liczenia pompek.
 *
 * Kazdy przypadek wymieniony w specyfikacji ma tu swoj odpowiednik:
 * poprawna pompka, polpompka, bardzo szybka pompka, zatrzymanie w polowie,
 * powrot bez zejscia, przypadkowe ruchy i chwilowa utrata detekcji.
 *
 * Testy nie potrzebuja kamery ani telefonu - karmimy detektor syntetycznymi
 * sekwencjami punktow ciala i sprawdzamy, co naliczyl.
 */
import { PushupDetector } from './detector';
import { buildSequence, rep, standingLandmarks, type Segment, type SimOptions } from './synthetic';
import type { CounterEvent } from './stateMachine';

/** Bezruch na gorze, potrzebny zeby detektor skalibrowal pozycje wyjsciowa. */
const CALIBRATION: Segment = { kind: 'hold', durationMs: 1200 };

/** Glebokosc pelnego powtorzenia (prog domyslny to 0.55). */
const FULL = 0.65;
/** Glebokosc wyraznej polpompki. */
const HALF = 0.28;

function run(segments: readonly Segment[], sim: Partial<SimOptions> = {}) {
  const detector = new PushupDetector();
  const frames = buildSequence(segments, sim);
  const events: CounterEvent[] = [];

  for (const frame of frames) {
    events.push(...detector.process(frame.landmarks, frame.t).events);
  }

  return {
    reps: detector.getState().reps,
    state: detector.getState(),
    events,
    repEvents: events.filter((e) => e.type === 'REP'),
    shallowEvents: events.filter((e) => e.type === 'TOO_SHALLOW'),
  };
}

describe('kalibracja', () => {
  it('ustala pozycje gorna po krotkim bezruchu', () => {
    const { state, events } = run([CALIBRATION]);

    expect(events.some((e) => e.type === 'CALIBRATED')).toBe(true);
    expect(state.hTop).toBeCloseTo(1.2, 1);
    expect(state.phase).toBe('TOP');
  });

  it('nie liczy powtorzen, dopoki nie ma kalibracji', () => {
    // Od razu ruch, bez chwili bezruchu na gorze.
    const { reps } = run([rep(FULL, 1600), rep(FULL, 1600)]);
    expect(reps).toBe(0);
  });
});

describe('poprawne powtorzenia', () => {
  it('liczy pojedyncza pelna pompke', () => {
    const { reps } = run([CALIBRATION, rep(FULL, 1600)]);
    expect(reps).toBe(1);
  });

  it('liczy dokladnie 10 pompek z serii 10', () => {
    const segments: Segment[] = [CALIBRATION];
    for (let i = 0; i < 10; i += 1) segments.push(rep(FULL, 1600));

    const { reps, repEvents } = run(segments);
    expect(reps).toBe(10);
    expect(repEvents).toHaveLength(10);
  });

  it('liczy poprawnie mimo drgan punktow', () => {
    const segments: Segment[] = [CALIBRATION];
    for (let i = 0; i < 10; i += 1) segments.push(rep(FULL, 1600));

    const { reps } = run(segments, { noise: 0.005, seed: 42 });
    expect(reps).toBe(10);
  });

  it('zalicza pompke z przytrzymaniem na dole', () => {
    const { reps } = run([
      CALIBRATION,
      { kind: 'move', amplitude: FULL, downMs: 700, holdMs: 2000, upMs: 700 },
    ]);
    expect(reps).toBe(1);
  });
});

describe('powtorzenia odrzucane', () => {
  it('nie liczy polpompek i prosi o glebsze zejscie', () => {
    const segments: Segment[] = [CALIBRATION];
    for (let i = 0; i < 4; i += 1) segments.push(rep(HALF, 1600));

    const { reps, shallowEvents } = run(segments);
    expect(reps).toBe(0);
    expect(shallowEvents.length).toBeGreaterThan(0);
  });

  it('nie liczy bardzo szybkiego ruchu (ponizej progu czasu)', () => {
    const { reps } = run([CALIBRATION, rep(FULL, 400)]);
    expect(reps).toBe(0);
  });

  it('liczy szybka, ale realna pompke', () => {
    const { reps, repEvents } = run([CALIBRATION, rep(FULL, 800)]);
    expect(reps).toBe(1);
    expect(repEvents[0]).toMatchObject({ type: 'REP' });
  });

  it('nie liczy zatrzymania w polowie ruchu', () => {
    const { reps } = run([
      CALIBRATION,
      { kind: 'ramp', from: 0, to: 0.3, durationMs: 500 },
      { kind: 'hold', durationMs: 3000, depth: 0.3 },
      { kind: 'ramp', from: 0.3, to: 0, durationMs: 500 },
    ]);
    expect(reps).toBe(0);
  });

  it('nie liczy powrotu bez wystarczajacego zejscia', () => {
    const { reps, shallowEvents } = run([
      CALIBRATION,
      { kind: 'ramp', from: 0, to: 0.35, durationMs: 600 },
      { kind: 'ramp', from: 0.35, to: 0, durationMs: 600 },
    ]);
    expect(reps).toBe(0);
    expect(shallowEvents.length).toBeGreaterThan(0);
  });

  it('nie liczy przypadkowych drgan w bezruchu', () => {
    const { reps } = run([CALIBRATION, { kind: 'hold', durationMs: 8000 }], {
      noise: 0.005,
      seed: 7,
    });
    expect(reps).toBe(0);
  });

  it('nie liczy powtorzenia, gdy uzytkownik nie wrocil do gory', () => {
    const { reps } = run([
      CALIBRATION,
      { kind: 'ramp', from: 0, to: FULL, durationMs: 800 },
      { kind: 'hold', durationMs: 2000, depth: FULL },
      // Wraca tylko do polowy i tam zostaje.
      { kind: 'ramp', from: FULL, to: 0.3, durationMs: 600 },
      { kind: 'hold', durationMs: 1500, depth: 0.3 },
    ]);
    expect(reps).toBe(0);
  });
});

describe('utrata detekcji', () => {
  it('przetrwa krotkie mrugniecie detekcji w trakcie powtorzenia', () => {
    const { reps } = run([
      CALIBRATION,
      { kind: 'ramp', from: 0, to: FULL, durationMs: 800 },
      { kind: 'lost', durationMs: 200 },
      { kind: 'ramp', from: FULL, to: 0, durationMs: 800 },
    ]);
    expect(reps).toBe(1);
  });

  it('nie tworzy powtorzenia-widma po dluzszej utracie detekcji', () => {
    const { reps, events } = run([
      CALIBRATION,
      { kind: 'ramp', from: 0, to: FULL, durationMs: 800 },
      { kind: 'lost', durationMs: 900 },
      { kind: 'ramp', from: FULL, to: 0, durationMs: 800 },
    ]);
    expect(reps).toBe(0);
    expect(events.some((e) => e.type === 'LOST')).toBe(true);
  });

  it('wraca do liczenia po odzyskaniu detekcji', () => {
    const { reps } = run([
      CALIBRATION,
      { kind: 'lost', durationMs: 1000 },
      CALIBRATION,
      rep(FULL, 1600),
      rep(FULL, 1600),
    ]);
    expect(reps).toBe(2);
  });
});

describe('komunikat "Zejdz nizej"', () => {
  it('nie pojawia sie przy kazdej polpompce - ma odstep czasowy', () => {
    const segments: Segment[] = [CALIBRATION];
    for (let i = 0; i < 6; i += 1) segments.push(rep(HALF, 1200));

    const { shallowEvents } = run(segments);

    // 6 polpompek po 1.2 s to ok. 7 s, a odstep miedzy komunikatami to 4 s.
    expect(shallowEvents.length).toBeGreaterThanOrEqual(1);
    expect(shallowEvents.length).toBeLessThan(6);
  });
});

describe('ocena ustawienia', () => {
  it('nie liczy, gdy uzytkownik stoi zamiast byc w podporze', () => {
    const detector = new PushupDetector();
    const standing = standingLandmarks();

    let issue = null;
    for (let i = 0; i < 20; i += 1) {
      issue = detector.process(standing, i * 50).issue;
    }

    expect(issue).toBe('NOT_IN_POSITION');
    expect(detector.getState().reps).toBe(0);
  });

  it('zglasza brak sylwetki, gdy model nic nie zwrocil', () => {
    const detector = new PushupDetector();
    const result = detector.process(null, 0);
    expect(result.issue).toBe('NO_POSE');
  });
});

describe('reset detektora', () => {
  it('zeruje licznik i kalibracje', () => {
    const detector = new PushupDetector();
    for (const frame of buildSequence([CALIBRATION, rep(FULL, 1600)])) {
      detector.process(frame.landmarks, frame.t);
    }
    expect(detector.getState().reps).toBe(1);

    detector.reset();
    expect(detector.getState().reps).toBe(0);
    expect(detector.getState().hTop).toBeNull();
  });
});
