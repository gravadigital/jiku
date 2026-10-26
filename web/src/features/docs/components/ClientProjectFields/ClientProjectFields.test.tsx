import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClientProjectFields } from './ClientProjectFields';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/features/clients', () => ({
  useClients: () => ({
    data: [
      { id: 4, name: 'EXO' },
      { id: 2, name: 'ACME' },
    ],
  }),
}));
vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [
      { id: 12, name: 'Videoconferencia', client: { id: 4, name: 'EXO' } },
      { id: 31, name: 'Portal', client: { id: 2, name: 'ACME' } },
    ],
  }),
}));

describe('ClientProjectFields (TS-23)', () => {
  it('elegir proyecto completa el cliente', async () => {
    const onChange = vi.fn();
    render(<ClientProjectFields value={{ clients: [], projects: [] }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Proyecto' }));
    await userEvent.click(screen.getByRole('option', { name: 'Videoconferencia · EXO' }));
    expect(onChange).toHaveBeenCalledWith({ clients: [4], projects: [12] });
  });

  it('con cliente, el proyecto se limita y muestra la ayuda', async () => {
    render(<ClientProjectFields value={{ clients: [4], projects: [12] }} onChange={vi.fn()} />);
    expect(screen.getByText('Solo los proyectos de EXO')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Proyecto' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Sin proyecto',
      'Videoconferencia · EXO',
    ]);
  });

  it('cambiar el cliente vacía el proyecto ajeno; Sin cliente quita ambos', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ClientProjectFields value={{ clients: [4], projects: [12] }} onChange={onChange} />
    );
    await userEvent.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await userEvent.click(screen.getByRole('option', { name: 'ACME' }));
    expect(onChange).toHaveBeenLastCalledWith({ clients: [2], projects: [] });

    rerender(<ClientProjectFields value={{ clients: [4], projects: [12] }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await userEvent.click(screen.getByRole('option', { name: 'Sin cliente' }));
    expect(onChange).toHaveBeenLastCalledWith({ clients: [], projects: [] });
  });
});
