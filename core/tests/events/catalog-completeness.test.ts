import 'mocha';
import 'should';
import { EVENT_TYPES } from '@jiku/nats-protocol';
import { OBSERVED } from './catalog-contract.test';
// Side-effect import: fuerza que este archivo (y sus `describe`) se registren ANTES que el
// `after()` de acá abajo, sin depender del orden de carga de mocha entre archivos (Task 4,
// Implementation Notes — Opción 1, la elegida).
import './catalog-contract-tasks.test';

/**
 * El gate de completitud del catálogo (S-067, Task 4, CA-4, TS-35): los 16 tipos del catálogo, y
 * SOLO esos 16, tienen que haber sido observados y validados por `catalog-contract.test.ts` (los
 * 10 de requisito) y `catalog-contract-tasks.test.ts` (los 6 de tarea).
 *
 * POR QUÉ VIVE EN SU PROPIO ARCHIVO Y NO AL FINAL DE UNO DE LOS DOS DE ESCENARIOS: mocha NO
 * garantiza en qué orden carga dos archivos de test. Un `after()` puesto en el segundo archivo
 * (por orden alfabético o el que sea) podría correr antes de que el PRIMERO haya ejercitado sus
 * eventos, si mocha decidiera cargarlos al revés. Este archivo importa a los DOS por su nombre
 * (arriba), lo que fuerza que sus `describe`/`it` se REGISTREN antes que el `after()` de acá
 * abajo — y un `after()` DE NIVEL RAÍZ (fuera de cualquier `describe`) corre al final de TODA la
 * corrida de mocha, así que es correcto sin importar en qué archivo, ni con qué invocación
 * (`npx mocha tests/events/catalog-completeness.test.ts` sola incluida, gracias al import).
 *
 * SIN ESTE GATE, un evento del catálogo que ningún `it()` ejercitó pasaría desapercibido — que es
 * exactamente el fallo que CA-4 nombra ("para cada uno de los 16", no "para los que se nos
 * ocurrió probar").
 */
after(() => {
  const expected = new Set<string>(Object.values(EVENT_TYPES));

  const missing = [...expected].filter((type) => !OBSERVED.has(type));
  const extra = [...OBSERVED].filter((type) => !expected.has(type));

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      'El gate de completitud del catálogo de 16 eventos (S-067, TS-35) falló. ' +
        `Faltan (${missing.length}): ${missing.join(', ') || '—'}. ` +
        `Sobran (${extra.length}): ${extra.join(', ') || '—'}.`
    );
  }
});
