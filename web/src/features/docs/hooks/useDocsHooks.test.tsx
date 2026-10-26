import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDocument, updateDocument } from '../services/docsApi';
import { uploadDocAttachment } from '../services/docsClientApi';
import { useCreateDocument } from './useCreateDocument';
import { useSaveDocument } from './useSaveDocument';
import { useUploadDocAttachment } from './useUploadDocAttachment';

vi.mock('../services/docsApi', () => ({
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
}));
vi.mock('../services/docsClientApi', () => ({ uploadDocAttachment: vi.fn() }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}

describe('useCreateDocument (TS-37)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalida carpeta y listados al crear', async () => {
    vi.mocked(createDocument).mockResolvedValue({ ok: true, data: { id: ID, version: 1 } });
    const { Wrapper, client } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateDocument(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: ID, content: 'x' });
    });
    await waitFor(() => expect(result.current.data).toEqual({ id: ID, version: 1 }));
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['docs-documents'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs', 'documents'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs', 'search'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs', 'topics'] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['docs-folder-contents', expect.anything()] });
  });

  it('re-lanza el DocsError de un resultado fallido', async () => {
    const error = { code: 'already_exists', message: 'Ya existe', status: 409 };
    vi.mocked(createDocument).mockResolvedValue({ ok: false, error });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useCreateDocument(), { wrapper: Wrapper });
    await act(async () => {
      result.current.mutate({ id: ID, content: 'x' });
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
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['docs-documents'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['docs', 'topics'] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['docs-folder-contents'] });
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
