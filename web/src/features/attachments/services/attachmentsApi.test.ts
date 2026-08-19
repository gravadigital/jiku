import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestUploadTicket } from './attachmentsApi';

const post = vi.fn();

vi.mock('@/lib/axios', () => ({
  apiClient: {
    post: (...args: unknown[]) => post(...args),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('requestUploadTicket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pide el ticket con el body exacto del contrato y devuelve el UploadTicket', async () => {
    post.mockResolvedValue({
      data: {
        fileId: 1234,
        uploadUrl: 'https://bucket.test/f/abc.pdf?X-Amz-Signature=xyz',
        expiresIn: 300,
      },
    });

    const ticket = await requestUploadTicket({
      fileName: 'informe.pdf',
      mimeType: 'application/pdf',
      fileSize: 4194304,
      checksum: null,
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/attachments', {
      fileName: 'informe.pdf',
      mimeType: 'application/pdf',
      fileSize: 4194304,
      checksum: null,
    });
    expect(ticket).toEqual({
      fileId: 1234,
      uploadUrl: 'https://bucket.test/f/abc.pdf?X-Amz-Signature=xyz',
      expiresIn: 300,
    });
  });

  it('no manda entityType, entityId, description ni files', async () => {
    post.mockResolvedValue({ data: { fileId: 1, uploadUrl: 'https://b/x', expiresIn: 300 } });

    await requestUploadTicket({
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      fileSize: 100,
      checksum: null,
    });

    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ['checksum', 'fileName', 'fileSize', 'mimeType'].sort()
    );
    expect(body).not.toHaveProperty('entityType');
    expect(body).not.toHaveProperty('entityId');
    expect(body).not.toHaveProperty('description');
    expect(body).not.toHaveProperty('files');
  });

  it('manda checksum null cuando no se calcula', async () => {
    post.mockResolvedValue({ data: { fileId: 1, uploadUrl: 'https://b/x', expiresIn: 300 } });

    await requestUploadTicket({
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      fileSize: 100,
    });

    expect((post.mock.calls[0][1] as Record<string, unknown>).checksum).toBeNull();
  });

  it('propaga el error de la api sin envolverlo', async () => {
    const apiError = Object.assign(new Error('File too large'), {
      code: 'file_too_large',
      status: 400,
    });
    post.mockRejectedValue(apiError);

    await expect(
      requestUploadTicket({ fileName: 'a.pdf', mimeType: 'application/pdf', fileSize: 100 })
    ).rejects.toBe(apiError);
  });
});
