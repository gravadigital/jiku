import { vi } from 'vitest';
export const ID_A = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';

export const DOC = {
  id: ID_A,
  title: 'Arquitectura de videoconferencia',
  version: 6,
  prunedVersionsCount: 3,
  lock: null,
} as never;

export const VERSIONS = [
  {
    version: 6,
    checksum: 'sha256:ab12',
    sizeBytes: 2048,
    author: 'sub-ana',
    authorName: 'Ana Pérez',
    kind: 'update',
    protected: false,
    via: 'human',
    sessionId: null,
    message: null,
    createdAt: '2026-10-24T14:30:00.000Z',
  },
  {
    version: 5,
    checksum: 'sha256:cd34',
    sizeBytes: 2000,
    author: 'sub-yo',
    authorName: 'Yo Mismo',
    kind: 'restore',
    protected: true,
    via: 'human',
    sessionId: null,
    message: 'cierre de sprint',
    createdAt: '2026-10-20T09:00:00.000Z',
  },
  {
    version: 1,
    checksum: 'sha256:ef56',
    sizeBytes: 100,
    author: 'sub-bot',
    authorName: null,
    kind: 'create',
    protected: false,
    via: 'agent',
    sessionId: null,
    message: null,
    createdAt: '2026-10-01T10:00:00.000Z',
  },
];

export const versionsQuery = (over: Record<string, unknown> = {}) => ({
  data: { pages: [{ items: VERSIONS, page: { limit: 50, returned: 3 } }] },
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  ...over,
});
