import { describe, it, expect } from 'vitest';
import { toResult, unwrap } from './docsResult';

describe('toResult / unwrap (P-2)', () => {
  it('envuelve el éxito', async () => {
    await expect(toResult(async () => 5)).resolves.toEqual({ ok: true, data: 5 });
  });

  it('conserva code, status y details del ApiError', async () => {
    const error = {
      code: 'version_conflict',
      message: 'x',
      status: 409,
      details: { currentVersion: 7 },
    };
    await expect(
      toResult(async () => {
        throw error;
      })
    ).resolves.toEqual({ ok: false, error });
  });

  it('una excepción desconocida pasa a internal_error', async () => {
    const result = await toResult(async () => {
      throw new Error('boom');
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'Internal error', status: 500 },
    });
  });

  it('unwrap devuelve el dato o lanza el DocsError', () => {
    expect(unwrap({ ok: true, data: 1 })).toBe(1);
    const error = { code: 'a', message: 'b', status: 400 };
    expect(() => unwrap({ ok: false, error })).toThrow();
    try {
      unwrap({ ok: false, error });
    } catch (e) {
      expect(e).toBe(error);
    }
  });
});
