import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { validateFile } from './fileValidation';

const source = readFileSync(join(__dirname, 'fileValidation.ts'), 'utf8');

describe('fileValidation', () => {
  it('no declara el tope de tamaño ni una lista de extensiones bloqueante', () => {
    expect(source).not.toContain('10 * 1024 * 1024');
    expect(source).not.toContain('MAX_FILE_SIZE');
    expect(source).not.toContain('ALLOWED_EXTENSIONS');
    expect(source).not.toContain('10MB');
  });

  it('acepta un archivo de cualquier tamaño y extensión: la política vive en core', () => {
    const big = new File(['x'], 'enorme.exe', { type: 'application/x-msdownload' });
    Object.defineProperty(big, 'size', { value: 500 * 1024 * 1024 });
    expect(validateFile(big)).toEqual({ valid: true });
  });

  it('rechaza un archivo vacío sin nombrar ninguna política configurable', () => {
    const empty = new File([], 'vacio.pdf', { type: 'application/pdf' });
    const result = validateFile(empty);
    expect(result.valid).toBe(false);
    expect(result.error).not.toMatch(/MB|Formatos/);
  });
});
