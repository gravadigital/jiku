import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocsCard } from '../../hooks/useDocsCard';
import { useModule } from '../../hooks/useModules';
import { DocsPanel } from './DocsPanel';
import { DOC_A, DOC_B, ID_A, PAGE, queryResult } from './panelFixtures';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../hooks/useDocsCard', () => ({ useDocsCard: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('../NewDocumentDialog', () => ({
  NewDocumentDialog: () => <div data-testid="new-doc" />,
}));

const UNAVAILABLE =
  'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.';

const setModule = (status: 'not_installed' | 'unavailable' | 'available') =>
  vi.mocked(useModule).mockReturnValue({ status, sharing: false, isKnown: true });
const setQuery = (over?: Record<string, unknown>) =>
  vi.mocked(useDocsCard).mockReturnValue(queryResult(over) as never);

describe('DocsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setModule('available');
    setQuery();
  });

  it('TS-12: sin módulo no se renderiza, no consulta y no monta el diálogo', () => {
    setModule('not_installed');
    const { container } = render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('heading', { name: 'Documentación' })).toBeNull();
    expect(useDocsCard).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(screen.queryByTestId('new-doc')).toBeNull();
  });

  it('TS-13: card de proyecto con documentos, sin tabla ni ruta', () => {
    render(<DocsPanel scope={{ projectId: 12 }} context={{ clientId: 4 }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Documentación 2' })).toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Documentos vinculados' })).getAllByRole(
      'listitem'
    );
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole('link', { name: DOC_A.title })).toHaveAttribute(
      'href',
      `/docs/${ID_A}`
    );
    expect(within(items[1]!).getByRole('link', { name: DOC_B.title })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Ruta' })).toBeNull();
    expect(screen.queryByText('/clientes/exo/videoconferencia/')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
    expect(screen.queryByText('En edición')).toBeNull();
  });

  it('TS-14: cantidad exacta y "N+"', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ ...DOC_A, id: `id-${i}` }));
    setQuery({ data: { items: five, page: { limit: 5, returned: 5, total: 12 } } });
    const { unmount } = render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Documentación 12' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    unmount();

    setQuery({ data: { items: five, page: { limit: 5, returned: 5, cursor: 'c1' } } });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Documentación 5+' })).toBeInTheDocument();
  });

  it('TS-15: marca indirecta en la card de proyecto', () => {
    render(<DocsPanel scope={{ projectId: 12 }} />);
    const [rowA, rowB] = screen.getAllByRole('listitem');
    expect(rowB).toHaveTextContent('Sin tema · vinculado, sin proyecto propio');
    expect(rowB).toHaveTextContent('20/10/2026');
    expect(rowA).toHaveTextContent('video');
    expect(rowA).toHaveTextContent('arquitectura');
    expect(rowA).toHaveTextContent('24/10/2026');
    expect(rowA).not.toHaveTextContent('vinculado, sin proyecto propio');
  });

  it.each([[{ requirementId: 45 }], [{ taskId: 7 }]])(
    'TS-16: %o sin marca indirecta ni rutas',
    (scope) => {
      render(<DocsPanel scope={scope} />);
      const rows = screen.getAllByRole('listitem');
      expect(rows[1]).toHaveTextContent('Sin tema');
      expect(rows[1]).not.toHaveTextContent('vinculado, sin proyecto propio');
      expect(screen.queryByRole('table')).toBeNull();
    }
  );

  it('TS-11: título largo sin espacios no genera tabla ni ruta', () => {
    const long = 'x'.repeat(180);
    setQuery({ data: { ...PAGE, items: [{ ...DOC_A, title: long }] } });
    const { container } = render(<DocsPanel scope={{ requirementId: 45 }} />);
    expect(screen.getByRole('link', { name: long })).toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();
    expect(screen.queryByRole('columnheader')).toBeNull();
    expect(container.textContent).not.toMatch(/(^|\s)\//);
  });

  it.each([
    [{ projectId: 12 }, 'No hay documentos vinculados a este proyecto.'],
    [{ requirementId: 45 }, 'No hay documentos vinculados a este requisito.'],
    [{ taskId: 7 }, 'No hay documentos vinculados a esta tarea.'],
  ])('TS-22: vacío por entidad %o', (scope, message) => {
    setQuery({ data: { items: [], page: { limit: 5, returned: 0, total: 0 } } });
    render(<DocsPanel scope={scope} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Documentación 0' })).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('button', { name: /^Nuevo documento en/ })).toBeEnabled();
    expect(screen.queryByRole('link', { name: 'Ver todos' })).toBeNull();
  });

  it('TS-23: cargando', () => {
    setQuery({ isLoading: true, data: undefined });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Documentación' })).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('button', { name: /^Nuevo documento en/ })).toBeEnabled();
    expect(screen.queryByRole('link', { name: 'Ver todos' })).toBeNull();
  });

  it('TS-24: módulo caído', () => {
    setModule('unavailable');
    setQuery({ data: undefined });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Documentación' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(UNAVAILABLE);
    expect(screen.getByRole('button', { name: 'Nuevo documento en este proyecto' })).toBeDisabled();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ver todos' })).toBeNull();
    expect(useDocsCard).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('TS-25: error de la consulta', () => {
    setQuery({ isError: true, data: undefined });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(UNAVAILABLE);
    expect(screen.getByRole('button', { name: 'Nuevo documento en este proyecto' })).toBeDisabled();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ver todos' })).toBeNull();
  });

  it('TS-26: filtros por scope', () => {
    const base = { count: true, sort: '-updatedAt', limit: 5 };
    const { unmount } = render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(useDocsCard).toHaveBeenLastCalledWith({
      filters: { projectId: [12], ...base },
      enabled: true,
    });
    unmount();
    const second = render(<DocsPanel scope={{ requirementId: 45 }} />);
    expect(useDocsCard).toHaveBeenLastCalledWith({
      filters: { requirementId: 45, ...base },
      enabled: true,
    });
    second.unmount();
    render(<DocsPanel scope={{ taskId: 7 }} />);
    expect(useDocsCard).toHaveBeenLastCalledWith({
      filters: { taskId: 7, ...base },
      enabled: true,
    });
  });
});
