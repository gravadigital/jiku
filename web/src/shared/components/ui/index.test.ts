import fs from 'node:fs';
import path from 'node:path';

// El barrel completo incluye componentes (Pagination, Button, AddButton, CommentEditor)
// que llaman a next/navigation en su nivel superior, y CommentEditor arrastra (via el
// barrel de @/features/objectives → ObjectiveComment) un uso de next-auth/react. Sin
// estos mocks, la importación dinámica del barrel completo resuelve los módulos reales,
// que en este entorno de test fallan al resolver 'next/server' desde next-auth/lib/env.js.
// Mismo patrón que WorkedTimesPage.test.tsx y Pagination.test.tsx.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));

const UI_DIR = __dirname;
const LAYOUT_DIR = path.resolve(__dirname, '../layout');

// Card e Input eran nombres muertos hasta S-053: la story los reescribió como los
// componentes fundacionales nuevos del Design System, así que dejaron de estar libres.
const MUERTOS_UI = ['Textarea', 'MarkdownEditor', 'MultiSelect'] as const;
const VIVOS_UI = [
  'AddButton',
  'Accordion',
  'AutomatedIdentityBadge',
  'Avatar',
  'Badge',
  'Button',
  'Card',
  'CommentEditor',
  'ConfirmDialog',
  'DateLabel',
  'DatePicker',
  'Dropzone',
  'EmptyState',
  'FinishDateLabel',
  'Input',
  'InputDate',
  'InputMultiplePersons',
  'InputMultipleSelect',
  'InputSelect',
  'InputText',
  'InputTextarea',
  'Loader',
  'Pagination',
  'SectionCard',
  'Select',
  'SidebarNav',
  'Spinner',
  'Stepper',
  'Table',
  'Tabs',
  'ToggleGroup',
  'Tooltip',
  'ViewHeader',
  'WeekNav',
] as const;

const CARPETAS_MUERTAS_UI = ['Textarea', 'MarkdownEditor', 'MultiSelect', 'AttachmentDownload'];

const CARPETAS_VIVAS_UI = [
  'Badge',
  'Card',
  'Input',
  'InputText',
  'InputTextarea',
  'SectionCard',
  'MarkdownEditorWithPreview',
  'AttachmentPreview',
  'AttachFileButton',
  'AttachmentSkeleton',
  'Select',
  'InputSelect',
  'Avatar',
  'SidebarNav',
  'Stepper',
  'Table',
  'Tabs',
  'ViewHeader',
  'WeekNav',
  'Accordion',
  'Dropzone',
  'EmptyState',
];

describe('barrel de shared/components/ui', () => {
  const barrel = fs.readFileSync(path.join(UI_DIR, 'index.ts'), 'utf-8');

  it.each(MUERTOS_UI)('no exporta %s — el nombre queda libre para el componente del DS', (nombre) => {
    expect(barrel).not.toContain(`export { ${nombre} } from './${nombre}';`);
  });

  it.each(VIVOS_UI)('sigue exportando %s', (nombre) => {
    expect(barrel).toContain(`export { ${nombre} } from './${nombre}';`);
  });

  it('tiene exactamente 34 exports', () => {
    expect(barrel.match(/^export \{/gm)).toHaveLength(34);
  });

  it.each(CARPETAS_MUERTAS_UI)('la carpeta de %s ya no existe en ui/', (nombre) => {
    expect(fs.existsSync(path.join(UI_DIR, nombre))).toBe(false);
  });

  it.each(CARPETAS_VIVAS_UI)('la carpeta del componente vivo %s no fue tocada', (nombre) => {
    expect(fs.existsSync(path.join(UI_DIR, nombre))).toBe(true);
  });

  it.each(MUERTOS_UI)('no queda ningún módulo SCSS huérfano de %s', (nombre) => {
    expect(fs.existsSync(path.join(UI_DIR, nombre, `${nombre}.module.scss`))).toBe(false);
  });

  it('no queda ningún módulo SCSS huérfano de AttachmentDownload', () => {
    expect(
      fs.existsSync(path.join(UI_DIR, 'AttachmentDownload', 'AttachmentDownload.module.scss')),
    ).toBe(false);
  });

  it('el test propio de AttachmentDownload desapareció junto con su componente', () => {
    expect(
      fs.existsSync(path.join(UI_DIR, 'AttachmentDownload', 'AttachmentDownload.test.tsx')),
    ).toBe(false);
  });

  // El barrel completo transitivamente importa decenas de componentes (incluye
  // CommentEditor -> @/features/objectives). Bajo la suite completa, en paralelo con
  // el resto de los archivos de test, esa resolución puede superar el timeout por
  // defecto de Vitest — de ahí el timeout explícito, más alto que el resto de esta suite.
  it(
    'importar el barrel no expone los nombres muertos en runtime',
    async () => {
      const ui = await import('./index');
      for (const nombre of MUERTOS_UI) {
        expect((ui as Record<string, unknown>)[nombre]).toBeUndefined();
      }
    },
    15000,
  );

  it(
    'importar el barrel sí expone los vivos en runtime',
    async () => {
      const ui = await import('./index');
      for (const nombre of VIVOS_UI) {
        expect((ui as Record<string, unknown>)[nombre]).toBeDefined();
      }
    },
    15000,
  );
});

describe('barrel de shared/components/layout', () => {
  const barrel = fs.readFileSync(path.join(LAYOUT_DIR, 'index.ts'), 'utf-8');

  it('no exporta Header — el séptimo muerto no vivía en el barrel de ui', () => {
    expect(barrel).not.toContain("export { Header } from './Header';");
  });

  it.each(['Navbar', 'NavItem', 'NavSubItem', 'PageLayout'])('sigue exportando %s', (nombre) => {
    expect(barrel).toContain(`export { ${nombre} } from './${nombre}';`);
  });

  it('la carpeta de Header ya no existe en layout/', () => {
    expect(fs.existsSync(path.join(LAYOUT_DIR, 'Header'))).toBe(false);
  });

  it('no queda ningún módulo SCSS huérfano de Header', () => {
    expect(fs.existsSync(path.join(LAYOUT_DIR, 'Header', 'Header.module.scss'))).toBe(false);
  });
});
