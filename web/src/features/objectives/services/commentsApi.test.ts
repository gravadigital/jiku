import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { updateComment } from './commentsApi';

vi.mock('@/lib/axios', () => ({
  apiClient: {
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('updateComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.patch).mockResolvedValue({ data: undefined });
  });

  // TS-31 (S-048/CA-2, CA-3): PATCH /objectives/{id}/comment/{cid} (singular) con fileIds
  it('TS-31: llama a PATCH /objectives/{id}/comment/{cid} con fileIds (S-048)', async () => {
    await updateComment(5, 7, { comment: 'texto', fileIds: [3] });

    expect(apiClient.patch).toHaveBeenCalledWith('/objectives/5/comment/7', {
      comment: 'texto',
      fileIds: [3],
    });
  });

  it('sin fileIds, el body no incluye la clave', async () => {
    await updateComment(5, 7, { comment: 'solo texto' });

    expect(apiClient.patch).toHaveBeenCalledWith('/objectives/5/comment/7', {
      comment: 'solo texto',
    });
    const [, body] = vi.mocked(apiClient.patch).mock.calls[0];
    expect(body).not.toHaveProperty('fileIds');
  });
});
