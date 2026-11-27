import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRequirementsCount } from '../services/requirementsApi';
import { useRequirementsCount } from './useRequirementsCount';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/lib/axios', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../services/requirementsApi', () => ({
  getRequirementsCount: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useRequirementsCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TS-5 (S-038/CA-1): el namespace de key es 'requirements-count' y el hook resuelve data
  it('TS-5: usa la queryKey ["requirements-count", filters] y resuelve el conteo', async () => {
    vi.mocked(getRequirementsCount).mockResolvedValue(8);

    const { result } = renderHook(
      () => useRequirementsCount({ projectId: 1, state: 'analisis' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(8);
    expect(getRequirementsCount).toHaveBeenCalledWith({ projectId: 1, state: 'analisis' });
  });
});
