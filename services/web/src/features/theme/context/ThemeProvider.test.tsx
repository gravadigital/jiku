import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY } from '../types/theme.types';
import { ThemeProvider, useTheme } from './ThemeProvider';

function Consumer() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        Oscuro
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        Claro
      </button>
    </div>
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

describe('ThemeProvider', () => {
  // TS-17
  it('estampa el atributo data-theme en <html> al cambiar de tema', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider initialTheme="light">
        <Consumer />
      </ThemeProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  // TS-18
  it('expone el tema actual por hook', () => {
    render(
      <ThemeProvider initialTheme="dark">
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
  });

  // TS-19
  it('useTheme fuera del provider lanza un error explícito', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow('useTheme debe usarse dentro de ThemeProvider');

    consoleError.mockRestore();
  });

  // TS-20
  it('cambiar el tema no dispara ninguna request', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response());
    const user = userEvent.setup();

    render(
      <ThemeProvider initialTheme="light">
        <Consumer />
      </ThemeProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  // TS-21
  it('cambiar el tema no invalida TanStack Query', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    function ConsumerWithQueryClient() {
      useQueryClient();
      return <Consumer />;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider initialTheme="light">
          <ConsumerWithQueryClient />
        </ThemeProvider>
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('persiste el tema en localStorage al cambiar', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider initialTheme="light">
        <Consumer />
      </ThemeProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('no sobrescribe el atributo del <html> en el primer render cuando storage y cookie coinciden', () => {
    document.documentElement.dataset.theme = 'light';
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    render(
      <ThemeProvider initialTheme="light">
        <Consumer />
      </ThemeProvider>
    );

    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
