import React from 'react';
import {
  Platform,
  ScrollView,
  View,
  type RefreshControlProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';

/**
 * Najwieksza sensowna szerokosc tresci w przegladarce.
 *
 * Aplikacja jest projektowana pod telefon. Na monitorze rozciagnieta na cale
 * 1920 px wygladalaby fatalnie - przycisk "Rozpocznij trening" mialby dwa metry
 * szerokosci, a wzrok musialby skakac przez pol ekranu. Ograniczamy wiec tresc
 * i centrujemy ja, zachowujac uklad, ktory i tak jest dopracowany pod waski
 * ekran. Na telefonie ta wartosc nie ma znaczenia, bo ekran jest wezszy.
 */
const MAX_CONTENT_WIDTH = 520;

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  /** Wylacza gorny odstep - przydatne na ekranach z wlasnym naglowkiem. */
  edgeToEdge?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

/** Ograniczenie szerokosci stosujemy wylacznie w przegladarce. */
const widthLimit: ViewStyle =
  Platform.OS === 'web'
    ? { maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }
    : {};

/** Wspolna ramka ekranu: tlo z motywu i bezpieczne marginesy. */
export function Screen({
  children,
  scroll = false,
  style,
  edgeToEdge = false,
  refreshControl,
}: Props): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingTop: edgeToEdge ? 0 : insets.top,
    paddingBottom: insets.bottom,
    backgroundColor: theme.colors.background,
    flex: 1,
  };

  if (scroll) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={[
          {
            paddingTop: edgeToEdge ? 0 : insets.top,
            paddingBottom: insets.bottom + theme.spacing.xxxl,
          },
          widthLimit,
          style,
        ]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[padding, widthLimit, style]}>{children}</View>;
}
