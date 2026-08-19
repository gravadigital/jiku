import 'mocha';
import 'should';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Test de DOCUMENTACIÓN, no de código, y por eso vale la pena: CA-12 se enuncia sobre
 * `docs/apis/api.yaml` —no sobre el modelo compartido ni sobre el ENUM de PostgreSQL—, así que
 * este es el único control que impide que alguien reponga un valor eliminado al editar el spec.
 *
 * NO USA UN PARSER DE YAML A PROPÓSITO: `js-yaml` no es dependencia declarada de la api (llega
 * transitivamente, que es distinto), y agregar una dependencia de producción para leer un
 * archivo de documentación no se justifica. El bloque `enum:` de este schema es plano y con un
 * valor por línea: leerlo con una expresión regular es suficiente y no suma superficie.
 *
 * Vive en `tests/utils/` porque no necesita base de datos: corre con `npm run test:unit`.
 */
describe('docs/apis/api.yaml — contrato de adjuntos', () => {
  const SPEC_PATH = path.join(__dirname, '../../../docs/apis/api.yaml');

  /** Extrae los valores ACTIVOS del bloque `enum:` de un schema. Ignora los comentados. */
  function enumValuesOf(schemaName: string): string[] {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    const lines = spec.split('\n');

    const schemaIndex = lines.findIndex((line) => line.trim() === `${schemaName}:`);
    schemaIndex.should.be.above(-1, `no se encontró el schema ${schemaName} en api.yaml`);

    const enumIndex = lines.findIndex((line, index) => index > schemaIndex && line.trim() === 'enum:');
    enumIndex.should.be.above(-1, `${schemaName} no declara un bloque enum`);

    const values: string[] = [];
    for (let index = enumIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      // Un item activo del enum: `        - valor`. Un comentado (`# - valor`) NO matchea, que
      // es exactamente lo que este test tiene que distinguir.
      const match = /^\s+- ([a-z_]+)\s*$/.exec(line);
      if (match) {
        values.push(match[1]);
        continue;
      }
      // Una línea comentada dentro del bloque no lo termina: los cinco valores eliminados
      // quedaron documentados así a propósito.
      if (line.trim().startsWith('#')) {
        continue;
      }
      break;
    }
    return values;
  }

  // TS-47 (CA-12): exactamente cinco valores. La lista es literal y ordenada a propósito: un
  // `containEql` por valor dejaría pasar un sexto repuesto por error, que es el modo de fallo
  // que este test existe para atrapar.
  it('AttachmentEntityType tiene exactamente los cinco valores del rediseño', () => {
    enumValuesOf('AttachmentEntityType').should.deepEqual([
      'project',
      'requirement',
      'objective',
      'requirement_comment',
      'objective_comment',
    ]);
  });

  it('AttachmentEntityType no declara ninguno de los cinco valores eliminados', () => {
    const values = enumValuesOf('AttachmentEntityType');
    ['comment', 'comment_draft', 'requirement_draft', 'objective_draft', 'stage']
      .forEach((removed) => {
        values.should.not.containEql(removed);
      });
  });
});
