import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, type Mock } from 'vitest';
import { docsApi } from '../services/docsApi';
import { useDocument } from './useDocument';

vi.mock('../services/docsApi');
const mockGetById = docsApi.getById as Mock;
const DOC_ID = '01JC7Z4X9QH2M5N8R3T6V0W1YA';

function setup(params: Parameters<typeof useDocument>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useDocument(params), { wrapper }) };
}

describe('useDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-13: trae el documento con key docs-document', async () => {
    mockGetById.mockResolvedValueOnce({ id: DOC_ID, title: 'Guía de despliegue', updatedAt: 'x' });
    const { result, client } = setup({ documentId: DOC_ID, enabled: true });
    await waitFor(() => expect(result.current.data?.title).toBe('Guía de despliegue'));
    expect(client.getQueryCache().find({ queryKey: ['docs-document', DOC_ID] })).toBeDefined();
  });

  it('no consulta si está deshabilitado', () => {
    setup({ documentId: DOC_ID, enabled: false });
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it('module_unavailable invalida modules', async () => {
    mockGetById.mockRejectedValueOnce({ code: 'module_unavailable', message: 'x', status: 503 });
    const { result, client } = setup({ documentId: DOC_ID });
    const spy = vi.spyOn(client, 'invalidateQueries');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['modules'] });
  });
});
