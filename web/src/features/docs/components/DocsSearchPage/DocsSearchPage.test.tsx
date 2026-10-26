import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModule } from '../../hooks/useModules';
import { listDocuments, searchDocuments } from '../../services/docsApi';
import { DocsSearchPage } from './DocsSearchPage';

const replace = vi.fn();
const push = vi.fn();
let params = new URLSearchParams();

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => params,
}));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 'sub-yo', name: 'Yo' }),
}));
vi.mock('../../services/docsApi', () => ({
  listDocuments: vi.fn(),
  searchDocuments: vi.fn(),
  getDocsSuggestions: vi.fn(),
  getSuggestedRelations: vi.fn(),
  updateRelations: vi.fn(),
}));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('../NewDocumentDialog', () => ({
  NewDocumentDialog: ({ open, initial }: { open: boolean; initial?: unknown }) =>
    open ? (
      <div role="dialog" data-initial={JSON.stringify(initial ?? null)}>
        nuevo
      </div>
    ) : null,
}));
vi.mock('@/features/projects/hooks/useProject', () => ({
  useProject: () => ({ data: { name: 'Videoconferencia' } }),
}));
vi.mock('@/features/clients/hooks/useClient', () => ({
  useClient: () => ({ data: { name: 'EXO' } }),
}));
vi.mock('@/features/auth/hooks/usePersons', () => ({ usePersons: () => ({ data: [] }) }));
vi.mock('@/features/requirements/hooks/useRequirement', () => ({
  useRequirement: () => ({ data: { title: 'Videollamadas' } }),
}));
vi.mock('@/features/objectives/hooks/useObjective', () => ({
  useObjective: () => ({ data: { title: 'Migrar video' } }),
}));
vi.mock('@/features/projects/hooks/useProjects', () => ({ useProjects: () => ({ data: [] }) }));

const ID_A = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const ID_B = '01J9Z3K8M2Q4R6T8V0W2Y4A6D0';
const DOC_A = {
  id: ID_A,
  title: 'Arquitectura de videoconferencia',
  version: 6,
  visibility: 'internal',
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-ana',
  updatedByName: 'Ana Pérez',
  clients: [4],
  projects: [12],
  clientRefs: [{ id: 4, name: 'EXO' }],
  projectRefs: [{ id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4 }],
  topics: [],
  lock: null,
};
const DOC_B = {
  ...DOC_A,
  id: ID_B,
  title: 'Notas de reunión',
  visibility: 'public',
  updatedByName: null,
  updatedBy: 'sub-bot',
  clientRefs: [],
  projectRefs: [],
  clients: [],
  projects: [],
};

const page = (items: unknown[], extra: object = {}) =>
  ({ ok: true, data: { items, page: { limit: 20, returned: items.length, ...extra } } }) as never;

function renderPage(qs = '') {
  params = new URLSearchParams(qs);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <DocsSearchPage />
      </QueryClientProvider>
    ),
  };
}

