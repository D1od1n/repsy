/**
 * Polaczenie kamery z modelem pose estimation.
 *
 * =========================== PRYWATNOSC (WAZNE) ===========================
 * Klatka z kamery istnieje WYLACZNIE wewnatrz funkcji onFrame, na osobnym
 * watku, i jest zwalniana (dispose) natychmiast po uzyciu. Przez granice do
 * JavaScriptu przechodzi tylko 51 liczb - wspolrzedne 17 punktow ciala.
 *
 * Nie ma tu zapisu do pliku, nie ma zadnego wywolania sieciowego, nie ma
 * bufora klatek. Kamera jest skonfigurowana bez wyjscia foto i wideo, wiec
 * aplikacja technicznie nie jest w stanie nic nagrac.
 * ==========================================================================
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  type CameraFrameOutput,
} from 'react-native-vision-camera';
import { useResizer } from 'react-native-vision-camera-resizer';
import { useTensorflowModel, type TensorflowModelDelegate } from 'react-native-fast-tflite';

import { PushupDetector, type DetectionResult } from '../../core/pushup/detector';
import { parseLandmarks } from '../../core/pose/types';

/**
 * Model MoveNet SinglePose Lightning.
 * Wejscie: [1, 192, 192, 3] UINT8. Wyjscie: [1, 1, 17, 3] FLOAT32 (y, x, score).
 * Plik pobiera skrypt `npm run fetch-model` (uruchamiany tez po npm install).
 */
const MODEL = require('../../../assets/models/movenet_lightning_f16.tflite');

const MODEL_SIZE = 192;

/**
 * Przetwarzamy co druga klatke (~15 analiz na sekunde przy kamerze 30 fps).
 * Pompka trwa okolo sekundy, wiec to wciaz kilkanascie probek na powtorzenie -
 * w zupelnosci wystarczy, a zuzycie procesora i baterii spada o polowe.
 */
const PROCESS_EVERY_NTH_FRAME = 2;

/** Niska rozdzielczosc wystarcza modelowi 192x192, a mocno odciaza pipeline. */
const TARGET_RESOLUTION = { width: 640, height: 480 };

export type PoseStatus = 'loading' | 'ready' | 'no-permission' | 'no-camera' | 'error';

export interface PoseDetectionApi {
  status: PoseStatus;
  errorKey: string | null;
  frameOutput: CameraFrameOutput | undefined;
  device: ReturnType<typeof useCameraDevice>;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  /** Czyscic stan detektora przed nowym treningiem. */
  reset: () => void;
}

interface Options {
  /** Gdy false, klatki sa natychmiast odrzucane (np. gdy ekran jest w tle). */
  enabled: boolean;
  /** Wywolywane dla kazdej przeanalizowanej klatki, juz na watku JS. */
  onResult: (result: DetectionResult) => void;
}

function delegatesForPlatform(): TensorflowModelDelegate[] {
  // Akceleracja sprzetowa: CoreML na iOS, GPU na Androidzie.
  return Platform.OS === 'ios' ? ['core-ml'] : ['android-gpu'];
}

