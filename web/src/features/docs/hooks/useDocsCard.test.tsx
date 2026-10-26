import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listDocuments } from '../services/docsApi';
import { cardFilters } from '../utils/docsCard';
import { useDocsCard } from './useDocsCard';
import type { DocsDocumentPage } from '../types/docs.types';

vi.mock('../services/docsApi', () => ({ listDocuments: vi.fn() }));

const PAGE = { items: [], page: { limit: 5, returned: 0, total: 0 } } as DocsDocumentPage;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}

describe('useDocsCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-5: una sola consulta, sin cursor, con la key de la card', async () => {
    vi.mocked(listDocuments).mockResolvedValue({ ok: true, data: PAGE });
    const { Wrapper, client } = setup();
    const filters = cardFilters({ projectId: 12 });
    const { result } = renderHook(() => useDocsCard({ filters, enabled: true }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(PAGE));
    expect(listDocuments).toHaveBeenCalledTimes(1);
    expect(listDocuments).toHaveBeenCalledWith({
      projectId: [12],
      count: true,
      sort: '-updatedAt',
      limit: 5,
    });
    expect(
      client.getQueryCache().find({ queryKey: ['docs', 'documents', 'card', filters] })
    ).toBeDefined();
  });

  it('TS-6: deshabilitado no consulta; el error invalida [modules] y no reintenta', async () => {
    const { Wrapper, client } = setup();
    const filters = cardFilters({ projectId: 12 });
    renderHook(() => useDocsCard({ filters, enabled: false }), { wrapper: Wrapper });
    expect(listDocuments).not.toHaveBeenCalled();

    vi.mocked(listDocuments).mockResolvedValue({
      ok: false,
      error: { code: 'module_unavailable', status: 503, message: 'Unavailable' },
    } as never);
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDocsCard({ filters, enabled: true }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['modules'] });
    expect(listDocuments).toHaveBeenCalledTimes(1);
  });
});
