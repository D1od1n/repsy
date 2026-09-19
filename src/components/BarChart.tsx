import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface BarDatum {
  label: string;
  value: number;
  /** Czy cel danego dnia zostal osiagniety - slupek dostaje wtedy kolor sukcesu. */
  achieved?: boolean;
}

interface Props {
  data: readonly BarDatum[];
  /** Linia celu rysowana w poprzek wykresu. */
  goal?: number;
  height?: number;
}

/**
 * Prosty wykres slupkowy. Celowo bez biblioteki wykresow - potrzebujemy
 * tylko slupkow i jednej linii celu, a mniej zaleznosci to mniej problemow
 * przy budowaniu aplikacji.
 */
export function BarChart({ data, goal, height = 160 }: Props): React.ReactElement {
  const theme = useTheme();

  const maxValue = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  const barCount = Math.max(1, data.length);

  // Wykres skalujemy w jednostkach wirtualnych, a SVG rozciaga go na szerokosc.
  const chartWidth = 100;
  const gap = barCount > 14 ? 0.6 : 1.6;
  const barWidth = Math.max(0.5, (chartWidth - gap * (barCount - 1)) / barCount);

  const goalY = goal === undefined ? null : height - (goal / maxValue) * height;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="none">
        {goalY !== null && (
          <Line
            x1={0}
            y1={goalY}
            x2={chartWidth}
            y2={goalY}
            stroke={theme.colors.textTertiary}
            strokeWidth={0.4}
            strokeDasharray="1.5 1.5"
          />
        )}

        {data.map((datum, index) => {
          const barHeight = (datum.value / maxValue) * height;
          const x = index * (barWidth + gap);
          const y = height - barHeight;

          return (
            <Rect
              key={`${datum.label}-${index}`}
              x={x}
              y={datum.value === 0 ? height - 1 : y}
              width={barWidth}
              height={datum.value === 0 ? 1 : barHeight}
              rx={0.6}
              fill={
                datum.value === 0
                  ? theme.colors.track
                  : datum.achieved === true
                    ? theme.colors.success
                    : theme.colors.accent
              }
            />
          );
        })}
      </Svg>

      <View style={{ flexDirection: 'row', marginTop: theme.spacing.xs }}>
        {data.map((datum, index) => (
          <View key={`${datum.label}-label-${index}`} style={{ flex: 1, alignItems: 'center' }}>
            {/* Przy gestych wykresach (miesiac) podpisujemy co trzeci slupek. */}
            {(data.length <= 14 || index % 3 === 0) && (
              <Text variant="caption" color="textTertiary">
                {datum.label}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
