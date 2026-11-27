import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const source = readFileSync(join(__dirname, 'attachment.types.ts'), 'utf8');

describe('attachment.types', () => {
  it('EntityType ya no declara ninguno de los cuatro valores de borrador', () => {
    expect(source).not.toContain('requirement_draft');
    expect(source).not.toContain('comment_draft');
    expect(source).not.toContain('objective_comment_draft');
    expect(source).not.toContain('requirement_comment_draft');
  });

  it('declara UploadTicket y UploadTicketRequest', () => {
    expect(source).toContain('UploadTicket');
    expect(source).toContain('UploadTicketRequest');
  });
});
