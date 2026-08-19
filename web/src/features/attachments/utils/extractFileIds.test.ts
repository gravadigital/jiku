import { describe, it, expect } from 'vitest';
import { extractAttachmentIds, extractFileIds } from './extractFileIds';

describe('extractFileIds', () => {
  it('extrae un id de imagen ![file:N]', () => {
    expect(extractFileIds('texto ![file:42] más texto')).toEqual([42]);
  });

  it('extrae un id de archivo [file:N]', () => {
    expect(extractFileIds('ver [file:77] adjunto')).toEqual([77]);
  });

  it('extrae múltiples ids mezclando imagen y archivo', () => {
    expect(extractFileIds('[file:1]![file:2][file:3]')).toEqual([1, 2, 3]);
  });

  it('NO confunde los dos espacios de ids: ignora los [attach:N] de vínculo', () => {
    expect(extractFileIds('[attach:99] y [file:1234]')).toEqual([1234]);
  });

  it('retorna array vacío cuando no hay placeholders', () => {
    expect(extractFileIds('sin adjuntos')).toEqual([]);
  });

  it('retorna array vacío para string vacío', () => {
    expect(extractFileIds('')).toEqual([]);
  });
});

describe('extractAttachmentIds', () => {
  it('extrae ids de vínculo del markdown ya guardado', () => {
    expect(extractAttachmentIds('[attach:1]![attach:2]')).toEqual([1, 2]);
  });

  it('NO devuelve los [file:N] de archivos sin vínculo', () => {
    expect(extractAttachmentIds('[file:1234] y [attach:99]')).toEqual([99]);
  });
});
