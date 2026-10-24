import { describe, it, expect } from 'vitest';
import { displayTitle, folderPathOf } from './paths';

describe('paths', () => {
  it('folderPathOf devuelve la carpeta', () => {
    expect(folderPathOf('/clientes/acme/arquitectura.md')).toBe('/clientes/acme/');
    expect(folderPathOf('/leeme.md')).toBe('/');
  });

  it('displayTitle usa el título o el nombre de archivo sin .md', () => {
    expect(displayTitle({ title: 'Arq', fileName: 'a.md' })).toBe('Arq');
    expect(displayTitle({ title: '', fileName: 'Notas.MD' })).toBe('Notas');
  });
});
