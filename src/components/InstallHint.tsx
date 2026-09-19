/**
 * Podpowiedz "dodaj do ekranu glownego" - wersja telefonowa.
 *
 * W aplikacji instalowanej z pliku nie ma czego dodawac, wiec komponent nic
 * nie renderuje. Istnieje po to, zeby ekrany wspoldzielone przez obie wersje
 * nie musialy sprawdzac platformy.
 */
import type React from 'react';

export function InstallHint(): React.ReactElement | null {
  return null;
}
