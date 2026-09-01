import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { addRequirementActivity, getRequirements, getRequirementsCount } from './requirementsApi';

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

  // TS-16 (S-041/CA-6): el CSV de estados llega tal cual a la api
  it('TS-16: el CSV de estados llega tal cual a la api (S-041)', async () => {
    await getRequirements({ state: 'desarrollo,revision', page: 1, limit: 15 });

    const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/state=desarrollo(%2C|,)revision/);
  });

  // TS-17 (S-041/CA-4): el sentinel 'all' se descarta al serializar, la request sale sin state
  it('TS-17: el sentinel "all" se descarta y la request sale sin "state" (S-041)', async () => {
    await getRequirements({ state: 'all', page: 1, limit: 15 });

    const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('state');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('limit=15');
  });
});

describe('getRequirementsCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: 12 });
  });

  // TS-1 (S-038/CA-1): count viaja dentro del objeto de filtros, no concatenado a mano
  it('TS-1: pasa "count" dentro del objeto de filtros, sin "?&" ni "&&" en la URL', async () => {
    await getRequirementsCount({ projectId: 1, state: 'desarrollo' });

    const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string;
    expect(calledUrl).toBe('/requirements?projectId=1&state=desarrollo&count=true');
    expect(calledUrl).not.toContain('?&');
    expect(calledUrl).not.toContain('&&');
  });

  // TS-2 (S-038/CA-1): la respuesta es el número crudo, no un sobre
  it('TS-2: devuelve el número crudo devuelto por la api', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: 12 });

    const result = await getRequirementsCount({ projectId: 1, state: 'desarrollo' });

    expect(result).toBe(12);
    expect(typeof result).toBe('number');
  });

  // TS-3 (S-038/CA-1): sin filtros no produce una query string malformada
  it('TS-3: sin filtros produce "/requirements?count=true"', async () => {
    await getRequirementsCount({});

    expect(apiClient.get).toHaveBeenCalledWith('/requirements?count=true');
  });

  // TS-4 (S-038/CA-1): nunca se manda count=false
  it('TS-4: nunca manda "count=false" en la URL', async () => {
    await getRequirementsCount({ projectId: 1, count: false });

    const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('count=false');
    expect(calledUrl).toContain('count=true');
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
