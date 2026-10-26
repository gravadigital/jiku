import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocument } from '../../hooks/useDocument';
import { useModule } from '../../hooks/useModules';
import { DocumentView } from './DocumentView';
import { DETAIL_A, ID_A, NOT_FOUND, V4 } from './fixtures';

let params = new URLSearchParams();

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => params,
  notFound: vi.fn(),
}));
vi.mock('../../hooks/useDocument', () => ({ useDocument: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
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
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 'sub-yo', name: 'Yo' }),
}));
vi.mock('../VersionHistoryPanel', () => ({
  VersionHistoryPanel: ({
    open,
    viewingVersion,
  }: {
    open: boolean;
    viewingVersion: number | null;
  }) =>
    open ? (
      <div role="dialog" aria-label="Historial de versiones">{`viendo ${viewingVersion}`}</div>
    ) : null,
}));

const PRUNED = {
  code: 'version_pruned',
  message: 'Version pruned',
  status: 404,
  details: { requestedVersion: 7, previousAvailable: 5, nextAvailable: 9 },
};

// `useDocument` se mockea por argumentos: el vigente y el versionado son dos consultas.
const setQueries = (versioned: Record<string, unknown>) =>
  vi
    .mocked(useDocument)
    .mockImplementation(((options: { version?: number }) =>
      options.version === undefined ? { data: DETAIL_A, isError: false } : versioned) as never);

describe('DocumentView — versiones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams();
    vi.mocked(useModule).mockReturnValue({ status: 'available', sharing: false, isKnown: true });
  });

  it('TS-34: ?version=4 muestra la versión anterior con aviso, sin Editar', () => {
    params = new URLSearchParams({ version: '4' });
    setQueries({ data: V4, isError: false });
    render(<DocumentView id={ID_A} />);

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(
      'Estás viendo la versión 4, guardada el 20/10/2026 09:00 por Ana Pérez.'
    );
    expect(within(notice).getByRole('link', { name: 'Ver la versión actual' })).toHaveAttribute(
      'href',
      `/docs/${ID_A}`
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Versión vieja' })).toBeInTheDocument();
    expect(
      screen.getByText('Versión 4 · actualizado 20/10/2026 09:00 por Ana Pérez')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Arquitectura de videoconferencia' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Historial de versiones' })).toBeInTheDocument();
    expect(vi.mocked(useDocument)).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID_A, version: 4, enabled: true })
    );
  });

  it.each(['6', 'abc', '0'])('TS-35: ?version=%s se trata como lectura normal', (value) => {
    params = new URLSearchParams({ version: value });
    setQueries({ data: undefined, isError: false });
    render(<DocumentView id={ID_A} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: /Editar/ })).toBeInTheDocument();
    const versionedCalls = vi
      .mocked(useDocument)
      .mock.calls.filter(
        ([o]) =>
          (o as { enabled?: boolean }).enabled === true && 'version' in o && o.version !== undefined
      );
    expect(versionedCalls).toHaveLength(0);
  });

  it('TS-36: versión compactada ofrece las más cercanas y no confunde con "no existe"', () => {
    params = new URLSearchParams({ version: '7' });
    setQueries({ data: undefined, isError: true, error: PRUNED });
    const { rerender } = render(<DocumentView id={ID_A} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      'La versión 7 ya no se conserva: se compactó al limpiar el historial.'
    );
    expect(alert).toHaveTextContent('Versiones más cercanas:');
    expect(within(alert).getByRole('link', { name: 'Versión 5' })).toHaveAttribute(
      'href',
      `/docs/${ID_A}?version=5`
    );
    expect(within(alert).getByRole('link', { name: 'Versión 9' })).toHaveAttribute(
      'href',
      `/docs/${ID_A}?version=9`
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Arquitectura de videoconferencia' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Contexto' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'En este documento' })).toBeNull();
    expect(screen.queryByText(NOT_FOUND)).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();

    setQueries({
      data: undefined,
      isError: true,
      error: {
        ...PRUNED,
        details: { requestedVersion: 7, previousAvailable: 5, nextAvailable: null },
      },
    });
    rerender(<DocumentView id={ID_A} />);
    expect(screen.getByRole('link', { name: 'Versión 5' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Versión 9' })).toBeNull();
  });

  it('otro error de la versión pedida se muestra como no disponible, no como "no existe"', () => {
    params = new URLSearchParams({ version: '4' });
    setQueries({ data: undefined, isError: true, error: { code: 'internal_error', status: 500 } });
    render(<DocumentView id={ID_A} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no está disponible/);
    expect(screen.queryByText(NOT_FOUND)).toBeNull();
  });

  it('el panel de historial se abre y sabe qué versión se está viendo', () => {
    params = new URLSearchParams({ version: '4' });
    setQueries({ data: V4, isError: false });
    render(<DocumentView id={ID_A} />);
    fireEvent.click(screen.getByRole('button', { name: 'Historial de versiones' }));
    expect(screen.getByRole('dialog', { name: 'Historial de versiones' })).toHaveTextContent(
      'viendo 4'
    );
  });
});
