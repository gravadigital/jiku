import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Guardia de regresión de S-056 (TS-19 a TS-24, TS-26, TS-27) y S-057 (TS-25 a TS-32).
 *
 * El alcance del guardia son las cuatro carpetas migradas hasta ahora: `clients`, `projects`,
 * `objectives` (S-056) y `requirements` (S-057), tanto en `app/(loggedin)/` como en `features/`.
 * **No** cubre `time-allocation` ni `worked-times`, que migran en S-058 y todavía tienen su
 * propia deuda — extender la lista `SCOPE_DIRS` es su trabajo, no de este archivo.
 *
 * Cada assert reproduce exactamente la búsqueda que el Story Plan usó para relevar la deuda
 * original, para que un valor que reaparezca en el alcance haga fallar este test antes de
 * llegar a `dev`.
 */

const WEB_SRC = path.resolve(__dirname, '..');

const SCOPE_DIRS = [
  path.join(WEB_SRC, 'app/(loggedin)/clients'),
  path.join(WEB_SRC, 'app/(loggedin)/projects'),
  path.join(WEB_SRC, 'app/(loggedin)/objectives'),
  path.join(WEB_SRC, 'app/(loggedin)/requirements'),
  path.join(WEB_SRC, 'features/clients'),
  path.join(WEB_SRC, 'features/projects'),
  path.join(WEB_SRC, 'features/objectives'),
  path.join(WEB_SRC, 'features/requirements'),
];

function walk(dir: string, extensions: readonly string[]): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function readAll(files: readonly string[]): { file: string; content: string }[] {
  return files.map((file) => ({ file, content: fs.readFileSync(file, 'utf8') }));
}

const allScssFiles = SCOPE_DIRS.flatMap((dir) => walk(dir, ['.module.scss']));
const allTsxFiles = SCOPE_DIRS.flatMap((dir) => walk(dir, ['.tsx']));
const productionTsxFiles = allTsxFiles.filter((file) => !file.endsWith('.test.tsx'));

const REQUIREMENTS_DIRS = SCOPE_DIRS.filter((dir) => dir.includes('requirements'));
const requirementsScssFiles = REQUIREMENTS_DIRS.flatMap((dir) => walk(dir, ['.module.scss']));

