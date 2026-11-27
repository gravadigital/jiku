import fs from 'node:fs';
import path from 'node:path';

// Geometría de las pantallas según design_handoff_jiku_identity/designs/Jiku App.dc.html, que
// el README declara "fuente de verdad visual". El contenido no cambia — sólo la parte visual.
//
// Este guardia cubre lo que el prototipo fija como medida y el código resolvía con valores
// propios: las fracciones de las filas de filtros, el minmax de las grillas de cards y el gap
// de 18px del sistema (que en varios módulos era 1rem, 2rem o 0.5rem).
const WEB_SRC = path.resolve(__dirname, '..');
const read = (relative: string): string => fs.readFileSync(path.join(WEB_SRC, relative), 'utf8');

describe('handoff — filas de filtros en grid con las fracciones del prototipo', () => {
  // El prototipo arma cada fila de filtros como grid, no como flex con ratios: las columnas
  // quedan alineadas entre pantallas y el gap entra en el reparto en vez de sumarse por fuera.
  const CASES = [
    {
      screen: 'Proyectos',
      file: 'features/projects/components/ProjectListFilters/ProjectListFilters.module.scss',
      columns: '2fr 1fr 1fr 1fr',
    },
    {
      screen: 'Requisitos',
      file: 'features/requirements/components/RequirementFilters/RequirementFilters.module.scss',
      columns: '1.4fr 1fr 1fr 1fr',
    },
    {
      screen: 'Actores',
      file: 'features/clients/components/ClientListFilters/ClientListFilters.module.scss',
      columns: '2fr 1fr 1fr',
    },
  ] as const;

  for (const { screen, file, columns } of CASES) {
    describe(screen, () => {
      const source = read(file);

      it(`la fila es grid de \`${columns}\``, () => {
        expect(source).toMatch(/display:\s*grid/);
        expect(source.replace(/\s+/g, ' ')).toContain(`grid-template-columns: ${columns}`);
      });

      it('el gap es el del sistema (--space-grid-gap, 18px)', () => {
        expect(source).toMatch(/gap:\s*var\(--space-grid-gap\)/);
      });

      it('los campos ya no reparten con ratios propios de flex', () => {
        // `flex: 6 6 0`, `flex: 4.1`, `flex: 2` — el reparto ahora lo hace el grid. Se busca la
        // propiedad `flex` exacta (no `flex-direction`, que sigue siendo legítima dentro de un
        // campo para apilar label sobre control).
        expect(source).not.toMatch(/(?<![-\w])flex:\s*[\d.]/);
      });
    });
  }
});

describe('handoff — grillas de cards a minmax(250px, 1fr)', () => {
  // El prototipo usa repeat(auto-fill, minmax(250px,1fr)) en las cuatro grillas de cards, que
  // al ancho de diseño (1400px) da cuatro columnas. Con minmax de 300/350px daban tres.
  const CASES = [
    {
      label: 'Proyectos (listado)',
      file: 'features/projects/components/ProjectsBoard/ProjectsBoard.module.scss',
    },
    {
      label: 'Proyectos de un actor',
      file: 'features/clients/components/ClientProjects/ClientProjects.module.scss',
    },
    {
      label: 'Tareas por proyecto',
      file: 'features/objectives/components/ObjectivesGroup/ObjectivesGroup.module.scss',
    },
  ] as const;

  for (const { label, file } of CASES) {
    describe(label, () => {
      const source = read(file);

      it('la grilla es auto-fill con minmax(250px, 1fr)', () => {
        expect(source.replace(/\s+/g, ' ')).toMatch(
          /grid-template-columns: repeat\(auto-fill, minmax\(250px, 1fr\)\)/
        );
      });

      it('no quedan minmax de 300px ni 350px, ni auto-fit', () => {
        expect(source).not.toMatch(/minmax\(\s*3[05]0px/);
        expect(source).not.toMatch(/auto-fit/);
      });
    });
  }
});

describe('handoff — el gap de grilla es un token, no rem sueltos', () => {
  // 18px es el gap de grillas del sistema. Los módulos de estas pantallas lo escribían como
  // 1rem (16px), 2rem (32px) o 0.5rem (8px), que no son valores de la escala.
  const FILES = [
    'features/projects/components/ProjectsBoard/ProjectsBoard.module.scss',
    'features/clients/components/ClientProjects/ClientProjects.module.scss',
  ] as const;

  for (const file of FILES) {
    it(`${path.basename(file)} usa --space-grid-gap`, () => {
      const source = read(file);
      expect(source).toMatch(/gap:\s*var\(--space-grid-gap\)/);
      expect(source).not.toMatch(/gap:\s*[\d.]+rem/);
    });
  }
});

describe('handoff — layout de detalle: columna principal + aside de 380px', () => {
  // El prototipo fija minmax(560px,1fr) 380px con gap 22px para el detalle de proyecto y de
  // requisito. El código tenía el aside en 420px.
  const CASES = [
    {
      label: 'Requisito (detalle)',
      file: 'features/requirements/components/RequirementDetail/RequirementDetail.module.scss',
    },
  ] as const;

  for (const { label, file } of CASES) {
    it(`${label}: el aside mide 380px, no 420px`, () => {
      const source = read(file).replace(/\s+/g, ' ');
      expect(source).toMatch(/grid-template-columns: minmax\(560px, 1fr\) 380px/);
      // Sólo la columna: 420px sigue siendo legítimo en otras propiedades de la pantalla
      // (el max-height del panel de adjuntos, por ejemplo).
      expect(source).not.toMatch(/grid-template-columns:[^;]*420px/);
    });
  }
});
