import { vi, type Mock } from 'vitest';
import { attachmentsApi } from './attachmentsApi';
import { apiClient } from '@/lib/axios';

vi.mock('@/lib/axios', () => ({
  apiClient: { post: vi.fn() },
}));

const mockPost = apiClient.post as unknown as Mock;

/**
 * XHR falso: los tests disparan los callbacks a mano. No se mockea `fetch`, esta capa
 * ya no lo usa.
 */
class FakeXhr {
  static instances: FakeXhr[] = [];

  status = 0;
  responseText = '';
  withCredentials = false;
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  open = vi.fn();
  send = vi.fn();
  setRequestHeader = vi.fn();

  constructor() {
    FakeXhr.instances.push(this);
  }

  static get last(): FakeXhr {
    return FakeXhr.instances[FakeXhr.instances.length - 1];
  }

  emitProgress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.({ loaded, total, lengthComputable } as ProgressEvent);
  }

  finish(status: number) {
    this.status = status;
    this.onload?.();
  }

  failNetwork() {
    this.status = 0;
    this.onerror?.();
  }

  abort() {
    this.onabort?.();
  }
}

const ticket = {
  fileId: 1234,
  uploadUrl: 'https://bucket.test/f/abc.pdf?X-Amz-Signature=xyz',
  expiresIn: 300,
};

