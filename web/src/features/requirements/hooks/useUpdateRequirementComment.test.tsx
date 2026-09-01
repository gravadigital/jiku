import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateRequirementComment } from '../services/requirementsApi';
import { useUpdateRequirementComment } from './useUpdateRequirementComment';

vi.mock('../services/requirementsApi', () => ({
  updateRequirementComment: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe('useUpdateRequirementComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TS-4 (S-048/CA-1): invalida ['requirement', reqid] en onSuccess
  it('TS-4: invalida ["requirement", reqid] en onSuccess (S-048)', async () => {
    vi.mocked(updateRequirementComment).mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateRequirementComment(12), { wrapper: Wrapper });
    result.current.mutate({ cid: 7, comment: 'nuevo', fileIds: [] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['requirement', 12] });
  });

  // TS-5 (S-048/CA-3): invalida también los adjuntos del comentario editado
  it('TS-5: invalida ["attachments", "requirement_comment", cid] en onSuccess (S-048)', async () => {
    vi.mocked(updateRequirementComment).mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateRequirementComment(12), { wrapper: Wrapper });
    result.current.mutate({ cid: 7, comment: 'nuevo', fileIds: [3] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['attachments', 'requirement_comment', 7],
    });
  });

  it('llama a la Server Action con reqid, cid y el payload', async () => {
    vi.mocked(updateRequirementComment).mockResolvedValue(undefined);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateRequirementComment(12), { wrapper: Wrapper });
    result.current.mutate({ cid: 7, comment: 'texto', fileIds: [3, 9] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updateRequirementComment).toHaveBeenCalledWith(12, 7, {
      comment: 'texto',
      fileIds: [3, 9],
    });
  });
});
