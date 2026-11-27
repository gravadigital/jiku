import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { confirmAttachment, requestAttachmentUpload } from './docsAttachmentsApi';

vi.mock('@/lib/axios', () => ({ apiClient: { post: vi.fn() } }));

const DOC = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const ATT = '01J9Z3K8M2Q4R6T8V0W2Y4A6D1';

describe('adjuntos (TS-16)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pide la subida y confirma sin body, sin loguear la URL', async () => {
    const upload = {
      id: ATT,
      uploadUrl: 'https://s3.example.com/up?X-Amz-Signature=abc',
      expiresIn: 300,
      link: `https://jiku.example.com/docs/attachments/${ATT}`,
    };
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: upload })
      .mockResolvedValueOnce({ data: { id: ATT, status: 'ready' } });
    const spies = (['log', 'warn', 'error', 'info'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {})
    );
    const payload = {
      documentId: DOC,
      fileName: 'diagrama.png',
      mimeType: 'image/png',
      fileSize: 2048,
      checksum: `sha256:${'a'.repeat(64)}`,
    };

    await expect(requestAttachmentUpload(payload)).resolves.toEqual({ ok: true, data: upload });
    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/docs/attachments', payload);

    await expect(confirmAttachment(ATT)).resolves.toEqual({
      ok: true,
      data: { id: ATT, status: 'ready' },
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, `/docs/attachments/${ATT}/confirm`);

    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain('X-Amz-Signature');
    }
  });

  it('un error de la api no lanza', async () => {
    const error = {
      code: 'attachment_type_not_allowed',
      message: 'Tipo no permitido',
      status: 400,
    };
    vi.mocked(apiClient.post).mockRejectedValue(error);
    await expect(
      requestAttachmentUpload({
        documentId: DOC,
        fileName: 'a.exe',
        mimeType: 'x',
        fileSize: 1,
        checksum: `sha256:${'a'.repeat(64)}`,
      })
    ).resolves.toEqual({ ok: false, error });
  });
});
