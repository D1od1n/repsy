/**
 * Metryka glebokosci pompki dla kamery ustawionej PRZED uzytkownikiem.
 *
 * Dlaczego nie kat lokcia jako sygnal glowny?
 * Przy ujeciu z przodu rece sa skierowane w strone kamery, wiec kat lokcia jest
 * mocno skrocony perspektywicznie - te same 90 stopni w rzeczywistosci daja na
 * obrazie bardzo rozne wartosci zaleznie od ustawienia telefonu i rozstawu rak.
 * Sam kat lokcia bylby wiec zawodny.
 *
 * Sygnal glowny: pionowy dystans barkow nad dlonmi, podzielony przez szerokosc
 * barkow.
 *
 *     h = (y_nadgarstkow - y_barkow) / szerokosc_barkow
 *
 * Dlonie leza na podlodze i sa nieruchome, wiec caly ruch pompki widac jako
 * zmiane h: na gorze barki sa wysoko nad dlonmi (h duze), na dole schodza do
 * ich poziomu (h male).
 *
 * Dzielenie przez szerokosc barkow jest tu kluczowe - dzieki niemu metryka nie
 * zalezy od tego, jak daleko stoi telefon ani jakiej postury jest uzytkownik.
 */
import { angleDegrees, distance, midpoint } from '../pose/geometry';
import type { Landmarks } from '../pose/types';

export interface PushupMetrics {
  /** Znormalizowana wysokosc barkow nad dlonmi. Duze = gora, male = dol. */
  h: number;
  /** Szerokosc barkow - nasza miarka skali. */
  shoulderWidth: number;
  /** Sredni kat lokcia w stopniach, albo null gdy lokcie sa niepewne. */
  elbowAngle: number | null;
}

export interface MetricConfig {
  minScore: number;
}

export const DEFAULT_METRIC: MetricConfig = { minScore: 0.3 };

/**
 * Liczy metryki z jednej klatki. Zwraca `null`, gdy brakuje punktow potrzebnych
 * do wiarygodnego pomiaru - taka klatka jest po prostu pomijana.
 */
export function computeMetrics(
  landmarks: Landmarks,
  config: MetricConfig = DEFAULT_METRIC,
): PushupMetrics | null {
  const { minScore } = config;
  const ls = landmarks.leftShoulder;
  const rs = landmarks.rightShoulder;

  if (ls.score < minScore || rs.score < minScore) return null;

  const shoulderWidth = distance(ls, rs);
  if (shoulderWidth <= 0) return null;

  const wrists = [landmarks.leftWrist, landmarks.rightWrist].filter(
    (w) => w.score >= minScore,
  );
  if (wrists.length === 0) return null;

  const midShoulder = midpoint(ls, rs);
  const midWrist =
    wrists.length === 2 ? midpoint(wrists[0]!, wrists[1]!) : wrists[0]!;

  const h = (midWrist.y - midShoulder.y) / shoulderWidth;

  return { h, shoulderWidth, elbowAngle: computeElbowAngle(landmarks, minScore) };
}

/**
 * Sredni kat lokcia z tych rak, ktore sa wystarczajaco pewne.
 * Sluzy wylacznie jako sygnal POTWIERDZAJACY dolna pozycje - nigdy jako jedyny
 * warunek zaliczenia powtorzenia.
 */
function computeElbowAngle(landmarks: Landmarks, minScore: number): number | null {
  const sides = [
    [landmarks.leftShoulder, landmarks.leftElbow, landmarks.leftWrist],
    [landmarks.rightShoulder, landmarks.rightElbow, landmarks.rightWrist],
  ] as const;

  const angles: number[] = [];
  for (const [shoulder, elbow, wrist] of sides) {
    if (
      shoulder.score >= minScore &&
      elbow.score >= minScore &&
      wrist.score >= minScore
    ) {
      angles.push(angleDegrees(shoulder, elbow, wrist));
    }
  }

  if (angles.length === 0) return null;
  return angles.reduce((sum, a) => sum + a, 0) / angles.length;
}
