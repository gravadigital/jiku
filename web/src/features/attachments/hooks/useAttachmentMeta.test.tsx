import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAttachmentMeta } from './useAttachmentMeta';

vi.mock('../services/attachmentsClientApi', () => ({
  getPreviewUrl: (id: number) => `/api/attachments/${id}/preview`,
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function mockFetchResponse({
  status = 200,
  ok = true,
  headers = {},
}: {
  status?: number;
  ok?: boolean;
  headers?: Record<string, string>;
}): Response {
  return {
    ok,
    status,
    headers: new Headers(headers),
  } as Response;
}

describe('useAttachmentMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('hace HEAD al endpoint de preview y devuelve metadata normalizada', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockFetchResponse({
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': '204800',
          'Content-Disposition': 'attachment; filename="reporte.pdf"',
        },
      })
    );

    const { result } = renderHook(() => useAttachmentMeta(42), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      id: 42,
      fileName: 'reporte.pdf',
      fileSize: 204800,
      mimeType: 'application/pdf',
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/attachments/42/preview', { method: 'HEAD' });
  });

  it('no vuelve a hacer fetch si se vuelve a montar el mismo queryClient (cache)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockFetchResponse({
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': '5000',
          'Content-Disposition': 'attachment; filename="img.png"',
        },
      })
    );

    const wrapper = createWrapper();
    const first = renderHook(() => useAttachmentMeta(7), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    first.unmount();

    const second = renderHook(() => useAttachmentMeta(7), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('expone el status 403 como error.status', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse({ status: 403, ok: false }));

    const { result } = renderHook(() => useAttachmentMeta(9), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(403);
  });

  it('usa "Adjunto N" cuando no hay Content-Disposition', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockFetchResponse({ headers: { 'Content-Type': 'application/octet-stream' } })
    );

    const { result } = renderHook(() => useAttachmentMeta(321), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.fileName).toBe('Adjunto 321');
    expect(result.current.data?.fileSize).toBeUndefined();
  });

  it('parsea nombres UTF-8 en Content-Disposition', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockFetchResponse({
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': "attachment; filename*=UTF-8''Mi%20archivo%20%C3%A9.txt",
        },
      })
    );

    const { result } = renderHook(() => useAttachmentMeta(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.fileName).toBe('Mi archivo é.txt');
  });
});
