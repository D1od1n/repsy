import { computeStreak, type DayOutcome } from './streak';
import { addDays } from '../date/localDate';

const TODAY = '2026-09-19';

/** Buduje ciag dni wstecz od `TODAY` na podstawie wzorca: 1 = cel osiagniety. */
function days(pattern: readonly number[], endingOn: string = TODAY): DayOutcome[] {
  return pattern.map((value, index) => ({
    date: addDays(endingOn, index - (pattern.length - 1)),
    achieved: value === 1,
  }));
}

describe('streak biezacy', () => {
  it('liczy dni z rzedu zakonczone dzisiaj', () => {
    const result = computeStreak(days([1, 1, 1, 1, 1]), TODAY);
    expect(result.current).toBe(5);
  });

  it('nie zeruje sie, gdy dzisiejszy cel nie jest jeszcze zrobiony', () => {
    // Ostatnie 4 dni zrobione, dzis jeszcze nie - dzien wciaz trwa.
    const result = computeStreak(days([1, 1, 1, 1, 0]), TODAY);
    expect(result.current).toBe(4);
  });

  it('zeruje sie, gdy wczoraj cel nie zostal osiagniety', () => {
    const result = computeStreak(days([1, 1, 1, 0, 0]), TODAY);
    expect(result.current).toBe(0);
  });

  it('przerwa w srodku nie laczy dwoch serii', () => {
    const result = computeStreak(days([1, 1, 0, 1, 1]), TODAY);
    expect(result.current).toBe(2);
  });

  it('brak danych daje zero', () => {
    expect(computeStreak([], TODAY).current).toBe(0);
  });
});

describe('najdluzszy streak', () => {
  it('znajduje najdluzsza serie w historii, nie tylko biezaca', () => {
    const result = computeStreak(days([1, 1, 1, 1, 0, 1, 1]), TODAY);
    expect(result.current).toBe(2);
    expect(result.longest).toBe(4);
  });

  it('gdy biezaca jest najdluzsza, zwraca ja', () => {
    const result = computeStreak(days([0, 1, 1, 1, 1]), TODAY);
    expect(result.current).toBe(4);
    expect(result.longest).toBe(4);
  });
});

describe('liczba wykonanych dni', () => {
  it('sumuje wszystkie dni z osiagnietym celem', () => {
    const result = computeStreak(days([1, 0, 1, 1, 0, 1]), TODAY);
    expect(result.completedDays).toBe(4);
  });
});

describe('kamienie milowe', () => {
  it('wskazuje najblizszy kamien milowy i dystans do niego', () => {
    const result = computeStreak(days([1, 1, 1, 1, 1]), TODAY);
    expect(result.current).toBe(5);
    expect(result.nextMilestone).toBe(7);
    expect(result.daysToMilestone).toBe(2);
  });

  it('po osiagnieciu kamienia milowego pokazuje kolejny', () => {
    const pattern = new Array(7).fill(1);
    const result = computeStreak(days(pattern), TODAY);
    expect(result.current).toBe(7);
    expect(result.nextMilestone).toBe(14);
  });

  it('dla bardzo dlugich serii odmierza kolejne tysiace', () => {
    const pattern = new Array(1200).fill(1);
    const result = computeStreak(days(pattern), TODAY);
    expect(result.current).toBe(1200);
    expect(result.nextMilestone).toBe(2000);
  });
});
