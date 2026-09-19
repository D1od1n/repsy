/**
 * Znajomi i ranking.
 *
 * Ranking jest prywatny - widac w nim wylacznie Ciebie i Twoich znajomych.
 * Nie ma globalnej listy ani szukania obcych osob po wynikach.
 */
import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { Text } from '../../src/components/Text';
import { AddFriendModal } from '../../src/components/AddFriendModal';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAppStore } from '../../src/features/store/appStore';
import { useAuthStore } from '../../src/features/auth/authStore';
import { periodRange } from '../../src/core/date/localDate';
import {
  fetchLeaderboard,
  listFriends,
  listRequests,
  removeFriend,
  respondToRequest,
} from '../../src/data/api/friendsApi';
import { isBackendConfigured } from '../../src/data/api/supabase';
import { useInviteLink } from '../../src/features/friends/useInviteLink';

type Period = 'day' | 'week' | 'month';

export default function FriendsScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<Period>('day');
  const [addOpen, setAddOpen] = useState(false);

  const today = useAppStore((state) => state.today);
  const profile = useAuthStore((state) => state.profile);
  const session = useAuthStore((state) => state.session);
  const userId = session?.user.id ?? '';

  const range = periodRange(period, today);
  const enabled = isBackendConfigured() && userId !== '';

  const leaderboard = useQuery({
    queryKey: ['leaderboard', period, range.from, range.to, userId],
    queryFn: () => fetchLeaderboard(range.from, range.to, userId),
    enabled,
  });

  const friends = useQuery({
    queryKey: ['friends', userId],
    queryFn: listFriends,
    enabled,
  });

  const requests = useQuery({
    queryKey: ['friendRequests', userId],
    queryFn: () => listRequests(userId),
    enabled,
  });

  const refreshAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    await queryClient.invalidateQueries({ queryKey: ['friends'] });
    await queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
  }, [queryClient]);

  // Link zapraszajacy moze przyjsc w kazdej chwili - takze gdy aplikacja
  // juz dziala. Po dodaniu znajomego odswiezamy listy.
  useInviteLink(useCallback(() => void refreshAll(), [refreshAll]));

  if (!enabled) {
    return (
      <Screen style={{ padding: theme.spacing.lg, justifyContent: 'center' }}>
        <Text variant="title3" align="center">
          {t('friends.title')}
        </Text>
        <View style={{ height: theme.spacing.base }} />
        <Text variant="callout" color="textSecondary" align="center">
          {t('errors.supabaseNotConfigured')}
        </Text>
      </Screen>
    );
  }

  const incoming = (requests.data ?? []).filter((request) => request.direction === 'incoming');

  return (
    <Screen
      scroll
      style={{ paddingHorizontal: theme.spacing.lg }}
      refreshControl={
        <RefreshControl
          refreshing={leaderboard.isFetching}
          onRefresh={() => void refreshAll()}
        />
      }
    >
      <View style={{ paddingTop: theme.spacing.base }}>
        <Text variant="title1">{t('friends.title')}</Text>
      </View>

      <View style={{ height: theme.spacing.base }} />

      <SegmentedControl<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'day', label: t('friends.periodToday') },
          { value: 'week', label: t('friends.periodWeek') },
          { value: 'month', label: t('friends.periodMonth') },
        ]}
      />

      <View style={{ height: theme.spacing.lg }} />

      {/* ------------------------------------------------- ranking */}
      <Card padded={false}>
        {(leaderboard.data ?? []).length === 0 ? (
          <View style={{ padding: theme.spacing.base }}>
            <Text variant="callout" color="textTertiary">
              {t('friends.empty')}
            </Text>
          </View>
        ) : (
          (leaderboard.data ?? []).map((entry, index, all) => (
            <View
              key={entry.userId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.base,
                borderBottomWidth: index === all.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border,
                backgroundColor: entry.isMe ? theme.colors.surfaceElevated : 'transparent',
              }}
            >
              <Text variant="headline" color="textTertiary" tabular style={{ width: 28 }}>
                {index + 1}
              </Text>
              <Text variant="title3" style={{ marginRight: theme.spacing.sm }}>
                {entry.avatarEmoji}
              </Text>
              <Text variant="body" style={{ flex: 1 }}>
                {entry.username}
              </Text>
              <Text variant="headline" tabular color={entry.isMe ? 'accent' : 'text'}>
                {entry.total}
              </Text>
            </View>
          ))
        )}
      </Card>

      {/* --------------------------------------------- zaproszenia */}
      {incoming.length > 0 && (
        <>
          <View style={{ height: theme.spacing.xl }} />
          <Text variant="title3">{t('friends.requests')}</Text>
          <View style={{ height: theme.spacing.sm }} />

          <Card padded={false}>
            {incoming.map((request, index) => (
              <View
                key={request.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: theme.spacing.md,
                  paddingHorizontal: theme.spacing.base,
                  borderBottomWidth: index === incoming.length - 1 ? 0 : 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <Text variant="body" style={{ flex: 1 }}>
                  {`${request.avatarEmoji} ${request.username}`}
                </Text>

                <Button
                  title={t('friends.accept')}
                  onPress={() => {
                    void respondToRequest(request.id, true).then(refreshAll);
                  }}
                />
                <View style={{ width: theme.spacing.sm }} />
                <Button
                  variant="ghost"
                  title={t('friends.decline')}
                  onPress={() => {
                    void respondToRequest(request.id, false).then(refreshAll);
                  }}
                />
              </View>
            ))}
          </Card>
        </>
      )}

      {/* -------------------------------------------- moj kod */}
      <View style={{ height: theme.spacing.xl }} />
      <Card>
        <Text variant="footnote" color="textSecondary">
          {t('friends.yourCode')}
        </Text>
        <View style={{ height: theme.spacing.xs }} />
        <Text variant="title1" tabular>
          {profile?.friendCode ?? '—'}
        </Text>

        <View style={{ height: theme.spacing.base }} />

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            variant="secondary"
            style={{ flex: 1 }}
            title={t('friends.copyCode')}
            onPress={() => {
              if (profile === null) return;
              void Clipboard.setStringAsync(profile.friendCode);
              Alert.alert(t('friends.codeCopied'));
            }}
          />
          <Button
            variant="secondary"
            style={{ flex: 1 }}
            title={t('friends.shareInvite')}
            onPress={() => {
              if (profile === null) return;
              void Share.share({
                message: t('friends.inviteMessage', {
                  code: profile.friendCode,
                  // Link otworzy aplikacje u kogos, kto ja juz ma. Dlatego
                  // w tresci zawsze jest tez kod do recznego wpisania.
                  link: `repsy://add-friend?code=${profile.friendCode}`,
                }),
              });
            }}
          />
        </View>
      </Card>

      {/* ------------------------------------------ lista znajomych */}
      <View style={{ height: theme.spacing.xl }} />
      <Button large title={t('friends.addFriend')} onPress={() => setAddOpen(true)} />

      {(friends.data ?? []).length > 0 && (
        <>
          <View style={{ height: theme.spacing.lg }} />
          <Card padded={false}>
            {(friends.data ?? []).map((friend, index, all) => (
              <ListRow
                key={friend.id}
                title={`${friend.avatarEmoji} ${friend.username}`}
                last={index === all.length - 1}
                onPress={() => {
                  Alert.alert(
                    t('friends.removeConfirm', { username: friend.username }),
                    undefined,
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('friends.remove'),
                        style: 'destructive',
                        onPress: () => {
                          void removeFriend(friend.id).then(refreshAll);
                        },
                      },
                    ],
                  );
                }}
              />
            ))}
          </Card>
        </>
      )}

      <AddFriendModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false);
          void refreshAll();
        }}
      />
    </Screen>
  );
}