describe('S-056: guardia de regresión de la migración al Design System', () => {
  it('TS-19: no queda ningún hexadecimal literal en .tsx ni .module.scss del alcance', () => {
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
    const offenders = readAll([...allScssFiles, ...allTsxFiles])
      .filter(({ file }) => !file.endsWith('.test.tsx'))
      .flatMap(({ file, content }) => {
        const matches = content.match(hexPattern);
        return matches ? matches.map((match) => `${file}: ${match}`) : [];
      });

    expect(offenders).toEqual([]);
  });

  it('TS-20: el magenta descontinuado (#DA2C6A / #DA2C6B) no aparece en el alcance', () => {
    const magentaPattern = /#DA2C6[AB]/gi;
    const offenders = readAll([...allScssFiles, ...allTsxFiles]).flatMap(({ file, content }) => {
      const matches = content.match(magentaPattern);
      return matches ? matches.map(() => file) : [];
    });

    expect(offenders).toEqual([]);
  });

  it('TS-21: todo border-radius del alcance resuelve a 8/10/14/999px, 50%, o al tier semántico', () => {
    const radiusPattern = /border-radius:\s*([^;]+);/g;
    const allowedLiteral = new Set(['8px', '10px', '14px', '999px', '50%']);
    const offenders: string[] = [];

    for (const { file, content } of readAll(allScssFiles)) {
      let match: RegExpExecArray | null;
       
      while ((match = radiusPattern.exec(content)) !== null) {
        const value = match[1].trim();
        const isToken = value.startsWith('var(--radius-') || value.startsWith('var(--card-radius');
        const isAllowedLiteral = allowedLiteral.has(value);
        // Compuestos como "0 0 8px 8px": cada término numérico debe resolver a un valor
        // permitido.
        const isCompoundOfAllowed =
          /^[\d.a-z%\s]+$/i.test(value) &&
          value
            .split(/\s+/)
            .every((term) => term === '0' || allowedLiteral.has(term));

        if (!isToken && !isAllowedLiteral && !isCompoundOfAllowed) {
          offenders.push(`${file}: border-radius: ${value}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('TS-25: SCOPE_DIRS incluye las dos carpetas de requisitos, además de las seis de S-056', () => {
    const relativeScopeDirs = SCOPE_DIRS.map((dir) => path.relative(WEB_SRC, dir));
    expect(relativeScopeDirs).toEqual(
      expect.arrayContaining([
        path.join('app/(loggedin)/clients'),
        path.join('app/(loggedin)/projects'),
        path.join('app/(loggedin)/objectives'),
        path.join('app/(loggedin)/requirements'),
        path.join('features/clients'),
        path.join('features/projects'),
        path.join('features/objectives'),
        path.join('features/requirements'),
      ])
    );
    expect(SCOPE_DIRS).toHaveLength(8);
  });

  it('TS-22: projects/new, projects/edit/[id] y los 4 archivos con selectStyles de requirements no contienen selectStyles ni importan react-select', () => {
    const files = [
      path.join(WEB_SRC, 'app/(loggedin)/projects/new/page.tsx'),
      path.join(WEB_SRC, 'app/(loggedin)/projects/edit/[id]/page.tsx'),
      path.join(
        WEB_SRC,
        'features/requirements/components/CreateRequirementForm/CreateRequirementForm.tsx'
      ),
      path.join(
        WEB_SRC,
        'features/requirements/components/EditRequirementForm/EditRequirementForm.tsx'
      ),
      path.join(
        WEB_SRC,
        'features/requirements/components/RequirementFilters/RequirementFilters.tsx'
      ),
      path.join(
        WEB_SRC,
        'features/requirements/components/RequirementsReportFilters/RequirementsReportFilters.tsx'
      ),
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/selectStyles/);
      expect(content).not.toMatch(/from 'react-select'/);
    }
  });

  it('TS-23: no quedan <button> crudos en los .tsx de producción del alcance', () => {
    const offenders = readAll(productionTsxFiles)
      .filter(({ content }) => /<button/.test(content))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it('TS-24: no quedan <table> ad-hoc en los .tsx de producción del alcance', () => {
    const offenders = readAll(productionTsxFiles)
      .filter(({ content }) => /<table/.test(content))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it('TS-26: no queda ningún font-family hardcodeado (system-ui / Roboto) en el alcance', () => {
    const offenders = readAll(allScssFiles)
      .filter(({ content }) => /font-family:[^;]*(system-ui|'Roboto')/i.test(content))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it('TS-27: los seis componentes de código muerto no existen ni se exportan', () => {
    const deadComponents = [
      'clients/components/ClientsDrawer',
      'projects/components/ProjectDetails',
      'projects/components/ProjectInactiveObjectivesTable',
      'projects/components/ProjectActiveObjectives',
      'objectives/components/ObjectiveStateFilter',
      'objectives/components/DeleteObjectiveButton',
    ];

    for (const relativePath of deadComponents) {
      const fullPath = path.join(WEB_SRC, 'features', relativePath);
      expect(fs.existsSync(fullPath), `${relativePath} debería estar borrado`).toBe(false);
    }

    const barrels = [
      path.join(WEB_SRC, 'features/clients/index.ts'),
      path.join(WEB_SRC, 'features/projects/index.ts'),
      path.join(WEB_SRC, 'features/objectives/index.ts'),
    ];
    const deadNames = [
      'ClientsDrawer',
      'ProjectDetails',
      'ProjectInactiveObjectivesTable',
      'ProjectActiveObjectives',
      'ObjectiveStateFilter',
      'DeleteObjectiveButton',
    ];

    for (const barrel of barrels) {
      const content = fs.readFileSync(barrel, 'utf8');
      for (const name of deadNames) {
        expect(content).not.toMatch(new RegExp(`\\b${name}\\b`));
      }
    }
  });

  it('TS-36: no se reintroduce ningún token del sistema viejo', () => {
    // Tokens del sistema anterior a la identidad Jiku (S-052). Sobreviven en
    // módulos aún no migrados, pero en el alcance del guardia no deben volver.
    const OLD_SYSTEM_TOKENS = [
      '--font-primary',
      '--color-error',
      '--color-text-muted',
      '--radius-buttons',
      '--color-general-title',
    ];

    // Alcance: requirements (S-057). clients/projects/objectives arrastran deuda
    // de S-056 registrada en esa story; ampliar el alcance es trabajo de S-060.
    const offenders: string[] = [];
    for (const { file, content } of readAll(requirementsScssFiles)) {
      for (const token of OLD_SYSTEM_TOKENS) {
        if (content.includes(token)) {
          offenders.push(`${file}: ${token}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('TS-37: la tipografía se declara con tokens semánticos, no con literales', () => {
    // font-size en px y font-weight numérico eluden la escala tipográfica del DS.
    const fontSizePx = /font-size:\s*\d+(\.\d+)?px/g;
    const numericWeight = /font-weight:\s*\d+/g;

    // Mismo alcance acotado que TS-36.
    const offenders: string[] = [];
    for (const { file, content } of readAll(requirementsScssFiles)) {
      for (const match of content.match(fontSizePx) ?? []) {
        offenders.push(`${file}: ${match}`);
      }
      for (const match of content.match(numericWeight) ?? []) {
        offenders.push(`${file}: ${match}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
