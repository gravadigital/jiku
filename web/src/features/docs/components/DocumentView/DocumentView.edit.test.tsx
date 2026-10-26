import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDocument } from '../../hooks/useDocument';
import { useEditSession } from '../../hooks/useEditSession';
import { useModule } from '../../hooks/useModules';
import { DocumentView } from './DocumentView';
import { DETAIL_A, ID_A as ID, LOCK_LUIS, UNAVAILABLE } from './fixtures';

const replace = vi.fn();
let params = new URLSearchParams();

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => params,
  notFound: vi.fn(),
}));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../hooks/useDocument', () => ({ useDocument: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('../../hooks/useEditSession', () => ({ useEditSession: vi.fn() }));
vi.mock('../DocumentEditor', () => ({
  DocumentEditor: ({ onDone }: { onDone: () => void }) => (
    <div>
      editor
      <button type="button" onClick={onDone}>
        terminar
      </button>
    </div>
  ),
}));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 'sub-yo', name: 'Yo' }),
}));
vi.mock('../VersionHistoryPanel', () => ({
  VersionHistoryPanel: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Historial de versiones" /> : null,
}));

const LARGE =
  'Este documento es demasiado grande para editarlo desde acá. Podés leerlo y editarlo con jiku-go.';

const DOC = { ...DETAIL_A, title: 'Arquitectura', content: '# Arquitectura\n\nTexto' };
const LOCK = LOCK_LUIS;

const start = vi.fn();
const session = (over: Record<string, unknown> = {}) =>
  vi.mocked(useEditSession).mockReturnValue({
    phase: 'idle',
    sessionId: null,
    blockedBy: null,
    start,
    release: vi.fn(),
    markBlocked: vi.fn(),
    clearBlocked: vi.fn(),
    ...over,
  } as never);
const setDoc = (over: Record<string, unknown> = {}) =>
  vi.mocked(useDocument).mockReturnValue({ data: { ...DOC, ...over }, isError: false } as never);

