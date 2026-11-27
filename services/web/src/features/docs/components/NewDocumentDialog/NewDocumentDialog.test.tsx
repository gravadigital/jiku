import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Host, NEW_ID, calls, mutate, push, setMutation, setRole } from './testSupport';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (url: string) => push(url) }),
}));
vi.mock('../../hooks/useCreateDocument', () => ({ useCreateDocument: vi.fn() }));
vi.mock('../../hooks/useCanRestrictDocs', () => ({ useCanRestrictDocs: vi.fn() }));
vi.mock('../../hooks/useTopicSuggestions', () => ({
  useTopicSuggestions: () => ({ data: undefined, isFetching: false }),
}));
vi.mock('../../utils/ulid', () => ({ newUlid: () => '01JA0000000000000000000NEW' }));
vi.mock('@/features/clients', () => ({
  useClients: () => ({ data: [{ id: 4, name: 'EXO' }, { id: 2, name: 'ACME' }] }),
}));
vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [
      { id: 12, name: 'Videoconferencia', client: { id: 4, name: 'EXO' } },
      { id: 31, name: 'Portal', client: { id: 2, name: 'ACME' } },
    ],
  }),
}));

const open = async () => {
  render(<Host />);
  await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
};

describe('NewDocumentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    setMutation();
    setRole(false);
  });

  it('TS-25: sin carpeta, nombre de archivo, ruta ni plantilla', async () => {
    await open();
    expect(screen.getByRole('dialog', { name: 'Nuevo documento' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Nuevo documento' })).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Título' });
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('placeholder', 'Ej.: Guía de despliegue');
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Temas' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Interno' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/Nombre del archivo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Se crea en/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Plantilla/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear y editar' })).toBeDisabled();
  });

  it('TS-26: crea con el frontmatter y navega antes de cerrar', async () => {
    mutate.mockImplementation((_payload, options) =>
      options.onSuccess({ id: NEW_ID, version: 1, path: '/x.md', folderId: 'F', fileName: 'x.md' })
    );
    await open();
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Guía de despliegue');
    await userEvent.click(screen.getByRole('combobox', { name: 'Proyecto' }));
    await userEvent.click(screen.getByRole('option', { name: 'Videoconferencia · EXO' }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Temas' }), 'infra{Enter}');
    await userEvent.type(screen.getByRole('combobox', { name: 'Temas' }), 'accesos{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Crear y editar' }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toEqual({
      id: NEW_ID,
      content:
        '---\ntitle: Guía de despliegue\nvisibility: internal\ntopics: [infra, accesos]\njiku:\n  clients: [4]\n  projects: [12]\n---\n\n# Guía de despliegue\n',
    });
    expect(calls).toEqual([`push:/docs/${NEW_ID}?editar=1`, 'close']);
  });

  it('mientras crea el botón está en loading', async () => {
    setMutation({ isPending: true });
    await open();
    expect(screen.getByRole('button', { name: /Crear y editar/ })).toHaveAttribute('aria-busy', 'true');
  });

  it('TS-28: Restringido solo para admin', async () => {
    await open();
    expect(screen.queryByRole('radio', { name: 'Restringido' })).not.toBeInTheDocument();
  });

  it('TS-28: admin crea restringido', async () => {
    setRole(true);
    await open();
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Notas');
    await userEvent.click(screen.getByRole('radio', { name: 'Restringido' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear y editar' }));
    expect(mutate.mock.calls[0]![0].content).toContain('visibility: restricted\n');
  });

  it('TS-32: Enter con título vacío, Cancelar, Escape y Enter en Temas', async () => {
    await open();
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), '{Enter}');
    expect(screen.getByText('El título no puede quedar vacío.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole('combobox', { name: 'Temas' }), 'infra{Enter}');
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Quitar tema infra' })).toBeInTheDocument();

    const opener = screen.getByRole('button', { name: 'Abrir', hidden: true });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();

    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });
});
