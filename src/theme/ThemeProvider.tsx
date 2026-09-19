/**
 * Motyw jasny i ciemny.
 *
 * Domyslnie idziemy za ustawieniem systemu, ale uzytkownik moze wymusic jasny
 * albo ciemny w ustawieniach aplikacji.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import type { ThemePreference } from '../core/model';
import { createTheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(createTheme(false));

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

interface Props {
  preference: ThemePreference;
  children: React.ReactNode;
}

export function ThemeProvider({ preference, children }: Props): React.ReactElement {
  const systemScheme = useColorScheme();

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';
  const theme = useMemo(() => createTheme(isDark), [isDark]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
