import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

interface Props {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
  /** Ostatni wiersz nie rysuje kreski na dole. */
  last?: boolean;
}

/** Wiersz listy w stylu ustawien iOS. */
export function ListRow({
  title,
  subtitle,
  value,
  onPress,
  right,
  destructive = false,
  last = false,
}: Props): React.ReactElement {
  const theme = useTheme();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.base,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.border,
        minHeight: 52,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body" color={destructive ? 'danger' : 'text'}>
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text variant="footnote" color="textSecondary">
            {subtitle}
          </Text>
        )}
      </View>

      {value !== undefined && (
        <Text variant="body" color="textSecondary" tabular>
          {value}
        </Text>
      )}
      {right}
    </View>
  );

  if (onPress === undefined) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}
