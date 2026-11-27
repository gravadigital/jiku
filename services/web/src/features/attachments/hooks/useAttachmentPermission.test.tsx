import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as attachmentsApi from '../services/attachmentsApi';
import { useAttachmentPermission } from './useAttachmentPermission';

vi.mock('../services/attachmentsApi', () => ({
  getAttachmentById: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('useAttachmentPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna data=true cuando el attachment es accesible', async () => {
    vi.mocked(attachmentsApi.getAttachmentById).mockResolvedValue({ id: 123 } as never);

    const { result } = renderHook(() => useAttachmentPermission(123, 'objective', 1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('retorna data=false cuando la API responde 403', async () => {
    vi.mocked(attachmentsApi.getAttachmentById).mockRejectedValue({
      status: 403,
      message: 'Forbidden',
    });

    const { result } = renderHook(() => useAttachmentPermission(456, 'objective', 1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('retorna data=false cuando la API responde 404', async () => {
    vi.mocked(attachmentsApi.getAttachmentById).mockRejectedValue({
      status: 404,
      message: 'Not Found',
    });

    const { result } = renderHook(() => useAttachmentPermission(999, 'objective', 1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('propaga el error cuando la API responde 500', async () => {
    vi.mocked(attachmentsApi.getAttachmentById).mockRejectedValue({
      status: 500,
      message: 'Server Error',
    });

    const { result } = renderHook(() => useAttachmentPermission(123, 'objective', 1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
  });

  it('tiene isLoading=true inicialmente', () => {
    vi.mocked(attachmentsApi.getAttachmentById).mockResolvedValue({ id: 123 } as never);

    const { result } = renderHook(() => useAttachmentPermission(123, 'objective', 1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });
});
