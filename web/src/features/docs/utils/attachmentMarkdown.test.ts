import { describe, it, expect } from 'vitest';
import { attachmentMarkdown } from './attachmentMarkdown';

const LINK = 'https://jiku.example.com/docs/attachments/01J9Z3K8M2Q4R6T8V0W2Y4A6D1';

describe('attachmentMarkdown (TS-24)', () => {
  it('imagen, no imagen y nombre con corchetes', () => {
    expect(
      attachmentMarkdown({ fileName: 'diagrama.png', mimeType: 'image/png', link: LINK })
    ).toBe(`![diagrama.png](${LINK})`);
    expect(attachmentMarkdown({ fileName: 'export.csv', mimeType: 'text/csv', link: LINK })).toBe(
      `[export.csv](${LINK})`
    );
    expect(attachmentMarkdown({ fileName: 'a[1].png', mimeType: 'image/png', link: LINK })).toBe(
      `![a\\[1\\].png](${LINK})`
    );
  });
});
