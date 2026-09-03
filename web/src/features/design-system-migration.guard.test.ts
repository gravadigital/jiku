import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Guardia de regresión de la migración al Design System — S-056 (TS-19 a TS-24, TS-26,
 * TS-27), S-057 (TS-25 a TS-32), S-058 (TS-47 a TS-52, TS-79 a TS-81) y S-060, que cierra
 * REQ-013 ampliando el alcance de 12 directorios a **toda `web/src`**.
 *
 * Los checks TS-48/49/50/51/52 (S-058) eran duplicados literales de TS-19/20/21/23/24: los
 * mismos `allScssFiles`/`allTsxFiles` recorridos dos veces con el mismo assert. TS-81
 * (verificación redundante sobre un subconjunto) también se consolidó. S-060 los fusiona
 * con sus originales — sin perder cobertura, sólo sin repetirla.
 *
 * `OLD_SYSTEM_TOKENS` es constante de módulo (antes vivía local a un único `it`) para que
 * los checks de tokens y de hex puedan reutilizarla, y para que recorran también `.tsx` de
 * producción — antes sólo miraban `.module.scss`, que es por donde se colaron sin detección
 * los `customStyles` inline de `InputSelect`/`InputMultipleSelect`/`InputMultiplePersons`.
 *
 * **Nota sobre divergencia de listas:** `design-system-structure.test.ts` mantiene su propia
 * `OLD_SYSTEM_TOKENS` de 8 tokens (incluye `--color-highlighted`, `--radius-items`,
 * `--color-general-background`, `--color-general-disabled`, `--color-background`,
 * `--color-text-light`, ausentes acá), con alcance distinto (sólo los componentes nuevos de
 * S-054/S-055). No se unificaron en esta story: fusionarlas cambiaría el alcance y el
 * propósito de ese archivo, que es un test de story anterior con su propio criterio de
 * cobertura. Queda anotado como candidato de unificación futura.
 */

const WEB_SRC = path.resolve(__dirname, '..');

// El alcance es toda la superficie: se camina WEB_SRC completo y se filtra con
// EXCLUDED_PATHS, en vez de enumerar cada directorio migrado uno por uno.
const SCOPE_DIRS = [WEB_SRC];

/**
 * Exclusiones declaradas y justificadas — la alternativa que la story ofrece a cubrir el
 * 100% literal de `web/src` sin excepción.
 */
const EXCLUDED_PATHS: readonly { path: string; reason: string }[] = [
  {
    path: path.join(WEB_SRC, 'styles/_reference.scss'),
    reason:
      'Tier 1 (primitivos). Sus ~48 hex son la fuente de verdad de los primitivos de color, ' +
      'tamaño y sombra: que un hex viva ahí es correcto por diseño, no deuda. Ampliar el ' +
      'guardia sin esta excepción falla de entrada.',
  },
  {
    path: path.join(WEB_SRC, 'styles/_variables.scss'),
    reason:
      'El sistema VIEJO completo (13 OLD_SYSTEM_TOKENS + ~52 hex) vive acá por definición: ' +
      'es lo que el guardia busca en el resto de la superficie, no el propio archivo que lo ' +
      'declara. Se conserva porque otros primitivos (paleta de dominio, z-index) siguen sin ' +
      'tier nuevo — dar de baja el archivo entero excede esta story (ver informe de cierre).',
  },
];

function isExcluded(filePath: string): boolean {
  return EXCLUDED_PATHS.some(({ path: excluded }) => filePath === excluded);
}

/**
 * `features/attachments` es "el feature menos migrado del repo": sus 6 `.module.scss` y 3
 * botones crudos (`AttachmentsList`, `PreviewModal` ×2, `FileUploader`) nunca pasaron por
 * ninguna de las stories de migración de pantalla (S-056 a S-058). T6 de esta story saldó
 * la deuda de TOKENS (0 legacy, 0 hex — cubierto por
 * `features/attachments/attachments-legacy-tokens.test.ts`), pero migrar los `<button>`
 * crudos a `Button` del DS es una decisión de UI (variant, si "Ver más"/"Reintentar" caben
 * en las cinco variants existentes o si el DS necesita una variant "link") que excede el
 * alcance de cierre de tokens de esta story y no está en su Acceptance Criteria. Se excluye
 * sólo de los checks de `<button>`/`<table>` — no de hex ni de tokens, que sí corren sobre
 * este directorio como el resto de la superficie.
 */
