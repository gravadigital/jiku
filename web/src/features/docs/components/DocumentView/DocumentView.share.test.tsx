import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocument } from '../../hooks/useDocument';
import { useEditSession } from '../../hooks/useEditSession';
import { useModule } from '../../hooks/useModules';
import { DocumentView } from './DocumentView';

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
vi.mock('../../hooks/useFolderTrail', () => ({ useFolderTrail: () => ({ data: undefined }) }));
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
vi.mock('@/features/auth/hooks/usePersons', () => ({ usePersons: vi.fn(() => ({ data: [] })) }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const FOLDER_ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6F0';
const DOC = {
  id: ID,
  title: 'Arquitectura',
  path: '/clientes/acme/arquitectura.md',
  folderId: FOLDER_ID,
  fileName: 'arquitectura.md',
  version: 6,
  visibility: 'internal',
  updatedAt: '2026-10-24T11:30:00.000Z',
  updatedBy: 'sub-ana',
  content: '# Arquitectura\n\nTexto',
  relations: {},
  topics: [],
  attachments: [],
  lock: null,
  folder: {
    id: FOLDER_ID,
    path: '/clientes/acme/',
    effectivePermission: 'manage',
    sharingBlocked: false,
  },
};

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
const setDoc = (folder: Record<string, unknown> = {}) =>
  vi.mocked(useDocument).mockReturnValue({
    data: { ...DOC, folder: { ...DOC.folder, ...folder } },
    isError: false,
  } as never);

describe('DocumentView — Compartir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    module_('available', true);
    session();
    setDoc();
  });

  it('TS-39: con sharing y manage aparece entre Volver y Editar', () => {
    render(<DocumentView id={ID} />);
    const share = screen.getByRole('button', { name: /Compartir/ });
    expect(share).toBeEnabled();
    const labels = screen.getAllByRole('button').concat(screen.getAllByRole('link'));
    const order = labels
      .filter((el) => /Volver|Compartir|Editar/.test(el.textContent ?? ''))
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map((el) => (el.textContent ?? '').replace(/[^A-Za-z]/g, ''));
    expect(order).toEqual(['Volver', 'Compartir', 'Editar']);
  });

  it('TS-40: sin sharing no aparece (CA-32)', () => {
    module_('available', false);
    render(<DocumentView id={ID} />);
    expect(screen.queryByRole('button', { name: /Compartir/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Editar/ })).toBeInTheDocument();
  });

  it.each(['write', 'read', null])('TS-41: permiso %s no muestra Compartir', (permission) => {
    setDoc({ effectivePermission: permission });
    render(<DocumentView id={ID} />);
    expect(screen.queryByRole('button', { name: /Compartir/ })).toBeNull();
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

  it('TS-45: carpeta con compartir bloqueado igual muestra el botón', () => {
    setDoc({ sharingBlocked: true });
    render(<DocumentView id={ID} />);
    const share = screen.getByRole('button', { name: /Compartir/ });
    fireEvent.click(share);
    expect(
      screen.getByText('La carpeta de este documento no permite compartirlo fuera de Jiku.')
    ).toBeInTheDocument();
  });
});
