import { describe, it, expect } from 'vitest';
import { extractAttachmentIds } from './extractAttachmentIds';

describe('extractAttachmentIds', () => {
  it('extrae un id de imagen ![attach:N]', () => {
    expect(extractAttachmentIds('texto ![attach:42] más texto')).toEqual([42]);
  });

  it('extrae un id de archivo [attach:N]', () => {
    expect(extractAttachmentIds('ver [attach:77] adjunto')).toEqual([77]);
  });

  it('extrae múltiples ids mezclando imagen y archivo', () => {
    expect(extractAttachmentIds('[attach:1]![attach:2][attach:3]')).toEqual([1, 2, 3]);
  });

  it('retorna array vacío cuando no hay placeholders', () => {
    expect(extractAttachmentIds('sin adjuntos')).toEqual([]);
  });

  it('retorna array vacío para string vacío', () => {
    expect(extractAttachmentIds('')).toEqual([]);
  });
});
