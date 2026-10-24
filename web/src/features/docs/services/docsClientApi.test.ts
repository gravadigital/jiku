import { describe, it, expect, vi, beforeEach } from 'vitest';
import { putFileToStorage } from '@/features/attachments/services/attachmentsClientApi';
import { confirmAttachment, requestAttachmentUpload } from './docsAttachmentsApi';
import { releaseLockKeepalive, uploadDocAttachment } from './docsClientApi';

vi.mock('./docsAttachmentsApi', () => ({
  requestAttachmentUpload: vi.fn(),
  confirmAttachment: vi.fn(),
}));
vi.mock('@/features/attachments/services/attachmentsClientApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  putFileToStorage: vi.fn(),
}));

const DOC = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const SESSION = '01J9Z3K8M2Q4R6T8V0W2Y4A6E2';
const ATT = '01J9Z3K8M2Q4R6T8V0W2Y4A6D1';
const LINK = `https://jiku.example.com/docs/attachments/${ATT}`;

describe('releaseLockKeepalive (TS-30)', () => {
  it('manda el pedido con keepalive y se traga el fallo', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => releaseLockKeepalive(DOC, SESSION)).not.toThrow();
    await Promise.resolve();
    expect(global.fetch).toHaveBeenCalledWith(`/api/docs/documents/${DOC}/unlock`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: `{"sessionId":"${SESSION}"}`,
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('uploadDocAttachment', () => {
  const file = new File(['abc'], 'diagrama.png', { type: 'image/png' });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requestAttachmentUpload).mockResolvedValue({
      ok: true,
      data: { id: ATT, uploadUrl: 'https://s3.example.com/up', expiresIn: 300, link: LINK },
    });
    vi.mocked(putFileToStorage).mockResolvedValue(undefined);
    vi.mocked(confirmAttachment).mockResolvedValue({
      ok: true,
      data: { id: ATT, status: 'ready' },
    });
  });

  it('TS-31: compone los pasos en orden', async () => {
    const result = await uploadDocAttachment(DOC, file);
    expect(requestAttachmentUpload).toHaveBeenCalledWith({
      documentId: DOC,
      fileName: 'diagrama.png',
      mimeType: 'image/png',
      fileSize: 3,
      checksum: 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
    expect(putFileToStorage).toHaveBeenCalledWith({
      uploadUrl: 'https://s3.example.com/up',
      file,
      onProgress: undefined,
    });
    expect(confirmAttachment).toHaveBeenCalledWith(ATT);
    expect(result).toEqual({
      id: ATT,
      fileName: 'diagrama.png',
      mimeType: 'image/png',
      link: LINK,
    });
  });

  it('TS-32a: un rechazo del pedido corta antes de subir', async () => {
    const error = {
      code: 'attachment_type_not_allowed',
      message: 'Tipo no permitido',
      status: 400,
    };
    vi.mocked(requestAttachmentUpload).mockResolvedValue({ ok: false, error });
    await expect(uploadDocAttachment(DOC, file)).rejects.toEqual(error);
    expect(putFileToStorage).not.toHaveBeenCalled();
  });

  it('TS-32b: URL vencida se mapea a expired_upload_url y no confirma', async () => {
    const expired = Object.assign(new Error('venció'), { code: 'expired_upload_url' });
    vi.mocked(putFileToStorage).mockRejectedValue(expired);
    await expect(uploadDocAttachment(DOC, file)).rejects.toMatchObject({
      code: 'expired_upload_url',
      status: 403,
    });
    expect(confirmAttachment).not.toHaveBeenCalled();
  });

  it('TS-32c: la confirmación que falla rechaza con su error', async () => {
    const error = { code: 'checksum_mismatch', message: 'x', status: 400 };
    vi.mocked(confirmAttachment).mockResolvedValue({ ok: false, error });
    await expect(uploadDocAttachment(DOC, file)).rejects.toEqual(error);
  });

  it('TS-32d: sin type usa application/octet-stream', async () => {
    await uploadDocAttachment(DOC, new File(['abc'], 'raro'));
    expect(vi.mocked(requestAttachmentUpload).mock.calls[0][0].mimeType).toBe(
      'application/octet-stream'
    );
  });
});
