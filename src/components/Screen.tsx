import React from 'react';
import {
  ScrollView,
  View,
  type RefreshControlProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  /** Wylacza gorny odstep - przydatne na ekranach z wlasnym naglowkiem. */
  edgeToEdge?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

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
          style,
        ]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[padding, style]}>{children}</View>;
}
