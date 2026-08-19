import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { addRequirementActivity, getRequirements } from './requirementsApi';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

vi.mock('@/lib/axios', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('getRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
  });

  // TS-3 (S-066/CA-1): search debe serializarse en la query string enviada a GET /requirements
  it('TS-3: serializa "search" en la query string de GET /requirements (S-066)', async () => {
    await getRequirements({ search: 'login', page: 1 });

    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('search=login'));
  });
});

describe('addRequirementActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.post).mockResolvedValue({ data: undefined });
  });

  // AC-4 / TS-5: POST /requirements/{reqid}/comments con comment, visibilityLevel, fileIds
  it('TS-5 (AC-4): envía POST a /requirements/{reqid}/comments con fileIds', async () => {
    await addRequirementActivity(12, {
      comment: 'Mirá esto\n![attach:99]',
      visibilityLevel: 'internal',
      fileIds: [99],
    });

    expect(apiClient.post).toHaveBeenCalledWith('/requirements/12/comments', {
      comment: 'Mirá esto\n![attach:99]',
      visibilityLevel: 'internal',
      fileIds: [99],
    });
  });

  it('envía el comentario sin attachmentIds cuando no hay adjuntos', async () => {
    await addRequirementActivity(12, {
      comment: 'Solo texto',
      visibilityLevel: 'public',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/requirements/12/comments', {
      comment: 'Solo texto',
      visibilityLevel: 'public',
    });
  });
});
