/**
 * Polaczenie kamery z modelem pose estimation - wersja przegladarkowa.
 *
 * =========================== PRYWATNOSC (WAZNE) ===========================
 * Obraz z kamery NIE OPUSZCZA tej funkcji. Konkretnie:
 *
 *  - strumien z getUserMedia trafia wylacznie do elementu <video>, ktory sluzy
 *    do podgladu i jako zrodlo pikseli dla modelu dzialajacego lokalnie;
 *  - model MoveNet jest wczytywany z NASZEGO wlasnego serwera (public/models/)
 *    i liczony na GPU urzadzenia przez WebGL - zaden obraz nie jest nigdzie
 *    wysylany;
 *  - z analizy wychodzi wylacznie 17 punktow (x, y, pewnosc), czyli 51 liczb;
 *  - nie ma tu MediaRecorder, nie ma canvas.toDataURL, nie ma toBlob,
 *    nie ma zapisu do IndexedDB ani fetch/XHR z jakimikolwiek danymi obrazu.
 *    Brak tych wywolan jest sprawdzany testem (patrz privacy.test.ts).
 *
 * Kamera jest zatrzymywana (stop() na kazdej sciezce strumienia) przy wyjsciu
 * z ekranu, przy wylaczeniu analizy i przy ukryciu karty przegladarki.
 * ==========================================================================
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

import { PushupDetector, type DetectionResult } from '../../core/pushup/detector';
import { KEYPOINT_ORDER, parseLandmarks } from '../../core/pose/types';
import { assetUrl } from '../web/basePath';
import type { PoseDetectionApi, PoseStatus } from './poseTypes';

interface Options {
  /** Gdy false, klatki nie sa analizowane, a kamera zostaje zatrzymana. */
  enabled: boolean;
  onResult: (result: DetectionResult) => void;
}

/**
 * Gorny limit analiz na sekunde.
 *
 * WAZNE: to jest SUFIT, a nie cel. Na telefonie wąskim gardłem jest sam
 * model (kazda analiza trwa okolo 100 ms), wiec realnie wychodzi ~10/s
 * i ten limit nigdy sie nie wlacza. Ma znaczenie tylko na mocnym
 * komputerze, gdzie bez niego petla kręciłaby sie po 60 razy na sekunde
 * i grzala procesor bez zadnego pozytku.
 *
 * Pierwotnie bylo tu 15/s "dla zgodnosci z wersja telefonowa". To byl blad:
 * telefon i tak nie osiagal tej wartosci, a limit odbieral kilka procent
 * probek tam, gdzie kazda jest na wage zlota. Liczba probek na powtorzenie
 * decyduje o tym, jak szybko mozna cwiczyc - przy 5 probkach na cykl
 * (pompka ponizej 0,6 s przy wolnym telefonie) filtr wygladzajacy zaczyna
 * zjadac amplitude ruchu i powtorzenie przepada.
 */
const MAX_ANALYSES_PER_SECOND = 30;
const MIN_INTERVAL_MS = 1000 / MAX_ANALYSES_PER_SECOND;

/** Niska rozdzielczosc wystarcza modelowi 192x192, a mocno odciaza pipeline. */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 30 },
  // Kamera przednia: telefon stoi przed cwiczacym, wiec uzytkownik musi
  // sie widziec, zeby ustawic kadr.
  facingMode: 'user',
};

