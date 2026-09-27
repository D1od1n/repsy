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
import { ConfirmDialog } from './ConfirmDialog';
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

    await fireEvent.press(getByText('Start'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('zablokowany przycisk nie reaguje', async () => {
    const onPress = jest.fn();
    const { getByText } = await renderWithTheme(
      <Button title="Start" onPress={onPress} disabled />,
    );

    await fireEvent.press(getByText('Start'));
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

    await fireEvent.press(getByText('Miesiac'));
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
  // UWAGA na ksztalt tego testu.
  //
  // Pierwotnie probowal KLIKNAC przycisk "Dodaj" przy pustym polu
  // i sprawdzic, ze nic sie nie stalo. Przycisk jest wtedy wylaczony
  // (Pressable disabled), a symulowanie klikniecia w wylaczony element
  // potrafilo w RNTL zawiesic test: na CI konczyl sie limitem 5 s,
  // lokalnie zwykle zdazyl. Objaw wygladal na niestabilnosc losowa.
  //
  // Teraz sprawdzamy wlasciwa gwarancje: przycisk JEST nieaktywny.
  // To jest to, co widzi uzytkownik i czytnik ekranu - i czego nie da
  // sie obejsc. Sciezke "poprawna wartosc przechodzi" pokrywa test nizej,
  // wiec razem opisuja pelne zachowanie walidacji.
  it('blokuje przycisk zapisu przy pustym polu', async () => {
    const onSubmit = jest.fn();
    const { getByRole } = await renderWithTheme(
      <ManualRepsModal visible onClose={jest.fn()} onSubmit={onSubmit} />,
    );

    const addButton = getByRole('button', { name: 'Dodaj' });

    expect(addButton.props.accessibilityState?.disabled).toBe(true);
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

describe('ConfirmDialog', () => {
  // Komponent powstal po zgloszeniu "przycisk zakoncz trening nie dziala".
  // Poprzednie dwie proby opieraly sie na oknach systemowych - najpierw na
  // martwej atrapie Alert z react-native-web, potem na window.confirm, ktore
  // bywa tlumione bez mozliwosci wykrycia. To okno jest zwyklym komponentem,
  // wiec da sie je sprawdzic testem - i wlasnie o to chodzi.

  const labels = {
    message: 'Zakonczyc trening?',
    confirmLabel: 'Zakoncz',
    cancelLabel: 'Anuluj',
  };

  it('pokazuje pytanie i oba przyciski, gdy jest widoczne', async () => {
    const { getByText } = await renderWithTheme(
      <ConfirmDialog visible {...labels} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(getByText(labels.message)).toBeTruthy();
    expect(getByText(labels.confirmLabel)).toBeTruthy();
    expect(getByText(labels.cancelLabel)).toBeTruthy();
  });

  it('wywoluje onConfirm po potwierdzeniu', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByText } = await renderWithTheme(
      <ConfirmDialog visible {...labels} onConfirm={onConfirm} onCancel={onCancel} />,
    );

    await fireEvent.press(getByText(labels.confirmLabel));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('wywoluje onCancel po anulowaniu', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByText } = await renderWithTheme(
      <ConfirmDialog visible {...labels} onConfirm={onConfirm} onCancel={onCancel} />,
    );

    await fireEvent.press(getByText(labels.cancelLabel));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('nic nie pokazuje, gdy nie jest widoczne', async () => {
    const { queryByText } = await renderWithTheme(
      <ConfirmDialog visible={false} {...labels} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(queryByText(labels.message)).toBeNull();
  });
});
