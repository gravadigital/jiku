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
vi.mock('@/features/clients', () => ({ useClients: () => ({ data: [{ id: 4, name: 'EXO' }] }) }));
vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [{ id: 12, name: 'Videoconferencia', client: { id: 4, name: 'EXO' } }],
  }),
}));

describe('DocsPanel con el diálogo real', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useModule).mockReturnValue({ status: 'available', sharing: false, isKnown: true });
    vi.mocked(useDocsCard).mockReturnValue(queryResult() as never);
    setMutation();
    setRole(false);
  });

  it('TS-21: el alta llega con las relaciones de la card y devuelve el foco', async () => {
    render(<DocsPanel scope={{ projectId: 12 }} />);
    const trigger = screen.getByRole('button', { name: 'Nuevo documento en este proyecto' });
    await userEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Nuevo documento' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('EXO');
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toHaveTextContent(
      'Videoconferencia · EXO'
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(trigger).toHaveFocus();
  });
});
