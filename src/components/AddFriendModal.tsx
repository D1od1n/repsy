/**
 * Dodawanie znajomego po nazwie uzytkownika albo po kodzie.
 *
 * Jedno pole obsluguje oba sposoby - funkcja `find_user` po stronie bazy
 * sprawdza i nazwe, i kod. Dla uzytkownika to o jedna decyzje mniej.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';
import { addFriend, type AddFriendResult } from '../data/api/friendsApi';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

const MESSAGE_KEYS: Record<AddFriendResult, string> = {
  sent: 'friends.sent',
  accepted: 'friends.sent',
  already_friends: 'friends.alreadyFriends',
  self: 'friends.cannotAddSelf',
  not_found: 'friends.notFound',
};

export function AddFriendModal({ visible, onClose, onAdded }: Props): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [messageKey, setMessageKey] = useState<string | null>(null);

  const close = (): void => {
    setQuery('');
    setMessageKey(null);
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (query.trim() === '') return;

    setBusy(true);
    setMessageKey(null);
    try {
      const result = await addFriend(query.trim());
      setMessageKey(MESSAGE_KEYS[result]);

      if (result === 'sent' || result === 'accepted') {
        setQuery('');
        onAdded();
      }
    } catch {
      setMessageKey('errors.network');
    } finally {
      setBusy(false);
    }
  };

  const success = messageKey === 'friends.sent';

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
          <Text variant="title3">{t('friends.addFriend')}</Text>
          <View style={{ height: theme.spacing.sm }} />
          <Text variant="footnote" color="textSecondary">
            {`${t('friends.byUsername')} ${t('common.of')} ${t('friends.byCode')}`}
          </Text>

          <View style={{ height: theme.spacing.base }} />

          <TextInput
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('friends.usernamePlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            maxLength={20}
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              padding: theme.spacing.base,
              fontSize: 18,
              color: theme.colors.text,
            }}
          />

          {messageKey !== null && (
            <>
              <View style={{ height: theme.spacing.md }} />
              <Text variant="footnote" color={success ? 'success' : 'danger'}>
                {t(messageKey)}
              </Text>
            </>
          )}

          <View style={{ height: theme.spacing.lg }} />

          <Button
            title={t('common.add')}
            loading={busy}
            disabled={query.trim() === ''}
            onPress={() => void submit()}
          />
          <View style={{ height: theme.spacing.sm }} />
          <Button variant="ghost" title={t('common.close')} onPress={close} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