export function usePoseDetection({ enabled, onResult }: Options): PoseDetectionApi {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  const delegates = useMemo(() => delegatesForPlatform(), []);
  const model = useTensorflowModel(MODEL, delegates);
  const resizerState = useResizer({
    width: MODEL_SIZE,
    height: MODEL_SIZE,
    channelOrder: 'rgb',
    dataType: 'uint8',
    // 'stretch' mapuje caly kadr na kwadrat modelu w sposob liniowy.
    // Powstale zniekształcenie proporcji odwracamy potem w parseLandmarks.
    scaleMode: 'stretch',
    pixelLayout: 'interleaved',
  });

  const detectorRef = useRef<PushupDetector | null>(null);
  if (detectorRef.current === null) detectorRef.current = new PushupDetector();

  // Blad wyliczamy wprost podczas renderowania. Trzymanie go w stanie i
  // ustawianie w efekcie powodowaloby zbedna, kaskadowa runde renderowania.
  const loadFailed = model.state === 'error' || resizerState.state === 'error';
  const errorKey = loadFailed ? 'workout.error.modelFailed' : null;

  // Wartosci wspoldzielone z watkiem kamery.
  const frameCounter = useSharedValue(0);
  const isEnabled = useSharedValue(enabled);

  useEffect(() => {
    isEnabled.value = enabled;
  }, [enabled, isEnabled]);

  /**
   * Odbior wyniku na watku JS.
   *
   * Swiadoma decyzja architektoniczna: kosztowna inferencja dzieje sie na
   * watku kamery, ale maszyna stanow liczaca pompki dziala tutaj, w zwyklym
   * JavaScripcie. Dzieki temu w aplikacji wykonuje sie DOKLADNIE ten sam kod,
   * ktory pokrywaja testy jednostkowe - a przesylanie 51 liczb kilkanascie
   * razy na sekunde jest pomijalnie tanie.
   */
  const handleKeypoints = useCallback(
    (output: number[], frameWidth: number, frameHeight: number) => {
      const detector = detectorRef.current;
      if (detector === null) return;

      const landmarks = parseLandmarks(output, frameWidth, frameHeight);
      onResult(detector.process(landmarks, Date.now()));
    },
    [onResult],
  );

  const handleNoPose = useCallback(() => {
    const detector = detectorRef.current;
    if (detector === null) return;
    onResult(detector.process(null, Date.now()));
  }, [onResult]);

  // Do workletu przekazujemy bezposrednio sam model i resizer (obiekty Nitro),
  // a nie opakowania zwracane przez hooki - dzieki temu przez granice watku
  // idzie dokladnie to, co ma isc, i nic wiecej.
  const tfliteModel = model.state === 'loaded' ? model.model : null;
  const resizer = resizerState.resizer;

  const frameOutput = useFrameOutput({
    // LiteRT i tak konwertuje do RGB wewnetrznie, wiec taniej jest dostac
    // RGB prosto z pipeline'u kamery niz konwertowac YUV po drodze.
    pixelFormat: 'rgb',
    targetResolution: TARGET_RESOLUTION,
    // Gdy analiza nie wyrabia sie w jednym interwale, wolimy pominac klatke
    // niz zatkac pipeline kamery.
    dropFramesWhileBusy: true,
    // Bufory maja przychodzic juz obrocone do pionu. Caly algorytm zaklada,
    // ze os Y to gora-dol w swiecie rzeczywistym, wiec to jest kluczowe.
    enablePhysicalBufferRotation: true,

    onFrame(frame) {
      'worklet';

      try {
        if (!isEnabled.value) return;
        if (tfliteModel == null || resizer == null) return;

        frameCounter.value += 1;
        if (frameCounter.value % PROCESS_EVERY_NTH_FRAME !== 0) return;

        const width = frame.width;
        const height = frame.height;

        const resized = resizer.resize(frame);
        // Kopie pikseli robimy jeszcze wewnatrz try, bo to ostatnia operacja
        // dotykajaca pamieci przeskalowanej klatki. Dzieki finally bufor jest
        // zwalniany takze wtedy, gdy odczyt rzuci wyjatek - przy 20 kl./s
        // wyciek w tym miejscu narastalby blyskawicznie.
        let inputBuffer: ArrayBuffer;
        try {
          const pixels = new Uint8Array(resized.getPixelBuffer());
          inputBuffer = pixels.buffer.slice(
            pixels.byteOffset,
            pixels.byteOffset + pixels.byteLength,
          );
        } finally {
          resized.dispose();
        }

        const outputs = tfliteModel.runSync([inputBuffer]);
        const keypoints = new Float32Array(outputs[0]!);

        // Przez granice watku idzie zwykla tablica liczb - nic wiecej.
        scheduleOnRN(handleKeypoints, Array.from(keypoints), width, height);
      } catch {
        // Pojedyncza nieudana klatka nie moze przerwac treningu.
        scheduleOnRN(handleNoPose);
      } finally {
        // Klatka MUSI zostac zwolniona, inaczej pipeline kamery sie zatka.
        frame.dispose();
      }
    },
  });

  const reset = useCallback(() => {
    // Licznika klatek nie zerujemy - sluzy wylacznie do pomijania co drugiej
    // klatki (modulo), wiec jego biezaca wartosc nie ma znaczenia.
    detectorRef.current?.reset();
  }, []);

  const status: PoseStatus = !hasPermission
    ? 'no-permission'
    : device == null
      ? 'no-camera'
      : errorKey !== null
        ? 'error'
        : model.state === 'loaded' && resizerState.state === 'ready'
          ? 'ready'
          : 'loading';

  return {
    status,
    errorKey,
    frameOutput,
    device,
    hasPermission,
    requestPermission,
    reset,
  };
}
