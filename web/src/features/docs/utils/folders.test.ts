import { describe, it, expect } from 'vitest';
import { resolveRoot } from './folders';
import type { DocsFolder } from '../types/docs.types';

const folder = (id: string, path: string, parentId: string | null, name: string): DocsFolder => ({
  id,
  name,
  path,
  parentId,
  inheritAcl: true,
  externalBlocked: false,
  sharingBlocked: false,
  createdAt: '2026-10-01T10:00:00.000Z',
  createdBy: 'sub-ana',
  effectivePermission: 'read',
});

describe('resolveRoot', () => {
  it('TS-11: raíz visible (admin)', () => {
    const root = folder('F9', '/', null, '');
    const clientes = folder('F1', '/clientes/', 'F9', 'clientes');
    const acme = folder('F0', '/clientes/acme/', 'F1', 'acme');
    expect(resolveRoot([root, clientes, acme])).toEqual({ root, tops: [clientes] });
  });

  it('TS-12: raíz invisible (user)', () => {
    const acme = folder('F0', '/clientes/acme/', 'F1', 'acme');
    const ops = folder('F2', '/ops/', 'F9', 'ops');
    const runbooks = folder('F3', '/ops/runbooks/', 'F2', 'runbooks');
    expect(resolveRoot([ops, runbooks, acme])).toEqual({ root: null, tops: [acme, ops] });
  });
});
