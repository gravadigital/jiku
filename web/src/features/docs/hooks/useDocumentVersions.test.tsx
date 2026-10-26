import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listVersions } from '../services/docsApi';
import { useDocumentVersions } from './useDocumentVersions';

vi.mock('../services/docsApi', () => ({ listVersions: vi.fn() }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';

function setup() {
  const client = new QueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}

describe('useDocumentVersions (TS-16)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pagina por cursor y termina cuando no hay cursor', async () => {
    vi.mocked(listVersions)
      .mockResolvedValueOnce({
        ok: true,
        data: { items: [], page: { limit: 50, returned: 0, cursor: 'c1' } },
      })
      .mockResolvedValueOnce({ ok: true, data: { items: [], page: { limit: 50, returned: 0 } } });
    const { Wrapper, client } = setup();
    const { result } = renderHook(() => useDocumentVersions({ id: ID }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listVersions).toHaveBeenNthCalledWith(1, ID, {});
    expect(result.current.hasNextPage).toBe(true);
    expect(client.getQueryCache().find({ queryKey: ['docs', 'versions', ID] })).toBeDefined();
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(listVersions).toHaveBeenNthCalledWith(2, ID, { cursor: 'c1' });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it('con enabled false no llama', () => {
    const { Wrapper } = setup();
    renderHook(() => useDocumentVersions({ id: ID, enabled: false }), { wrapper: Wrapper });
    expect(listVersions).not.toHaveBeenCalled();
  });
});
