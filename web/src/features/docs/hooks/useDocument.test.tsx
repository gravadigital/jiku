import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocument } from '../services/docsApi';
import { useDocument } from './useDocument';

vi.mock('../services/docsApi', () => ({ listDocuments: vi.fn(), getDocument: vi.fn() }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';

function setup() {
  // retry no se fuerza a false: se prueba la política del hook (retryDelay corto).
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}

describe('useDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no reintenta un 404', async () => {
    vi.mocked(getDocument).mockResolvedValue({
      ok: false,
      error: { code: 'document_not_found', status: 404 },
    } as never);
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDocument({ id: ID }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getDocument).toHaveBeenCalledTimes(1);
  });

  it('no reintenta module_unavailable e invalida [modules]', async () => {
    vi.mocked(getDocument).mockResolvedValue({
      ok: false,
      error: { code: 'module_unavailable', status: 503 },
    } as never);
    const { Wrapper, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDocument({ id: ID }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getDocument).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['modules'] });
  });

  it('reintenta una vez otros errores', async () => {
    vi.mocked(getDocument).mockResolvedValue({
      ok: false,
      error: { code: 'internal_error', status: 500 },
    } as never);
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDocument({ id: ID }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getDocument).toHaveBeenCalledTimes(2);
  });

  it('usa la key [docs-document, id] y respeta enabled', () => {
    const { Wrapper, client } = setup();
    renderHook(() => useDocument({ id: ID, enabled: false }), { wrapper: Wrapper });
    expect(getDocument).not.toHaveBeenCalled();
    expect(client.getQueryCache().find({ queryKey: ['docs-document', ID] })).toBeDefined();
  });
});

describe('useDocument (S-082)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P-2: un resultado fallido se re-lanza con su code intacto', async () => {
    const error = { code: 'document_not_found', message: 'x', status: 404 };
    vi.mocked(getDocument).mockResolvedValue({ ok: false, error });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDocument({ id: ID }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(error);
  });

  it('refetchInterval se pasa a la consulta', () => {
    const { Wrapper, client } = setup();
    renderHook(() => useDocument({ id: ID, enabled: false, refetchInterval: 60_000 }), {
      wrapper: Wrapper,
    });
    const query = client.getQueryCache().find({ queryKey: ['docs-document', ID] });
    expect((query?.observers[0].options as { refetchInterval?: unknown }).refetchInterval).toBe(
      60_000
    );
  });
});
