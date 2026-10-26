import { expectTypeOf } from 'vitest';
import type { DocsAttachment, DocsDocument } from './docs.types';

const PORTAL_ITEM = {
  id: '01JC7Z4X9QH2M5N8R3T6V0W1YA',
  title: 'Guía de despliegue',
  version: 3,
  visibility: 'public',
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-20T14:30:00.000Z',
} satisfies DocsDocument;

const PORTAL_DETAIL = {
  ...PORTAL_ITEM,
  content: '# Instalación\n\nPaso uno.\n',
  attachments: [
    {
      id: '01JC7Z5B2K8D4F6G0H1J3K5M7N',
      documentId: '01JC7Z4X9QH2M5N8R3T6V0W1YA',
      fileName: 'diagrama.png',
    },
  ],
} satisfies DocsDocument;

describe('DocsDocument (proyección del portal, jiku-docs 1.3.0)', () => {
  it('TS-1: no declara ruta', () => {
    expectTypeOf<DocsDocument>().not.toHaveProperty('path');
    expectTypeOf<DocsDocument>().not.toHaveProperty('folderId');
    expectTypeOf<DocsDocument>().not.toHaveProperty('fileName');
  });

  it('TS-2: declara la proyección del portal', () => {
    expectTypeOf<DocsDocument>().toHaveProperty('id').toEqualTypeOf<string>();
    expectTypeOf<DocsDocument>().toHaveProperty('title').toEqualTypeOf<string>();
    expectTypeOf<DocsDocument>().toHaveProperty('updatedAt').toEqualTypeOf<string>();
    expectTypeOf<DocsDocument>().toHaveProperty('version').toEqualTypeOf<number | undefined>();
    expectTypeOf<DocsDocument>().toHaveProperty('createdAt').toEqualTypeOf<string | undefined>();
    expectTypeOf<DocsDocument>().toHaveProperty('content').toEqualTypeOf<string | undefined>();
    expectTypeOf<DocsDocument>().toHaveProperty('contentUrl').toEqualTypeOf<string | undefined>();
    expectTypeOf<DocsDocument>()
      .toHaveProperty('attachments')
      .toEqualTypeOf<DocsAttachment[] | undefined>();
  });

  it('TS-3: visibility sigue el enum 1.3.0', () => {
    expectTypeOf<NonNullable<DocsDocument['visibility']>>().toEqualTypeOf<
      'internal' | 'public' | 'restricted'
    >();
  });

  it('TS-4: los fixtures 1.3.0 satisfacen el tipo y agregar path es un error', () => {
    expect(PORTAL_ITEM.id).toBe(PORTAL_DETAIL.id);
    // @ts-expect-error el portal no recibe la ruta
    const conRuta = { ...PORTAL_ITEM, path: '/clientes/acme/guia.md' } satisfies DocsDocument;
    expect(conRuta.path).toBe('/clientes/acme/guia.md');
  });

  it('TS-5: DocsAttachment.fileName se conserva', () => {
    expectTypeOf<DocsAttachment>().toHaveProperty('fileName').toEqualTypeOf<string>();
  });
});
