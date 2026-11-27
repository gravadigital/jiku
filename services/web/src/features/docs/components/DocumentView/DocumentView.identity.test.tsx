import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDocument } from '../../hooks/useDocument';
import { useEditSession } from '../../hooks/useEditSession';
import { useModule } from '../../hooks/useModules';
import { DocumentView } from './DocumentView';
import { DETAIL_A, ID_A as ID, V4 } from './fixtures';

const JIKU_ID = '7f3c2a10-0000-4000-8000-000000000001';
let params = new URLSearchParams();
let mockUser: { id: string; name: string; zitadelId: string | null } = {
  id: JIKU_ID,
  name: 'Yo',
  zitadelId: 'sub-yo',
};

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => params,
  notFound: vi.fn(),
}));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../hooks/useDocument', () => ({ useDocument: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('../../hooks/useEditSession', () => ({ useEditSession: vi.fn() }));
vi.mock('../DocumentEditor', () => ({ DocumentEditor: () => <div>editor</div> }));
vi.mock('../VersionHistoryPanel', () => ({ VersionHistoryPanel: () => null }));
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => mockUser }));

const OWN_LOCK = {
  sessionId: '01J9Z3K8M2Q4R6T8V0W2Y4A6E3',
  holder: 'sub-yo',
  holderName: 'Yo',
  via: 'human',
  expiresAt: '2026-10-26T15:45:00.000Z',
};
const MINE = { updatedBy: 'sub-yo', updatedByName: 'Yo', lock: null };

describe('DocumentView — identidad por sub (S-101)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams();
    mockUser = { id: JIKU_ID, name: 'Yo', zitadelId: 'sub-yo' };
    vi.mocked(useModule).mockReturnValue({ status: 'available', sharing: false, isKnown: true });
    vi.mocked(useEditSession).mockReturnValue({
      phase: 'idle',
      sessionId: 'OTRA-SESION',
      blockedBy: null,
      start: vi.fn(),
      release: vi.fn(),
      markBlocked: vi.fn(),
      clearBlocked: vi.fn(),
    } as never);
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-10-26T15:40:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const setDoc = (over: Record<string, unknown>) =>
    vi
      .mocked(useDocument)
      .mockReturnValue({ data: { ...DETAIL_A, ...over }, isError: false } as never);

  it('TS-20: reserva propia en otra pestaña', () => {
    setDoc({ lock: OWN_LOCK });
    render(<DocumentView id={ID} />);
    expect(screen.getByText('Lo estás editando en otra pestaña o ventana.')).toBeInTheDocument();
    expect(screen.queryByText(/lo está editando/)).toBeNull();
  });

  it('TS-21: sin zitadelId no reconoce la reserva', () => {
    mockUser = { id: 'sub-yo', name: 'Yo', zitadelId: null };
    setDoc({ lock: OWN_LOCK });
    render(<DocumentView id={ID} />);
    expect(
      screen.getByText('Yo lo está editando hasta las 15:45. Podés leerlo mientras tanto.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Lo estás editando en otra pestaña o ventana.')).toBeNull();
  });

  it('TS-22: cabecera "por vos"', () => {
    setDoc(MINE);
    render(<DocumentView id={ID} />);
    expect(screen.getByText('Versión 6 · actualizado 24/10/2026 14:30 por vos')).toBeInTheDocument();
  });

  it('TS-23: cabecera sin zitadelId', () => {
    mockUser = { id: 'sub-yo', name: 'Yo', zitadelId: null };
    setDoc(MINE);
    render(<DocumentView id={ID} />);
    expect(screen.getByText('Versión 6 · actualizado 24/10/2026 14:30 por Yo')).toBeInTheDocument();
    expect(screen.queryByText(/por vos/)).toBeNull();
  });

  it('TS-24: aviso de versión vieja "por vos"', () => {
    params = new URLSearchParams({ version: '5' });
    const old = {
      ...V4,
      version: 5,
      updatedBy: 'sub-yo',
      updatedByName: 'Yo',
      updatedAt: '2026-10-23T10:00:00.000Z',
    };
    vi.mocked(useDocument).mockImplementation(((options: { version?: number }) =>
      options.version === undefined
        ? { data: DETAIL_A, isError: false }
        : { data: old, isError: false }) as never);
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Estás viendo la versión 5, guardada el 23/10/2026 10:00 por vos.'
    );
  });
});
