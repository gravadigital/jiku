import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createShare, listShares, revokeShare } from '../services/sharesApi';
import { useCreateShare } from './useCreateShare';
import { useDocumentShares } from './useDocumentShares';
import { useRevokeShare } from './useRevokeShare';

vi.mock('../services/sharesApi', () => ({
  listShares: vi.fn(),
  createShare: vi.fn(),
  revokeShare: vi.fn(),
}));

const DOC = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const S1 = '01J9Z3K8M2Q4R6T8V0W2Y4A6S1';
const S2 = '01J9Z3K8M2Q4R6T8V0W2Y4A6S2';
const share = (id: string, status = 'active') =>
  ({ id, documentId: DOC, mode: 'latest', status, createdBy: 'sub-ana' }) as never;
const CREATED = {
  id: S1,
  token: 'jds_x',
  url: 'https://docs-publico.ejemplo.com/p/docs/jds_x',
  expiresAt: '2026-11-08T12:00:00.000Z',
};
const PAGE = { limit: 200, returned: 2 };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client, invalidate };
}

describe('useDocumentShares', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-13: habilitado, con su key', async () => {
    vi.mocked(listShares).mockResolvedValue({
      ok: true,
      data: { items: [share(S1)], page: PAGE },
    });
    const { Wrapper, client } = setup();
    const { result } = renderHook(() => useDocumentShares({ documentId: DOC, enabled: true }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data?.items).toEqual([share(S1)]));
    expect(client.getQueryData(['docs-shares', DOC])).toBeDefined();
  });

  it('TS-14: deshabilitado no consulta', () => {
    const { Wrapper } = setup();
    renderHook(() => useDocumentShares({ documentId: DOC, enabled: false }), { wrapper: Wrapper });
    expect(listShares).not.toHaveBeenCalled();
  });

  it('TS-15: module_unavailable invalida modules y no reintenta', async () => {
    vi.mocked(listShares).mockResolvedValue({
      ok: false,
      error: { code: 'module_unavailable', message: 'x', status: 503 },
    });
    const { Wrapper, invalidate } = setup();
    const { result } = renderHook(() => useDocumentShares({ documentId: DOC }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['modules'] });
    expect(listShares).toHaveBeenCalledTimes(1);
  });
});

describe('useCreateShare', () => {
  beforeEach(() => vi.clearAllMocks());
  const input = { expiresInDays: 15 as const, includeAttachments: true, note: 'para soporte ACME' };

  it('TS-16: invalida en éxito y en error, sin reintento, gcTime 0', async () => {
    vi.mocked(createShare).mockResolvedValueOnce({ ok: true, data: CREATED });
    const { Wrapper, invalidate, client } = setup();
    const { result } = renderHook(() => useCreateShare(DOC), { wrapper: Wrapper });
    let data;
    await act(async () => {
      data = await result.current.mutateAsync(input);
    });
    expect(data).toEqual(CREATED);
    expect(createShare).toHaveBeenCalledWith(DOC, input);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['docs-shares', DOC] });
    expect(
      client
        .getMutationCache()
        .getAll()
        .every((m) => m.gcTime === 0)
    ).toBe(true);

    invalidate.mockClear();
    vi.mocked(createShare).mockResolvedValueOnce({
      ok: false,
      error: { code: 'gateway_timeout', message: 'La operación tardó demasiado', status: 504 },
    });
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({
        code: 'gateway_timeout',
      });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['docs-shares', DOC] });
    expect(createShare).toHaveBeenCalledTimes(2);
  });

  it('TS-17: sharing_not_configured invalida modules', async () => {
    vi.mocked(createShare).mockResolvedValue({
      ok: false,
      error: { code: 'sharing_not_configured', message: 'x', status: 404 },
    });
    const { Wrapper, invalidate } = setup();
    const { result } = renderHook(() => useCreateShare(DOC), { wrapper: Wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({
        code: 'sharing_not_configured',
      });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['modules'] });
  });
});

describe('useRevokeShare', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-18: actualiza la fila tras el 200, sin optimista', async () => {
    let resolve!: (v: never) => void;
    vi.mocked(revokeShare).mockReturnValue(new Promise((r) => (resolve = r)));
    const { Wrapper, client, invalidate } = setup();
    client.setQueryData(['docs-shares', DOC], {
      items: [share(S1), share(S2, 'revoked')],
      page: PAGE,
    });
    const { result } = renderHook(() => useRevokeShare(DOC), { wrapper: Wrapper });
    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.mutateAsync(S1);
    });
    const before = client.getQueryData<{ items: { id: string; status: string }[] }>([
      'docs-shares',
      DOC,
    ]);
    expect(before?.items[0].status).toBe('active');
    await act(async () => {
      resolve({
        ok: true,
        data: { id: S1, revokedAt: '2026-10-24T12:05:00.000Z' },
      } as never);
      await promise;
    });
    const after = client.getQueryData<{
      items: { id: string; status: string; revokedAt?: string }[];
    }>(['docs-shares', DOC]);
    expect(after?.items[0]).toMatchObject({
      id: S1,
      status: 'revoked',
      revokedAt: '2026-10-24T12:05:00.000Z',
    });
    expect(after?.items[1]).toEqual(share(S2, 'revoked'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['docs-shares', DOC] });
  });

  it('tolera caché vacío', async () => {
    vi.mocked(revokeShare).mockResolvedValue({
      ok: true,
      data: { id: S1, revokedAt: '2026-10-24T12:05:00.000Z' },
    });
    const { Wrapper, client } = setup();
    const { result } = renderHook(() => useRevokeShare(DOC), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync(S1);
    });
    expect(client.getQueryData(['docs-shares', DOC])).toBeUndefined();
  });

  it('TS-38: share_not_found invalida la lista', async () => {
    vi.mocked(revokeShare).mockResolvedValue({
      ok: false,
      error: { code: 'share_not_found', message: 'x', status: 404 },
    });
    const { Wrapper, invalidate } = setup();
    const { result } = renderHook(() => useRevokeShare(DOC), { wrapper: Wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(S1)).rejects.toMatchObject({
        code: 'share_not_found',
      });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['docs-shares', DOC] });
  });
});
