import fs from 'node:fs';
import path from 'node:path';

// TS-108/TS-109 (S-060, T6): componentes de ui/ que sobrevivieron a la baja de T2 pero
// nunca estuvieron dentro de SCOPE_DIRS (el guardia cubre features/{...} y
// app/(loggedin)/{...}, no shared/components/ui). Cierra la deuda antes de que T8 amplíe
// el alcance del guardia a toda la superficie.
const UI_DIR = path.resolve(__dirname);

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

// Componentes con .module.scss y/o .tsx propio con estilos, tras las bajas de T2/T5.
const COMPONENTS_WITH_STYLES = [
  'InputText',
  'CommentEditor',
  'InlineCommentEditor',
  'AttachmentPreview',
  'MarkdownEditorWithPreview',
  'RichTextEditor',
  'AttachFileButton',
  'AutomatedIdentityBadge',
  'DateLabel',
  'FinishDateLabel',
  'AttachmentSkeleton',
];

function readIfExists(filePath: string): string | null {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
}

describe('shared/components/ui — deuda de tokens legacy (T6)', () => {
  describe.each(COMPONENTS_WITH_STYLES)('%s', (component) => {
    const scssPath = path.join(UI_DIR, component, `${component}.module.scss`);
    const tsxPath = path.join(UI_DIR, component, `${component}.tsx`);
    const scssSource = readIfExists(scssPath);
    const tsxSource = readIfExists(tsxPath);

    it.each(OLD_SYSTEM_TOKENS)('el .module.scss no consume el token legacy %s', (token) => {
      if (scssSource === null) return;
      expect(scssSource).not.toContain(token);
    });

    it.each(OLD_SYSTEM_TOKENS)('el .tsx no consume el token legacy %s (customStyles inline)', (token) => {
      if (tsxSource === null) return;
      expect(tsxSource).not.toContain(token);
    });

    it('el .module.scss no lleva hex literal', () => {
      if (scssSource === null) return;
      expect(scssSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });

    it('el .tsx de producción no lleva hex literal', () => {
      if (tsxSource === null) return;
      expect(tsxSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  });
});
