import fs from 'node:fs';
import path from 'node:path';

// El barrel completo incluye componentes (Pagination, Button, CommentEditor) que llaman
// a next/navigation en su nivel superior, y CommentEditor arrastra (via el barrel de
// @/features/objectives → ObjectiveComment) un uso de next-auth/react. Sin estos mocks,
// la importación dinámica del barrel completo resuelve los módulos reales, que en este
// entorno de test fallan al resolver 'next/server' desde next-auth/lib/env.js.
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
// S-060: InputSelect, AddButton, InputDate, InputTextarea, InputMultiplePersons, DatePicker,
// SectionCard y Spinner se suman a los nombres muertos — quedaron sin ningún uso tras
// cerrarse la migración completa de la superficie (última story del split de REQ-013).
// Spinner lo reemplazó Loader (T5): mismo rol, con accesibilidad (role="status") que
// Spinner nunca tuvo. Dropzone NO se da de baja: es spec vigente del DS (S-055) sin
// consumidor todavía, catálogo por delante del uso, no código muerto.
const MUERTOS_UI = [
  'Textarea',
  'MarkdownEditor',
  'MultiSelect',
  'InputSelect',
  'AddButton',
  'InputDate',
  'InputTextarea',
  'InputMultiplePersons',
  'DatePicker',
  'SectionCard',
  'Spinner',
] as const;
const VIVOS_UI = [
  'Accordion',
  'AutomatedIdentityBadge',
  'Avatar',
  'Badge',
  'Button',
  'Card',
  'CommentEditor',
  'ConfirmDialog',
  'DateLabel',
  'Dropzone',
  'EmptyState',
  'FinishDateLabel',
  'Input',
  'InputMultipleSelect',
  'InputText',
  'Loader',
  'Pagination',
  'Select',
  'SidebarNav',
  'Stepper',
  'Table',
  'Tabs',
  'ToggleGroup',
  'Tooltip',
  'ViewHeader',
  'WeekNav',
] as const;

const CARPETAS_MUERTAS_UI = [
  'Textarea',
  'MarkdownEditor',
  'MultiSelect',
  'AttachmentDownload',
  'InputSelect',
  'AddButton',
  'InputDate',
  'InputTextarea',
  'InputMultiplePersons',
  'DatePicker',
  'SectionCard',
  'Spinner',
];

const CARPETAS_VIVAS_UI = [
  'Badge',
  'Card',
  'Input',
  'InputText',
  'MarkdownEditorWithPreview',
  'AttachmentPreview',
  'AttachFileButton',
  'AttachmentSkeleton',
  'Select',
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

  // S-057: se agrega `export { STATE_TO_FAMILY } from './Badge';` — el mapa estado→familia que
  // las pantallas de dominio (RequirementList, S-057) consumen sin reimplementarlo. El export de
  // sólo-tipos (`export type { BadgeVariant, BadgeFamily, BadgeOption }`) no matchea este regex,
  // que busca únicamente `export {` (exports de valor).
  it('tiene exactamente 27 exports', () => {
    expect(barrel.match(/^export \{/gm)).toHaveLength(27);
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

  // S-060: Navbar/NavItem/NavSubItem quedaron sin ningún uso tras S-058 (reemplazados por
  // ShellSidebar + SidebarNav) — el único consumo real era `parseExternalLinks`, extraído a
  // `shared/utils/parse-external-links`. PageLayout se dio de baja en T4: las 12 páginas que
  // lo consumían migraron a ViewHeader, el reemplazo del DS.
  it.each(['Navbar', 'NavItem', 'NavSubItem', 'PageLayout'])('ya no exporta %s', (nombre) => {
    expect(barrel).not.toContain(`export { ${nombre} } from './${nombre}';`);
  });

  it('la carpeta de Header ya no existe en layout/', () => {
    expect(fs.existsSync(path.join(LAYOUT_DIR, 'Header'))).toBe(false);
  });

  it('no queda ningún módulo SCSS huérfano de Header', () => {
    expect(fs.existsSync(path.join(LAYOUT_DIR, 'Header', 'Header.module.scss'))).toBe(false);
  });

  it.each(['Navbar', 'NavItem', 'NavSubItem', 'PageLayout'])('la carpeta de %s ya no existe en layout/', (nombre) => {
    expect(fs.existsSync(path.join(LAYOUT_DIR, nombre))).toBe(false);
  });
});
