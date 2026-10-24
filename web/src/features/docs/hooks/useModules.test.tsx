import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getModules } from '../services/modulesApi';
import { useModule, useModules } from './useModules';

vi.mock('../services/modulesApi', () => ({ getModules: vi.fn() }));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}

describe('useModule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-7: resuelve el estado', async () => {
    vi.mocked(getModules).mockResolvedValue([
      { module: 'docs', status: 'unavailable', features: { sharing: false } },
    ]);
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useModule('docs'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isKnown).toBe(true));
    expect(result.current).toEqual({ status: 'unavailable', sharing: false, isKnown: true });
  });

  it('TS-8: sin entrada docs es not_installed', async () => {
    vi.mocked(getModules).mockResolvedValue([]);
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useModule('docs'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isKnown).toBe(true));
    expect(result.current).toEqual({ status: 'not_installed', sharing: false, isKnown: true });
  });

  it('TS-9: mientras carga y si falla se comporta como not_installed', async () => {
    let reject!: (e: unknown) => void;
    vi.mocked(getModules).mockReturnValue(new Promise((_, r) => (reject = r)));
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useModule('docs'), { wrapper: Wrapper });
    expect(result.current).toEqual({ status: 'not_installed', sharing: false, isKnown: false });
    await act(async () => reject({ code: 'internal_error', status: 500 }));
    await waitFor(() => expect(getModules).toHaveBeenCalled());
    expect(result.current).toEqual({ status: 'not_installed', sharing: false, isKnown: false });
  });

  it('expone sharing true cuando la api lo informa', async () => {
    vi.mocked(getModules).mockResolvedValue([
      { module: 'docs', status: 'available', features: { sharing: true } },
    ]);
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useModule('docs'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.sharing).toBe(true));
  });
});

describe('useModules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it('TS-10: consulta al montar y cada 60 s con key [modules]', async () => {
    vi.mocked(getModules).mockResolvedValue([]);
    const { Wrapper, client } = wrapper();
    renderHook(() => useModules(), { wrapper: Wrapper });
    await waitFor(() => expect(getModules).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await waitFor(() => expect(getModules).toHaveBeenCalledTimes(2));
    const query = client.getQueryCache().find({ queryKey: ['modules'] });
    expect(query).toBeDefined();
    expect((query!.observers[0].options as { refetchInterval: number }).refetchInterval).toBe(
      60_000
    );
  });
});
