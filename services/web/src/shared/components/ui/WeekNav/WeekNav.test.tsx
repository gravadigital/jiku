import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WeekNav } from './WeekNav';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('WeekNav', () => {
  it('TS-66: es un nav con nombre accesible', () => {
    render(<WeekNav weekStart={new Date('2026-08-24')} isCurrentWeek={false} onChange={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: 'Navegación de semana' })).toBeInTheDocument();
  });

  it('TS-67: escribe el rango completo, con mes y año', () => {
    render(<WeekNav weekStart={new Date('2026-08-24')} isCurrentWeek={false} onChange={vi.fn()} />);

    expect(screen.getAllByText('Semana del 24 al 28 de agosto 2026').length).toBeGreaterThan(0);
  });

  it('TS-68: resuelve el cruce de mes en el rango', () => {
    render(<WeekNav weekStart={new Date('2026-08-31')} isCurrentWeek={false} onChange={vi.fn()} />);

    expect(
      screen.getAllByText('Semana del 31 de agosto al 4 de septiembre 2026').length
    ).toBeGreaterThan(0);
  });

  it('TS-69: resuelve el cruce de año en el rango', () => {
    render(<WeekNav weekStart={new Date('2026-12-28')} isCurrentWeek={false} onChange={vi.fn()} />);

    expect(
      screen.getAllByText('Semana del 28 de diciembre 2026 al 1 de enero 2027').length
    ).toBeGreaterThan(0);
  });

  it('TS-70: retrocede una semana', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeekNav weekStart={new Date('2026-08-24')} isCurrentWeek={false} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Anterior/ }));

    const calledDate = onChange.mock.calls[0][0] as Date;
    expect(calledDate.toISOString().slice(0, 10)).toBe('2026-08-17');
  });

  it('TS-71: avanza una semana', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeekNav weekStart={new Date('2026-08-24')} isCurrentWeek={false} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));

    const calledDate = onChange.mock.calls[0][0] as Date;
    expect(calledDate.toISOString().slice(0, 10)).toBe('2026-08-31');
  });

  it('TS-72: «Esta semana» no se oculta en la semana actual: se marca', () => {
    render(<WeekNav weekStart={new Date('2026-08-24')} isCurrentWeek onChange={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Esta semana' });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('TS-73: «Esta semana» vuelve al presente cuando no estás en él', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeekNav weekStart={new Date('2026-08-24')} isCurrentWeek={false} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Esta semana' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const calledDate = onChange.mock.calls[0][0] as Date;
    expect(calledDate.getUTCDay()).toBe(1);
  });

  it('TS-74: anuncia el cambio de semana en una región viva', () => {
    render(<WeekNav weekStart={new Date('2026-08-24')} isCurrentWeek={false} onChange={vi.fn()} />);

    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.textContent).toContain('Semana del 24 al 28 de agosto 2026');
  });
});
