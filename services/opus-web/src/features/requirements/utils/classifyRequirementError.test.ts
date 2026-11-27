import { describe, it, expect } from 'vitest';
import type { ApiError } from '@/lib/axios';
import { classifyRequirementError } from './classifyRequirementError';

const NOT_FOUND_404 = {
  code: 'requirement_not_found',
  message: 'Requirement not found',
  status: 404,
};
const FORBIDDEN_403 = { code: 'access_denied', message: 'Access denied', status: 403 };
const INTERNAL_500 = { code: 'internal_error', message: 'Internal error', status: 500 };
const NETWORK = { code: 'unknown_error', message: 'Error desconocido', status: 500 };

describe('classifyRequirementError', () => {
  it('TS-1: 404 requirement_not_found es not_found', () => {
    expect(classifyRequirementError(NOT_FOUND_404)).toBe('not_found');
  });

  it('TS-2: 403 access_denied es not_found', () => {
    expect(classifyRequirementError(FORBIDDEN_403)).toBe('not_found');
  });

  it.each([404, 403])('TS-3: status %s con code distinto es not_found', (status) => {
    expect(classifyRequirementError({ code: 'x', message: 'x', status } as ApiError)).toBe(
      'not_found'
    );
  });

  it.each(['requirement_not_found', 'access_denied'])(
    'TS-4: code %s con status 500 es not_found',
    (code) => {
      expect(classifyRequirementError({ code, message: 'x', status: 500 } as ApiError)).toBe(
        'not_found'
      );
    }
  );

  it.each([
    INTERNAL_500,
    { code: 'x', message: 'x', status: 502 },
    { code: 'module_unavailable', message: 'x', status: 503 },
    { code: 'gateway_timeout', message: 'x', status: 504 },
    NETWORK,
  ])('TS-5: %j es system', (error) => {
    expect(classifyRequirementError(error)).toBe('system');
  });

  it('TS-6: sin error o error sin campos es system', () => {
    expect(classifyRequirementError(null)).toBe('system');
    expect(classifyRequirementError(undefined)).toBe('system');
    expect(classifyRequirementError({})).toBe('system');
  });
});
