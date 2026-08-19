import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = join(__dirname, '..');

function grep(pattern: string): string {
  try {
    return execSync(`grep -rn -- ${JSON.stringify(pattern)} src`, {
      cwd: root,
      encoding: 'utf8',
    });
  } catch {
    // grep sale con 1 cuando no hay coincidencias
    return '';
  }
}

describe('contrato del BFF después de S-006', () => {
  it('el route handler POST /api/attachments no existe', () => {
    expect(existsSync(join(root, 'src/app/api/attachments/route.ts'))).toBe(false);
  });

  it('ningún módulo hace un POST contra /api/attachments', () => {
    const hits = grep("'POST', '/api/attachments'") + grep('"POST", "/api/attachments"');
    expect(hits).toBe('');
  });

  it('nadie referencia uploadAttachments', () => {
    expect(grep('uploadAttachments')).toBe('');
  });

  it('next.config.js no declara bodySizeLimit', () => {
    const config = readFileSync(join(root, 'next.config.js'), 'utf8');
    expect(config).not.toContain('bodySizeLimit');
    expect(config).not.toContain('10mb');
  });
});
