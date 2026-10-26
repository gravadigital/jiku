import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanRestrictDocs } from '../../hooks/useCanRestrictDocs';
import { useSaveDocument } from '../../hooks/useSaveDocument';
import { useUploadDocAttachment } from '../../hooks/useUploadDocAttachment';
import { DocumentEditor } from './DocumentEditor';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/features/clients', () => ({
  useClients: () => ({
    data: [
      { id: 1, name: 'EXO' },
      { id: 2, name: 'ACME' },
    ],
  }),
}));
// Forma de `GET /api/projects` (con `clientId`).
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
      { id: 50, name: 'Migración', code: 'MIG', clientId: 1 },
    ],
  }),
}));
vi.mock('../../hooks/useTopicSuggestions', () => ({
  useTopicSuggestions: () => ({ data: undefined, isFetching: false }),
}));
vi.mock('../../hooks/useCanRestrictDocs', () => ({ useCanRestrictDocs: vi.fn() }));
vi.mock('../../hooks/useSaveDocument', () => ({ useSaveDocument: vi.fn() }));
vi.mock('../../hooks/useUploadDocAttachment', () => ({ useUploadDocAttachment: vi.fn() }));
vi.mock('../../services/docsApi', () => ({ getDocument: vi.fn() }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: vi.fn(() => ({ id: 'sub-yo', name: 'Yo' })),
}));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const SESSION = '01J9Z3K8M2Q4R6T8V0W2Y4A6S1';
const docWith = (projectId: number) => ({
  id: ID,
  title: 'Arquitectura',
  version: 6,
  visibility: 'internal',
  content: `---\ntitle: Arquitectura\nvisibility: internal\njiku:\n  clients: [1]\n  projects: [${projectId}]\n---\n# Contexto\n`,
});
const mutate = vi.fn();
const session = {
  phase: 'editing',
  sessionId: SESSION,
  blockedBy: null,
  start: vi.fn(),
  release: vi.fn(),
  markBlocked: vi.fn(),
  clearBlocked: vi.fn(),
} as never;

const renderEditor = (doc: Record<string, unknown>) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentEditor doc={doc as never} session={session} onDone={vi.fn()} />
    </QueryClientProvider>
  );

describe('DocumentEditor — relaciones con la forma de la api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCanRestrictDocs).mockReturnValue(false);
    vi.mocked(useSaveDocument).mockReturnValue({ mutate, isPending: false } as never);
    vi.mocked(useUploadDocAttachment).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
  });

  it('TS-24: muestra cliente y proyecto del documento', () => {
    renderEditor(docWith(43));
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('EXO');
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toHaveTextContent(
      'EXO - Videoconferencia · EXO'
    );
    expect(screen.getByText('Solo los proyectos de EXO')).toBeInTheDocument();
  });

  it('TS-25: proyecto con solo clientId', () => {
    renderEditor(docWith(50));
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('EXO');
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toHaveTextContent('Migración · EXO');
  });

  it('TS-26: reelegir el mismo cliente conserva el proyecto y guarda igual', async () => {
    renderEditor(docWith(43));
    await userEvent.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await userEvent.click(screen.getByRole('option', { name: 'EXO' }));
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    const content = mutate.mock.calls[0]![0].content as string;
    expect(content).toContain('  clients: [1]\n');
    expect(content).toContain('  projects: [43]\n');
  });
});
