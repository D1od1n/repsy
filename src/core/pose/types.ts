/**
 * Typy dla danych z modelu pose estimation.
 *
 * ============================ PRYWATNOSC ============================
 * Ten modul operuje WYLACZNIE na wspolrzednych punktow ciala (liczby).
 * Nigdy nie dostaje ani nie przechowuje pikseli, klatek czy obrazow.
 * Klatka kamery zyje tylko wewnatrz workletu i jest natychmiast zwalniana.
 * ====================================================================
 */

/** Kolejnosc punktow na wyjsciu MoveNet (standard COCO, 17 punktow). */
export const KEYPOINT_ORDER = [
  'nose',
  'leftEye',
  'rightEye',
  'leftEar',
  'rightEar',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
] as const;

export type KeypointName = (typeof KEYPOINT_ORDER)[number];

export interface Keypoint {
  /** Poziomo, w jednostkach "wysokosci kadru" (skorygowane o proporcje obrazu). */
  x: number;
  /** Pionowo, 0 = gora kadru, 1 = dol kadru. */
  y: number;
  /** Pewnosc detekcji 0..1. */
  score: number;
}

/** Wszystkie 17 punktow pod czytelnymi nazwami. */
export type Landmarks = Record<KeypointName, Keypoint>;

/**
 * Zamienia surowe wyjscie modelu na nazwane punkty i koryguje proporcje obrazu.
 *
 * Model dostaje kwadrat 192x192, wiec klatka 4:3 czy 16:9 jest do niego rozciagana.
 * Gdybysmy liczyli odleglosci na rozciagnietych wspolrzednych, odleglosc w poziomie
 * i w pionie mialyby inna skale, a caly algorytm opiera sie na ich stosunku.
 * Dlatego mnozymy X przez proporcje kadru - po tej korekcie 1 jednostka w poziomie
 * znaczy tyle samo co 1 jednostka w pionie.
 *
 * @param output  Float32Array/number[] o dlugosci 51: [y, x, score] x 17
 * @param frameWidth  szerokosc klatki w pikselach
 * @param frameHeight wysokosc klatki w pikselach
 */
export function parseLandmarks(
  output: ArrayLike<number>,
  frameWidth: number,
  frameHeight: number,
): Landmarks {
  if (output.length < KEYPOINT_ORDER.length * 3) {
    throw new Error(
      `Model zwrocil ${output.length} liczb, oczekiwano ${KEYPOINT_ORDER.length * 3}.`,
    );
  }
  const aspect = frameHeight > 0 ? frameWidth / frameHeight : 1;

  const result = {} as Landmarks;
  for (let i = 0; i < KEYPOINT_ORDER.length; i += 1) {
    const name = KEYPOINT_ORDER[i]!;
    const base = i * 3;
    result[name] = {
      y: output[base]!,
      x: output[base + 1]! * aspect,
      score: output[base + 2]!,
    };
  }
  return result;
}
