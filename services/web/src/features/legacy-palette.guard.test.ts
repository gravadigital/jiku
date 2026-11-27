import fs from 'node:fs';
import path from 'node:path';

// La tabla de migración del handoff da de baja la paleta anterior: #22C55E, #F59E0B, #B91C1C,
// #6D28D9 y todo rosa/rojo de marca. En `web` sobrevivían dos mapas de color con esos valores
// —OBJECTIVE_STATE_COLORS / OBJECTIVE_AREA_COLORS y PROJECT_STATUS_COLORS— que ya no tenían
// consumidores: sólo se re-exportaban desde el barrel del módulo.
//
// El color de estado hoy lo resuelve la familia del Badge del DS (getStatusBadgeFamily y
// equivalentes), que es la que respeta los tintes del manual. Los mapas de hex eran la vía por
// la que la paleta vieja podía volver a entrar sin que ningún guardia lo notara: los tres tests
// de tokens sólo miran archivos .scss/.tsx de la superficie, no los .ts de utilidades.
const FEATURES = path.resolve(__dirname);

const DISCONTINUED = [
  '#22C55E',
  '#F59E0B',
  '#B91C1C',
  '#6D28D9',
  '#EC4899',
  '#8B5CF6',
  '#3B82F6',
  '#EF4444',
  '#6B7280',
  '#FFA500',
  '#DA2C6B',
  '#FF3B3C',
] as const;

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });

describe('la paleta anterior no vuelve por los helpers de dominio', () => {
  const files = walk(FEATURES);

  it('encuentra archivos que auditar', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  for (const hex of DISCONTINUED) {
    it(`ningún helper declara ${hex}`, () => {
      const offenders = files.filter((file) =>
        fs.readFileSync(file, 'utf8').toUpperCase().includes(hex.toUpperCase())
      );
      expect(offenders.map((f) => path.relative(FEATURES, f))).toEqual([]);
    });
  }
});

describe('los mapas de color por hex ya no existen', () => {
  it('objectiveHelpers no exporta mapas de color ni sus getters', () => {
    const source = fs.readFileSync(
      path.join(FEATURES, 'objectives/utils/objectiveHelpers.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/OBJECTIVE_STATE_COLORS/);
    expect(source).not.toMatch(/OBJECTIVE_AREA_COLORS/);
    expect(source).not.toMatch(/getStateColor/);
    expect(source).not.toMatch(/getAreaColor/);
  });

  it('projectHelpers no exporta el mapa de color ni su getter', () => {
    const source = fs.readFileSync(
      path.join(FEATURES, 'projects/utils/projectHelpers.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/PROJECT_STATUS_COLORS/);
    expect(source).not.toMatch(/getStatusColor/);
  });

  it('las etiquetas SÍ se conservan: el contenido no cambia, sólo el color', () => {
    const objectives = fs.readFileSync(
      path.join(FEATURES, 'objectives/utils/objectiveHelpers.ts'),
      'utf8'
    );
    expect(objectives).toMatch(/OBJECTIVE_STATE_LABELS/);
    expect(objectives).toMatch(/OBJECTIVE_AREA_LABELS/);

    const projects = fs.readFileSync(
      path.join(FEATURES, 'projects/utils/projectHelpers.ts'),
      'utf8'
    );
    expect(projects).toMatch(/PROJECT_STATUS_LABELS/);
    expect(projects).toMatch(/PROJECT_TYPE_LABELS/);
  });
});
