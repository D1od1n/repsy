/**
 * Ostatni krok powitania: jak ustawic telefon.
 *
 * Ten ekran jest wazniejszy, niz sie wydaje - zle ustawiony telefon to
 * najczestszy powod, dla ktorego licznik nie dziala tak, jak powinien.
 */
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAppStore } from '../../src/features/store/appStore';

export default function OnboardingSetupScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const setSetting = useAppStore((state) => state.setSetting);

  return (
    <Screen scroll style={{ paddingHorizontal: theme.spacing.lg }}>
      <View style={{ height: theme.spacing.xxl }} />

      <Text variant="title1">{t('onboarding.setupTitle')}</Text>
      <View style={{ height: theme.spacing.md }} />
      <Text variant="body" color="textSecondary">
        {t('onboarding.setupBody')}
      </Text>

      <View style={{ height: theme.spacing.xl }} />

      <Card>
        <PhonePlacementDiagram />
      </Card>

      <View style={{ height: theme.spacing.lg }} />

      <Text variant="callout" color="textSecondary">
        {t('workout.setupHint')}
      </Text>

      <View style={{ height: theme.spacing.lg }} />

      <Card>
        <Text variant="footnote" color="textSecondary">
          {t('onboarding.privacyNote')}
        </Text>
      </Card>

      <View style={{ height: theme.spacing.xxl }} />

      <Button
        large
        title={t('onboarding.finish')}
        onPress={() => {
          void setSetting('onboardingDone', true);
          router.replace('/(tabs)');
        }}
      />
    </Screen>
  );
}

/** Prosty rysunek: telefon przed cwiczacym, a nie z boku. */
function PhonePlacementDiagram(): React.ReactElement {
  const theme = useTheme();

  return (
    <Svg width="100%" height={140} viewBox="0 0 200 100">
      {/* podloga */}
      <Line x1={10} y1={80} x2={190} y2={80} stroke={theme.colors.border} strokeWidth={2} />

      {/* cwiczacy w podporze */}
      <Circle cx={150} cy={64} r={7} fill={theme.colors.accent} />
      <Line x1={150} y1={64} x2={182} y2={58} stroke={theme.colors.text} strokeWidth={3} />
      <Line x1={150} y1={64} x2={150} y2={80} stroke={theme.colors.text} strokeWidth={3} />
      <Line x1={166} y1={61} x2={166} y2={80} stroke={theme.colors.text} strokeWidth={3} />

      {/* telefon oparty o cos stabilnego, ekranem do cwiczacego */}
      <Rect
        x={34}
        y={54}
        width={16}
        height={26}
        rx={3}
        fill={theme.colors.surfaceElevated}
        stroke={theme.colors.text}
        strokeWidth={2}
      />

      {/* pole widzenia kamery */}
      <Line x1={50} y1={58} x2={140} y2={38} stroke={theme.colors.accent} strokeWidth={1} strokeDasharray="3 3" />
      <Line x1={50} y1={76} x2={140} y2={82} stroke={theme.colors.accent} strokeWidth={1} strokeDasharray="3 3" />
    </Svg>
  );
}
