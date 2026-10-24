import { createDocsUrlTransform } from './docsUrlTransform';

const DOC_ID = '01JC7Z4X9QH2M5N8R3T6V0W1YA';
const ID = '01JC7Z5B2K8D4F6G0H1J3K5M7N';
const DEST = `/api/docs/documents/${DOC_ID}/attachments/${ID}`;
const transform = createDocsUrlTransform(DOC_ID);

describe('createDocsUrlTransform', () => {
  it('TS-13: reescribe un adjunto relativo bajo el documento', () => {
    expect(transform(`/docs/attachments/${ID}`)).toBe(DEST);
  });

  it('TS-14: reescribe un adjunto absoluto de cualquier host', () => {
    expect(transform(`https://jiku.acme.io/docs/attachments/${ID}?x=1`)).toBe(DEST);
    expect(transform(`http://otro.host:8080/docs/attachments/${ID}`)).toBe(DEST);
  });

  it('TS-15: un adjunto de otro documento se reescribe con el id del documento abierto', () => {
    const result = transform(`/docs/attachments/${ID}`);
    expect(result).toBe(DEST);
    expect(result).not.toContain('01JC7Z6C3M9E5G7H1J2K4N6P8Q');
  });

  it('TS-16: deja pasar http, https y mailto', () => {
    for (const url of ['https://example.com/a', 'http://example.com', 'mailto:soporte@acme.io']) {
      expect(transform(url)).toBe(url);
    }
  });

  it('TS-17: vacía lo peligroso o no absoluto', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      '//evil.com/x',
      '/projects/12',
      '/docs/attachments/no-es-ulid',
    ]) {
      expect(transform(url)).toBe('');
    }
  });

  it('TS-18: un documentId inválido falla cerrado para adjuntos', () => {
    expect(createDocsUrlTransform('..%2Fx')(`/docs/attachments/${ID}`)).toBe('');
    expect(createDocsUrlTransform('')(`/docs/attachments/${ID}`)).toBe('');
    expect(createDocsUrlTransform('..%2Fx')('https://example.com/a')).toBe('https://example.com/a');
  });

  it('TS-19: ya no queda el destino viejo', () => {
    for (const url of [
      `/docs/attachments/${ID}`,
      `https://jiku.acme.io/docs/attachments/${ID}?x=1`,
    ]) {
      expect(transform(url).startsWith('/api/docs/attachments/')).toBe(false);
    }
  });
});
