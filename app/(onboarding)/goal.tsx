/**
 * Wybor dziennego celu przy pierwszym uruchomieniu.
 * Domyslnie 100 - zgodnie z zalozeniem aplikacji.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAppStore } from '../../src/features/store/appStore';
import { GOAL_PRESETS } from '../../src/core/goals/goals';

export default function OnboardingGoalScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const setSetting = useAppStore((state) => state.setSetting);
  const [selected, setSelected] = useState(100);

  return (
    <Screen style={{ paddingHorizontal: theme.spacing.lg }}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text variant="title1">{t('onboarding.goalTitle')}</Text>
        <View style={{ height: theme.spacing.md }} />
        <Text variant="body" color="textSecondary">
          {t('onboarding.goalSubtitle')}
        </Text>

        <View style={{ height: theme.spacing.xxl }} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {GOAL_PRESETS.map((preset) => {
            const active = preset === selected;
            return (
              <Pressable
                key={preset}
                onPress={() => setSelected(preset)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  flexGrow: 1,
                  flexBasis: '40%',
                  paddingVertical: theme.spacing.xl,
                  borderRadius: theme.radius.lg,
                  alignItems: 'center',
                  backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                }}
              >
                <Text variant="title1" tabular color={active ? 'accentText' : 'text'}>
                  {preset}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ paddingBottom: theme.spacing.xl }}>
        <Button
          large
          title={t('common.done')}
          onPress={() => {
            void setSetting('defaultGoal', selected);
            router.replace('/(onboarding)/setup');
          }}
        />
      </View>
    </Screen>
  );
}
