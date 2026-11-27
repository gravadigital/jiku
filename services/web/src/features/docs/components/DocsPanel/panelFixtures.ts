import type { DocsDocument } from '../../types/docs.types';

export const ID_A = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
export const ID_B = '01J9Z3K8M2Q4R6T8V0W2Y4A6C9';

export const DOC_A = {
  id: ID_A,
  title: 'Arquitectura de videoconferencia',
  path: '/clientes/exo/videoconferencia/arquitectura.md',
  folderId: '01J9Z3K8M2Q4R6T8V0W2Y4A6F0',
  fileName: 'arquitectura.md',
  version: 6,
  visibility: 'internal',
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-ana',
  topics: ['video', 'arquitectura'],
  projectMatch: 'direct',
  lock: {
    sessionId: 's',
    holder: 'sub-ana',
    holderName: 'Ana Gómez',
    via: 'human',
    expiresAt: '2099-01-01T00:00:00.000Z',
  },
} as unknown as DocsDocument;

export const DOC_B = {
  ...DOC_A,
  id: ID_B,
  title: 'Runbook de guardias',
  path: '/ops/runbook.md',
  fileName: 'runbook.md',
  updatedAt: '2026-10-20T09:00:00.000Z',
  topics: [],
  projectMatch: 'indirect',
  lock: null,
} as DocsDocument;

export const PAGE = { items: [DOC_A, DOC_B], page: { limit: 5, returned: 2, total: 2 } };

export const queryResult = (over: Record<string, unknown> = {}) => ({
  data: PAGE,
  isLoading: false,
  isError: false,
  ...over,
});
