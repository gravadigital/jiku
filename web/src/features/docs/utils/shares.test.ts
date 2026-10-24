import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SHARE_EXPIRY,
  SHARE_EXPIRY_OPTIONS,
  expiresAtFrom,
  shareDescription,
  shareStatusBadge,
} from './shares';
import type { DocsShare } from '../types/docs.types';

describe('shares utils', () => {
  it('TS-10: opciones de vencimiento y expiresAtFrom', () => {
    expect(SHARE_EXPIRY_OPTIONS).toEqual([
      { value: '7', label: '7 días' },
      { value: '15', label: '15 días' },
      { value: '30', label: '30 días' },
      { value: '90', label: '90 días' },
      { value: '180', label: '180 días' },
    ]);
    expect(DEFAULT_SHARE_EXPIRY).toBe('30');
    expect(expiresAtFrom(30, new Date('2026-10-24T12:00:00.000Z'))).toBe(
      '2026-11-23T12:00:00.000Z'
    );
  });

  it('TS-11: badge por estado', () => {
    expect(shareStatusBadge('active')).toEqual({ label: 'Activo', family: 'resolved' });
    expect(shareStatusBadge('expired')).toEqual({ label: 'Vencido', family: 'neutral' });
    expect(shareStatusBadge('revoked')).toEqual({ label: 'Revocado', family: 'neutral' });
  });

  it('P-9: shareDescription con y sin nota', () => {
    const base = { expiresAt: '2026-11-08T12:00:00.000Z', note: 'para soporte ACME' } as DocsShare;
    expect(shareDescription(base)).toBe('Link que vence el 08/11/2026 12:00 · para soporte ACME');
    expect(shareDescription({ ...base, note: null })).toBe('Link que vence el 08/11/2026 12:00');
  });
});
