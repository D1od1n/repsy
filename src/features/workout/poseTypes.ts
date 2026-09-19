/**
 * Wspolny kontrakt hooka kamery dla obu platform.
 *
 * Ten plik celowo NIE importuje niczego z react-native-vision-camera ani
 * z TensorFlow.js. Dzieki temu moze go uzywac zarowno wersja telefonowa,
 * jak i przegladarkowa, a TypeScript pilnuje, ze obie realizuja dokladnie
 * ten sam interfejs - jesli jedna zacznie odstawac, kompilacja to wylapie.
 */
import type React from 'react';

export type PoseStatus = 'loading' | 'ready' | 'no-permission' | 'no-camera' | 'error';

export interface PoseDetectionApi {
  status: PoseStatus;
  /** Klucz tlumaczenia komunikatu bledu (nigdy gotowy tekst ani szczegoly techniczne). */
  errorKey: string | null;
  /**
   * Gotowy do wyrenderowania podglad kamery.
   *
   * Ekran treningu renderuje po prostu {pose.preview} i nie wie, czy pod
   * spodem jest natywny komponent kamery, czy element <video> przegladarki.
   */
  preview: React.ReactElement | null;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  /** Czysci stan detektora przed nowym treningiem. */
  reset: () => void;
}
