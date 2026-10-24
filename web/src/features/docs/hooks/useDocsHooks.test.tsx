import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDocument,
  listDocuments,
  searchDocuments,
  updateDocument,
} from '../services/docsApi';
import { uploadDocAttachment } from '../services/docsClientApi';
import { listAllFolders, listFolders } from '../services/foldersApi';
import { useCreateDocument } from './useCreateDocument';
import { useDocsSearch } from './useDocsSearch';
import { useFolderContents } from './useFolderContents';
import { useRootFolders } from './useRootFolders';
import { useSaveDocument } from './useSaveDocument';
import { useUploadDocAttachment } from './useUploadDocAttachment';

vi.mock('../services/docsApi', () => ({
  listDocuments: vi.fn(),
  searchDocuments: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
}));
vi.mock('../services/foldersApi', () => ({
  listFolders: vi.fn(),
  listAllFolders: vi.fn(),
  getFolderTrail: vi.fn(),
}));
vi.mock('../services/docsClientApi', () => ({ uploadDocAttachment: vi.fn() }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const F0 = '01J9Z3K8M2Q4R6T8V0W2Y4A6F0';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}

const folderRow = (id: string) => ({ id, name: id, path: `/${id}/`, parentId: null }) as never;
const docRow = (id: string) => ({ id, title: id }) as never;

describe('useFolderContents (P-6)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-33: carpetas primero y luego documentos, con su cursor', async () => {
    vi.mocked(listFolders).mockResolvedValue({
      ok: true,
      data: { items: [folderRow('A')], page: { limit: 50, returned: 1 } },
    });
    vi.mocked(listDocuments)
      .mockResolvedValueOnce({
        ok: true,
        data: { items: [docRow('D')], page: { limit: 50, returned: 50, cursor: 'd2' } },
      })
      .mockResolvedValueOnce({ ok: true, data: { items: [], page: { limit: 50, returned: 0 } } });
    const { Wrapper, client } = setup();
    const { result } = renderHook(() => useFolderContents({ folderId: F0 }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(listFolders).toHaveBeenCalledWith({ parentId: F0, limit: 50, cursor: undefined });
    expect(result.current.data?.pages[0]).toMatchObject({
      folders: [folderRow('A')],
      documents: [],
    });
    expect(result.current.hasNextPage).toBe(true);
    expect(client.getQueryCache().find({ queryKey: ['docs-folder-contents', F0] })).toBeDefined();

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(listDocuments).toHaveBeenCalledWith({
      folderId: F0,
      sort: '-updatedAt',
      limit: 50,
      cursor: undefined,
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.data?.pages[1]).toMatchObject({ folders: [], documents: [docRow('D')] });
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(listDocuments).toHaveBeenLastCalledWith({
      folderId: F0,
      sort: '-updatedAt',
      limit: 50,
      cursor: 'd2',
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it('TS-34: sin subcarpetas la primera página ya trae documentos', async () => {
    vi.mocked(listFolders).mockResolvedValue({
      ok: true,
      data: { items: [], page: { limit: 50, returned: 0 } },
    });
    vi.mocked(listDocuments).mockResolvedValue({
      ok: true,
      data: { items: [docRow('D')], page: { limit: 50, returned: 1 } },
    });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useFolderContents({ folderId: F0 }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(result.current.data?.pages[0].documents).toEqual([docRow('D')]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('TS-36: module_unavailable invalida [modules] y no reintenta', async () => {
    vi.mocked(listFolders).mockResolvedValue({
      ok: false,
      error: { code: 'module_unavailable', message: 'x', status: 503 },
    });
    const { Wrapper, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useFolderContents({ folderId: F0 }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['modules'] });
    expect(listFolders).toHaveBeenCalledTimes(1);
  });

  it('sin folderId no consulta', () => {
    const { Wrapper } = setup();
    renderHook(() => useFolderContents({ folderId: undefined }), { wrapper: Wrapper });
    expect(listFolders).not.toHaveBeenCalled();
  });
});

describe('useRootFolders', () => {
  it('resuelve la raíz en select', async () => {
    vi.mocked(listAllFolders).mockResolvedValue({
      ok: true,
      data: [folderRow('A'), { ...(folderRow('B') as object), parentId: 'A' } as never],
    });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useRootFolders(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.root).toBeNull();
    expect(result.current.data?.tops.map((f) => f.id)).toEqual(['A']);
  });
});

describe('useDocsSearch (TS-35)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no consulta con menos de 2 caracteres y recorta el texto', async () => {
    vi.mocked(searchDocuments).mockResolvedValue({ ok: true, data: { items: [] } });
    const { Wrapper, client } = setup();
    renderHook(() => useDocsSearch({ q: 'd' }), { wrapper: Wrapper });
    expect(searchDocuments).not.toHaveBeenCalled();

    const { result } = renderHook(() => useDocsSearch({ q: ' de ' }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(searchDocuments).toHaveBeenCalledWith({ q: 'de' });
    expect(client.getQueryCache().find({ queryKey: ['docs-search', 'de'] })).toBeDefined();
  });
});

describe('useCreateDocument (TS-37)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalida carpeta y listados al crear', async () => {
    vi.mocked(createDocument).mockResolvedValue({ ok: true, data: { id: ID, version: 1 } });
    const { Wrapper, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateDocument(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ folderId: F0, fileName: 'guia.md', content: '' });
    });
    await waitFor(() => expect(result.current.data).toEqual({ id: ID, version: 1 }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs-folder-contents', F0] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs-documents'] });
  });

  it('re-lanza el DocsError de un resultado fallido', async () => {
    const error = { code: 'already_exists', message: 'Ya existe', status: 409 };
    vi.mocked(createDocument).mockResolvedValue({ ok: false, error });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useCreateDocument(), { wrapper: Wrapper });
    await act(async () => {
      result.current.mutate({ folderId: F0, fileName: 'guia.md', content: '' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(error);
  });
});

describe('useSaveDocument (TS-38)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('guarda, invalida y no reintenta', async () => {
    vi.mocked(updateDocument).mockResolvedValue({ ok: true, data: { id: ID, version: 7 } });
    const { Wrapper, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useSaveDocument(ID), { wrapper: Wrapper });
    const payload = { baseVersion: 6, content: '# Nuevo', sessionId: 'S', message: 'agrego pasos' };
    await act(async () => {
      await result.current.mutateAsync(payload);
    });
    expect(updateDocument).toHaveBeenCalledWith(ID, payload);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs-document', ID] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs-documents'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs-folder-contents'] });
  });

  it('con error hay una sola llamada', async () => {
    vi.mocked(updateDocument).mockResolvedValue({
      ok: false,
      error: { code: 'gateway_timeout', message: 'x', status: 504 },
    });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useSaveDocument(ID), { wrapper: Wrapper });
    await act(async () => {
      result.current.mutate({ baseVersion: 6, content: 'x' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(updateDocument).toHaveBeenCalledTimes(1);
  });
});

describe('useUploadDocAttachment (TS-45)', () => {
  it('sube e invalida el documento', async () => {
    const uploaded = { id: 'D1', fileName: 'diagrama.png', mimeType: 'image/png', link: 'l' };
    vi.mocked(uploadDocAttachment).mockResolvedValue(uploaded);
    const { Wrapper, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUploadDocAttachment(ID), { wrapper: Wrapper });
    const file = new File(['x'], 'diagrama.png', { type: 'image/png' });
    await act(async () => {
      await result.current.mutateAsync(file);
    });
    expect(uploadDocAttachment).toHaveBeenCalledWith(ID, file);
    await waitFor(() => expect(result.current.data).toEqual(uploaded));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs-document', ID] });
  });
});
