// Fixtures compartidos por los tests de DocumentView (detalle 1.3.0: sin `folder`, con `*Refs`).
export const ID_A = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
export const ATT_ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6E0';

export const CONTENT_FM =
  '---\ntitle: Arquitectura de videoconferencia\njiku:\n  projects: [12]\n---\n# Contexto\n\nTexto.\n\n## Decisiones\n\nMás texto.\n';

export const DETAIL_A = {
  id: ID_A,
  title: 'Arquitectura de videoconferencia',
  path: '/clientes/exo/videoconferencia/arquitectura.md',
  folderId: '01J9Z3K8M2Q4R6T8V0W2Y4A6F0',
  fileName: 'arquitectura.md',
  version: 6,
  checksum: 'sha256:ab12',
  sizeBytes: 2048,
  visibility: 'internal',
  createdAt: '2026-10-01T10:00:00.000Z',
  createdBy: 'sub-ana',
  createdByName: 'Ana Pérez',
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-ana',
  updatedByName: 'Ana Pérez',
  clients: [4],
  projects: [12],
  prunedVersionsCount: 3,
  clientRefs: [{ id: 4, name: 'EXO' }],
  projectRefs: [{ id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4 }],
  requirementRefs: [{ id: 151, title: 'Login con SSO', projectId: 12 }],
  taskRefs: [{ id: 7, title: 'Migrar video', projectId: 12 }],
  content: CONTENT_FM,
  relations: { clients: [4], projects: [12], requirements: [151], tasks: [7] },
  topics: ['video', 'arquitectura'],
  lock: null,
  attachments: [
    {
      id: ATT_ID,
      documentId: ID_A,
      fileName: 'diagrama.png',
      mimeType: 'image/png',
      sizeBytes: 1000,
      link: `https://jiku.example/docs/attachments/${ATT_ID}`,
      uploadedBy: 'sub-ana',
      createdAt: '2026-10-02T10:00:00.000Z',
    },
  ],
};

export const V4 = {
  ...DETAIL_A,
  version: 4,
  updatedAt: '2026-10-20T09:00:00.000Z',
  content: '# Versión vieja\n\nTexto viejo.\n',
};

export const LOCK_LUIS = {
  sessionId: '01J9Z3K8M2Q4R6T8V0W2Y4A6S0',
  holder: 'sub-luis',
  holderName: 'Luis Gómez',
  via: 'human',
  expiresAt: '2026-10-26T15:45:00.000Z',
};

export const UNAVAILABLE =
  'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.';
export const NOT_FOUND = 'Este documento no existe o no tenés permiso para verlo.';
