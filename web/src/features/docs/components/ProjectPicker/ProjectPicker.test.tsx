import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectPicker } from './ProjectPicker';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [
      { id: 31, name: 'Portal', code: 'POR', client: { id: 2, name: 'ACME' } },
      { id: 12, name: 'Videoconferencia', code: 'VID', client: { id: 4, name: 'EXO' } },
      { id: 40, name: 'Interno', code: 'INT' },
    ],
  }),
}));

describe('ProjectPicker', () => {
  it('lista los proyectos ordenados por nombre, con su cliente', async () => {
    render(<ProjectPicker value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Proyecto' }));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Interno', 'Portal · ACME', 'Videoconferencia · EXO']);
  });

  it('con clientId filtra por cliente y elegir avisa id y nombre', async () => {
    const onChange = vi.fn();
    render(<ProjectPicker value={null} onChange={onChange} clientId={4} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Proyecto' }));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.click(screen.getByRole('option', { name: 'Videoconferencia · EXO' }));
    expect(onChange).toHaveBeenCalledWith(12, 'Videoconferencia', 4);
  });

  it('TS-24: emptyLabel agrega la opción vacía y onClear', async () => {
    const onClear = vi.fn();
    const onChange = vi.fn();
    render(
      <ProjectPicker value={12} emptyLabel="Sin proyecto" onClear={onClear} onChange={onChange} />
    );
    await userEvent.click(screen.getByRole('combobox', { name: 'Proyecto' }));
    await userEvent.click(screen.getByRole('option', { name: 'Sin proyecto' }));
    expect(onClear).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('combobox', { name: 'Proyecto' }));
    await userEvent.click(screen.getByRole('option', { name: 'Portal · ACME' }));
    expect(onChange).toHaveBeenCalledWith(31, 'Portal', 2);
  });

  it('sin emptyLabel no hay opción vacía', async () => {
    render(<ProjectPicker value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Proyecto' }));
    expect(screen.queryByRole('option', { name: 'Sin proyecto' })).not.toBeInTheDocument();
  });
});
