import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';
import { Text } from './Text';

interface Props {
  label: string;
  value: string | number;
  caption?: string;
  /** Rozciaga kafelek na cala szerokosc wiersza. */
  wide?: boolean;
}

export function StatTile({ label, value, caption, wide = false }: Props): React.ReactElement {
  const theme = useTheme();

  return (
    <Card style={{ flex: wide ? undefined : 1, minWidth: wide ? '100%' : undefined }}>
      <Text variant="footnote" color="textSecondary">
        {label}
      </Text>
      <View style={{ height: theme.spacing.xs }} />
      <Text variant="title2" tabular>
        {value}
      </Text>
      {caption !== undefined && (
        <Text variant="caption" color="textTertiary">
          {caption}
        </Text>
      )}
    </Card>
  );
}
