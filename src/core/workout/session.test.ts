import {
  createSession,
  finishSession,
  registerRep,
  tick,
  type SessionState,
} from './session';

const START = 1_000_000;

/** Wykonuje serie powtorzen co `intervalMs`, zaczynajac od `from`. */
function doReps(state: SessionState, count: number, from: number, intervalMs = 2000) {
  let current = state;
  let t = from;
  for (let i = 0; i < count; i += 1) {
    current = registerRep(current, t).state;
    t += intervalMs;
  }
  return { state: current, t };
}

describe('liczenie powtorzen', () => {
  it('sumuje powtorzenia', () => {
    const { state } = doReps(createSession(START), 5, START);
    expect(state.totalReps).toBe(5);
    expect(state.currentSetReps).toBe(5);
  });

  it('pierwsze powtorzenie otwiera serie', () => {
    const { state } = doReps(createSession(START), 1, START);
    expect(state.currentSetStartedAt).toBe(START);
    expect(state.sets).toHaveLength(0);
  });
});

describe('automatyczne wykrywanie serii', () => {
  it('przerwa dluzsza niz prog zamyka serie', () => {
    const first = doReps(createSession(START), 20, START);

    // Przerwa 15 s - dluzsza niz prog 12 s.
    const { state, events } = tick(first.state, first.t + 15_000);

    expect(state.sets).toHaveLength(1);
    expect(state.sets[0]?.reps).toBe(20);
    expect(state.currentSetReps).toBe(0);
    expect(events[0]?.type).toBe('SET_COMPLETED');
  });

  it('krotka przerwa NIE zamyka serii', () => {
    const first = doReps(createSession(START), 10, START);

    const { state, events } = tick(first.state, first.t + 5_000);

    expect(state.sets).toHaveLength(0);
    expect(state.currentSetReps).toBe(10);
    expect(events).toHaveLength(0);
  });

  it('trzy serie po przerwach maja poprawne liczby', () => {
    let session = createSession(START);
    let t = START;

    const first = doReps(session, 20, t);
    session = first.state;
    t = first.t + 20_000;

    const second = doReps(session, 15, t);
    session = second.state;
    t = second.t + 20_000;

    const third = doReps(session, 25, t);
    session = third.state;

    const { workout } = finishSession(session, third.t, '2026-09-19');

    expect(workout?.totalReps).toBe(60);
    expect(workout?.sets.map((s) => s.reps)).toEqual([20, 15, 25]);
    expect(workout?.sets.map((s) => s.index)).toEqual([1, 2, 3]);
  });

  it('powtarzajace sie tiki nie tworza pustych serii', () => {
    const first = doReps(createSession(START), 5, START);

    let state = tick(first.state, first.t + 20_000).state;
    state = tick(state, first.t + 40_000).state;
    state = tick(state, first.t + 60_000).state;

    expect(state.sets).toHaveLength(1);
  });

  it('tik na pustej sesji nic nie robi', () => {
    const { state, events } = tick(createSession(START), START + 60_000);
    expect(state.sets).toHaveLength(0);
    expect(events).toHaveLength(0);
  });
});

describe('zakonczenie treningu', () => {
  it('reczne zakonczenie zamyka otwarta serie', () => {
    const { state, t } = doReps(createSession(START), 12, START);

    const { workout } = finishSession(state, t, '2026-09-19');

    expect(workout?.sets).toHaveLength(1);
    expect(workout?.sets[0]?.reps).toBe(12);
    expect(workout?.totalReps).toBe(12);
  });

  it('liczy czas trwania treningu w sekundach', () => {
    const { state } = doReps(createSession(START), 3, START);

    const { workout } = finishSession(state, START + 125_000, '2026-09-19');

    expect(workout?.durationS).toBe(125);
  });

  it('trening bez powtorzen nie jest zapisywany', () => {
    const { workout } = finishSession(createSession(START), START + 30_000, '2026-09-19');
    expect(workout).toBeNull();
  });

  it('zapisany trening ma zrodlo "camera" i lokalna date', () => {
    const { state, t } = doReps(createSession(START), 4, START);
    const { workout } = finishSession(state, t, '2026-09-19');

    expect(workout?.source).toBe('camera');
    expect(workout?.localDate).toBe('2026-09-19');
    expect(workout?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('nie gubi powtorzen wykonanych po przerwie', () => {
    const first = doReps(createSession(START), 10, START);
    // Dluga przerwa, a potem jeszcze kilka powtorzen.
    const second = doReps(first.state, 5, first.t + 30_000);

    const { workout } = finishSession(second.state, second.t, '2026-09-19');

    expect(workout?.totalReps).toBe(15);
    expect(workout?.sets.map((s) => s.reps)).toEqual([10, 5]);
  });
});
