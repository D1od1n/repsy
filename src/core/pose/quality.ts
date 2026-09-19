/**
 * Ocena, czy uzytkownik jest dobrze ustawiony wzgledem telefonu.
 *
 * Telefon stoi PRZED uzytkownikiem (nie z boku), zwykle na podlodze. Zanim
 * zaczniemy liczyc powtorzenia, musimy miec pewnosc, ze widzimy to, co trzeba -
 * inaczej licznik bedzie zmyslal.
 */
import { distance, midpoint } from './geometry';
import type { Landmarks } from './types';

export type SetupIssue =
  | 'NO_POSE'         // nie widac nikogo
  | 'LOW_CONFIDENCE'  // widac cos, ale kluczowe punkty sa niepewne
  | 'TOO_FAR'         // uzytkownik za daleko / za maly w kadrze
  | 'TOO_CLOSE'       // uzytkownik za blisko, nie miesci sie w kadrze
  | 'OUT_OF_FRAME'    // czesc ciala poza kadrem
  | 'NOT_IN_POSITION'; // widac osobe, ale nie jest w podporze (np. stoi)

export interface QualityConfig {
  /** Minimalna pewnosc punktu, zeby uznac go za wiarygodny. */
  minScore: number;
  /** Szerokosc barkow ponizej tej wartosci = uzytkownik za daleko. */
  minShoulderWidth: number;
  /** Szerokosc barkow powyzej tej wartosci = uzytkownik za blisko. */
  maxShoulderWidth: number;
  /** Margines przy krawedzi kadru, w ktorym punkt uznajemy za "uciety". */
  frameMargin: number;
  /** Maksymalny stosunek |biodra-barki| / szerokosc barkow dla pozycji podporu. */
  maxHipShoulderRatio: number;
  /** Zapasowy prog na h, gdy bioder nie widac (stojaca sylwetka ma duze h). */
  maxStandingH: number;
}

export const DEFAULT_QUALITY: QualityConfig = {
  minScore: 0.3,
  minShoulderWidth: 0.08,
  maxShoulderWidth: 0.75,
  frameMargin: 0.02,
  maxHipShoulderRatio: 1.6,
  maxStandingH: 2.2,
};

/**
 * Zwraca `null`, gdy ustawienie jest poprawne, albo kod problemu do pokazania
 * uzytkownikowi. Kolejnosc sprawdzen jest celowa: od najbardziej podstawowego
 * (czy w ogole kogos widac) do najbardziej szczegolowego.
 */
export function assessSetup(
  landmarks: Landmarks,
  config: QualityConfig = DEFAULT_QUALITY,
): SetupIssue | null {
  const { minScore } = config;
  const ls = landmarks.leftShoulder;
  const rs = landmarks.rightShoulder;
  const lw = landmarks.leftWrist;
  const rw = landmarks.rightWrist;

  // Bez obu barkow nie policzymy ani skali, ani glebokosci.
  if (ls.score < minScore || rs.score < minScore) {
    const anyVisible = Object.values(landmarks).some((kp) => kp.score >= minScore);
    return anyVisible ? 'LOW_CONFIDENCE' : 'NO_POSE';
  }

  // Potrzebny co najmniej jeden nadgarstek - to nasz punkt odniesienia (podloga).
  if (lw.score < minScore && rw.score < minScore) return 'LOW_CONFIDENCE';

  // Szerokosc barkow pelni role miarki: mowi, jak daleko jest uzytkownik.
  const shoulderWidth = distance(ls, rs);
  if (shoulderWidth < config.minShoulderWidth) return 'TOO_FAR';
  if (shoulderWidth > config.maxShoulderWidth) return 'TOO_CLOSE';

  // Kluczowe punkty musza miescic sie w kadrze z niewielkim zapasem.
  const m = config.frameMargin;
  const required = [ls, rs, lw.score >= minScore ? lw : rw];
  for (const kp of required) {
    if (kp.y < m || kp.y > 1 - m) return 'OUT_OF_FRAME';
  }

  // Czy uzytkownik jest w podporze, a nie np. stoi przed telefonem?
  const midShoulder = midpoint(ls, rs);
  const lh = landmarks.leftHip;
  const rh = landmarks.rightHip;
  const hipsVisible = lh.score >= minScore && rh.score >= minScore;

  if (hipsVisible) {
    // W podporze biodra sa w obrazie mniej wiecej na wysokosci barkow
    // (perspektywa je skraca). Na stojaco sa wyraznie nizej.
    const midHip = midpoint(lh, rh);
    const ratio = Math.abs(midHip.y - midShoulder.y) / shoulderWidth;
    if (ratio > config.maxHipShoulderRatio) return 'NOT_IN_POSITION';
  } else {
    // Bez bioder korzystamy z odleglosci barki-dlonie: na stojaco jest duza.
    const wrists = [lw, rw].filter((w) => w.score >= minScore);
    const midWrist =
      wrists.length === 2 ? midpoint(wrists[0]!, wrists[1]!) : wrists[0]!;
    const h = (midWrist.y - midShoulder.y) / shoulderWidth;
    if (h > config.maxStandingH) return 'NOT_IN_POSITION';
  }

  return null;
}
