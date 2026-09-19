/**
 * Cele: domyslny oraz wyjatki na konkretne dni.
 *
 * Wyjatek dotyczy tylko swojego dnia - nastepnego dnia aplikacja sama wraca
 * do celu domyslnego, bo nadpisania trzymamy osobno dla kazdej daty.
 */
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAppStore } from '../../src/features/store/appStore';
import { GOAL_PRESETS, normalizeGoal } from '../../src/core/goals/goals';
import { addDays, compareDates } from '../../src/core/date/localDate';

export default function GoalSettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();

  const settings = useAppStore((state) => state.settings);
  const setSetting = useAppStore((state) => state.setSetting);
  const today = useAppStore((state) => state.today);
  const overrides = useAppStore((state) => state.goalOverrides);
  const setDailyGoal = useAppStore((state) => state.setDailyGoal);
  const clearDailyGoal = useAppStore((state) => state.clearDailyGoal);
  const goalFor = useAppStore((state) => state.goalFor);

  const [custom, setCustom] = useState('');

  // Pozwalamy ustawic cel na dzis i kilka najblizszych dni - to pokrywa
  // realne potrzeby ("dzis lzej", "w sobote wiecej") bez kalendarza.
  const upcomingDays = [0, 1, 2, 3].map((offset) => addDays(today, offset));

  const futureOverrides = Object.entries(overrides)
    .filter(([date]) => compareDates(date, today) >= 0)
    .sort(([a], [b]) => compareDates(a, b));

  return (
    <Screen scroll style={{ paddingHorizontal: theme.spacing.lg }}>
      <View style={{ height: theme.spacing.base }} />

      <Text variant="footnote" color="textSecondary">
        {t('settings.goalDefault')}
      </Text>
      <View style={{ height: theme.spacing.sm }} />

      <Card padded={false}>
        {GOAL_PRESETS.map((preset, index) => (
          <ListRow
            key={preset}
            title={String(preset)}
            value={settings.defaultGoal === preset ? '✓' : undefined}
            onPress={() => void setSetting('defaultGoal', preset)}
            last={index === GOAL_PRESETS.length - 1}
          />
        ))}
      </Card>

      <View style={{ height: theme.spacing.md }} />

      <Card>
        <Text variant="footnote" color="textSecondary">
          {t('settings.goalCustom')}
        </Text>
        <View style={{ height: theme.spacing.sm }} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <TextInput
            value={custom}
            onChangeText={(text) => setCustom(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder={String(settings.defaultGoal)}
            placeholderTextColor={theme.colors.textTertiary}
            style={{
              flex: 1,
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              fontSize: 20,
              fontVariant: ['tabular-nums'],
              color: theme.colors.text,
            }}
          />
          <Button
            title={t('common.save')}
            disabled={custom === ''}
            onPress={() => {
              void setSetting('defaultGoal', normalizeGoal(Number(custom)));
              setCustom('');
            }}
          />
        </View>
      </Card>

      {/* ------------------------------------------ cel na dany dzien */}
      <View style={{ height: theme.spacing.xl }} />
      <Text variant="footnote" color="textSecondary">
        {t('settings.goalForDay')}
      </Text>
      <View style={{ height: theme.spacing.sm }} />

      <Card padded={false}>
        {upcomingDays.map((date, index) => (
          <DayGoalRow
            key={date}
            date={date}
            isToday={index === 0}
            goal={goalFor(date)}
            hasOverride={overrides[date] !== undefined}
            onChange={(goal) => void setDailyGoal(date, goal)}
            onClear={() => void clearDailyGoal(date)}
            last={index === upcomingDays.length - 1}
          />
        ))}
      </Card>

      <View style={{ height: theme.spacing.md }} />

      {futureOverrides.length === 0 && (
        <Text variant="caption" color="textTertiary">
          {t('settings.goalNoOverrides')}
        </Text>
      )}
    </Screen>
  );
}

function DayGoalRow({
  date,
  isToday,
  goal,
  hasOverride,
  onChange,
  onClear,
  last,
}: {
  date: string;
  isToday: boolean;
  goal: number;
  hasOverride: boolean;
  onChange: (goal: number) => void;
  onClear: () => void;
  last: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  return (
    <View
      style={{
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.base,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text variant="body">{isToday ? t('common.today') : date}</Text>
          {hasOverride && (
            <Text variant="caption" color="accent">
              {t('settings.goalOverrides')}
            </Text>
          )}
        </View>

        <TextInput
          value={value}
          onChangeText={(text) => setValue(text.replace(/[^0-9]/g, ''))}
          onBlur={() => {
            if (value !== '') {
              onChange(Number(value));
              setValue('');
            }
          }}
          keyboardType="number-pad"
          maxLength={4}
          placeholder={String(goal)}
          placeholderTextColor={theme.colors.textTertiary}
          style={{
            minWidth: 72,
            backgroundColor: theme.colors.surfaceElevated,
            borderRadius: theme.radius.sm,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            fontSize: 17,
            fontVariant: ['tabular-nums'],
            textAlign: 'center',
            color: theme.colors.text,
          }}
        />

        {hasOverride && (
          <Text
            variant="body"
            color="danger"
            onPress={onClear}
            style={{ marginLeft: theme.spacing.md }}
            accessibilityRole="button"
          >
            ✕
          </Text>
        )}
      </View>
    </View>
  );
}
