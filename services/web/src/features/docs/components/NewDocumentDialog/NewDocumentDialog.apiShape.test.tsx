import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Host, calls, mutate, push, setMutation, setRole } from './testSupport';

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
      { id: 40, name: 'Interno', code: 'INT', clientId: null, client: null },
      { id: 50, name: 'Migración', code: 'MIG', clientId: 1 },
    ],
  }),
}));

const openWith = async (initial: Parameters<typeof Host>[0]['initial']) => {
  render(<Host initial={initial} />);
  await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
};

const submitWithTitle = async () => {
  await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Notas');
  await userEvent.click(screen.getByRole('button', { name: 'Crear y editar' }));
  return mutate.mock.calls[0]![0].content as string;
};

describe('NewDocumentDialog — relaciones con la forma de la api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    setMutation();
    setRole(false);
  });

  it('TS-17 y TS-18: precarga cliente + proyecto visibles y los manda al guardar', async () => {
    await openWith({ clientId: 1, projectId: 43 });
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('EXO');
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toHaveTextContent(
      'EXO - Videoconferencia · EXO'
    );
    expect(await submitWithTitle()).toContain('  clients: [1]\n  projects: [43]\n');
  });

  it('TS-19: solo projectId → cliente por client.id', async () => {
    await openWith({ projectId: 43 });
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('EXO');
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toHaveTextContent(
      'EXO - Videoconferencia · EXO'
    );
    expect(await submitWithTitle()).toContain('  clients: [1]\n  projects: [43]\n');
  });

  it('TS-20: solo projectId → cliente por respaldo clientId', async () => {
    await openWith({ projectId: 50 });
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('EXO');
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toHaveTextContent('Migración · EXO');
    expect(await submitWithTitle()).toContain('  clients: [1]\n  projects: [50]\n');
  });

  it('TS-21: proyecto sin cliente no inventa cliente', async () => {
    await openWith({ projectId: 40 });
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('Sin cliente');
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toHaveTextContent('Interno');
    const content = await submitWithTitle();
    expect(content).toContain('jiku:\n  projects: [40]\n');
    expect(content).not.toContain('clients:');
  });
});
