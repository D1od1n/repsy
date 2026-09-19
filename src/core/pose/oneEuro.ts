/**
 * Filtr One Euro - wygladzanie sygnalu z pose estimation.
 *
 * Dlaczego nie zwykla srednia wykladnicza (EMA)?
 * EMA wymusza kompromis: mocne wygladzanie = duze opoznienie. Przy liczeniu pompek
 * opoznienie jest grozne, bo przy szybkim tempie "scina" szczyty ruchu i powtorzenia
 * przestaja byc wykrywane.
 *
 * One Euro dobiera sile wygladzania do predkosci sygnalu:
 *  - gdy uzytkownik stoi w miejscu  -> mocne wygladzanie, znikaja drgania punktow
 *  - gdy schodzi szybko w dol       -> slabe wygladzanie, prawie zero opoznienia
 *
 * Zrodlo: Casiez, Roussel, Vogel (CHI 2012), "1e Filter".
 */

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

class LowPass {
  private value: number | null = null;

  filter(x: number, a: number): number {
    this.value = this.value === null ? x : a * x + (1 - a) * this.value;
    return this.value;
  }

  get last(): number | null {
    return this.value;
  }

  reset(): void {
    this.value = null;
  }
}

export interface OneEuroConfig {
  /** Czestotliwosc odciecia przy zerowej predkosci - im mniej, tym gladziej. */
  minCutoff: number;
  /** Jak mocno predkosc podbija czestotliwosc odciecia. */
  beta: number;
  /** Odciecie dla estymaty predkosci. */
  dCutoff: number;
}

/**
 * Wartosci dobrane pomiarowo, a nie "na oko".
 *
 * Klasyczne minCutoff=1.0 / beta=0.007 (z publikacji) obcinalo szczyt szybkiej
 * pompki az o 23.8%, przez co pelne powtorzenie nie bylo zaliczane. Ponizsze
 * ustawienia zbijaja te strate do ~2%, zachowujac wygladzanie w bezruchu.
 * Sygnal jest tu znormalizowany (0..1), wiec predkosci sa male liczbowo -
 * stad duza wartosc beta.
 */
export const DEFAULT_ONE_EURO: OneEuroConfig = {
  minCutoff: 2.5,
  beta: 15,
  dCutoff: 1.0,
};

export class OneEuroFilter {
  private readonly xFilter = new LowPass();
  private readonly dxFilter = new LowPass();
  private lastTime: number | null = null;

  constructor(private readonly config: OneEuroConfig = DEFAULT_ONE_EURO) {}

  /**
   * @param x         nowa probka
   * @param timeMs    znacznik czasu w milisekundach
   */
  filter(x: number, timeMs: number): number {
    if (!Number.isFinite(x)) return x;

    if (this.lastTime === null) {
      this.lastTime = timeMs;
      this.xFilter.filter(x, 1);
      return x;
    }

    const dt = (timeMs - this.lastTime) / 1000;
    this.lastTime = timeMs;

    // Zabezpieczenie: dwie klatki z tym samym (lub cofnietym) czasem.
    if (dt <= 0) return this.xFilter.last ?? x;

    const prev = this.xFilter.last ?? x;
    const dx = (x - prev) / dt;
    const edx = this.dxFilter.filter(dx, alpha(this.config.dCutoff, dt));

    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(edx);
    return this.xFilter.filter(x, alpha(cutoff, dt));
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}
