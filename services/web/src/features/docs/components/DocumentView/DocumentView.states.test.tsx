import { render, screen, within } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocument } from '../../hooks/useDocument';
import { useModule } from '../../hooks/useModules';
import { DocumentView } from './DocumentView';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));
vi.mock('../../hooks/useEditSession', () => ({
  useEditSession: () => ({
    phase: 'idle',
    sessionId: null,
    blockedBy: null,
    start: vi.fn(),
    release: vi.fn(),
    markBlocked: vi.fn(),
    clearBlocked: vi.fn(),
  }),
}));
vi.mock('../../hooks/useDocument', () => ({ useDocument: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: '7f3c2a10-0000-4000-8000-000000000001', name: 'Yo', zitadelId: 'sub-yo' }),
}));
vi.mock('../VersionHistoryPanel', () => ({
  VersionHistoryPanel: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Historial de versiones" /> : null,
}));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const UNAVAILABLE =
  'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.';

const setModule = (status: 'not_installed' | 'unavailable' | 'available', isKnown = true) =>
  vi.mocked(useModule).mockReturnValue({ status, sharing: false, isKnown });
const setDoc = (value: Record<string, unknown>) =>
  vi.mocked(useDocument).mockReturnValue(value as never);

describe('DocumentView — estados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setModule('available');
  });

  it('TS-55: cargando', () => {
    setDoc({ isLoading: true, isError: false, data: undefined });
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando documento…');
    expect(screen.queryByRole('navigation', { name: 'Ruta' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('TS-56: not found', () => {
    setDoc({
      isLoading: false,
      isError: true,
      data: undefined,
      error: { code: 'document_not_found', message: 'Documento no encontrado', status: 404 },
    });
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este documento no existe o no tenés permiso para verlo.'
    );
    // TS-37: el breadcrumb queda como única salida, sin "Volver".
    const route = screen.getByRole('navigation', { name: 'Ruta' });
    expect(within(route).getByRole('link', { name: 'Documentación' })).toHaveAttribute(
      'href',
      '/docs'
    );
    expect(screen.queryByRole('button', { name: 'Volver' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Adjuntos/ })).toBeNull();
  });

  it('TS-58: módulo caído sin documento cargado muestra solo el aviso de no disponible', () => {
    setModule('unavailable');
    setDoc({
      isLoading: false,
      isError: true,
      data: undefined,
      error: { code: 'module_unavailable', status: 503 },
    });
    render(<DocumentView id={ID} />);
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(UNAVAILABLE);
    expect(screen.getByRole('navigation', { name: 'Ruta' })).toBeInTheDocument();
  });

  it('un error distinto de 404 no se presenta como "no existe"', () => {
    setDoc({
      isLoading: false,
      isError: true,
      data: undefined,
      error: { code: 'internal_error', status: 500 },
    });
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('alert')).toHaveTextContent(UNAVAILABLE);
  });

  it('TS-59: el módulo pasa a not_installed con la página abierta', () => {
    setModule('not_installed', true);
    setDoc({ isLoading: false, isError: false, data: undefined });
    render(<DocumentView id={ID} />);
    expect(notFound).toHaveBeenCalled();
  });

  it('mientras el estado del módulo es desconocido no llama notFound', () => {
    setModule('not_installed', false);
    setDoc({ isLoading: false, isError: false, data: undefined });
    render(<DocumentView id={ID} />);
    expect(notFound).not.toHaveBeenCalled();
  });
});
