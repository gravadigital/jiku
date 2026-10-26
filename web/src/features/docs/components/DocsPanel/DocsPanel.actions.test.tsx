import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocsCard } from '../../hooks/useDocsCard';
import { useModule } from '../../hooks/useModules';
import { DocsPanel } from './DocsPanel';
import { queryResult } from './panelFixtures';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../hooks/useDocsCard', () => ({ useDocsCard: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('../NewDocumentDialog', () => ({
  NewDocumentDialog: (p: { open: boolean; initial?: unknown; onClose: () => void }) => (
    <div data-testid="new-doc" data-open={String(p.open)} data-initial={JSON.stringify(p.initial)}>
      <button type="button" onClick={p.onClose}>
        cerrar
      </button>
    </div>
  ),
}));

describe('DocsPanel — "+" y "Ver todos"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useModule).mockReturnValue({ status: 'available', sharing: false, isKnown: true });
    vi.mocked(useDocsCard).mockReturnValue(queryResult() as never);
  });

  it.each([
    [{ projectId: 12 }, '/docs?proyecto=12&origen=proyecto'],
    [{ requirementId: 45 }, '/docs?requisito=45&origen=requisito'],
    [{ taskId: 7 }, '/docs?tarea=7&origen=tarea'],
  ])('TS-17: "Ver todos" de %o', (scope, href) => {
    const { container } = render(<DocsPanel scope={scope} />);
    expect(screen.getByRole('link', { name: 'Ver todos' })).toHaveAttribute('href', href);
    expect(container.querySelector('a[href^="/docs?"] span[aria-hidden="true"]')).toHaveTextContent(
      '›'
    );
  });

  it('TS-18: "Ver todos" oculto sin documentos, cargando, caído o con error', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['available', { data: { items: [], page: { limit: 5, returned: 0, total: 0 } } }],
      ['available', { isLoading: true, data: undefined }],
      ['unavailable', { data: undefined }],
      ['available', { isError: true, data: undefined }],
    ];
    for (const [status, over] of cases) {
      vi.mocked(useModule).mockReturnValue({
        status: status as 'available',
        sharing: false,
        isKnown: true,
      });
      vi.mocked(useDocsCard).mockReturnValue(queryResult(over) as never);
      const { unmount } = render(<DocsPanel scope={{ projectId: 12 }} />);
      expect(screen.queryByRole('link', { name: 'Ver todos' })).toBeNull();
      unmount();
    }
  });

  it('TS-19: "+" de proyecto abre el alta con proyecto y cliente', async () => {
    render(<DocsPanel scope={{ projectId: 12 }} context={{ clientId: 4 }} />);
    const button = screen.getByRole('button', { name: 'Nuevo documento en este proyecto' });
    expect(button.querySelector('[aria-hidden="true"]')).toHaveTextContent('+');
    expect(screen.getByTestId('new-doc')).toHaveAttribute('data-open', 'false');

    await userEvent.click(button);
    const dialog = screen.getByTestId('new-doc');
    expect(dialog).toHaveAttribute('data-open', 'true');
    expect(JSON.parse(dialog.dataset.initial!)).toEqual({ projectId: 12, clientId: 4 });

    await userEvent.click(screen.getByRole('button', { name: 'cerrar' }));
    expect(screen.getByTestId('new-doc')).toHaveAttribute('data-open', 'false');
  });

  it('TS-20: "+" de requisito y de tarea', async () => {
    const { unmount } = render(
      <DocsPanel
        scope={{ requirementId: 45 }}
        context={{ projectId: 12, title: 'Login con SSO' }}
      />
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Nuevo documento en este requisito' })
    );
    expect(JSON.parse(screen.getByTestId('new-doc').dataset.initial!)).toEqual({
      projectId: 12,
      requirement: { id: 45, title: 'Login con SSO' },
    });
    unmount();

    render(
      <DocsPanel
        scope={{ taskId: 7 }}
        context={{ projectId: 7, title: 'Migrar el header a ViewHeader' }}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo documento en esta tarea' }));
    expect(JSON.parse(screen.getByTestId('new-doc').dataset.initial!)).toEqual({
      projectId: 7,
      task: { id: 7, title: 'Migrar el header a ViewHeader' },
    });
  });
});