describe('DocumentView — edición', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams();
    vi.mocked(useModule).mockReturnValue({ status: 'available', sharing: false, isKnown: true });
    session();
    setDoc();
  });
  afterEach(() => vi.useRealTimers());

  it('TS-31: Editar visible sin consultar carpeta ni rol', () => {
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('button', { name: /Editar/ })).toBeEnabled();
  });

  it('TS-31: documento grande sin Editar y con aviso', () => {
    setDoc({ content: '# Grande', contentUrl: 'https://s3.example.com/x' });
    render(<DocumentView id={ID} />);
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(screen.getByText(LARGE)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grande' })).toBeInTheDocument();
  });

  it('TS-71: bloqueado al abrir, sin role alert, Editar deshabilitado y sondeo', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-10-26T15:40:00Z'));
    setDoc({ lock: LOCK });
    render(<DocumentView id={ID} />);
    const text = 'Luis Gómez lo está editando hasta las 15:45. Podés leerlo mientras tanto.';
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: /Editar/ })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Arquitectura', level: 2 })).toBeInTheDocument();
    // El sondeo aplica solo a la consulta del vigente.
    const intervals = vi
      .mocked(useDocument)
      .mock.calls.map(([options]) => options.refetchInterval)
      .filter((value) => value !== undefined);
    expect(intervals.at(-1)).toBe(60_000);
  });

  it('TS-28: lock sin nombre → "Otra persona"', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-10-26T15:40:00Z'));
    setDoc({ lock: { ...LOCK, holderName: null } });
    render(<DocumentView id={ID} />);
    expect(
      screen.getByText(
        'Otra persona lo está editando hasta las 15:45. Podés leerlo mientras tanto.'
      )
    ).toBeInTheDocument();
  });

  it('TS-72: el bloqueo vence solo', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-10-26T15:40:00Z'));
    setDoc({ lock: LOCK });
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('button', { name: /Editar/ })).toBeDisabled();
    act(() => {
      vi.setSystemTime(new Date('2026-10-26T15:45:01Z'));
      vi.advanceTimersByTime(5 * 60_000 + 1000);
    });
    expect(screen.queryByText(/lo está editando/)).toBeNull();
    expect(screen.getByRole('button', { name: /Editar/ })).toBeEnabled();
  });

  it('TS-73: Editar pide la reserva y entra en edición', async () => {
    start.mockResolvedValue('ok');
    const { rerender } = render(<DocumentView id={ID} />);
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    expect(start).toHaveBeenCalledTimes(1);
    session({ phase: 'editing', sessionId: 'S' });
    rerender(<DocumentView id={ID} />);
    expect(screen.getByText('editor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(screen.queryByText(/^Adjuntos/)).toBeNull();
  });

  it('TS-33: en edición no está el botón Historial', () => {
    session({ phase: 'editing', sessionId: 'S' });
    render(<DocumentView id={ID} />);
    expect(screen.queryByRole('button', { name: 'Historial de versiones' })).toBeNull();
  });

  it('mientras adquiere, Editar está en loading', () => {
    session({ phase: 'acquiring', sessionId: 'S' });
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('button', { name: /Editar/ })).toHaveAttribute('aria-busy', 'true');
  });

  it('TS-74: otra sesión se adelantó → aviso con role alert y Editar deshabilitado', () => {
    session({
      blockedBy: {
        holder: 'sub-ana',
        holderName: null,
        via: 'agent',
        expiresAt: '2099-10-24T14:32:00.000Z',
      },
    });
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Un agente lo está editando hasta las /);
    expect(screen.getByRole('button', { name: /Editar/ })).toBeDisabled();
  });

  it('TS-29: bloqueo al pedir la reserva con el nombre del servicio', () => {
    session({
      blockedBy: {
        holder: 'sub-luis',
        holderName: 'Luis Gómez',
        via: 'human',
        expiresAt: '2099-10-24T15:45:00.000Z',
      },
    });
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Luis Gómez lo está editando hasta las /);
  });

  it('el lock propio en otra pestaña se avisa como tal', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-10-26T15:40:00Z'));
    setDoc({ lock: { ...LOCK, holder: 'sub-yo' } });
    render(<DocumentView id={ID} />);
    expect(screen.getByText('Lo estás editando en otra pestaña o ventana.')).toBeInTheDocument();
  });

  it.each([
    ['permission_denied', 'No tenés permiso para editar este documento.'],
    ['gateway_timeout', 'No se pudo empezar a editar. Intentá de nuevo.'],
    ['module_unavailable', 'No se pudo empezar a editar. Intentá de nuevo.'],
  ])('TS-75: start falla con %s', async (code, message) => {
    start.mockResolvedValue({ code, message: 'x', status: 500 });
    render(<DocumentView id={ID} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    });
    expect(toast.error).toHaveBeenCalledWith(message);
  });

  it('TS-91: ?editar=1 toma la reserva una vez y limpia el parámetro', async () => {
    params = new URLSearchParams({ editar: '1' });
    start.mockResolvedValue('ok');
    render(<DocumentView id={ID} />);
    await act(async () => {});
    expect(start).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(`/docs/${ID}`);
  });

  it('TS-91: ?editar=1 con documento grande limpia el parámetro sin tomar la reserva', async () => {
    params = new URLSearchParams({ editar: '1' });
    setDoc({ contentUrl: 'https://s3.example.com/x' });
    render(<DocumentView id={ID} />);
    await act(async () => {});
    expect(start).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith(`/docs/${ID}`);
  });

  it('TS-92: módulo caído deshabilita Editar y gana el aviso de no disponible', () => {
    vi.mocked(useModule).mockReturnValue({ status: 'unavailable', sharing: false, isKnown: true });
    setDoc({ lock: { ...LOCK, expiresAt: '2099-01-01T00:00:00.000Z' } });
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('button', { name: /Editar/ })).toBeDisabled();
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByText(/lo está editando/)).toBeNull();
  });

  it('al terminar la edición el foco vuelve a Editar', () => {
    session({ phase: 'editing', sessionId: 'S' });
    const { rerender } = render(<DocumentView id={ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'terminar' }));
    session({ phase: 'idle' });
    rerender(<DocumentView id={ID} />);
    expect(screen.getByRole('button', { name: /Editar/ })).toHaveFocus();
  });
});