describe('DocsSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useModule).mockReturnValue({ status: 'available', sharing: false, isKnown: true });
  });

  it('TS-30: inicio', async () => {
    vi.mocked(listDocuments).mockImplementation(async (f) =>
      f.myActiveProjects ? page([DOC_A]) : page([DOC_A, DOC_B])
    );
    renderPage();
    expect(await screen.findByText('En mis proyectos activos')).toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledWith({
      myActiveProjects: true,
      sort: '-updatedAt',
      limit: 5,
    });
    expect(listDocuments).toHaveBeenCalledWith({ sort: '-updatedAt', limit: 20 });
    expect(screen.getByText('Editados recientemente')).toBeInTheDocument();
    expect(screen.getByText('Sin cliente · Sin proyecto')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Visibilidad' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Ordenar por' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Documentación' })).toBeInTheDocument();
  });

  it('TS-31: si "mis proyectos" falla, solo se ve "Editados recientemente"', async () => {
    vi.mocked(listDocuments).mockImplementation(async (f) =>
      f.myActiveProjects
        ? ({ ok: false, error: { code: 'internal_error', message: 'x', status: 500 } } as never)
        : page([DOC_A])
    );
    renderPage();
    expect(await screen.findByText('Editados recientemente')).toBeInTheDocument();
    expect(screen.queryByText('En mis proyectos activos')).not.toBeInTheDocument();
  });

  it('TS-32: búsqueda de texto', async () => {
    vi.mocked(searchDocuments).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            documentId: ID_A,
            version: 6,
            title: DOC_A.title,
            path: '/x.md',
            headingPath: [],
            snippet: '…la <b>arquitectura</b> del…',
            score: 1,
            updatedAt: DOC_A.updatedAt,
            updatedBy: 'sub-ana',
            updatedByName: 'Ana Pérez',
          },
        ],
      },
    });
    renderPage('q=arquitectura');
    expect(
      await screen.findByRole('columnheader', { name: 'Documento · 1 de 1' })
    ).toBeInTheDocument();
    expect(searchDocuments).toHaveBeenCalledWith({ q: 'arquitectura', limit: 50 });
    expect(screen.getByRole('radio', { name: 'Relevancia' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Más recientes' })).toBeInTheDocument();
  });

  it('TS-34: listado con conteo y siguiente página', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      ...DOC_A,
      id: `id${i}`,
      title: `D${i}`,
    }));
    vi.mocked(listDocuments).mockResolvedValue(page(items, { cursor: 'c1', total: 45 }));
    renderPage('cliente=4');
    expect(
      await screen.findByRole('columnheader', { name: 'Documento · 20 de 45' })
    ).toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledWith({
      clientId: [4],
      sort: '-updatedAt',
      limit: 20,
      count: true,
    });
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(replace).toHaveBeenCalledWith('/docs?cliente=4&pagina=2', { scroll: false });
  });

  it('TS-18: una página inexistente se corrige a la última', async () => {
    vi.mocked(listDocuments)
      .mockResolvedValueOnce(page([DOC_A], { cursor: 'c1', total: 21 }))
      .mockResolvedValueOnce(page([DOC_B], { total: 21 }));
    renderPage('cliente=4&pagina=5');
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/docs?cliente=4&pagina=2', { scroll: false })
    );
  });

  it('TS-36: filtrado desde una ficha', async () => {
    vi.mocked(listDocuments).mockResolvedValue(page([DOC_A], { total: 1 }));
    const { unmount } = renderPage('proyecto=12&origen=proyecto');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Documentos · Videoconferencia' })
    ).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Temas' })).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Cliente · Proyecto' })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Volver al proyecto/ }));
    expect(push).toHaveBeenCalledWith('/projects/12');
    unmount();

    const second = renderPage('requisito=5&origen=requisito');
    await userEvent.click(await screen.findByRole('button', { name: /Volver al requisito/ }));
    expect(push).toHaveBeenLastCalledWith('/requirements/5');
    second.unmount();

    renderPage('tarea=7&origen=tarea');
    await userEvent.click(await screen.findByRole('button', { name: /Volver a la tarea/ }));
    expect(push).toHaveBeenLastCalledWith('/objectives/7');
  });

  it('TS-36: el destino de "Volver" nunca sale de la query', async () => {
    vi.mocked(listDocuments).mockResolvedValue(page([], { total: 0 }));
    renderPage('proyecto=12&origen=proyecto&volver=https://evil.example');
    await userEvent.click(await screen.findByRole('button', { name: /Volver al proyecto/ }));
    expect(push).toHaveBeenCalledWith('/projects/12');
  });

  it('sin el token de origen no hay botón Volver y el título es "Documentación"', async () => {
    vi.mocked(listDocuments).mockResolvedValue(page([DOC_A], { total: 1 }));
    renderPage('origen=proyecto&tema=video');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Documentación' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Volver/ })).not.toBeInTheDocument();
  });

  it('TS-39: orden y visibilidad escriben la URL sin página', async () => {
    vi.mocked(listDocuments).mockResolvedValue(page([DOC_A], { total: 1 }));
    renderPage('cliente=4&pagina=2');
    await userEvent.click(await screen.findByRole('radio', { name: 'A–Z' }));
    expect(replace).toHaveBeenLastCalledWith('/docs?cliente=4&orden=az', { scroll: false });
    await userEvent.click(screen.getByRole('radio', { name: 'Visibles para el cliente' }));
    expect(replace).toHaveBeenLastCalledWith('/docs?cliente=4&publico=1', { scroll: false });
  });

  it('TS-39: con orden=az pide sort title', async () => {
    vi.mocked(listDocuments).mockResolvedValue(page([DOC_A], { total: 1 }));
    renderPage('cliente=4&orden=az');
    await screen.findByRole('columnheader', { name: /Documento/ });
    expect(listDocuments).toHaveBeenCalledWith(expect.objectContaining({ sort: 'title' }));
  });

  it('TS-46: vista sin proyecto', async () => {
    vi.mocked(listDocuments).mockResolvedValue(page([DOC_B], { total: 1 }));
    renderPage('sinProyecto=1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sin proyecto' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Documentos que todavía no están vinculados a un proyecto/)
    ).toBeInTheDocument();
    for (const name of ['Documento · 1 de 1', 'Cliente', 'Actualizado', 'Acción']) {
      expect(await screen.findByRole('columnheader', { name })).toBeInTheDocument();
    }
    expect(screen.getByText(/Escribí «sin» para encontrar/)).toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledWith({
      hasProject: false,
      sort: '-updatedAt',
      limit: 20,
      count: true,
    });
  });

  it('TS-48: módulo no disponible', () => {
    vi.mocked(useModule).mockReturnValue({ status: 'unavailable', sharing: false, isKnown: true });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.'
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(
      screen
        .getAllByRole('radio')
        .every(
          (r) => (r as HTMLInputElement).disabled || r.getAttribute('aria-disabled') === 'true'
        )
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Nuevo documento' })).toBeDisabled();
    expect(screen.queryByRole('radiogroup', { name: 'Ordenar por' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Enter/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(listDocuments).not.toHaveBeenCalled();
    expect(searchDocuments).not.toHaveBeenCalled();
  });

  it('TS-49: module_unavailable en una consulta invalida los módulos', async () => {
    vi.mocked(listDocuments).mockResolvedValue({
      ok: false,
      error: { code: 'module_unavailable', message: 'x', status: 503 },
    });
    const { client } = renderPage('cliente=4');
    const spy = vi.spyOn(client, 'invalidateQueries');
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['modules'] }));
  });

  it('"Nuevo documento" abre el diálogo', async () => {
    vi.mocked(listDocuments).mockResolvedValue(page([], { total: 0 }));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo documento' }));
    expect(within(screen.getByRole('dialog')).getByText('nuevo')).toBeInTheDocument();
  });

  it('TS-33: el diálogo recibe el filtro de origen como `initial`', async () => {
    vi.mocked(listDocuments).mockResolvedValue(page([], { total: 0 }));
    const first = renderPage('proyecto=12&origen=proyecto');
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo documento' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-initial', '{"projectId":12}');
    first.unmount();

    renderPage('cliente=4');
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo documento' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-initial', '{"clientId":4}');
  });

  it('TS-33: sin filtros el diálogo no recibe `initial`', async () => {
    vi.mocked(listDocuments).mockResolvedValue(page([], { total: 0 }));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo documento' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-initial', 'null');
  });

  it('con el módulo no instalado no se pinta nada', () => {
    vi.mocked(useModule).mockReturnValue({
      status: 'not_installed',
      sharing: false,
      isKnown: false,
    });
    const { container } = renderPage();
    expect(container).toBeEmptyDOMElement();
  });
});
