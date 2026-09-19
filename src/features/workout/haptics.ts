/**
 * Krotka wibracja po zaliczonym powtorzeniu - wersja telefonowa.
 *
 * Wydzielone do osobnego modulu, bo expo-haptics NIE MA implementacji
 * webowej (dostarcza tylko deklaracje typow), wiec na stronie wywolanie
 * przerwaloby dzialanie ekranu treningu.
 */
import * as Haptics from 'expo-haptics';

/** Potwierdzenie zaliczonego powtorzenia. */
export function repFeedback(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Czy na tym urzadzeniu wibracja w ogole zadziala. */
export function hapticsSupported(): boolean {
  return true;
}
