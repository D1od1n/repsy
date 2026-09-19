/**
 * Testy komponentow interfejsu.
 *
 * Sprawdzamy zachowanie, ktore realnie moze sie zepsuc: czy przycisk da sie
 * kliknac, czy walidacja blokuje bledne dane, czy motyw ciemny faktycznie
 * zmienia kolory - a nie wyglad piksel po pikselu.
 *
 * Uwaga: w @testing-library/react-native 14 `render` jest ASYNCHRONICZNE
 * (dostosowanie do asynchronicznego `act` z Reacta 19), dlatego kazdy test
 * musi go poczekac przez await.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { Button } from './Button';
import { ManualRepsModal } from './ManualRepsModal';
import { ProgressBar } from './ProgressBar';
import { SegmentedControl } from './SegmentedControl';
import { StatTile } from './StatTile';
import { Text } from './Text';
import { ThemeProvider } from '../theme/ThemeProvider';
import { DARK_COLORS, LIGHT_COLORS } from '../theme/tokens';
import { initI18n } from '../i18n';
import type { ThemePreference } from '../core/model';

beforeAll(() => {
  initI18n('pl');
});

async function renderWithTheme(
  ui: React.ReactElement,
  preference: ThemePreference = 'light',
): Promise<Awaited<ReturnType<typeof render>>> {
  return render(<ThemeProvider preference={preference}>{ui}</ThemeProvider>);
}

/** Skleja tablice stylow React Native w jeden obiekt. */
function flattenStyle(style: unknown): Record<string, unknown> {
  const parts = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...parts.filter(Boolean)) as Record<string, unknown>;
}

describe('Text', () => {
  it('wyswietla tresc', async () => {
    const { getByText } = await renderWithTheme(<Text>100 pompek</Text>);
    expect(getByText('100 pompek')).toBeTruthy();
  });

  it('uzywa cyfr o stalej szerokosci, gdy o to poprosimy', async () => {
    const { getByText } = await renderWithTheme(<Text tabular>68</Text>);
    expect(flattenStyle(getByText('68').props.style).fontVariant).toEqual(['tabular-nums']);
  });
});

describe('Button', () => {
  it('wywoluje akcje po klinieciu', async () => {
    const onPress = jest.fn();
    const { getByText } = await renderWithTheme(<Button title="Start" onPress={onPress} />);

    fireEvent.press(getByText('Start'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('zablokowany przycisk nie reaguje', async () => {
    const onPress = jest.fn();
    const { getByText } = await renderWithTheme(
      <Button title="Start" onPress={onPress} disabled />,
    );

    fireEvent.press(getByText('Start'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('w trakcie ladowania pokazuje wskaznik zamiast napisu', async () => {
    const { queryByText } = await renderWithTheme(
      <Button title="Start" onPress={jest.fn()} loading />,
    );

    expect(queryByText('Start')).toBeNull();
  });
});

describe('ProgressBar', () => {
  it('podaje postep do czytnikow ekranu', async () => {
    const { getByRole } = await renderWithTheme(<ProgressBar value={0.42} />);
    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(42);
  });

  it('przycina wartosc powyzej zakresu', async () => {
    const { getByRole } = await renderWithTheme(<ProgressBar value={5} />);
    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(100);
  });

  it('przycina wartosc ponizej zera', async () => {
    const { getByRole } = await renderWithTheme(<ProgressBar value={-3} />);
    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(0);
  });
});

describe('SegmentedControl', () => {
  it('zglasza zmiane po klinieciu innej zakladki', async () => {
    const onChange = jest.fn();
    const { getByText } = await renderWithTheme(
      <SegmentedControl
        value="day"
        onChange={onChange}
        options={[
          { value: 'day', label: 'Dzien' },
          { value: 'month', label: 'Miesiac' },
        ]}
      />,
    );

    fireEvent.press(getByText('Miesiac'));
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('oznacza dokladnie jedna wybrana zakladke', async () => {
    const { getAllByRole } = await renderWithTheme(
      <SegmentedControl
        value="week"
        onChange={jest.fn()}
        options={[
          { value: 'day', label: 'Dzien' },
          { value: 'week', label: 'Tydzien' },
        ]}
      />,
    );

    const selected = getAllByRole('tab').filter(
      (tab) => tab.props.accessibilityState?.selected === true,
    );
    expect(selected).toHaveLength(1);
  });
});

describe('StatTile', () => {
  it('pokazuje etykiete i wartosc', async () => {
    const { getByText } = await renderWithTheme(<StatTile label="Serie" value={4} />);

    expect(getByText('Serie')).toBeTruthy();
    expect(getByText('4')).toBeTruthy();
  });
});

describe('ManualRepsModal', () => {
  it('nie pozwala zapisac pustej wartosci', async () => {
    const onSubmit = jest.fn();
    const { getByText } = await renderWithTheme(
      <ManualRepsModal visible onClose={jest.fn()} onSubmit={onSubmit} />,
    );

    fireEvent.press(getByText('Dodaj'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('przepuszcza poprawna liczbe pompek', async () => {
    const onSubmit = jest.fn();
    const { getByText, getByPlaceholderText } = await renderWithTheme(
      <ManualRepsModal visible onClose={jest.fn()} onSubmit={onSubmit} />,
    );

    // fireEvent w RNTL 14 tez jest asynchroniczne - bez await stan nie zdazy
    // sie zaktualizowac przed sprawdzeniem.
    await fireEvent.changeText(getByPlaceholderText('Liczba pompek'), '25');
    await fireEvent.press(getByText('Dodaj'));

    expect(onSubmit).toHaveBeenCalledWith(25);
  });

  it('odrzuca znaki inne niz cyfry', async () => {
    const { getByPlaceholderText } = await renderWithTheme(
      <ManualRepsModal visible onClose={jest.fn()} onSubmit={jest.fn()} />,
    );

    await fireEvent.changeText(getByPlaceholderText('Liczba pompek'), '2a5b');

    // Odpytujemy ponownie, zeby dostac aktualny wezel po przerysowaniu.
    expect(getByPlaceholderText('Liczba pompek').props.value).toBe('25');
  });
});

describe('motyw jasny i ciemny', () => {
  it('jasny motyw uzywa ciemnego tekstu', async () => {
    const { getByText } = await renderWithTheme(<Text>Repsy</Text>, 'light');
    expect(flattenStyle(getByText('Repsy').props.style).color).toBe(LIGHT_COLORS.text);
  });

  it('ciemny motyw uzywa jasnego tekstu', async () => {
    const { getByText } = await renderWithTheme(<Text>Repsy</Text>, 'dark');
    expect(flattenStyle(getByText('Repsy').props.style).color).toBe(DARK_COLORS.text);
  });
});
