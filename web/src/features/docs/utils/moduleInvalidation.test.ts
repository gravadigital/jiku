import { QueryClient } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { isModuleUnavailable, withModuleInvalidation } from './moduleInvalidation';

describe('withModuleInvalidation', () => {
  it('TS-11: module_unavailable invalida [modules] y relanza', async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const err = { code: 'module_unavailable', message: 'x', status: 503 };

    await expect(withModuleInvalidation(qc, () => Promise.reject(err))).rejects.toBe(err);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['modules'] });
  });

  it('TS-12: otros códigos no invalidan', async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    await expect(
      withModuleInvalidation(qc, () => Promise.reject({ code: 'upstream_unavailable' }))
    ).rejects.toBeDefined();
    await expect(
      withModuleInvalidation(qc, () => Promise.reject({ code: 'document_not_found' }))
    ).rejects.toBeDefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('devuelve el resultado si no falla', async () => {
    await expect(withModuleInvalidation(new QueryClient(), async () => 7)).resolves.toBe(7);
  });

  it('isModuleUnavailable acepta Error con code y rechaza valores no objeto', () => {
    expect(isModuleUnavailable(Object.assign(new Error('x'), { code: 'module_unavailable' }))).toBe(
      true
    );
    expect(isModuleUnavailable(null)).toBe(false);
    expect(isModuleUnavailable('module_unavailable')).toBe(false);
  });
});
