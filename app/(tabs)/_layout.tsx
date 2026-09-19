import React from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text as RNText, type ColorValue } from 'react-native';

import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * Zamiast biblioteki ikon uzywamy emoji. To jedna zaleznosc mniej,
 * a przy piciu zakladkach roznica wizualna jest zadna.
 */
function TabIcon({ symbol, color }: { symbol: string; color: ColorValue }): React.ReactElement {
  return <RNText style={{ fontSize: 22, color }}>{symbol}</RNText>;
}

export default function TabsLayout(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('common.appName'),
          tabBarIcon: ({ color }) => <TabIcon symbol="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('stats.title'),
          tabBarIcon: ({ color }) => <TabIcon symbol="📊" color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t('friends.title'),
          tabBarIcon: ({ color }) => <TabIcon symbol="🏆" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile.title'),
          tabBarIcon: ({ color }) => <TabIcon symbol="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
