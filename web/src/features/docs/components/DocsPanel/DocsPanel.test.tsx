import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDocuments } from '../../hooks/useDocuments';
import { useModule } from '../../hooks/useModules';
import { DocsPanel } from './DocsPanel';
import type { DocsDocument } from '../../types/docs.types';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../hooks/useDocuments', () => ({ useDocuments: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('@/features/auth/hooks/usePersons', () => ({
  usePersons: vi.fn(() => ({
    data: [{ userId: 'sub-ana', firstName: 'Ana', lastName: 'Gómez' }],
  })),
}));

const ID_A = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const DOC_A = {
  id: ID_A,
  title: 'Arquitectura',
  path: '/clientes/acme/arquitectura.md',
  folderId: '01J9Z3K8M2Q4R6T8V0W2Y4A6F0',
  fileName: 'arquitectura.md',
  version: 6,
  visibility: 'internal',
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-ana',
  lock: null,
} as unknown as DocsDocument;
const DOC_B = {
  ...DOC_A,
  id: '01J9Z3K8M2Q4R6T8V0W2Y4A6C9',
  title: 'Runbook',
  path: '/ops/runbook.md',
  fileName: 'runbook.md',
  updatedAt: '2026-10-20T09:00:00.000Z',
} as DocsDocument;

const queryResult = (over: Record<string, unknown> = {}) => ({
  data: { pages: [{ items: [DOC_A, DOC_B], page: { limit: 10, returned: 2 } }] },
  isLoading: false,
  isError: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  isFetchingNextPage: false,
  ...over,
});

const setModule = (status: 'not_installed' | 'unavailable' | 'available') =>
  vi.mocked(useModule).mockReturnValue({ status, sharing: false, isKnown: true });
const setQuery = (over?: Record<string, unknown>) =>
  vi.mocked(useDocuments).mockReturnValue(queryResult(over) as never);

describe('DocsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setModule('available');
    setQuery();
  });
  afterEach(() => vi.useRealTimers());

  it('TS-18: sin módulo no se renderiza y no consulta', () => {
    setModule('not_installed');
    const { container } = render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('heading', { name: 'Documentación' })).toBeNull();
    expect(useDocuments).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('TS-19: card con documentos', () => {
    render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Documentación' })).toBeInTheDocument();
    for (const name of ['Documento', 'Ruta', 'Actualizado']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByRole('link', { name: 'Arquitectura' })).toHaveAttribute(
      'href',
      `/docs/${ID_A}`
    );
    expect(within(rows[0]).getByText('/clientes/acme/')).toBeInTheDocument();
    expect(within(rows[0]).getByText('24/10/2026')).toBeInTheDocument();
    expect(within(rows[1]).getByRole('link', { name: 'Runbook' })).toBeInTheDocument();
    expect(within(rows[1]).getByText('/ops/')).toBeInTheDocument();
    expect(within(rows[1]).getByText('20/10/2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('TS-20: documento sin título usa el nombre de archivo', () => {
    setQuery({ data: { pages: [{ items: [{ ...DOC_A, title: '' }], page: {} }] } });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByRole('link', { name: 'arquitectura' })).toBeInTheDocument();
  });

  it('TS-21: documento en la raíz muestra "/"', () => {
    setQuery({
      data: {
        pages: [{ items: [{ ...DOC_A, path: '/leeme.md', fileName: 'leeme.md' }], page: {} }],
      },
    });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByText('/', { selector: 'td, td *' })).toBeInTheDocument();
  });

  describe('marca En edición', () => {
    const lockOf = (holder: string, expiresAt: string) =>
      ({ sessionId: 's', holder, via: 'human', expiresAt }) as const;

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-24T14:00:00Z'));
    });

    it('TS-22: lock vigente', () => {
      setQuery({
        data: {
          pages: [
            {
              items: [{ ...DOC_A, lock: lockOf('sub-ana', '2026-10-24T14:02:00.000Z') }],
              page: {},
            },
          ],
        },
      });
      render(<DocsPanel scope={{ projectId: 12 }} />);
      expect(screen.getByText('En edición')).toBeInTheDocument();
      expect(screen.getByText('Ana Gómez lo está editando')).toBeInTheDocument();
    });

    it('TS-23: lock vencido no marca; holder desconocido usa "otra persona"', () => {
      setQuery({
        data: {
          pages: [
            {
              items: [{ ...DOC_A, lock: lockOf('sub-ana', '2026-10-24T13:59:00.000Z') }],
              page: {},
            },
          ],
        },
      });
      const { unmount } = render(<DocsPanel scope={{ projectId: 12 }} />);
      expect(screen.queryByText('En edición')).toBeNull();
      unmount();

      setQuery({
        data: {
          pages: [
            {
              items: [{ ...DOC_A, lock: lockOf('sub-desconocido', '2026-10-24T14:02:00.000Z') }],
              page: {},
            },
          ],
        },
      });
      render(<DocsPanel scope={{ projectId: 12 }} />);
      expect(screen.getByText('En edición')).toBeInTheDocument();
      expect(screen.getByText('otra persona lo está editando')).toBeInTheDocument();
    });
  });

  it.each([
    [{ projectId: 12 }, 'No hay documentos vinculados a este proyecto.'],
    [{ requirementId: 45 }, 'No hay documentos vinculados a este requisito.'],
    [{ taskId: 7 }, 'No hay documentos vinculados a esta tarea.'],
  ])('TS-24: vacío por entidad %o', (scope, message) => {
    setQuery({ data: { pages: [{ items: [], page: { limit: 10, returned: 0 } }] } });
    render(<DocsPanel scope={scope} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('TS-25: cargando', () => {
    setQuery({ isLoading: true, data: undefined });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Documentación' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('TS-26: módulo caído muestra el aviso y deshabilita la consulta', () => {
    setModule('unavailable');
    setQuery({ data: undefined });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByRole('heading', { name: 'Documentación' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.'
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
    expect(useDocuments).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('TS-27: error de la query muestra el mismo aviso', () => {
    setQuery({ isError: true, data: undefined });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.'
    );
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('TS-28: Ver más pide la página siguiente', async () => {
    const fetchNextPage = vi.fn();
    setQuery({ hasNextPage: true, fetchNextPage });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('TS-28: Ver más en loading mientras trae la siguiente', () => {
    setQuery({ hasNextPage: true, isFetchingNextPage: true });
    render(<DocsPanel scope={{ projectId: 12 }} />);
    const button = screen.getByRole('button', { name: 'Ver más' });
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it.each([[{ requirementId: 45 }], [{ taskId: 7 }]])('TS-29: filtra por %o', (scope) => {
    render(<DocsPanel scope={scope} />);
    expect(useDocuments).toHaveBeenCalledWith({ filters: scope, enabled: true });
  });
});
