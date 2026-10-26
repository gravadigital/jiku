import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDocsSuggestions,
  getSuggestedRelations,
  listDocuments,
  searchDocuments,
  updateRelations,
} from '../services/docsApi';
import { useAssignProject } from './useAssignProject';
import { useDocsHome } from './useDocsHome';
import { useDocsList } from './useDocsList';
import { useDocsSuggestions } from './useDocsSuggestions';
import { useDocsTextSearch } from './useDocsTextSearch';
import { useSuggestedRelations } from './useSuggestedRelations';

vi.mock('../services/docsApi', () => ({
  listDocuments: vi.fn(),
  searchDocuments: vi.fn(),
  getDocsSuggestions: vi.fn(),
  getSuggestedRelations: vi.fn(),
  updateRelations: vi.fn(),
}));

const ID_B = '01J9Z3K8M2Q4R6T8V0W2Y4A6D0';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}

const pageOf = (cursor?: string, total = 45) => ({
  ok: true as const,
  data: {
    items: [{ id: cursor ?? 'last' }] as never,
    page: { limit: 20, returned: 1, total, ...(cursor ? { cursor } : {}) },
  },
});

const FILTERS = { clientId: [4], sort: '-updatedAt', limit: 20, count: true } as const;

describe('useDocsList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-17: alcanza la página pedida encadenando cursores', async () => {
    vi.mocked(listDocuments)
      .mockResolvedValueOnce(pageOf('c1'))
      .mockResolvedValueOnce(pageOf('c2'))
      .mockResolvedValueOnce(pageOf());
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDocsList({ filters: FILTERS, pagina: 3 }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.pageItems).toBeDefined());
    expect(listDocuments).toHaveBeenCalledTimes(3);
    expect(listDocuments).toHaveBeenNthCalledWith(1, FILTERS);
    expect(listDocuments).toHaveBeenNthCalledWith(2, { ...FILTERS, cursor: 'c1' });
    expect(listDocuments).toHaveBeenNthCalledWith(3, { ...FILTERS, cursor: 'c2' });
    expect(result.current.pageItems).toEqual([{ id: 'last' }]);
    expect(result.current.total).toBe(45);
  });

  it('TS-18: con una página inexistente expone la última disponible', async () => {
    vi.mocked(listDocuments).mockResolvedValueOnce(pageOf('c1')).mockResolvedValueOnce(pageOf());
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDocsList({ filters: FILTERS, pagina: 5 }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.lastAvailablePage).toBe(2));
    expect(result.current.pageItems).toBeUndefined();
  });

  it('TS-49: module_unavailable invalida los módulos', async () => {
    const error = { code: 'module_unavailable', message: 'x', status: 503 };
    vi.mocked(listDocuments).mockResolvedValue({ ok: false, error });
    const { Wrapper, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDocsList({ filters: FILTERS, pagina: 1 }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['modules'] });
  });
});

describe('useDocsTextSearch y useDocsHome', () => {
  beforeEach(() => vi.clearAllMocks());

  it('busca solo con 2 caracteres o más', async () => {
    vi.mocked(searchDocuments).mockResolvedValue({ ok: true, data: { items: [] } });
    const { Wrapper } = setup();
    const { rerender } = renderHook(
      ({ q }: { q: string }) => useDocsTextSearch({ query: { q, limit: 50 } }),
      { wrapper: Wrapper, initialProps: { q: 'a' } }
    );
    expect(searchDocuments).not.toHaveBeenCalled();
    rerender({ q: 'ar' });
    await waitFor(() => expect(searchDocuments).toHaveBeenCalledWith({ q: 'ar', limit: 50 }));
  });

  it('inicio: pide mis proyectos activos y los recientes; si lo primero falla, queda vacío', async () => {
    vi.mocked(listDocuments).mockImplementation(async (filters) =>
      filters.myActiveProjects
        ? { ok: false, error: { code: 'internal_error', message: 'x', status: 500 } }
        : pageOf()
    );
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDocsHome({ sort: '-updatedAt' }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.recent).toBeDefined());
    expect(listDocuments).toHaveBeenCalledWith({
      myActiveProjects: true,
      sort: '-updatedAt',
      limit: 5,
    });
    expect(listDocuments).toHaveBeenCalledWith({ sort: '-updatedAt', limit: 20 });
    expect(result.current.mine).toEqual([]);
  });
});

describe('useAssignProject / useSuggestedRelations / useDocsSuggestions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-19: invalida al terminar, con éxito o con error', async () => {
    vi.mocked(updateRelations)
      .mockResolvedValueOnce({ ok: true, data: { id: ID_B, version: 4 } as never })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'version_conflict', message: 'x', status: 409 },
      });
    const { Wrapper, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useAssignProject(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: ID_B, baseVersion: 3, projectId: 12 });
    });
    expect(updateRelations).toHaveBeenCalledWith(ID_B, {
      baseVersion: 3,
      add: { projects: [12] },
    });
    for (const key of [['docs', 'documents'], ['docs', 'search'], ['docs-documents']]) {
      expect(spy).toHaveBeenCalledWith({ queryKey: key });
    }

    spy.mockClear();
    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: ID_B, baseVersion: 3, projectId: 12 })
      ).rejects.toMatchObject({ code: 'version_conflict' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs', 'documents'] });
  });

  it('TS-20: la sugerencia de relaciones se pide una vez', async () => {
    vi.mocked(getSuggestedRelations).mockResolvedValue({ ok: true, data: { items: [] } });
    const { Wrapper } = setup();
    const { result } = renderHook(
      () => [useSuggestedRelations({ id: ID_B }), useSuggestedRelations({ id: ID_B })],
      { wrapper: Wrapper }
    );
    await waitFor(() => expect(result.current[0].isSuccess).toBe(true));
    expect(getSuggestedRelations).toHaveBeenCalledTimes(1);
  });

  it('TS-21: sin llamada con q vacío; con q pide con el cliente', async () => {
    vi.mocked(getDocsSuggestions).mockResolvedValue({
      ok: true,
      data: { projects: [], clients: [], persons: [], topics: [] },
    });
    const { Wrapper, client } = setup();
    const { rerender } = renderHook(
      ({ q, clientId }: { q: string; clientId?: number }) => useDocsSuggestions({ q, clientId }),
      { wrapper: Wrapper, initialProps: { q: '' } as { q: string; clientId?: number } }
    );
    expect(getDocsSuggestions).not.toHaveBeenCalled();
    rerender({ q: 'vid', clientId: 4 });
    await waitFor(() => expect(getDocsSuggestions).toHaveBeenCalledWith({ q: 'vid', clientId: 4 }));
    expect(client.getQueryData(['docs', 'suggestions', 'vid', 4])).toBeDefined();
  });
});
