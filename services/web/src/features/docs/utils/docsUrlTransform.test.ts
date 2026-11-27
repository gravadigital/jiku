import { describe, it, expect } from 'vitest';
import { docsUrlTransform, ULID_PATTERN } from './docsUrlTransform';

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6D1';
const OWN = `/docs/attachments/${ID}`;

describe('docsUrlTransform', () => {
  it.each([
    [`/docs/attachments/${ID}`, OWN],
    [`https://jiku.example.com/docs/attachments/${ID}`, OWN],
    [`http://otro-host:3000/docs/attachments/${ID}?v=2#x`, OWN],
    ['https://example.com/a', 'https://example.com/a'],
    ['mailto:ana@example.com', 'mailto:ana@example.com'],
    ['javascript:alert(1)', ''],
    ['  JavaScript:alert(1)', ''],
    ['data:text/html;base64,PHNjcmlwdD4=', ''],
    ['/projects/12', ''],
    ['#seccion', ''],
    [`//evil.com/docs/attachments/${ID}`, ''],
    ['/docs/attachments/no-es-ulid', ''],
  ])('TS-34: %s', (input, expected) => {
    expect(docsUrlTransform(input)).toBe(expected);
  });

  it('ULID_PATTERN acepta ULID y rechaza "attachments"', () => {
    expect(ULID_PATTERN.test(ID)).toBe(true);
    expect(ULID_PATTERN.test('attachments')).toBe(false);
    expect(ULID_PATTERN.test('abc')).toBe(false);
  });
});
