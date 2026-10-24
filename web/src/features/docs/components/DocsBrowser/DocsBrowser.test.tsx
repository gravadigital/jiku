import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDocsSearch } from '../../hooks/useDocsSearch';
import { useFolderContents } from '../../hooks/useFolderContents';
import { useFolderTrail } from '../../hooks/useFolderTrail';
import { useModule } from '../../hooks/useModules';
import { useRootFolders } from '../../hooks/useRootFolders';
import { DocsBrowser } from './DocsBrowser';

const replace = vi.fn();
let params = new URLSearchParams();

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => params,
}));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('../../hooks/useFolderTrail', () => ({ useFolderTrail: vi.fn() }));
vi.mock('../../hooks/useRootFolders', () => ({ useRootFolders: vi.fn() }));
vi.mock('../../hooks/useFolderContents', () => ({ useFolderContents: vi.fn() }));
vi.mock('../../hooks/useDocsSearch', () => ({ useDocsSearch: vi.fn(), MIN_SEARCH_LENGTH: 2 }));
vi.mock('../NewDocumentDialog', () => ({
  NewDocumentDialog: ({ open, folder }: { open: boolean; folder: { path: string } }) =>
    open ? <div role="dialog">{folder.path}</div> : null,
}));
vi.mock('@/features/auth/hooks/usePersons', () => ({
  usePersons: vi.fn(() => ({ data: [{ userId: 'sub-ana', firstName: 'Ana', lastName: 'Gómez' }] })),
}));

const F0 = '01J9Z3K8M2Q4R6T8V0W2Y4A6F0';
const F1 = '01J9Z3K8M2Q4R6T8V0W2Y4A6F1';
const F4 = '01J9Z3K8M2Q4R6T8V0W2Y4A6F4';
const DOC_ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const UNAVAILABLE =
  'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.';

const folder = (id: string, name: string, permission: string | null = 'write') => ({
  id,
  name,
  path: `/clientes/${name}/`,
  parentId: F1,
  effectivePermission: permission,
});
const FOLDER_ACME = folder(F0, 'acme');
const DOC = {
  id: DOC_ID,
  title: 'Arquitectura',
  path: '/clientes/acme/arquitectura.md',
  fileName: 'arquitectura.md',
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-ana',
  lock: null,
};

const setTrail = (over: Record<string, unknown> = {}) =>
  vi.mocked(useFolderTrail).mockReturnValue({
    data: {
      folder: FOLDER_ACME,
      trail: [
        { id: F1, name: 'clientes' },
        { id: F0, name: 'acme' },
      ],
    },
    isLoading: false,
    isError: false,
    error: null,
    ...over,
  } as never);
const setContents = (over: Record<string, unknown> = {}) =>
  vi.mocked(useFolderContents).mockReturnValue({
    data: {
      pages: [{ folders: [{ ...folder(F4, 'specs') }], documents: [DOC] }],
    },
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
    ...over,
  } as never);
const setSearch = (over: Record<string, unknown> = {}) =>
  vi.mocked(useDocsSearch).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...over,
  } as never);