describe('attachmentsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeXhr.instances = [];
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('requestUploadTicket', () => {
    it('TS-1: pide el ticket con JSON y un archivo por request', async () => {
      mockPost.mockResolvedValueOnce({ data: ticket });

      const result = await attachmentsApi.requestUploadTicket({
        fileName: 'informe.pdf',
        mimeType: 'application/pdf',
        fileSize: 4194304,
      });

      expect(mockPost).toHaveBeenCalledTimes(1);
      const [url, body] = mockPost.mock.calls[0];
      expect(url).toBe('/api/opus/attachments');
      expect(body).toEqual({
        fileName: 'informe.pdf',
        mimeType: 'application/pdf',
        fileSize: 4194304,
        checksum: null,
      });
      expect(body).not.toBeInstanceOf(FormData);
      expect(result).toEqual(ticket);
    });

    it('TS-2: el body no lleva entityType, entityId, files ni description', async () => {
      mockPost.mockResolvedValueOnce({ data: ticket });

      await attachmentsApi.requestUploadTicket({
        fileName: 'a.png',
        mimeType: 'image/png',
        fileSize: 1024,
      });

      const [, body] = mockPost.mock.calls[0];
      expect(Object.keys(body)).toEqual(['fileName', 'mimeType', 'fileSize', 'checksum']);
      expect(body).not.toHaveProperty('entityType');
      expect(body).not.toHaveProperty('entityId');
      expect(body).not.toHaveProperty('files');
      expect(body).not.toHaveProperty('description');
    });
  });

  describe('putFileToStorage', () => {
    const file = new File(['x'], 'informe.pdf', { type: 'application/pdf' });

    it('TS-3: hace PUT a la uploadUrl con el File crudo, sin withCredentials', async () => {
      const promise = attachmentsApi.putFileToStorage(ticket.uploadUrl, file, vi.fn());

      const xhr = FakeXhr.last;
      expect(xhr.open).toHaveBeenCalledWith('PUT', ticket.uploadUrl);
      expect(xhr.send).toHaveBeenCalledWith(file);
      expect(xhr.send.mock.calls[0][0]).not.toBeInstanceOf(FormData);
      expect(xhr.withCredentials).toBe(false);

      xhr.finish(200);
      await promise;
    });

    it('TS-4: reporta el porcentaje real', async () => {
      const onProgress = vi.fn();
      const promise = attachmentsApi.putFileToStorage(ticket.uploadUrl, file, onProgress);

      const xhr = FakeXhr.last;
      xhr.emitProgress(2097152, 4194304);
      expect(onProgress).toHaveBeenCalledWith(50);

      xhr.finish(200);
      await promise;
    });

    it('TS-5: un PUT 200 resuelve, con progreso reportado antes', async () => {
      const onProgress = vi.fn();
      const promise = attachmentsApi.putFileToStorage(ticket.uploadUrl, file, onProgress);

      const xhr = FakeXhr.last;
      xhr.emitProgress(4194304, 4194304);
      xhr.finish(200);

      await expect(promise).resolves.toBeUndefined();
      expect(onProgress).toHaveBeenCalled();
    });

    it('TS-6: una URL vencida rechaza con upload_url_expired y no reintenta', async () => {
      const promise = attachmentsApi.putFileToStorage(ticket.uploadUrl, file, vi.fn());

      const xhr = FakeXhr.last;
      xhr.finish(403);

      await expect(promise).rejects.toMatchObject({
        code: 'upload_url_expired',
        status: 403,
      });
      expect(xhr.send).toHaveBeenCalledTimes(1);
      expect(FakeXhr.instances).toHaveLength(1);
    });

    it('TS-7: un fallo de red o CORS rechaza con upload_network_error y status 0', async () => {
      const promise = attachmentsApi.putFileToStorage(ticket.uploadUrl, file, vi.fn());

      const xhr = FakeXhr.last;
      xhr.responseText = '<Error><Code>NoSuchKey</Code></Error>';
      xhr.failNetwork();

      await expect(promise).rejects.toMatchObject({
        code: 'upload_network_error',
        status: 0,
      });
    });

    it('un abort rechaza con upload_aborted', async () => {
      const promise = attachmentsApi.putFileToStorage(ticket.uploadUrl, file, vi.fn());

      FakeXhr.last.abort();

      await expect(promise).rejects.toMatchObject({ code: 'upload_aborted' });
    });

    it('declara el Content-Type del ticket', async () => {
      const promise = attachmentsApi.putFileToStorage(
        ticket.uploadUrl,
        file,
        vi.fn(),
        'application/pdf'
      );

      const xhr = FakeXhr.last;
      expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');

      xhr.finish(200);
      await promise;
    });
  });

  describe('uploadFile', () => {
    it('TS-8: compone ticket + PUT y resuelve con el fileId y los metadatos del File', async () => {
      const file = new File(['x'], 'informe.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 4194304 });
      mockPost.mockResolvedValueOnce({ data: ticket });

      const promise = attachmentsApi.uploadFile(file, vi.fn());

      await vi.waitFor(() => expect(FakeXhr.instances).toHaveLength(1));
      // El ticket se pidió antes del PUT.
      expect(mockPost).toHaveBeenCalledTimes(1);
      FakeXhr.last.finish(200);

      await expect(promise).resolves.toEqual({
        fileId: 1234,
        fileName: 'informe.pdf',
        mimeType: 'application/pdf',
        fileSize: 4194304,
      });
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(FakeXhr.last.send).toHaveBeenCalledTimes(1);
    });

    it('TS-31: no manda ningún entityType ni la cadena requirement_draft', async () => {
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      mockPost.mockResolvedValueOnce({ data: ticket });

      const promise = attachmentsApi.uploadFile(file, vi.fn());
      await vi.waitFor(() => expect(FakeXhr.instances).toHaveLength(1));
      FakeXhr.last.finish(200);
      await promise;

      expect(JSON.stringify(mockPost.mock.calls[0][1])).not.toContain('requirement_draft');
      expect(mockPost.mock.calls[0][1]).not.toHaveProperty('entityType');
    });
  });

  describe('URLs de preview', () => {
    it('TS-9: getFilePreviewUrl apunta al espacio de ids de files', () => {
      expect(attachmentsApi.getFilePreviewUrl(1234)).toBe('/api/files/1234/preview');
    });

    it('TS-10: getPreviewUrl (adjunto vinculado) no cambia', () => {
      expect(attachmentsApi.getPreviewUrl(77)).toBe('/api/attachments/77/preview');
    });
  });
});
