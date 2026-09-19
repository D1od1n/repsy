/**
 * Reczne dopisanie pompek.
 *
 * Potrzebne z dwoch powodow: ktos cwiczyl bez telefonu, albo kamera w danych
 * warunkach nie daje rady. Bez tej furtki zly dzien z detekcja oznaczalby
 * utrate streaka, co szybko zniechecilo by uzytkownika do aplikacji.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reps: number) => Promise<void> | void;
}

export function ManualRepsModal({ visible, onClose, onSubmit }: Props): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  const parsed = Number.parseInt(value, 10);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 2000;

  const close = (): void => {
    setValue('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: 'center',
          padding: theme.spacing.lg,
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.surfaceElevated,
            borderRadius: theme.radius.xl,
            padding: theme.spacing.xl,
          }}
        >
          <Text variant="title3">{t('workout.manual.title')}</Text>
          <View style={{ height: theme.spacing.sm }} />
          <Text variant="footnote" color="textSecondary">
            {t('workout.manual.body')}
          </Text>

          <View style={{ height: theme.spacing.lg }} />

          <TextInput
            value={value}
            onChangeText={(text) => setValue(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder={t('workout.manual.placeholder')}
            placeholderTextColor={theme.colors.textTertiary}
            autoFocus
            maxLength={4}
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              paddingVertical: theme.spacing.base,
              paddingHorizontal: theme.spacing.base,
              fontSize: 32,
              fontVariant: ['tabular-nums'],
              textAlign: 'center',
              color: theme.colors.text,
            }}
          />

          <View style={{ height: theme.spacing.lg }} />

          <Button
            title={t('common.add')}
            disabled={!valid}
            onPress={() => {
              if (!valid) return;
              void onSubmit(parsed);
              setValue('');
            }}
          />
          <View style={{ height: theme.spacing.sm }} />
          <Button variant="ghost" title={t('common.cancel')} onPress={close} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
