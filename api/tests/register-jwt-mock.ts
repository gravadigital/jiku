/**
 * Registra el mock de `jsonwebtoken` antes de que cualquier test cargue `lib/`.
 *
 * `auth-helper` toma la referencia al importar, así que si el mock no está puesto para
 * entonces la autenticación queda sin mockear y todas las requests responden 401.
 *
 * Vive en su propio archivo, y no dentro de `setup-env.ts`, porque Mocha carga los
 * archivos de `require` con `import()`: en ese contexto Node los trata como ESM y no
 * resuelve imports relativos sin extensión. Acá el mock se carga con `require`, que sí
 * pasa por la resolución de ts-node.
 */
import * as realJWT from 'jsonwebtoken';
import mockery from 'mockery';
import jsonwebtokenMock from './mocks/jsonwebtoken-mock';



mockery.enable({ warnOnUnregistered: false });
mockery.registerMock('jsonwebtoken', jsonwebtokenMock(realJWT));
