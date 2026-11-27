import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRequirementWorkedHours } from '../services/requirementsApi';
import { useRequirementWorkedHours } from './useRequirementWorkedHours';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/lib/axios', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../services/requirementsApi', () => ({
  getRequirementWorkedHours: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
}

describe('useRequirementWorkedHours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TS-18 (S-045/CA-4, CA-8): la query key es ['requirement-worked-hours', reqid] y llama a la
  // Server Action con el reqid
  it('TS-18: usa la queryKey ["requirement-worked-hours", reqid] y llama a la Server Action (S-045)', async () => {
    const responseData = {
      requirementId: 12,
      totalMinutes: 300,
      byPerson: [{ personId: 7, firstName: 'Ana', lastName: 'García', minutes: 300 }],
    };
    vi.mocked(getRequirementWorkedHours).mockResolvedValue(responseData);

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useRequirementWorkedHours(12), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(responseData);
    expect(getRequirementWorkedHours).toHaveBeenCalledWith(12);

    // El Story Plan pide verificar la entrada literal en el queryClient, no solo el resultado
    // del hook: es lo que confirma que la key es exactamente ['requirement-worked-hours', 12]
    // y no otra que coincida por casualidad con el mismo dato.
    const cacheEntry = queryClient
      .getQueryCache()
      .find({ queryKey: ['requirement-worked-hours', 12] });
    expect(cacheEntry).toBeDefined();
    expect(cacheEntry?.state.data).toEqual(responseData);
  });
});
