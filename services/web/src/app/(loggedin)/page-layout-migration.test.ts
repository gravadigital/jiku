import fs from 'node:fs';
import path from 'node:path';

// S-060 (T4): las 12 páginas que usaban PageLayout migraron a ViewHeader. Este test
// verifica, por lectura de archivo (sin renderizar), que ninguna vuelve a importar
// PageLayout — la garantía estructural equivalente a la que S-058 dejó para las 3
// páginas que migró primero (TS-62, comparadas por `.not.toImportPageLayout`).
const LOGGEDIN_DIR = path.resolve(__dirname);

const MIGRATED_PAGES = [
  'clients/page.tsx',
  'clients/new/page.tsx',
  'clients/edit/[id]/page.tsx',
  'projects/page.tsx',
  'objectives/page.tsx',
  'objectives/new/page.tsx',
  'objectives/[id]/page.tsx',
  'objectives/edit/[id]/page.tsx',
  'objectives/by-project/page.tsx',
  'objectives/by-responsible/page.tsx',
  'requirements/page.tsx',
  'requirements/report/page.tsx',
];

describe('TS-96/TS-97: migración de PageLayout a ViewHeader', () => {
  it.each(MIGRATED_PAGES)('%s ya no importa PageLayout', (relativePath) => {
    const content = fs.readFileSync(path.join(LOGGEDIN_DIR, relativePath), 'utf-8');

    expect(content).not.toMatch(/PageLayout/);
  });

  it.each(MIGRATED_PAGES)('%s usa ViewHeader', (relativePath) => {
    const content = fs.readFileSync(path.join(LOGGEDIN_DIR, relativePath), 'utf-8');

    expect(content).toMatch(/ViewHeader/);
  });
});
