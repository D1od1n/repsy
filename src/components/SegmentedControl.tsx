import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Przelacznik zakladek: Dzien / Tydzien / Miesiac, Dzis / Tydzien / Miesiac. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: Props<T>): React.ReactElement {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.full,
        padding: 4,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              backgroundColor: selected ? theme.colors.surfaceElevated : 'transparent',
            }}
          >
            <Text variant="subhead" color={selected ? 'text' : 'textSecondary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
