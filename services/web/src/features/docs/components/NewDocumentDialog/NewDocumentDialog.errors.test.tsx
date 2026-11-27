import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Host, NEW_ID, calls, mutate, push, reset, setMutation, setRole } from './testSupport';

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
vi.mock('@/features/clients', () => ({ useClients: () => ({ data: [] }) }));
vi.mock('@/features/projects/hooks/useProjects', () => ({ useProjects: () => ({ data: [] }) }));

const open = async () => {
  render(<Host />);
  await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Guía');
};

describe('NewDocumentDialog — errores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    setMutation();
    setRole(true);
  });

  it('TS-29: permission_denied queda junto al selector de visibilidad', async () => {
    setMutation({
      isError: true,
      error: { code: 'permission_denied', status: 403, message: 'Denied' },
    });
    await open();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Solo la conducción puede crear un documento restringido.');
    const group = screen.getByRole('radiogroup', { name: 'Visibilidad' });
    expect(group).toHaveAttribute('aria-describedby', expect.stringContaining(alert.id));
    expect(group.parentElement).toContainElement(alert);
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Guía');
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid_relation', 'El proyecto o el cliente elegido ya no existe. Elegí otro.'],
    [
      'module_unavailable',
      'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.',
    ],
    ['gateway_timeout', 'No se pudo crear el documento. Intentá de nuevo.'],
  ])('TS-30: %s', async (code, message) => {
    setMutation({ isError: true, error: { code, status: 500, message: 'x' } });
    await open();
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('dialog', { name: 'Nuevo documento' })).toBeInTheDocument();
  });

  it('TS-30: el reintento reusa el id y cambiar un campo limpia el aviso', async () => {
    setMutation({ isError: true, error: { code: 'gateway_timeout', status: 504, message: 'x' } });
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Crear y editar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear y editar' }));
    expect(mutate.mock.calls[0]![0].id).toBe(NEW_ID);
    expect(mutate.mock.calls[1]![0].id).toBe(NEW_ID);
    reset.mockClear();
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'x');
    expect(reset).toHaveBeenCalled();
  });

  it('TS-31: already_exists del mismo id es éxito', async () => {
    mutate.mockImplementation((_p, options) =>
      options.onError({ code: 'already_exists', status: 409, message: 'x' })
    );
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Crear y editar' }));
    expect(calls).toEqual([`push:/docs/${NEW_ID}?editar=1`, 'close']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
