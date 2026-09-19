import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { ColorPalette, TypographyVariant } from '../theme/tokens';

interface Props extends RNTextProps {
  variant?: TypographyVariant;
  color?: keyof ColorPalette;
  align?: TextStyle['textAlign'];
  /**
   * Cyfry o stalej szerokosci. Wlaczamy je wszedzie, gdzie liczba sie zmienia
   * (licznik, statystyki), zeby tekst obok nie skakal przy kazdej zmianie.
   */
  tabular?: boolean;
}

export function Text({
  variant = 'body',
  color = 'text',
  align,
  tabular = false,
  style,
  ...rest
}: Props): React.ReactElement {
  const theme = useTheme();
  const typography = theme.typography[variant];

  return (
    <RNText
      {...rest}
      style={[
        {
          fontSize: typography.fontSize,
          lineHeight: typography.lineHeight,
          fontWeight: typography.fontWeight as TextStyle['fontWeight'],
          color: theme.colors[color],
          textAlign: align,
        },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
