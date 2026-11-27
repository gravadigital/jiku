import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  putFileToStorage,
  uploadFile,
  getPreviewUrl,
  getDownloadUrl,
  getFilePreviewUrl,
  isExpiredUploadUrlError,
} from './attachmentsClientApi';

const requestUploadTicket = vi.fn();

vi.mock('./attachmentsApi', () => ({
  requestUploadTicket: (...args: unknown[]) => requestUploadTicket(...args),
}));

interface XhrStub {
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  addEventListener: (event: string, cb: () => void) => void;
  upload: { addEventListener: (event: string, cb: (e: ProgressEvent) => void) => void };
  status: number;
  responseText: string;
  fire: (event: string) => void;
  fireProgress: (e: Partial<ProgressEvent>) => void;
}

function installXhrStub(): XhrStub[] {
  const created: XhrStub[] = [];
  class FakeXhr {
    open = vi.fn();
    send = vi.fn();
    setRequestHeader = vi.fn();
    status = 200;
    responseText = '';
    private listeners: Record<string, Array<() => void>> = {};
    private progressListeners: Array<(e: ProgressEvent) => void> = [];
    upload = {
      addEventListener: (event: string, cb: (e: ProgressEvent) => void) => {
        if (event === 'progress') this.progressListeners.push(cb);
      },
    };
    addEventListener = (event: string, cb: () => void) => {
      (this.listeners[event] ??= []).push(cb);
    };
    fire = (event: string) => {
      (this.listeners[event] ?? []).forEach((cb) => cb());
    };
    fireProgress = (e: Partial<ProgressEvent>) => {
      this.progressListeners.forEach((cb) => cb(e as ProgressEvent));
    };
    constructor() {
      created.push(this as unknown as XhrStub);
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXhr as unknown as typeof XMLHttpRequest);
  return created;
}

function makeFile(name = 'informe.pdf', type = 'application/pdf'): File {
  return new File(['x'], name, { type });
}

describe('putFileToStorage', () => {
  let xhrs: XhrStub[];

  beforeEach(() => {
    vi.clearAllMocks();
    xhrs = installXhrStub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hace el PUT contra la uploadUrl de S3 y manda el File crudo', async () => {
    const file = makeFile();
    const promise = putFileToStorage({
      uploadUrl: 'https://bucket.test/f/abc.pdf?X-Amz-Signature=xyz',
      file,
    });
    const xhr = xhrs[0];
    xhr.status = 200;
    xhr.fire('load');
    await promise;

    expect(xhr.open).toHaveBeenCalledWith(
      'PUT',
      'https://bucket.test/f/abc.pdf?X-Amz-Signature=xyz'
    );
    const openedUrl = xhr.open.mock.calls[0][1] as string;
    expect(openedUrl.startsWith('/api/')).toBe(false);
    expect(xhr.send).toHaveBeenCalledWith(file);
    expect(xhr.send.mock.calls[0][0]).not.toBeInstanceOf(FormData);
  });

  it('no manda el header Authorization', async () => {
    const promise = putFileToStorage({
      uploadUrl: 'https://bucket.test/f/abc.pdf?sig',
      file: makeFile(),
    });
    const xhr = xhrs[0];
    xhr.status = 200;
    xhr.fire('load');
    await promise;

    const headers = xhr.setRequestHeader.mock.calls.map((call) => call[0]);
    expect(headers).not.toContain('Authorization');
  });

  it('reporta el progreso real desde upload.onprogress', async () => {
    const onProgress = vi.fn();
    const promise = putFileToStorage({
      uploadUrl: 'https://bucket.test/f/abc.pdf?sig',
      file: makeFile(),
      onProgress,
    });
    const xhr = xhrs[0];
    xhr.fireProgress({ lengthComputable: true, loaded: 2097152, total: 4194304 });
    expect(onProgress).toHaveBeenCalledWith(50);

    xhr.status = 200;
    xhr.fire('load');
    await promise;
  });

  it('ignora el progreso cuando el tamaño no es computable', async () => {
    const onProgress = vi.fn();
    const promise = putFileToStorage({
      uploadUrl: 'https://bucket.test/f/abc.pdf?sig',
      file: makeFile(),
      onProgress,
    });
    const xhr = xhrs[0];
    xhr.fireProgress({ lengthComputable: false, loaded: 10, total: 0 });
    expect(onProgress).not.toHaveBeenCalled();

    xhr.status = 200;
    xhr.fire('load');
    await promise;
  });

  it('el 403 de URL vencida falla de forma distinguible y en español', async () => {
    const promise = putFileToStorage({
      uploadUrl: 'https://bucket.test/f/abc.pdf?sig',
      file: makeFile(),
    });
    const xhr = xhrs[0];
    xhr.status = 403;
    xhr.fire('load');

    await expect(promise).rejects.toThrowError(/venc/i);
    await promise.catch((error: unknown) => {
      expect(isExpiredUploadUrlError(error)).toBe(true);
    });
  });

  it('el fallo de red rechaza con el mensaje de red', async () => {
    const promise = putFileToStorage({
      uploadUrl: 'https://bucket.test/f/abc.pdf?sig',
      file: makeFile(),
    });
    xhrs[0].fire('error');
    await expect(promise).rejects.toThrowError('Error de red al subir el archivo');
  });

  it('un status fuera de 2xx distinto de 403 rechaza con un mensaje legible', async () => {
    const promise = putFileToStorage({
      uploadUrl: 'https://bucket.test/f/abc.pdf?sig',
      file: makeFile(),
    });
    const xhr = xhrs[0];
    xhr.status = 500;
    xhr.fire('load');
    await expect(promise).rejects.toThrowError(/Hubo un error al subir el archivo/);
  });
});

describe('uploadFile', () => {
  let xhrs: XhrStub[];

  beforeEach(() => {
    vi.clearAllMocks();
    xhrs = installXhrStub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('compone ticket → PUT → fileId', async () => {
    requestUploadTicket.mockResolvedValue({
      fileId: 1234,
      uploadUrl: 'https://bucket.test/f/abc.pdf?sig',
      expiresIn: 300,
    });
    const file = makeFile('informe.pdf');
    const promise = uploadFile(file);
    await vi.waitFor(() => expect(xhrs.length).toBe(1));

    const xhr = xhrs[0];
    xhr.status = 200;
    xhr.fire('load');

    await expect(promise).resolves.toBe(1234);
    expect(requestUploadTicket).toHaveBeenCalledWith({
      fileName: 'informe.pdf',
      mimeType: 'application/pdf',
      fileSize: file.size,
      checksum: null,
    });
    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://bucket.test/f/abc.pdf?sig');
  });

  it('propaga el error del ticket sin hacer el PUT', async () => {
    requestUploadTicket.mockRejectedValue(
      Object.assign(new Error('File too large'), { code: 'file_too_large', status: 400 })
    );
    await expect(uploadFile(makeFile())).rejects.toThrowError('File too large');
    expect(xhrs.length).toBe(0);
  });
});

describe('urls de lectura', () => {
  it('getPreviewUrl y getDownloadUrl resuelven por id de vínculo', () => {
    expect(getPreviewUrl(42)).toBe('/api/attachments/42/preview');
    expect(getDownloadUrl(42)).toBe('/api/attachments/42/download');
  });

  it('getFilePreviewUrl resuelve por fileId, no por id de vínculo', () => {
    expect(getFilePreviewUrl(1234)).toBe('/api/files/1234/preview');
    expect(getFilePreviewUrl(1234)).not.toBe('/api/attachments/1234/preview');
  });
});