describe('DocsBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams({ folder: F0 });
    vi.mocked(useModule).mockReturnValue({ status: 'available', sharing: false, isKnown: true });
    vi.mocked(useRootFolders).mockReturnValue({
      data: { root: null, tops: [] },
      isLoading: false,
      isError: false,
    } as never);
    setTrail();
    setContents();
    setSearch();
  });
  afterEach(() => vi.useRealTimers());

  it('TS-48: carpeta con contenido, breadcrumb y botón', () => {
    render(<DocsBrowser />);
    expect(screen.getByRole('heading', { level: 1, name: 'Documentación' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Ruta de la carpeta' });
    expect(within(nav).getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/docs');
    expect(within(nav).getByRole('link', { name: 'clientes' })).toHaveAttribute(
      'href',
      `/docs?folder=${F1}`
    );
    expect(within(nav).queryByRole('link', { name: 'acme' })).toBeNull();
    expect(within(nav).getByText('acme')).toHaveAttribute('aria-current', 'page');
    for (const label of ['Nombre', 'Actualizado', 'Por']) {
      expect(screen.getByRole('columnheader', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'specs' })).toHaveAttribute(
      'href',
      `/docs?folder=${F4}`
    );
    expect(screen.getByRole('link', { name: 'Arquitectura' })).toHaveAttribute(
      'href',
      `/docs/${DOC_ID}`
    );
    expect(screen.getByText('24/10/2026 14:30')).toBeInTheDocument();
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nuevo documento/ })).toBeInTheDocument();
  });

  it('TS-49: "Por" desconocido y marca En edición con nombre accesible', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-24T14:00:00Z'));
    setContents({
      data: {
        pages: [
          {
            folders: [],
            documents: [
              {
                ...DOC,
                updatedBy: 'sub-x',
                lock: {
                  sessionId: 'S',
                  holder: 'sub-ana',
                  via: 'human',
                  expiresAt: '2026-10-24T14:02:00.000Z',
                },
              },
            ],
          },
        ],
      },
    });
    render(<DocsBrowser />);
    expect(screen.getByText('Otra persona')).toBeInTheDocument();
    expect(screen.getByText('En edición')).toBeInTheDocument();
    expect(screen.getByText('Ana Gómez lo está editando')).toBeInTheDocument();
  });

  it.each([
    ['read', false],
    [null, false],
    ['write', true],
    ['manage', true],
  ])('TS-50: permiso %s → botón %s', (permission, visible) => {
    setTrail({
      data: { folder: { ...FOLDER_ACME, effectivePermission: permission }, trail: [] },
    });
    render(<DocsBrowser />);
    expect(Boolean(screen.queryByRole('button', { name: /Nuevo documento/ }))).toBe(visible);
  });

  it('abre O-11 con la carpeta actual', async () => {
    render(<DocsBrowser />);
    await userEvent.click(screen.getByRole('button', { name: /Nuevo documento/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('/clientes/acme/');
  });

  it('TS-51: raíz sin "Nuevo documento" (con o sin raíz visible)', () => {
    params = new URLSearchParams();
    vi.mocked(useFolderTrail).mockReturnValue({ data: undefined } as never);
    vi.mocked(useRootFolders).mockReturnValue({
      data: { root: null, tops: [folder(F0, 'acme'), folder(F4, 'ops')] },
      isLoading: false,
      isError: false,
    } as never);
    setContents({ data: undefined });
    const { unmount } = render(<DocsBrowser />);
    expect(screen.queryByRole('link', { name: 'Inicio' })).toBeNull();
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'acme' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ops' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nuevo documento/ })).toBeNull();
    unmount();

    vi.mocked(useRootFolders).mockReturnValue({
      data: { root: { ...folder('R', ''), path: '/', effectivePermission: 'manage' }, tops: [] },
      isLoading: false,
      isError: false,
    } as never);
    setContents();
    render(<DocsBrowser />);
    expect(screen.queryByRole('button', { name: /Nuevo documento/ })).toBeNull();
  });

  it('TS-52: carpeta vacía según permiso', () => {
    setContents({ data: { pages: [{ folders: [], documents: [] }] } });
    const { unmount } = render(<DocsBrowser />);
    expect(
      screen.getByText('Esta carpeta está vacía. Creá el primer documento con «Nuevo documento».')
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    unmount();

    setTrail({ data: { folder: { ...FOLDER_ACME, effectivePermission: 'read' }, trail: [] } });
    render(<DocsBrowser />);
    expect(screen.getByText('Esta carpeta está vacía.')).toBeInTheDocument();
  });

  it('TS-53: cargando mantiene búsqueda y breadcrumb', () => {
    setContents({ data: undefined, isLoading: true });
    render(<DocsBrowser />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando documentación…');
    expect(screen.getByRole('textbox', { name: 'Buscar en la documentación' })).toBeEnabled();
    expect(screen.getByRole('navigation', { name: 'Ruta de la carpeta' })).toBeInTheDocument();
  });

  it('TS-54: Ver más', async () => {
    const fetchNextPage = vi.fn();
    setContents({ hasNextPage: true, fetchNextPage });
    const { unmount } = render(<DocsBrowser />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    unmount();

    setContents({ hasNextPage: true, isFetchingNextPage: true });
    render(<DocsBrowser />);
    expect(screen.getByRole('button', { name: /Ver más/ })).toHaveAttribute('aria-busy', 'true');
  });

  it.each([
    ['id mal formado', 'no-ulid', null],
    ['folder_not_found', F0, { code: 'folder_not_found', status: 404 }],
    ['permission_denied', F0, { code: 'permission_denied', status: 403 }],
  ])('TS-55: carpeta inexistente o sin permiso (%s)', (_name, folderParam, error) => {
    params = new URLSearchParams({ folder: folderParam });
    setTrail(error ? { data: undefined, isError: true, error } : { data: undefined });
    setContents({ data: undefined });
    render(<DocsBrowser />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Esta carpeta no existe o no tenés permiso para verla.'
    );
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: /Nuevo documento/ })).toBeNull();
    if (!error) {
      expect(vi.mocked(useFolderTrail).mock.calls[0][0].folderId).toBeUndefined();
    }
  });

  it('TS-56: error al listar y 403', () => {
    setContents({
      data: undefined,
      isError: true,
      error: { code: 'upstream_unavailable', status: 503 },
    });
    const { unmount } = render(<DocsBrowser />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo cargar la carpeta. Actualizá la página.'
    );
    expect(screen.queryByRole('table')).toBeNull();
    unmount();

    setContents({
      data: undefined,
      isError: true,
      error: { code: 'permission_denied', status: 403 },
    });
    render(<DocsBrowser />);
    expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para ver esta carpeta.');
  });

  it('TS-57: módulo caído', () => {
    vi.mocked(useModule).mockReturnValue({ status: 'unavailable', sharing: false, isKnown: true });
    render(<DocsBrowser />);
    expect(screen.getByRole('alert')).toHaveTextContent(UNAVAILABLE);
    expect(screen.getByRole('textbox', { name: 'Buscar en la documentación' })).toBeDisabled();
    expect(screen.queryByRole('table')).toBeNull();
    expect(vi.mocked(useFolderContents).mock.calls[0][0].enabled).toBe(false);
  });

  it('un único h1', () => {
    render(<DocsBrowser />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
