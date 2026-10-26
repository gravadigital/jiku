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

const openWith = async (initial: Parameters<typeof Host>[0]['initial']) => {
  render(<Host initial={initial} />);
  await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
};

const submitWithTitle = async () => {
  await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Notas');
  await userEvent.click(screen.getByRole('button', { name: 'Crear y editar' }));
  return mutate.mock.calls[0]![0].content as string;
};

describe('NewDocumentDialog — relaciones precargadas (TS-27)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    setMutation();
    setRole(false);
  });

  it('el cliente sale del proyecto', async () => {
    await openWith({ projectId: 12 });
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('EXO');
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toHaveTextContent(
      'Videoconferencia · EXO'
    );
    const content = await submitWithTitle();
    expect(content).toContain('  clients: [4]\n  projects: [12]\n');
  });

  it('con requisito: vínculo informativo y requirements en el frontmatter', async () => {
    await openWith({
      clientId: 4,
      projectId: 12,
      requirement: { id: 151, title: 'Login con SSO' },
    });
    expect(
      screen.getByText('También se vincula a: Requisito Login con SSO #151')
    ).toBeInTheDocument();
    expect(await submitWithTitle()).toContain('  requirements: [151]\n');
  });

  it('con tarea sin título', async () => {
    await openWith({ clientId: 4, projectId: 12, task: { id: 7, title: null } });
    expect(screen.getByText('También se vincula a: Tarea #7')).toBeInTheDocument();
    expect(await submitWithTitle()).toContain('  tasks: [7]\n');
  });
});
