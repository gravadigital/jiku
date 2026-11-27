import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restoreVersion } from '../services/docsApi';
import { useRestoreVersion } from './useRestoreVersion';

vi.mock('../services/docsApi', () => ({ restoreVersion: vi.fn() }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const KEYS = [
  ['docs-document', ID],
  ['docs', 'versions', ID],
  ['docs', 'documents'],
  ['docs', 'search'],
];

function setup() {
  const client = new QueryClient();
  const spy = vi.spyOn(client, 'invalidateQueries');
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, spy };
}

describe('useRestoreVersion (TS-17)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalida en éxito y en error, y re-lanza el code', async () => {
    const { Wrapper, spy } = setup();
    const { result } = renderHook(() => useRestoreVersion(ID), { wrapper: Wrapper });

    vi.mocked(restoreVersion).mockResolvedValueOnce({ ok: true, data: { id: ID, version: 7 } });
    result.current.mutate({ fromVersion: 5, baseVersion: 6 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(restoreVersion).toHaveBeenCalledWith(ID, { fromVersion: 5, baseVersion: 6 });
    for (const queryKey of KEYS) expect(spy).toHaveBeenCalledWith({ queryKey });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['docs-documents'] });

    spy.mockClear();
    const error = { code: 'version_conflict', message: 'x', status: 409 };
    vi.mocked(restoreVersion).mockResolvedValueOnce({ ok: false, error });
    result.current.mutate({ fromVersion: 5, baseVersion: 6 });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 'version_conflict' });
    for (const queryKey of KEYS) expect(spy).toHaveBeenCalledWith({ queryKey });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['docs-documents'] });
  });
});
