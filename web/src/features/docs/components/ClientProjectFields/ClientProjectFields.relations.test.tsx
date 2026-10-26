import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClientProjectFields } from './ClientProjectFields';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/features/clients', () => ({
  useClients: () => ({
    data: [
      { id: 1, name: 'EXO' },
      { id: 2, name: 'ACME' },
    ],
  }),
}));
// Forma de `GET /api/projects` (con `clientId`), a diferencia de los mocks que imitan el detalle.
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
      { id: 50, name: 'Migración', code: 'MIG', clientId: 1 },
    ],
  }),
}));

const pick = async (combo: string, option: string) => {
  await userEvent.click(screen.getByRole('combobox', { name: combo }));
  await userEvent.click(screen.getByRole('option', { name: option }));
};

describe('ClientProjectFields con la forma de la api', () => {
  it('TS-10: cliente elegido → proyectos de ese cliente', async () => {
    render(<ClientProjectFields value={{ clients: [1], projects: [] }} onChange={vi.fn()} />);
    expect(screen.getByText('Solo los proyectos de EXO')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Proyecto' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Sin proyecto',
      'EXO - Videoconferencia · EXO',
      'Migración · EXO',
    ]);
  });

  it('TS-11: proyecto primero completa el cliente', async () => {
    const onChange = vi.fn();
    render(<ClientProjectFields value={{ clients: [], projects: [] }} onChange={onChange} />);
    await pick('Proyecto', 'EXO - Videoconferencia · EXO');
    expect(onChange).toHaveBeenCalledWith({ clients: [1], projects: [43] });
  });

  it('TS-12: proyecto con solo clientId completa el cliente', async () => {
    const onChange = vi.fn();
    render(<ClientProjectFields value={{ clients: [], projects: [] }} onChange={onChange} />);
    await pick('Proyecto', 'Migración · EXO');
    expect(onChange).toHaveBeenCalledWith({ clients: [1], projects: [50] });
  });

  it('TS-13: reelegir el mismo cliente conserva el proyecto', async () => {
    const onChange = vi.fn();
    render(<ClientProjectFields value={{ clients: [1], projects: [43] }} onChange={onChange} />);
    await pick('Cliente', 'EXO');
    expect(onChange).toHaveBeenCalledWith({ clients: [1], projects: [43] });
  });

  it('TS-14: reelegir el mismo cliente conserva un proyecto con solo clientId', async () => {
    const onChange = vi.fn();
    render(<ClientProjectFields value={{ clients: [1], projects: [50] }} onChange={onChange} />);
    await pick('Cliente', 'EXO');
    expect(onChange).toHaveBeenCalledWith({ clients: [1], projects: [50] });
  });

  it('TS-15: otro cliente vacía el proyecto', async () => {
    const onChange = vi.fn();
    render(<ClientProjectFields value={{ clients: [1], projects: [43] }} onChange={onChange} />);
    await pick('Cliente', 'ACME');
    expect(onChange).toHaveBeenCalledWith({ clients: [2], projects: [] });
  });

  it('TS-16: Sin cliente vacía ambos', async () => {
    const onChange = vi.fn();
    render(<ClientProjectFields value={{ clients: [1], projects: [43] }} onChange={onChange} />);
    await pick('Cliente', 'Sin cliente');
    expect(onChange).toHaveBeenCalledWith({ clients: [], projects: [] });
  });
});