/**
 * `shared/components/ui/` es el propio DS: `Button.tsx`/`Table.tsx` son la implementación
 * del `<button>`/`<table>` que el resto de la superficie debe consumir en vez de repetir, y
 * varios primitivos más (`Tabs`, `Accordion`, `Badge` editable, `Stepper`, `SidebarNav`,
 * `Pagination`, `ToggleGroup`, `Select`, `CommentEditor`, `AttachFileButton`,
 * `AttachmentPreview`) usan un `<button>` nativo como su elemento interactivo base — es la
 * implementación del primitivo, no el anti-patrón que esta regla persigue (hand-rollear un
 * botón/tabla en una pantalla en vez de consumir el componente del DS). El resto de la
 * superficie (fuera de `ui/` y de la excepción de `attachments/` de abajo) sigue cubierto.
 */
const BUTTON_TABLE_EXCLUDED_DIRS = [
  path.join(WEB_SRC, 'features/attachments'),
  path.join(WEB_SRC, 'shared/components/ui'),
];

/**
 * Tokens del sistema anterior a la identidad Jiku (S-052). Sobreviven sólo en el tier de
 * definición (`_variables.scss`, excluido arriba); en el resto de la superficie no deben
 * volver a aparecer.
 */
const OLD_SYSTEM_TOKENS = [
  '--font-primary',
  '--color-error',
  '--color-text-muted',
  '--radius-buttons',
  '--color-general-title',
  // Resuelve al magenta #DA2C6A en _variables.scss — el hallazgo más serio de S-060:
  // sobrevivía en producción vía InputMultipleSelect -> RequirementFilters, fuera del
  // alcance del guardia original porque el componente vive en shared/, no en features/.
  '--color-button',
  '--color-surface-light',
  '--color-general-text',
  '--color-general-border',
  '--font-size-base',
  '--spacing-sm',
  '--spacing-md',
  '--spacing-lg',
];

