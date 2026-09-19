import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export function Card({ children, style, padded = true }: Props): React.ReactElement {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: padded ? theme.spacing.base : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
