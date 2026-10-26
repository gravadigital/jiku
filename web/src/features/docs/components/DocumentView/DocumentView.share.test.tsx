import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocument } from '../../hooks/useDocument';
import { useEditSession } from '../../hooks/useEditSession';
import { useModule } from '../../hooks/useModules';
import { DocumentView } from './DocumentView';
import { DETAIL_A, ID_A as ID } from './fixtures';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../hooks/useDocument', () => ({ useDocument: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('../../hooks/useEditSession', () => ({ useEditSession: vi.fn() }));
vi.mock('../../hooks/useCreateShare', () => ({
  useCreateShare: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }),
}));
vi.mock('../../hooks/useDocumentShares', () => ({
  useDocumentShares: () => ({ data: { items: [], page: {} }, isLoading: false, isError: false }),
}));
vi.mock('../../hooks/useRevokeShare', () => ({
  useRevokeShare: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../DocumentEditor', () => ({ DocumentEditor: () => <div>editor</div> }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 'sub-yo', name: 'Yo' }),
}));
vi.mock('../VersionHistoryPanel', () => ({
  VersionHistoryPanel: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Historial de versiones" /> : null,
}));

const DOC = { ...DETAIL_A, title: 'Arquitectura', clientRefs: [], projectRefs: [] };

const module_ = (status: string, sharing: boolean) =>
  vi.mocked(useModule).mockReturnValue({ status, sharing, isKnown: true } as never);
const session = (phase = 'idle') =>
  vi.mocked(useEditSession).mockReturnValue({
    phase,
    sessionId: null,
    blockedBy: null,
    start: vi.fn(),
    release: vi.fn(),
    markBlocked: vi.fn(),
    clearBlocked: vi.fn(),
  } as never);
const setDoc = (over: Record<string, unknown> = {}) =>
  vi.mocked(useDocument).mockReturnValue({ data: { ...DOC, ...over }, isError: false } as never);

describe('DocumentView — Compartir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    module_('available', true);
    session();
    setDoc();
  });

  it('TS-31: con sharing aparece entre Historial y Editar, habilitado y sin rol', () => {
    render(<DocumentView id={ID} />);
    const share = screen.getByRole('button', { name: /Compartir/ });
    expect(share).toBeEnabled();
    const order = screen
      .getAllByRole('button')
      .filter((el) => /Historial|Compartir|Editar/.test(el.textContent ?? ''))
      .map((el) => (el.textContent ?? '').replace(/[^A-Za-z ]/g, '').trim());
    expect(order).toEqual(['Historial de versiones', 'Compartir', 'Editar']);
  });

  it('TS-40: sin sharing no aparece (CA-32)', () => {
    module_('available', false);
    render(<DocumentView id={ID} />);
    expect(screen.queryByRole('button', { name: /Compartir/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Editar/ })).toBeInTheDocument();
  });

  it('TS-42: módulo no disponible lo deshabilita', () => {
    module_('unavailable', true);
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('button', { name: /Compartir/ })).toBeDisabled();
  });

  it('TS-43: oculto mientras se edita', () => {
    session('editing');
    render(<DocumentView id={ID} />);
    expect(screen.queryByRole('button', { name: /Compartir/ })).toBeNull();
  });

  it('TS-44: abre O-12 y devuelve el foco', () => {
    render(<DocumentView id={ID} />);
    const share = screen.getByRole('button', { name: /Compartir/ });
    share.focus();
    fireEvent.click(share);
    expect(screen.getByRole('dialog', { name: 'Compartir «Arquitectura»' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByRole('button', { name: /Compartir/ })).toHaveFocus();
  });

  it('TS-32: documento restringido deshabilita Compartir con la nota como descripción', () => {
    setDoc({ visibility: 'restricted' });
    render(<DocumentView id={ID} />);
    const share = screen.getByRole('button', { name: /Compartir/ });
    expect(share).toBeDisabled();
    expect(share).toHaveAccessibleDescription(
      'Los documentos restringidos no se pueden compartir por link.'
    );
    expect(
      screen.getByText('Los documentos restringidos no se pueden compartir por link.')
    ).toBeVisible();
    expect(screen.getAllByText('Restringido').length).toBeGreaterThan(0);
    fireEvent.click(share);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('TS-31: Editar se ofrece sin consultar carpeta ni rol', () => {
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('button', { name: /Editar/ })).toBeEnabled();
  });
});
