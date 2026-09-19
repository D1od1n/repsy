import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

interface Props {
  /** Postep 0..1. */
  value: number;
  height?: number;
  color?: string;
}

export function ProgressBar({ value, height = 8, color }: Props): React.ReactElement {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, value));

  return (
    <View
      // Bez `accessible` widok nie jest w ogole zglaszany czytnikom ekranu,
      // wiec sama rola nic by nie dala.
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.colors.track,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? theme.colors.accent,
        }}
      />
    </View>
  );
}
