import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSuggestedRelations } from '../../hooks/useSuggestedRelations';
import { updateDocument, updateRelations } from '../../services/docsApi';
import { AssignProjectAction, SuggestedProjectLine } from './AssignProjectAction';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock('../../services/docsApi', () => ({ updateRelations: vi.fn(), updateDocument: vi.fn() }));
vi.mock('../../hooks/useSuggestedRelations', () => ({ useSuggestedRelations: vi.fn() }));
vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [
      { id: 12, name: 'Videoconferencia', code: 'VID', client: { id: 4, name: 'EXO' } },
      { id: 31, name: 'Portal', code: 'POR', client: { id: 2, name: 'ACME' } },
    ],
  }),
}));

const ID_B = '01J9Z3K8M2Q4R6T8V0W2Y4A6D0';
const ITEM = { id: ID_B, version: 3, title: 'Notas de reunión' };
const CANDIDATE = {
  projectId: 12,
  clientId: 4,
  score: 0.82,
  reason: 'Menciona «Videoconferencia» 4 veces',
  projectName: 'Videoconferencia',
  projectCode: 'VID',
  clientName: 'EXO',
};

const suggestions = (items: unknown[], extra: object = {}) =>
  vi.mocked(useSuggestedRelations).mockReturnValue({ data: { items }, isLoading: false, ...extra } as never);

function renderAction() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SuggestedProjectLine id={ITEM.id} />
      <AssignProjectAction item={ITEM} />
    </QueryClientProvider>
  );
}

const OK = {
  ok: true as const,
  data: { id: ID_B, version: 4, relations: { clients: [4], projects: [12], requirements: [], tasks: [] } },
};

describe('AssignProjectAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-40: asignar sugerido', async () => {
    suggestions([CANDIDATE]);
    vi.mocked(updateRelations).mockResolvedValue(OK);
    renderAction();
    expect(screen.getByText(/Sugerido: Videoconferencia/)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Asignar sugerido' });
    expect(button).toHaveAccessibleDescription('Menciona «Videoconferencia» 4 veces');
    await userEvent.click(button);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Asignaste «Videoconferencia» a «Notas de reunión».')
    );
    expect(updateRelations).toHaveBeenCalledWith(ID_B, {
      baseVersion: 3,
      add: { projects: [12] },
    });
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it('TS-41: sin candidato, con candidato solo de cliente o con error → Asignar proyecto', () => {
    for (const setup of [
      () => suggestions([]),
      () => suggestions([{ ...CANDIDATE, projectId: null }]),
      () => vi.mocked(useSuggestedRelations).mockReturnValue({ isError: true, isLoading: false } as never),
    ]) {
      setup();
      const { unmount } = renderAction();
      expect(screen.getByRole('button', { name: 'Asignar proyecto' })).toBeInTheDocument();
      expect(screen.queryByText(/Sugerido:/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('TS-42: asignar con el selector', async () => {
    suggestions([]);
    vi.mocked(updateRelations).mockResolvedValue(OK);
    renderAction();
    await userEvent.click(screen.getByRole('button', { name: 'Asignar proyecto' }));
    const combobox = await screen.findByRole('combobox', { name: 'Proyecto' });
    await waitFor(() => expect(combobox).toHaveAttribute('aria-expanded', 'true'));
    await userEvent.click(screen.getByRole('option', { name: 'Videoconferencia · EXO' }));
    await waitFor(() =>
      expect(updateRelations).toHaveBeenCalledWith(ID_B, {
        baseVersion: 3,
        add: { projects: [12] },
      })
    );
  });

  it('TS-42: Escape vuelve al botón sin asignar', async () => {
    suggestions([]);
    renderAction();
    await userEvent.click(screen.getByRole('button', { name: 'Asignar proyecto' }));
    await screen.findByRole('combobox', { name: 'Proyecto' });
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: 'Asignar proyecto' })).toBeInTheDocument();
    expect(updateRelations).not.toHaveBeenCalled();
  });

  it('TS-43: conflicto de versión', async () => {
    suggestions([CANDIDATE]);
    vi.mocked(updateRelations).mockResolvedValue({
      ok: false,
      error: { code: 'version_conflict', message: 'x', status: 409, details: { currentVersion: 5 } },
    });
    renderAction();
    await userEvent.click(screen.getByRole('button', { name: 'Asignar sugerido' }));
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith('El documento cambió; se actualizó la fila.')
    );
  });

  it('TS-44: otros errores', async () => {
    suggestions([CANDIDATE]);
    const cases: Array<[object, string]> = [
      [
        { code: 'document_locked', message: 'x', status: 409, details: { holderName: 'Luis Gómez' } },
        'Luis Gómez lo está editando; probá en unos minutos.',
      ],
      [{ code: 'invalid_relation', message: 'x', status: 400 }, 'Ese proyecto no se puede asignar.'],
      [
        { code: 'gateway_timeout', message: 'x', status: 504 },
        'No se pudo asignar el proyecto. Intentá de nuevo.',
      ],
    ];
    for (const [error, message] of cases) {
      vi.mocked(updateRelations).mockResolvedValueOnce({ ok: false, error } as never);
      const { unmount } = renderAction();
      await userEvent.click(screen.getByRole('button', { name: 'Asignar sugerido' }));
      await waitFor(() => expect(toast.error).toHaveBeenLastCalledWith(message));
      unmount();
    }
  });

  it('TS-45: mientras asigna, el botón de la fila está deshabilitado', async () => {
    suggestions([CANDIDATE]);
    vi.mocked(updateRelations).mockReturnValue(new Promise(() => undefined));
    renderAction();
    await userEvent.click(screen.getByRole('button', { name: 'Asignar sugerido' }));
    const busy = await screen.findByRole('button', { name: 'Asignar sugerido' });
    await waitFor(() => expect(busy).toBeDisabled());
    expect(busy).toHaveAttribute('aria-busy', 'true');
  });
});
