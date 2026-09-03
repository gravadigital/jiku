import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeriodFilter } from './PeriodFilter';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}));

describe('PeriodFilter', () => {
  it('TS-87: los 5 períodos son role="radio" dentro de un role="radiogroup"', () => {
    render(<PeriodFilter dateFrom="2026-09-01" dateTo="2026-09-07" onPeriodChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(radios.map((r) => r.textContent)).toEqual([
      'Esta semana',
      'Semana pasada',
      'Este mes',
      'Mes pasado',
      'Rango personalizado',
    ]);
  });

  it('TS-87: elegir el período personalizado muestra dos Input variant date con label asociado', async () => {
    const user = userEvent.setup();
    render(<PeriodFilter dateFrom="2026-09-01" dateTo="2026-09-07" onPeriodChange={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: 'Rango personalizado' }));

    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
  });

  it('TS-87: no hay <input type="date"> crudo', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PeriodFilter dateFrom="2026-09-01" dateTo="2026-09-07" onPeriodChange={vi.fn()} />
    );

    await user.click(screen.getByRole('radio', { name: 'Rango personalizado' }));

    expect(container.querySelector('input[type="date"]')).not.toBeInTheDocument();
  });

  it('elegir "Semana pasada" dispara onPeriodChange con el rango correspondiente', async () => {
    const user = userEvent.setup();
    const onPeriodChange = vi.fn();
    render(<PeriodFilter dateFrom="2026-09-01" dateTo="2026-09-07" onPeriodChange={onPeriodChange} />);

    await user.click(screen.getByRole('radio', { name: 'Semana pasada' }));

    expect(onPeriodChange).toHaveBeenCalledWith(expect.any(String), expect.any(String));
  });

  it('cambiar la fecha "Desde" en el rango personalizado dispara onPeriodChange', async () => {
    const user = userEvent.setup();
    const onPeriodChange = vi.fn();
    render(<PeriodFilter dateFrom="2026-09-01" dateTo="2026-09-07" onPeriodChange={onPeriodChange} />);

    await user.click(screen.getByRole('radio', { name: 'Rango personalizado' }));
    const desde = screen.getByLabelText('Desde');
    await user.clear(desde);
    await user.type(desde, '2026-09-10');

    expect(onPeriodChange).toHaveBeenCalled();
  });
});
