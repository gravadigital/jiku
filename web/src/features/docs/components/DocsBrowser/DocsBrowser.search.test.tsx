import { act, fireEvent, render, screen } from '@testing-library/react';
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
vi.mock('../NewDocumentDialog', () => ({ NewDocumentDialog: () => null }));
vi.mock('@/features/auth/hooks/usePersons', () => ({
  usePersons: vi.fn(() => ({ data: [] })),
}));

const F0 = '01J9Z3K8M2Q4R6T8V0W2Y4A6F0';
const DOC_ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const HIT = {
  documentId: DOC_ID,
  version: 6,
  title: 'Guía de despliegue',
  path: '/ops/guia-de-despliegue.md',
  headingPath: ['Pasos'],
  snippet: 'pasos de <b>despliegue</b> en producción',
  score: 0.8,
  updatedAt: '2026-10-22T11:15:00.000Z',
  updatedBy: 'sub-ana',
};

const setSearch = (over: Record<string, unknown> = {}) =>
  vi.mocked(useDocsSearch).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...over,
  } as never);

describe('DocsBrowser — búsqueda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams({ folder: F0 });
    vi.mocked(useModule).mockReturnValue({ status: 'available', sharing: false, isKnown: true });
    vi.mocked(useRootFolders).mockReturnValue({ data: { root: null, tops: [] } } as never);
    vi.mocked(useFolderTrail).mockReturnValue({
      data: {
        folder: { id: F0, name: 'acme', path: '/clientes/acme/', effectivePermission: 'write' },
        trail: [{ id: F0, name: 'acme' }],
      },
    } as never);
    vi.mocked(useFolderContents).mockReturnValue({
      data: { pages: [{ folders: [], documents: [] }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
    } as never);
    setSearch();
  });
  afterEach(() => vi.useRealTimers());

  it('TS-58: debounce de 300 ms y URL con folder y q', () => {
    vi.useFakeTimers();
    render(<DocsBrowser />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en la documentación' }), {
      target: { value: 'despliegue' },
    });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(replace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(replace).toHaveBeenCalledWith(`/docs?folder=${F0}&q=despliegue`);
  });

  it('TS-59: resultados con fragmento marcado y sin carpeta ni "Ver más"', () => {
    params = new URLSearchParams({ folder: F0, q: 'despliegue' });
    setSearch({ data: { items: [HIT] } });
    const { container } = render(<DocsBrowser />);
    for (const label of ['Documento', 'Carpeta', 'Actualizado']) {
      expect(screen.getByRole('columnheader', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Guía de despliegue' })).toHaveAttribute(
      'href',
      `/docs/${DOC_ID}`
    );
    expect(screen.getByText('/ops/')).toBeInTheDocument();
    expect(screen.getByText('22/10/2026 11:15')).toBeInTheDocument();
    expect(container.querySelector('mark')).toHaveTextContent('despliegue');
    expect(screen.getByText('1 resultados')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Ruta de la carpeta' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Nuevo documento/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('TS-60a: sin resultados', () => {
    params = new URLSearchParams({ q: 'xyz' });
    setSearch({ data: { items: [] } });
    render(<DocsBrowser />);
    expect(
      screen.getByText('No hay documentos que coincidan con «xyz». Probá con otras palabras.')
    ).toBeInTheDocument();
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('TS-60b: menos de 2 caracteres muestra la carpeta', () => {
    params = new URLSearchParams({ folder: F0, q: 'd' });
    render(<DocsBrowser />);
    expect(screen.getByRole('navigation', { name: 'Ruta de la carpeta' })).toBeInTheDocument();
    expect(screen.getByText(/Esta carpeta está vacía/)).toBeInTheDocument();
    expect(screen.queryByText('Sin resultados')).toBeNull();
  });

  it('TS-61: error de búsqueda', () => {
    params = new URLSearchParams({ q: 'despliegue' });
    setSearch({ isError: true, error: { code: 'gateway_timeout', status: 504 } });
    render(<DocsBrowser />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo buscar. Intentá de nuevo.');
  });

  it('TS-62: vaciar el campo vuelve a la carpeta', () => {
    vi.useFakeTimers();
    params = new URLSearchParams({ folder: F0, q: 'despliegue' });
    setSearch({ data: { items: [HIT] } });
    render(<DocsBrowser />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en la documentación' }), {
      target: { value: '' },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replace).toHaveBeenCalledWith(`/docs?folder=${F0}`);
  });
});
