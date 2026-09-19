import React from 'react';
import { ActivityIndicator, Pressable, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Duzy przycisk na pelna szerokosc - glowna akcja ekranu. */
  large?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  large = false,
  style,
  accessibilityLabel,
}: Props): React.ReactElement {
  const theme = useTheme();
  const inactive = disabled || loading;

  const background: Record<ButtonVariant, string> = {
    primary: theme.colors.accent,
    secondary: theme.colors.surface,
    ghost: 'transparent',
    danger: theme.colors.danger,
  };

  const textColor: Record<ButtonVariant, 'accentText' | 'text' | 'danger'> = {
    primary: 'accentText',
    secondary: 'text',
    ghost: 'text',
    danger: 'accentText',
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        {
          backgroundColor: background[variant],
          paddingVertical: large ? theme.spacing.lg : theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: large ? 60 : 48,
          opacity: inactive ? 0.4 : pressed ? 0.8 : 1,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.accentText : theme.colors.text} />
      ) : (
        <Text variant={large ? 'title3' : 'headline'} color={textColor[variant]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
