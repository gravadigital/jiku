import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lockDocument, unlockDocument } from '../services/docsApi';
import { releaseLockKeepalive } from '../services/docsClientApi';
import { useEditSession } from './useEditSession';

vi.mock('../services/docsApi', () => ({ lockDocument: vi.fn(), unlockDocument: vi.fn() }));
vi.mock('../services/docsClientApi', () => ({ releaseLockKeepalive: vi.fn() }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const GRANT = { id: ID, sessionId: 'x', expiresAt: '2026-10-24T14:02:00.000Z' };
const DETAILS = { holder: 'sub-ana', via: 'human', expiresAt: '2026-10-24T14:32:00.000Z' };

function setup() {
  const client = new QueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useEditSession({ documentId: ID }), { wrapper: Wrapper }) };
}

const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe('useEditSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(lockDocument).mockResolvedValue({ ok: true, data: GRANT });
    vi.mocked(unlockDocument).mockResolvedValue({ ok: true, data: { id: ID } });
  });
  afterEach(() => vi.useRealTimers());

  it('TS-39: toma la reserva y la renueva cada 60 s con el mismo sessionId', async () => {
    const { result } = setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.start();
    });
    expect(outcome).toBe('ok');
    expect(result.current.phase).toBe('editing');
    expect(lockDocument).toHaveBeenCalledTimes(1);
    const sid = vi.mocked(lockDocument).mock.calls[0][1];
    expect(sid).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    await tick(60_000);
    expect(lockDocument).toHaveBeenCalledTimes(2);
    expect(vi.mocked(lockDocument).mock.calls[1][1]).toBe(sid);
    await tick(60_000);
    expect(lockDocument).toHaveBeenCalledTimes(3);
  });

  it('TS-40: bloqueado devuelve locked y no renueva', async () => {
    vi.mocked(lockDocument).mockResolvedValue({
      ok: false,
      error: { code: 'document_locked', message: 'x', status: 409, details: DETAILS },
    });
    const { result } = setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.start();
    });
    expect(outcome).toBe('locked');
    expect(result.current.phase).toBe('idle');
    expect(result.current.blockedBy).toEqual(DETAILS);
    await tick(120_000);
    expect(lockDocument).toHaveBeenCalledTimes(1);
  });

  it('otros errores vuelven a idle y se devuelven; module_unavailable invalida [modules]', async () => {
    const error = { code: 'module_unavailable', message: 'x', status: 503 };
    vi.mocked(lockDocument).mockResolvedValue({ ok: false, error });
    const { result, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.start();
    });
    expect(outcome).toEqual(error);
    expect(result.current.phase).toBe('idle');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['modules'] });
  });

  it('un fallo de red del Server Action se trata como error genérico', async () => {
    vi.mocked(lockDocument).mockRejectedValue(new Error('network'));
    const { result } = setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.start();
    });
    expect(outcome).toMatchObject({ code: 'internal_error' });
  });

  it('TS-41: la renovación que falla pasa a lost y se recupera', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.start();
    });
    vi.mocked(lockDocument).mockResolvedValueOnce({
      ok: false,
      error: { code: 'gateway_timeout', message: 'x', status: 504 },
    });
    await tick(60_000);
    expect(result.current.phase).toBe('lost');
    expect(result.current.blockedBy).toBeNull();
    await tick(60_000);
    expect(result.current.phase).toBe('editing');
  });

  it('TS-42: la renovación con document_locked guarda al titular', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.start();
    });
    const details = { ...DETAILS, via: 'agent', expiresAt: '2026-10-24T14:40:00.000Z' };
    vi.mocked(lockDocument).mockResolvedValueOnce({
      ok: false,
      error: { code: 'document_locked', message: 'x', status: 409, details },
    });
    await tick(60_000);
    expect(result.current.phase).toBe('lost');
    expect(result.current.blockedBy).toEqual(details);
  });

  it('TS-43: release libera, corta la renovación y se traga lock_not_held', async () => {
    vi.mocked(unlockDocument).mockResolvedValue({
      ok: false,
      error: { code: 'lock_not_held', message: 'x', status: 409 },
    });
    const { result } = setup();
    await act(async () => {
      await result.current.start();
    });
    const sid = vi.mocked(lockDocument).mock.calls[0][1];
    await act(async () => {
      await result.current.release();
    });
    expect(unlockDocument).toHaveBeenCalledWith(ID, sid);
    expect(result.current.phase).toBe('idle');
    expect(result.current.sessionId).toBeNull();
    await tick(120_000);
    expect(lockDocument).toHaveBeenCalledTimes(1);
  });

  it('TS-44: pagehide y desmontaje liberan con keepalive solo si hay reserva', async () => {
    const { result, unmount } = setup();
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(releaseLockKeepalive).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.start();
    });
    const sid = vi.mocked(lockDocument).mock.calls[0][1];
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(releaseLockKeepalive).toHaveBeenCalledWith(ID, sid);

    vi.mocked(releaseLockKeepalive).mockClear();
    unmount();
    expect(releaseLockKeepalive).toHaveBeenCalledWith(ID, sid);
  });

  it('desmontar en idle no libera', () => {
    const { unmount } = setup();
    unmount();
    expect(releaseLockKeepalive).not.toHaveBeenCalled();
  });

  it('markBlocked pasa a lost con el titular y clearBlocked lo quita', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.start();
    });
    act(() =>
      result.current.markBlocked({ holder: 'sub-ana', via: 'human', expiresAt: DETAILS.expiresAt })
    );
    expect(result.current.phase).toBe('lost');
    expect(result.current.blockedBy?.holder).toBe('sub-ana');
    act(() => result.current.clearBlocked());
    expect(result.current.blockedBy).toBeNull();
  });
});