export function usePoseDetection({ enabled, onResult }: Options): PoseDetectionApi {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<poseDetection.PoseDetector | null>(null);
  const detectorRef = useRef<PushupDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastRunRef = useRef(0);

  // onResult trzymamy w ref, zeby zmiana jego tozsamosci nie restartowala
  // petli analizy. Petla musi byc stabilna przez caly trening.
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const [hasPermission, setHasPermission] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (detectorRef.current === null) detectorRef.current = new PushupDetector();

  /**
   * Zatrzymanie kamery.
   *
   * To nie jest sprzatanie "dla porzadku" - dopoki choc jedna sciezka zyje,
   * dioda kamery sie swieci, a przegladarka uznaje, ze strona nadal patrzy.
   * Wywolujemy to przy kazdym wyjsciu z analizy.
   */
  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const stream = streamRef.current;
    if (stream !== null) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video !== null) {
      video.srcObject = null;
    }
    setStreamReady(false);
  }, []);

  /** Prosi o dostep do kamery i uruchamia podglad. */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || navigator.mediaDevices === undefined) {
      // Najczestsza przyczyna: strona otwarta przez http zamiast https.
      // Przegladarki udostepniaja kamere wylacznie w bezpiecznym kontekscie.
      setErrorKey('workout.error.insecureContext');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
        // Mikrofon nie jest do niczego potrzebny. Nie prosimy o niego nawet
        // przypadkiem - kazde zbedne uprawnienie to zbedne ryzyko.
        audio: false,
      });

      streamRef.current = stream;
      setHasPermission(true);
      setErrorKey(null);
      setStreamReady(true);
      return true;
    } catch (error) {
      const name = typeof error === 'object' && error !== null && 'name' in error
        ? String((error as { name: unknown }).name)
        : '';

      // Rozrozniamy odmowe od braku kamery - to dwa zupelnie rozne komunikaty
      // dla uzytkownika. Szczegolow technicznych nie pokazujemy nigdy.
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        // Uzytkownik odmowil - to nie jest blad, tylko inny stan ekranu.
        setErrorKey(null);
        setHasPermission(false);
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setErrorKey('workout.error.noCamera');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        // Kamere trzyma inna aplikacja albo inna karta przegladarki.
        setErrorKey('workout.error.cameraBusy');
      } else {
        setErrorKey('workout.error.cameraFailed');
      }
      return false;
    }
  }, []);

  // --- wczytanie modelu (raz na cale zycie ekranu) --------------------------
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await tf.setBackend('webgl');
        await tf.ready();

        const model = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          // Model z wlasnego serwera: dziala offline i pozwala zamknac CSP
          // na obce domeny. Bez tego TensorFlow.js pobralby go z internetu.
          modelUrl: assetUrl('models/movenet/model.json'),
        });

        if (cancelled) {
          model.dispose();
          return;
        }
        modelRef.current = model;
        setModelReady(true);
      } catch {
        if (!cancelled) setErrorKey('workout.error.modelFailed');
      }
    })();

    return () => {
      cancelled = true;
      modelRef.current?.dispose();
      modelRef.current = null;
    };
  }, []);

  // --- podpiecie strumienia do elementu <video> -----------------------------
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video === null || stream === null || !streamReady) return;

    video.srcObject = stream;
    // play() bywa odrzucane, gdy przegladarka uzna, ze brakuje gestu
    // uzytkownika. Nie jest to blad krytyczny - podglad ruszy po dotknieciu.
    void video.play().catch(() => undefined);
  }, [streamReady]);

  // --- petla analizy --------------------------------------------------------
  useEffect(() => {
    if (!enabled || !streamReady || !modelReady) return;

    let stopped = false;

    const tick = async (): Promise<void> => {
      if (stopped) return;

      const video = videoRef.current;
      const model = modelRef.current;
      const detector = detectorRef.current;
      const now = performance.now();

      // Analiza bywa wolniejsza niz klatka. Gdy poprzednia jeszcze trwa albo
      // nie minal jeszcze odstep, po prostu pomijamy te klatke - dokladnie
      // jak dropFramesWhileBusy w wersji telefonowej.
      const shouldRun =
        !busyRef.current &&
        now - lastRunRef.current >= MIN_INTERVAL_MS &&
        video !== null &&
        model !== null &&
        detector !== null &&
        video.readyState >= 2 &&
        video.videoWidth > 0;

      if (shouldRun) {
        busyRef.current = true;
        lastRunRef.current = now;
        try {
          const poses = await model.estimatePoses(video, { maxPoses: 1, flipHorizontal: false });
          if (!stopped) {
            const first = poses[0];
            if (first === undefined) {
              // Jedno wywolanie na klatke: kazde process() przesuwa maszyne
              // stanow, wiec podwojne liczyloby ta sama klatke dwa razy.
              onResultRef.current(detector.process(null, Date.now()));
            } else {
              const landmarks = parseLandmarks(
                toFlatKeypoints(first, video.videoWidth, video.videoHeight),
                video.videoWidth,
                video.videoHeight,
              );
              onResultRef.current(detector.process(landmarks, Date.now()));
            }
          }
        } catch {
          // Pojedyncza nieudana klatka nie moze przerwac treningu.
          if (!stopped && detector !== null) {
            onResultRef.current(detector.process(null, Date.now()));
          }
        } finally {
          busyRef.current = false;
        }
      }

      if (!stopped) rafRef.current = requestAnimationFrame(() => void tick());
    };

    rafRef.current = requestAnimationFrame(() => void tick());

    return () => {
      stopped = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, streamReady, modelReady]);

  // --- zatrzymanie kamery przy wyjsciu i przy ukryciu karty -----------------
  useEffect(() => {
    // Gdy analiza jest wylaczona, nie ma czego nasluchiwac ani zatrzymywac:
    // kamere zgasil juz cleanup POPRZEDNIEGO przebiegu tego efektu
    // (React uruchamia go przy kazdej zmianie `enabled`). Wywolanie
    // stopCamera() tutaj bylo tylko powtorzeniem tamtego - i wymuszalo
    // dodatkowa runde renderowania.
    if (!enabled) return;

    // Gdy uzytkownik przelaczy karte albo zablokuje telefon, nie ma powodu
    // trzymac wlaczonej kamery.
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') stopCamera();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', stopCamera);

    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', stopCamera);
      // Wyjscie z ekranu treningu = kamera gasnie. Bez tego dioda
      // swiecilaby sie dalej po przejsciu na inny ekran.
      stopCamera();
    };
  }, [enabled, stopCamera]);

  const reset = useCallback(() => {
    detectorRef.current?.reset();
  }, []);

  const status: PoseStatus = !hasPermission
    ? 'no-permission'
    : errorKey !== null
      ? 'error'
      : streamReady && modelReady
        ? 'ready'
        : 'loading';

  const preview = (
    <video
      ref={videoRef}
      // autoPlay + playsInline + muted to komplet wymagany przez Safari na
      // iPhone; bez playsInline film probuje wejsc w tryb pelnoekranowy.
      autoPlay
      playsInline
      muted
      // Element jest czysto dekoracyjny - tresc niesie licznik obok.
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        // Kamera przednia pokazuje obraz "jak w lustrze" - tak jest
        // naturalniej przy ustawianiu kadru. Dotyczy WYLACZNIE podgladu:
        // model czyta piksele z elementu, a nie jego transformacje CSS.
        transform: 'scaleX(-1)',
      }}
    />
  );

  return { status, errorKey, preview, hasPermission, requestPermission, reset };
}

/**
 * Zamienia punkty z TensorFlow.js na format oczekiwany przez parseLandmarks.
 *
 * MoveNet w wersji TFJS zwraca wspolrzedne w PIKSELACH obrazu wejsciowego oraz
 * nazwy punktow, a wersja TFLite - liczby znormalizowane 0..1 w kolejnosci
 * [y, x, score]. Tu sprowadzamy jedno do drugiego, zeby dalej dzialal
 * dokladnie ten sam kod co na telefonie.
 */
function toFlatKeypoints(pose: poseDetection.Pose, width: number, height: number): number[] {
  const flat = new Array<number>(KEYPOINT_ORDER.length * 3).fill(0);

  for (let i = 0; i < KEYPOINT_ORDER.length; i += 1) {
    const kp = pose.keypoints[i];
    if (kp === undefined) continue;

    flat[i * 3] = height > 0 ? kp.y / height : 0;
    flat[i * 3 + 1] = width > 0 ? kp.x / width : 0;
    flat[i * 3 + 2] = kp.score ?? 0;
  }
  return flat;
}
