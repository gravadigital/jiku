import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listDocuments } from '../services/docsApi';
import { useDocuments } from './useDocuments';

vi.mock('../services/docsApi', () => ({ listDocuments: vi.fn(), getDocument: vi.fn() }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}

describe('useDocuments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-13: pagina por cursor', async () => {
    vi.mocked(listDocuments)
      .mockResolvedValueOnce({
        ok: true,
        data: { items: [], page: { limit: 10, returned: 10, cursor: 'c2' } },
      })
      .mockResolvedValueOnce({ ok: true, data: { items: [], page: { limit: 10, returned: 3 } } });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDocuments({ filters: { projectId: 12 } }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(listDocuments).toHaveBeenCalledWith({ projectId: 12, limit: 10 });

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(listDocuments).toHaveBeenLastCalledWith({ projectId: 12, limit: 10, cursor: 'c2' });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it('TS-11: module_unavailable invalida [modules] y propaga el error', async () => {
    const err = { code: 'module_unavailable', message: 'x', status: 503 };
    vi.mocked(listDocuments).mockResolvedValue({ ok: false, error: err } as never);
    const { Wrapper, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDocuments({ filters: { projectId: 12 } }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(err);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['modules'] });
  });

  it('TS-12: otros códigos no invalidan [modules]', async () => {
    vi.mocked(listDocuments).mockResolvedValue({
      ok: false,
      error: { code: 'upstream_unavailable', status: 503 },
    } as never);
    const { Wrapper, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDocuments({ filters: { projectId: 12 } }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });

  it('con enabled false no consulta', () => {
    const { Wrapper } = setup();
    renderHook(() => useDocuments({ filters: { taskId: 7 }, enabled: false }), {
      wrapper: Wrapper,
    });
    expect(listDocuments).not.toHaveBeenCalled();
  });
});
