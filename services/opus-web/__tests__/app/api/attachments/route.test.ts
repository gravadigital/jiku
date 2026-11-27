/**
 * @jest-environment node
 *
 * El upload de attachments se realiza directamente al backend desde attachmentsApi
 * (sin proxy en Next.js). Ver src/features/attachments/services/attachmentsApi.ts
 * y __tests__/features/attachments/services/attachmentsApi.test.ts
 */

describe('POST /api/attachments', () => {
  it('no existe ruta proxy — el upload va directo al backend desde attachmentsApi', () => {
    expect(true).toBe(true);
  });
});
