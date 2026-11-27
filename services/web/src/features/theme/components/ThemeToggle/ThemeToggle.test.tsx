import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '../../context/ThemeProvider';
import { ThemeToggle } from './ThemeToggle';

function renderWithProvider(initialTheme: 'light' | 'dark' = 'light') {
  return render(
    <ThemeProvider initialTheme={initialTheme}>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe('ThemeToggle', () => {
  // TS-26
  it('renderiza un radiogroup "Tema" con los radios "Claro" y "Oscuro"', () => {
    renderWithProvider();

    const group = screen.getByRole('radiogroup', { name: 'Tema' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeInTheDocument();
  });

  // TS-27
  it('marca la opción vigente con aria-checked', () => {
    renderWithProvider('dark');

    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'false');
  });

  // TS-28
  it('elegir "Oscuro" estampa el atributo y persiste', async () => {
    const user = userEvent.setup();
    renderWithProvider('light');

    await user.click(screen.getByRole('radio', { name: 'Oscuro' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('jiku.theme')).toBe('dark');
  });

  // TS-29
  it('volver a "Claro" revierte las dos cosas', async () => {
    const user = userEvent.setup();
    renderWithProvider('light');

    await user.click(screen.getByRole('radio', { name: 'Oscuro' }));
    await user.click(screen.getByRole('radio', { name: 'Claro' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('jiku.theme')).toBe('light');
  });

  // TS-30
  it('es operable por teclado como radiogroup', async () => {
    const user = userEvent.setup();
    renderWithProvider('light');

    screen.getByRole('radio', { name: 'Claro' }).focus();
    await user.keyboard('{ArrowRight}');

    const oscuro = screen.getByRole('radio', { name: 'Oscuro' });
    expect(oscuro).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
