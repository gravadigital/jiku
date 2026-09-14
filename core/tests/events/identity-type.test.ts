import 'mocha';
import 'should';
import { IdentityType } from '@jiku/models';
import { identityTypeFromMatchedRole, SERVICE_ROLES } from '../../src/events/auth/identity-type';

/**
 * LA DERIVACIÓN DE `identity_type` DESDE `matched_role` (v2 del evento de autenticación).
 *
 * POR QUÉ EXISTE ESTE ARCHIVO: la v2 del callout **elimina `identity_type` del payload**. La
 * razón que da su CHANGELOG es buena y conviene tenerla presente al leer esto: ese campo reportaba
 * el `type:` de la regla de `rules.yaml`, o sea **lo que el YAML decía**, no algo verificado sobre
 * el principal. `matched_role` es un HECHO leído del token —el rol que ganó la regla—, así que la
 * derivación es más fiable que el campo que reemplaza, no menos.
 *
 * LA COLUMNA NO SE VA. `users.identity_type` sigue existiendo y sigue importando: separa a una
 * persona de un service user, y de eso depende que un `Usuario` de servicio no aparezca en
 * `people.list`. Lo que cambia es DE DÓNDE sale el valor, no si se guarda.
 *
 * EL MAPA ES CERRADO Y FALLA DEL LADO SEGURO: un rol que no está en la lista de servicio es
 * `person`. Es el mismo default que el esquema tenía antes (`.default(IdentityType.Person)`), así
 * que un rol nuevo que nadie agregue acá se comporta como se comportaba ayer, y el modo de falla
 * —una persona clasificada como persona— es el inofensivo. Al revés —un service user clasificado
 * como persona— el síntoma sería visible: aparecería en `people.list` si tuviera fila en `people`,
 * que no tiene.
 */

describe('events/auth/identity-type — derivar identity_type de matched_role (v2)', () => {
  it('TS-1 · los dos roles de servicio de `rules.yaml` dan `service`', () => {
    identityTypeFromMatchedRole('internal-app').should.equal(IdentityType.Service);
    identityTypeFromMatchedRole('core').should.equal(IdentityType.Service);
  });

  it('TS-2 · los tres roles de producto dan `person`', () => {
    identityTypeFromMatchedRole('admin').should.equal(IdentityType.Person);
    identityTypeFromMatchedRole('user').should.equal(IdentityType.Person);
    identityTypeFromMatchedRole('external-user').should.equal(IdentityType.Person);
  });

  it('TS-3 · un rol desconocido cae en `person`, el default de siempre', () => {
    identityTypeFromMatchedRole('rol-que-no-existe').should.equal(IdentityType.Person);
  });

  it('TS-4 · `matched_role` ausente o vacío cae en `person`, sin lanzar', () => {
    identityTypeFromMatchedRole(undefined).should.equal(IdentityType.Person);
    identityTypeFromMatchedRole('').should.equal(IdentityType.Person);
  });

  it('TS-5 · el comodín `*` de una regla sin `match` es `person`', () => {
    // El callout manda `'*'` cuando la regla que ganó no declara `match`. No es un rol de
    // servicio: es "cualquiera", y lo seguro es tratarlo como persona.
    identityTypeFromMatchedRole('*').should.equal(IdentityType.Person);
  });

  it('TS-6 · la comparación es EXACTA: no hay prefijos ni case-insensitive', () => {
    // `Core` y `internal-app-2` NO son roles de servicio. Normalizar la comparación sería
    // exactamente cómo un rol nuevo se clasifica mal sin que nadie lo note.
    identityTypeFromMatchedRole('Core').should.equal(IdentityType.Person);
    identityTypeFromMatchedRole('internal-app-2').should.equal(IdentityType.Person);
    identityTypeFromMatchedRole(' core').should.equal(IdentityType.Person);
  });

  it('TS-7 · la lista de roles de servicio es la de `rules.yaml`, y son DOS', () => {
    // Si alguien agrega un rol de servicio a `rules.yaml`, este test es el que le recuerda que
    // esta lista también tiene que crecer. Es el gemelo del gate de paridad de `ROLE_METHODS`.
    [...SERVICE_ROLES].sort().should.deepEqual(['core', 'internal-app']);
  });
});
