import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, type Mock } from 'vitest';
import { docsApi } from '../services/docsApi';
import { useDocuments } from './useDocuments';

vi.mock('../services/docsApi');
const mockList = docsApi.list as Mock;

const item = (id: string) => ({ id, title: id, updatedAt: '2026-10-20T14:30:00.000Z' });

function setup(params: Parameters<typeof useDocuments>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useDocuments(params), { wrapper }) };
}

describe('useDocuments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-10: pagina por cursor', async () => {
    mockList
      .mockResolvedValueOnce({
        items: ['a', 'b', 'c', 'd', 'e'].map(item),
        page: { limit: 5, returned: 5, cursor: 'c2' },
      })
      .mockResolvedValueOnce({ items: [item('f')], page: { limit: 5, returned: 1 } });
    const { result, client } = setup({ projectId: 12, enabled: true });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(
      client.getQueryCache().find({ queryKey: ['docs-documents', { projectId: 12 }] })
    ).toBeDefined();
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(mockList).toHaveBeenLastCalledWith({ projectId: 12 }, 'c2');
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.data?.pages.flatMap((p) => p.items)).toHaveLength(6);
  });

  it('TS-11: deshabilitado no llama', () => {
    setup({ projectId: 12, enabled: false });
    expect(mockList).not.toHaveBeenCalled();
  });

  it('TS-12: module_unavailable invalida modules y relanza', async () => {
    const error = { code: 'module_unavailable', message: 'x', status: 503 };
    mockList.mockRejectedValueOnce(error);
    const { result, client } = setup({ projectId: 12 });
    const spy = vi.spyOn(client, 'invalidateQueries');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['modules'] });
    expect(result.current.error).toEqual(error);
  });

  it('usa la key por requisito', async () => {
    mockList.mockResolvedValueOnce({ items: [], page: { limit: 5, returned: 0 } });
    const { result, client } = setup({ requirementId: 345 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockList).toHaveBeenCalledWith({ requirementId: 345 }, undefined);
    expect(
      client.getQueryCache().find({ queryKey: ['docs-documents', { requirementId: 345 }] })
    ).toBeDefined();
  });
});
