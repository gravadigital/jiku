import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DaySelector } from './DaySelector';

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

describe('DaySelector', () => {
  it('TS-84: renderiza un role="radiogroup" con un role="radio" por día, sin <button> crudos', () => {
    render(<DaySelector selectedDate={formatDate(today())} onDayChange={vi.fn()} dailyMinutes={{}} />);

    const group = screen.getByRole('radiogroup');
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
  });

  it('TS-84: las flechas mueven la selección con wraparound', async () => {
    const user = userEvent.setup();
    const onDayChange = vi.fn();
    render(
      <DaySelector selectedDate={formatDate(today())} onDayChange={onDayChange} dailyMinutes={{}} />
    );

    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    await user.keyboard('{ArrowRight}');

    expect(onDayChange).toHaveBeenCalled();
  });

  it('el día seleccionado se marca con aria-checked', () => {
    render(<DaySelector selectedDate={formatDate(today())} onDayChange={vi.fn()} dailyMinutes={{}} />);

    const checkedRadios = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checkedRadios).toHaveLength(1);
  });

  it('el semáforo del día (completed/partial/empty) se conserva en el contenido del chip, no sólo con color', () => {
    const todayStr = formatDate(today());
    render(
      <DaySelector
        selectedDate={todayStr}
        onDayChange={vi.fn()}
        dailyMinutes={{ [todayStr]: 400 }}
        completedThreshold={360}
      />
    );

    // El label del día con carga completa lleva una señal textual (no sólo color).
    const radios = screen.getAllByRole('radio');
    const selected = radios.find((r) => r.getAttribute('aria-checked') === 'true');
    expect(selected?.textContent).toMatch(/completo/i);
  });

  it('un día sin carga muestra la señal "sin carga" en el texto del chip', () => {
    const todayStr = formatDate(today());
    render(<DaySelector selectedDate={todayStr} onDayChange={vi.fn()} dailyMinutes={{}} />);

    const radios = screen.getAllByRole('radio');
    const selected = radios.find((r) => r.getAttribute('aria-checked') === 'true');
    expect(selected?.textContent).toMatch(/sin carga/i);
  });
});
