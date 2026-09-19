/**
 * Przypomnienia o dziennym celu.
 *
 * Kazda zmiana od razu przelicza zaplanowane powiadomienia - inaczej
 * skasowana godzina nadal by sie odzywala.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Switch, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAppStore } from '../../src/features/store/appStore';
import { newId } from '../../src/core/id';
import {
  hasNotificationPermission,
  requestNotificationPermission,
  rescheduleReminders,
} from '../../src/features/notifications/notificationService';
import type { Reminder } from '../../src/core/model';

export default function RemindersScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();

  const settings = useAppStore((state) => state.settings);
  const setSetting = useAppStore((state) => state.setSetting);
  const reminders = useAppStore((state) => state.reminders);
  const saveReminder = useAppStore((state) => state.saveReminder);
  const deleteReminder = useAppStore((state) => state.deleteReminder);

  const [permissionDenied, setPermissionDenied] = useState(false);
  const [picking, setPicking] = useState(false);

  const refreshSchedule = useCallback(async () => {
    const state = useAppStore.getState();

    await rescheduleReminders({
      reminders: state.reminders,
      enabled: state.settings.remindersEnabled,
      goalFor: state.goalFor,
      totalFor: (date) =>
        state.workouts
          .filter((workout) => workout.localDate === date)
          .reduce((total, workout) => total + workout.totalReps, 0),
    });
  }, []);

  useEffect(() => {
    void hasNotificationPermission().then((granted) => setPermissionDenied(!granted));
  }, []);

  const toggleReminders = async (enabled: boolean): Promise<void> => {
    if (enabled) {
      const result = await requestNotificationPermission();
      setPermissionDenied(result !== 'granted');
      if (result !== 'granted') return;
    }

    await setSetting('remindersEnabled', enabled);
    await refreshSchedule();
  };

  const addReminder = async (hour: number, minute: number): Promise<void> => {
    await saveReminder({
      id: newId(),
      hour,
      minute,
      enabled: true,
      customMessage: '',
    });
    await refreshSchedule();
  };

  return (
    <Screen scroll style={{ paddingHorizontal: theme.spacing.lg }}>
      <View style={{ height: theme.spacing.base }} />

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="body" style={{ flex: 1 }}>
            {t('settings.remindersEnabled')}
          </Text>
          <Switch
            value={settings.remindersEnabled}
            onValueChange={(value) => void toggleReminders(value)}
          />
        </View>
        <View style={{ height: theme.spacing.sm }} />
        <Text variant="caption" color="textTertiary">
          {t('settings.remindersHint')}
        </Text>
      </Card>

      {permissionDenied && (
        <>
          <View style={{ height: theme.spacing.md }} />
          <Text variant="footnote" color="danger">
            {t('settings.remindersDenied')}
          </Text>
        </>
      )}

      <View style={{ height: theme.spacing.lg }} />

      {reminders.length === 0 ? (
        <Text variant="callout" color="textTertiary" align="center">
          {t('settings.remindersEmpty')}
        </Text>
      ) : (
        <Card padded={false}>
          {reminders.map((reminder, index) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              last={index === reminders.length - 1}
              onChange={async (updated) => {
                await saveReminder(updated);
                await refreshSchedule();
              }}
              onDelete={async () => {
                await deleteReminder(reminder.id);
                await refreshSchedule();
              }}
            />
          ))}
        </Card>
      )}

      <View style={{ height: theme.spacing.lg }} />

      <Button title={t('settings.remindersAdd')} onPress={() => setPicking(true)} />

      {picking && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setPicking(false);
            if (event.type === 'set' && date !== undefined) {
              void addReminder(date.getHours(), date.getMinutes());
            }
          }}
        />
      )}
    </Screen>
  );
}

function ReminderRow({
  reminder,
  last,
  onChange,
  onDelete,
}: {
  reminder: Reminder;
  last: boolean;
  onChange: (reminder: Reminder) => void;
  onDelete: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const [message, setMessage] = useState(reminder.customMessage);

  const time = `${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`;

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
        <Text variant="title2" tabular style={{ flex: 1 }}>
          {time}
        </Text>

        <Switch
          value={reminder.enabled}
          onValueChange={(value) => onChange({ ...reminder, enabled: value })}
        />

        <Text
          variant="body"
          color="danger"
          onPress={onDelete}
          style={{ marginLeft: theme.spacing.base }}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          ✕
        </Text>
      </View>

      <View style={{ height: theme.spacing.sm }} />

      <TextInput
        value={message}
        onChangeText={setMessage}
        onBlur={() => onChange({ ...reminder, customMessage: message })}
        placeholder={t('settings.reminderMessage')}
        placeholderTextColor={theme.colors.textTertiary}
        maxLength={120}
        style={{
          backgroundColor: theme.colors.surfaceElevated,
          borderRadius: theme.radius.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          fontSize: 15,
          color: theme.colors.text,
        }}
      />
    </View>
  );
}
