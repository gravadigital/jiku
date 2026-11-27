import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectPicker } from './ProjectPicker';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/features/clients', () => ({
  useClients: () => ({
    data: [
      { id: 1, name: 'EXO' },
      { id: 2, name: 'ACME' },
    ],
  }),
}));
// Forma de `GET /api/projects`: `clientId` siempre, `client` solo con id/name (o ausente).
vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [
      {
        id: 43,
        name: 'EXO - Videoconferencia',
        code: 'VID',
        clientId: 1,
        client: { id: 1, name: 'EXO' },
      },
      { id: 31, name: 'Portal', code: 'POR', clientId: 2, client: { id: 2, name: 'ACME' } },
      { id: 40, name: 'Interno', code: 'INT', clientId: null, client: null },
      { id: 50, name: 'Migración', code: 'MIG', clientId: 1 },
      { id: 60, name: 'Huérfano', code: 'HUE', clientId: 99 },
    ],
  }),
}));

const open = () => userEvent.click(screen.getByRole('combobox', { name: 'Proyecto' }));
const optionTexts = () => screen.getAllByRole('option').map((o) => o.textContent);

describe('ProjectPicker', () => {
  it('TS-5: sin clientId lista todos con su cliente, ordenados por nombre', async () => {
    render(<ProjectPicker value={null} onChange={vi.fn()} />);
    await open();
    expect(optionTexts()).toEqual([
      'EXO - Videoconferencia · EXO',
      'Huérfano',
      'Interno',
      'Migración · EXO',
      'Portal · ACME',
    ]);
  });

  it('TS-6: con clientId filtra por client.id y por clientId', async () => {
    render(
      <ProjectPicker value={null} onChange={vi.fn()} clientId={1} emptyLabel="Sin proyecto" />
    );
    await open();
    expect(optionTexts()).toEqual([
      'Sin proyecto',
      'EXO - Videoconferencia · EXO',
      'Migración · EXO',
    ]);
  });

  it('TS-7: avisa el cliente aunque solo venga clientId', async () => {
    const onChange = vi.fn();
    render(<ProjectPicker value={null} onChange={onChange} clientId={1} />);
    await open();
    await userEvent.click(screen.getByRole('option', { name: 'Migración · EXO' }));
    expect(onChange).toHaveBeenCalledWith(50, 'Migración', 1);
  });

  it('TS-8: avisa el cliente cuando viene client', async () => {
    const onChange = vi.fn();
    render(<ProjectPicker value={null} onChange={onChange} />);
    await open();
    await userEvent.click(screen.getByRole('option', { name: 'EXO - Videoconferencia · EXO' }));
    expect(onChange).toHaveBeenCalledWith(43, 'EXO - Videoconferencia', 1);
  });

  it('TS-9: sin client ni nombre en useClients, solo el nombre del proyecto', async () => {
    render(<ProjectPicker value={null} onChange={vi.fn()} />);
    await open();
    expect(screen.getByRole('option', { name: 'Huérfano' }).textContent).toBe('Huérfano');
  });

  it('emptyLabel agrega la opción vacía y onClear', async () => {
    const onClear = vi.fn();
    render(
      <ProjectPicker value={43} emptyLabel="Sin proyecto" onClear={onClear} onChange={vi.fn()} />
    );
    await open();
    await userEvent.click(screen.getByRole('option', { name: 'Sin proyecto' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('sin emptyLabel no hay opción vacía', async () => {
    render(<ProjectPicker value={null} onChange={vi.fn()} />);
    await open();
    expect(screen.queryByRole('option', { name: 'Sin proyecto' })).not.toBeInTheDocument();
  });
});
