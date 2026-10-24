import { classifyDocumentError } from './classifyDocumentError';

describe('classifyDocumentError', () => {
  it.each([
    [404, 'not_found'],
    [403, 'not_found'],
    [503, 'unavailable'],
    [500, 'system'],
    [502, 'system'],
    [504, 'system'],
  ])('status %i → %s', (status, expected) => {
    expect(classifyDocumentError({ status })).toBe(expected);
  });

  it('sin error es system', () => {
    expect(classifyDocumentError(null)).toBe('system');
  });
});
