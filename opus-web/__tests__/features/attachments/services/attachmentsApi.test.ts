import { attachmentsApi } from '@/features/attachments/services/attachmentsApi';
import { vi, type Mock } from 'vitest';

vi.mock('next-auth/react', () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
}));

const mockAttachment = {
  id: 123,
  entityType: 'comment_draft',
  entityId: 42,
  fileName: 'imagen.png',
  fileSize: 5000000,
  mimeType: 'image/png',
  storageKey: 'grava-gestion/comment_draft/42/uuid.png',
  retentionStatus: 'active',
  createdAt: '2026-04-23T10:00:00Z',
  updatedAt: '2026-04-23T10:00:00Z',
};

describe('attachmentsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('uploadFile', () => {
    it('construye FormData con los campos correctos y llama al backend directamente', async () => {
      const file = new File(['content'], 'imagen.png', { type: 'image/png' });
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockAttachment]),
      });

      await attachmentsApi.uploadFile('comment_draft', 42, file);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as Mock).mock.calls[0];
      expect(url).toContain('opus/attachments');
      expect(options.method).toBe('POST');
      expect(options.body).toBeInstanceOf(FormData);
      expect((options.body as FormData).get('entityType')).toBe('comment_draft');
      expect((options.body as FormData).get('entityId')).toBe('42');
      expect((options.body as FormData).get('files')).toBe(file);
    });

    it('retorna el array de Attachment del response', async () => {
      const file = new File(['content'], 'imagen.png', { type: 'image/png' });
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockAttachment]),
      });

      const result = await attachmentsApi.uploadFile('comment_draft', 42, file);

      expect(result).toEqual([mockAttachment]);
    });

    it('soporta entityType requirement_comment_draft', async () => {
      const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([{ ...mockAttachment, entityType: 'requirement_comment_draft' }]),
      });

      await attachmentsApi.uploadFile('requirement_comment_draft', 42, file);

      const [, options] = (global.fetch as Mock).mock.calls[0];
      expect((options.body as FormData).get('entityType')).toBe('requirement_comment_draft');
    });

    it('lanza error cuando el response no es ok', async () => {
      const file = new File(['content'], 'imagen.png', { type: 'image/png' });
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ code: 'no_files', message: 'At least one file is required' }),
      });

      await expect(attachmentsApi.uploadFile('comment_draft', 42, file)).rejects.toMatchObject({
        code: 'no_files',
        status: 400,
      });
    });
  });

  describe('getPreviewUrl', () => {
    it('retorna /api/attachments/{id}/preview', () => {
      expect(attachmentsApi.getPreviewUrl(123)).toBe('/api/attachments/123/preview');
    });

    it('retorna /api/attachments/{id}/preview con id diferente', () => {
      expect(attachmentsApi.getPreviewUrl(456)).toBe('/api/attachments/456/preview');
    });
  });
});