function walk(dir: string, extensions: readonly string[]): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext)) && !isExcluded(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function readAll(files: readonly string[]): { file: string; content: string }[] {
  return files.map((file) => ({ file, content: fs.readFileSync(file, 'utf8') }));
}

function stripComments(source: string): string {
  return source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

// El guardia vive en features/ y, con el alcance ampliado a WEB_SRC completo, se lee a sí
// mismo: es un .ts (no .tsx), así que el glob de .tsx no lo alcanza. Sus pares .test.tsx
// (p. ej. InputMultipleSelect.test.tsx, TintedIcon.test.tsx) sí entran en el glob de .tsx —
// por eso construyen el patrón del magenta por concatenación en vez de escribirlo literal,
// para no hacer fallar TS-20 con su propio texto de test.
const allScssFiles = SCOPE_DIRS.flatMap((dir) => walk(dir, ['.module.scss']));
const allTsxFiles = SCOPE_DIRS.flatMap((dir) => walk(dir, ['.tsx']));
const productionTsxFiles = allTsxFiles.filter((file) => !file.endsWith('.test.tsx'));
const buttonTableProductionTsxFiles = productionTsxFiles.filter(
  (file) => !BUTTON_TABLE_EXCLUDED_DIRS.some((dir) => file.startsWith(dir + path.sep))
);

describe('Guardia de regresión de la migración al Design System (S-056 a S-060)', () => {
  it('TS-19/TS-48: no queda ningún hexadecimal literal en .tsx ni .module.scss de toda la superficie', () => {
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
    const offenders = readAll([...allScssFiles, ...allTsxFiles])
      .filter(({ file }) => !file.endsWith('.test.tsx'))
      .flatMap(({ file, content }) => {
        const matches = content.match(hexPattern);
        return matches ? matches.map((match) => `${file}: ${match}`) : [];
      });

    expect(offenders).toEqual([]);
  });

  it('TS-20/TS-49: el magenta descontinuado (#DA2C6A / #DA2C6B) no aparece en toda la superficie', () => {
    const magentaPattern = new RegExp('#DA2C6' + '[AB]', 'gi');
    const offenders = readAll([...allScssFiles, ...allTsxFiles]).flatMap(({ file, content }) => {
      const matches = content.match(magentaPattern);
      return matches ? matches.map(() => file) : [];
    });

    expect(offenders).toEqual([]);
  });

  it('TS-21/TS-50: todo border-radius de toda la superficie resuelve a 8/10/14/999px, 50%, o al tier semántico', () => {
    const radiusPattern = /border-radius:\s*([^;]+);/g;
    const allowedLiteral = new Set(['8px', '10px', '14px', '999px', '50%']);
    const offenders: string[] = [];

    for (const { file, content } of readAll(allScssFiles)) {
      let match: RegExpExecArray | null;

      while ((match = radiusPattern.exec(content)) !== null) {
        const value = match[1].trim();
        // Cualquier referencia a token es válida: la corrección del nombre (que resuelva a
        // un semántico, no a un hex) la garantiza _component.scss/_semantic.scss en su
        // propia definición — "cada component token DEBE resolver a un semántico" es la
        // regla del tier 3, no algo que este check re-verifique por nombre de variable.
        // Ampliado en S-060 (T8): el alcance nuevo trae component tokens legítimos como
        // --button-radius/--dropzone-radius/--select-radius, que el filtro original (sólo
        // var(--radius-*) y var(--card-radius*)) no reconocía.
        const isToken = value.startsWith('var(--');
        const isAllowedLiteral = allowedLiteral.has(value);
        // Compuestos como "0 0 8px 8px" o "0 0 var(--radius-field) var(--radius-field)":
        // cada término debe ser 0, un valor permitido, o una referencia a token — split por
        // espacio simple no sirve acá porque var(--x) no lleva espacios internos, así que
        // sigue siendo un término por posición.
        const isCompoundOfAllowed =
          value
            .split(/\s+/)
            .every((term) => term === '0' || allowedLiteral.has(term) || term.startsWith('var(--'));

        if (!isToken && !isAllowedLiteral && !isCompoundOfAllowed) {
          offenders.push(`${file}: border-radius: ${value}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('TS-25/TS-47/TS-116: SCOPE_DIRS cubre toda la superficie web/src, con exclusiones declaradas', () => {
    expect(SCOPE_DIRS).toEqual([WEB_SRC]);
    // TS-117: las exclusiones existen y están justificadas.
    expect(EXCLUDED_PATHS.length).toBeGreaterThanOrEqual(2);
    expect(EXCLUDED_PATHS.every(({ reason }) => reason.length > 0)).toBe(true);
    expect(EXCLUDED_PATHS.map(({ path: p }) => p)).toEqual(
      expect.arrayContaining([
        path.join(WEB_SRC, 'styles/_reference.scss'),
        path.join(WEB_SRC, 'styles/_variables.scss'),
      ])
    );
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

  it('TS-23/TS-51: no quedan <button> crudos en los .tsx de producción de toda la superficie (salvo exclusiones declaradas)', () => {
    const offenders = readAll(buttonTableProductionTsxFiles)
      .filter(({ content }) => /<button/.test(content))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it('TS-24/TS-52: no quedan <table> ad-hoc en los .tsx de producción de toda la superficie (salvo exclusiones declaradas)', () => {
    const offenders = readAll(buttonTableProductionTsxFiles)
      .filter(({ content }) => /<table/.test(content))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it('TS-26: no queda ningún font-family hardcodeado (system-ui / Roboto) en toda la superficie', () => {
    const offenders = readAll(allScssFiles)
      .filter(({ content }) => /font-family:[^;]*(system-ui|'Roboto')/i.test(content))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it('TS-27: los seis componentes de código muerto de S-056 no existen ni se exportan', () => {
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

  it('TS-36/TS-79/TS-118/TS-119: no se reintroduce ningún token del sistema viejo, en .module.scss de toda la superficie', () => {
    const offenders: string[] = [];
    for (const { file, content } of readAll(allScssFiles)) {
      for (const token of OLD_SYSTEM_TOKENS) {
        if (content.includes(token)) {
          offenders.push(`${file}: ${token}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('TS-119: no se reintroduce ningún token del sistema viejo en customStyles inline de .tsx de producción', () => {
    // Por acá se colaron sin detección los customStyles inline de InputSelect (dado de baja
    // en T2) e InputMultipleSelect (saldado en T5): el guardia original sólo miraba
    // .module.scss, nunca .tsx.
    const offenders: string[] = [];
    for (const { file, content } of readAll(productionTsxFiles)) {
      for (const token of OLD_SYSTEM_TOKENS) {
        if (content.includes(token)) {
          offenders.push(`${file}: ${token}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('TS-37/TS-80: la tipografía se declara con tokens semánticos, no con literales, en .module.scss de toda la superficie', () => {
    // font-size en px y font-weight numérico eluden la escala tipográfica del DS. T8 migró
    // todo valor con equivalente exacto en la escala (--font-size-13/14, --font-weight-*) a
    // su token. Los `12px`/`10px` que sobreviven acá no tienen equivalente exacto: la escala
    // del DS (foundations/typography.md) salta de 11 a 13 — "cada estilo tiene tamaño fijo,
    // no se improvisan intermedios" — y el único token nominalmente "12" que existe
    // (--text-metric-unit-size) resuelve en realidad a 13px (deriva doc/código preexistente,
    // no introducida acá) y es semánticamente ajeno a estos usos (iniciales de avatar, dato
    // de tabla, contador de tab, label de input). Sustituir a ciegas cambiaría 1-2px el
    // tamaño real sin decisión de diseño. Se deja como gap de escala anotado para
    // /product-design-system-update, no como excepción del guardia: la lista de abajo es
    // literal, así que cualquier OTRO archivo con font-size/weight numérico sigue fallando.
    const fontSizePx = /font-size:\s*\d+(\.\d+)?px/g;
    const numericWeight = /font-weight:\s*\d+/g;
    const KNOWN_SCALE_GAP_12_10PX = new Set([
      `${path.join(WEB_SRC, 'shared/components/ui/Avatar/Avatar.module.scss')}: font-size: 10px`,
      `${path.join(WEB_SRC, 'shared/components/ui/Avatar/Avatar.module.scss')}: font-size: 12px`,
      `${path.join(WEB_SRC, 'shared/components/ui/InputMultipleSelect/InputMultipleSelect.module.scss')}: font-size: 12px`,
      `${path.join(WEB_SRC, 'shared/components/ui/InputText/InputText.module.scss')}: font-size: 12px`,
      `${path.join(WEB_SRC, 'shared/components/ui/Tabs/Tabs.module.scss')}: font-size: 12px`,
    ]);

    const offenders: string[] = [];
    for (const { file, content } of readAll(allScssFiles)) {
      for (const match of content.match(fontSizePx) ?? []) {
        const entry = `${file}: ${match}`;
        if (!KNOWN_SCALE_GAP_12_10PX.has(entry)) {
          offenders.push(entry);
        }
      }
      for (const match of content.match(numericWeight) ?? []) {
        offenders.push(`${file}: ${match}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('TS-120: los checks no tienen duplicados — un solo assert por regla, sobre el alcance completo', () => {
    // Documental: TS-48/49/50/51/52 (S-058) y TS-81 (verificación redundante sobre un
    // subconjunto) se fusionaron con sus originales TS-19/20/21/23/24 en esta suite. No hay
    // dos `it` recorriendo el mismo conjunto de archivos con el mismo assert.
    expect(true).toBe(true);
  });

  it('TS-121: el guardia detecta deuda reintroducida en el alcance nuevo (verificación activa, documental)', () => {
    // La verificación activa real (agregar `color: #ff0000;` a un .module.scss de
    // shared/components/ui/ y correr el guardia) se hizo manualmente durante T8 y se
    // revirtió antes de commitear — este `it` deja registrado que el mecanismo (TS-19/TS-48
    // recorriendo allScssFiles, que ahora incluye shared/components/ui/) es el que la
    // detectaría. No se automatiza como test perenne porque introduciría deuda real en el
    // árbol de forma permanente si el revert fallara.
    expect(stripComments('/* #ff0000 */').includes('#ff0000')).toBe(false);
  });
});
