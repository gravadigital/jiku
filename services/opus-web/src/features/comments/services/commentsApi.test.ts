import { vi, type Mock } from 'vitest';
import { commentsApi } from './commentsApi';
import { apiClient } from '@/lib/axios';

vi.mock('@/lib/axios', () => ({
  apiClient: { post: vi.fn() },
}));

const mockPost = apiClient.post as unknown as Mock;

describe('commentsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: { id: 1 } });
  });

  it('TS-29: serializa fileIds al body del comentario', async () => {
    await commentsApi.create(7, { comment: 'hola', fileIds: [1234] });

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/api/opus/requirements/7/comments');
    expect(body).toEqual({ comment: 'hola', fileIds: [1234] });
    expect(body).not.toHaveProperty('attachmentIds');
  });

  it('un comentario sin adjuntos manda fileIds vacío', async () => {
    await commentsApi.create(7, { comment: 'hola', fileIds: [] });

    expect(mockPost.mock.calls[0][1]).toEqual({ comment: 'hola', fileIds: [] });
  });

  it('devuelve data y no la respuesta de axios', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 99 } });

    await expect(commentsApi.create(7, { comment: 'x' })).resolves.toEqual({ id: 99 });
  });
});
