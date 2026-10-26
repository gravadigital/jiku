import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocsCard } from '../../hooks/useDocsCard';
import { useModule } from '../../hooks/useModules';
import { setMutation, setRole } from '../NewDocumentDialog/testSupport';
import { DocsPanel } from './DocsPanel';
import { queryResult } from './panelFixtures';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../hooks/useDocsCard', () => ({ useDocsCard: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('../../hooks/useCreateDocument', () => ({ useCreateDocument: vi.fn() }));
vi.mock('../../hooks/useCanRestrictDocs', () => ({ useCanRestrictDocs: vi.fn() }));
vi.mock('../../hooks/useTopicSuggestions', () => ({
  useTopicSuggestions: () => ({ data: undefined, isFetching: false }),
}));
vi.mock('@/features/clients', () => ({ useClients: () => ({ data: [{ id: 1, name: 'EXO' }] }) }));
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
    ],
  }),
}));

describe('DocsPanel "+" con la forma de la api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useModule).mockReturnValue({ status: 'available', sharing: false, isKnown: true });
    vi.mocked(useDocsCard).mockReturnValue(queryResult() as never);
    setMutation();
    setRole(false);
  });

  const expectPrefilled = () => {
    expect(screen.getByRole('dialog', { name: 'Nuevo documento' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('EXO');
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toHaveTextContent(
      'EXO - Videoconferencia · EXO'
    );
  };

  it('TS-22: con context.clientId precarga cliente y proyecto', async () => {
    render(<DocsPanel scope={{ projectId: 43 }} context={{ clientId: 1 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo documento en este proyecto' }));
    expectPrefilled();
  });

  it('TS-23: sin context el cliente se completa desde el proyecto', async () => {
    render(<DocsPanel scope={{ projectId: 43 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo documento en este proyecto' }));
    expectPrefilled();
  });
});
