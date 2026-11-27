import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, type Mock } from 'vitest';
import { modulesApi } from '../services/modulesApi';
import { useModule } from './useModules';

vi.mock('../services/modulesApi');
const mockGetAll = modulesApi.getAll as Mock;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useModule('docs'), { wrapper }) };
}

describe('useModule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-7: available con key [modules]', async () => {
    mockGetAll.mockResolvedValueOnce([
      { module: 'docs', status: 'available', features: { sharing: false } },
    ]);
    const { result, client } = setup();
    await waitFor(() => expect(result.current).toEqual({ status: 'available', isKnown: true }));
    expect(
      client.getQueryCache().find({ queryKey: ['modules'] })?.observers[0].options.refetchInterval
    ).toBe(60000);
  });

  it('TS-8: cargando y error se comportan como not_installed desconocido', async () => {
    mockGetAll.mockReturnValueOnce(new Promise(() => {}));
    expect(setup().result.current).toEqual({ status: 'not_installed', isKnown: false });

    mockGetAll.mockRejectedValueOnce({ code: 'unknown_error', message: 'x', status: 500 });
    const { result, client } = setup();
    await waitFor(() => expect(client.getQueryState(['modules'])?.status).toBe('error'));
    expect(result.current).toEqual({ status: 'not_installed', isKnown: false });
  });

  it('TS-9: sin entrada docs es not_installed conocido', async () => {
    mockGetAll.mockResolvedValueOnce([]);
    const { result } = setup();
    await waitFor(() => expect(result.current).toEqual({ status: 'not_installed', isKnown: true }));
  });
});
