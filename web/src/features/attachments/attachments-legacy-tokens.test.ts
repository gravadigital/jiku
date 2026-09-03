import fs from 'node:fs';
import path from 'node:path';

// TS-106/TS-107 (S-060, T6): features/attachments es el feature menos migrado del repo —
// nunca estuvo en el alcance del guardia (design-system-migration.guard.test.ts cubre sólo
// 12 dirs; T8 lo amplía a toda la superficie). Este test cierra la deuda antes de esa
// ampliación, para que el guardia no arranque en rojo.
const ATTACHMENTS_DIR = path.resolve(__dirname);

const OLD_SYSTEM_TOKENS = [
  '--font-primary',
  '--color-error',
  '--color-text-muted',
  '--radius-buttons',
  '--color-general-title',
  '--color-button',
  '--color-surface-light',
  '--color-general-text',
  '--color-general-border',
  '--font-size-base',
  '--spacing-sm',
  '--spacing-md',
  '--spacing-lg',
];

const SCSS_MODULES = [
  'components/FileUploader/FileUploader.module.scss',
  'components/PreviewModal/PreviewModal.module.scss',
  'components/MarkdownViewer/MarkdownViewer.module.scss',
  'components/MarkdownViewer/AttachmentPlaceholder.module.scss',
  'components/AttachmentsList/AttachmentsList.module.scss',
  'components/AttachmentItem/AttachmentItem.module.scss',
];

function readModule(relativePath: string): string {
  return fs.readFileSync(path.join(ATTACHMENTS_DIR, relativePath), 'utf-8');
}

describe('features/attachments — deuda de tokens legacy (T6)', () => {
  describe.each(SCSS_MODULES)('%s', (relativePath) => {
    const source = readModule(relativePath);

    it.each(OLD_SYSTEM_TOKENS)('no consume el token legacy %s', (token) => {
      expect(source).not.toContain(token);
    });

    it('no lleva hex literal', () => {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  });
});
