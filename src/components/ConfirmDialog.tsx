/**
 * Okno potwierdzenia wbudowane w aplikacje.
 *
 * ======================= DLACZEGO NIE OKNO PRZEGLADARKI =======================
 * Pierwsza proba naprawy przycisku "Zakoncz trening" polegala na zamianie
 * martwego `Alert` z react-native-web na `window.confirm`. Uzytkownik zglosil,
 * ze nadal nie dziala.
 *
 * Wbudowane okna przegladarki (`confirm`, `alert`) bywaja tlumione i NIE DA SIE
 * tego wykryc z poziomu kodu: `confirm()` zwraca wtedy po prostu `false`,
 * dokladnie tak samo jakby uzytkownik kliknal "Anuluj". Zaleznie od
 * przegladarki, trybu pelnoekranowego PWA i ustawien uzytkownika zachowanie
 * bywa rozne, a my nie mamy jak sprawdzic, ktory to przypadek.
 *
 * Dlatego przestajemy na nich polegac przy akcjach, ktore MUSZA dzialac.
 * `Modal` z react-native jest implementowany przez react-native-web poprawnie
 * (inaczej niz `Alert`), wiec to okno wyglada i dziala tak samo na telefonie
 * i na stronie, a jego zachowanie zalezy wylacznie od naszego kodu.
 * =============================================================================
 */
import React from 'react';
import { Modal, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

interface Props {
  visible: boolean;
  /** Pytanie - krotkie, zrozumiale bez dodatkowego kontekstu. */
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Czy akcja jest nieodwracalna - wtedy przycisk jest ostrzegawczy. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: Props): React.ReactElement {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Sprzetowy przycisk "wstecz" na Androidzie ma zamykac okno,
      // a nie cofac uzytkownika z ekranu treningu.
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: 'center',
          padding: theme.spacing.lg,
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.surfaceElevated,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.lg,
          }}
        >
          <Text variant="headline" align="center">
            {message}
          </Text>

          <View style={{ height: theme.spacing.xl }} />

          <Button
            large
            variant={destructive ? 'danger' : 'primary'}
            title={confirmLabel}
            onPress={onConfirm}
          />

          <View style={{ height: theme.spacing.sm }} />

          <Button variant="ghost" title={cancelLabel} onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}
