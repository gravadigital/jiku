import { docsUrlTransform } from './docsUrlTransform';

const ID = '01JC7Z5B2K8D4F6G0H1J3K5M7N';

describe('docsUrlTransform', () => {
  it('TS-14: reescribe un adjunto relativo', () => {
    expect(docsUrlTransform(`/docs/attachments/${ID}`)).toBe(`/api/docs/attachments/${ID}`);
  });

  it('TS-15: reescribe un adjunto absoluto de cualquier host', () => {
    expect(docsUrlTransform(`https://jiku.acme.io/docs/attachments/${ID}?x=1`)).toBe(
      `/api/docs/attachments/${ID}`
    );
    expect(docsUrlTransform(`http://otro.host:8080/docs/attachments/${ID}`)).toBe(
      `/api/docs/attachments/${ID}`
    );
  });

  it('TS-16: deja pasar http, https y mailto', () => {
    for (const url of ['https://example.com/a', 'http://example.com', 'mailto:soporte@acme.io']) {
      expect(docsUrlTransform(url)).toBe(url);
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
      expect(docsUrlTransform(url)).toBe('');
    }
  });
});
