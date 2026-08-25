export type IdentityType = 'person' | 'service';

/**
 * Un usuario cuando aparece como AUTOR de algo: creador de un requisito, o autor de una
 * entrada de actividad. Espeja el schema `AuthorUser` de `docs/apis/api.yaml`.
 *
 * `identityType` es opcional a proposito: una api vieja no lo manda, y la condicion del
 * front es `=== 'service'`, asi que su ausencia NO marca nada. Falla del lado seguro: se
 * pierde una marca, nunca se marca a una persona.
 *
 * NO es el tipo del `user` de los suscriptores: ese es un selector de personas, la api lo
 * deja en tres campos a proposito, y declararle `identityType` mentiria (S-019, CA-1/CA-2).
 *
 * `roles` no sale en ninguna respuesta HTTP de la api, en ningun endpoint.
 */
export interface AuthorUser {
  id: string;
  name: string;
  /**
   * `null` para una identidad de servicio: un machine user de Zitadel no tiene direccion de
   * correo, asi que la fila espejada la deja vacia. Es la MISMA superficie que `identityType`
   * marca, y por eso los dos campos viven juntos.
   *
   * Ningun componente lo renderiza —lo unico que se muestra es el email de la SESION PROPIA,
   * que siempre es una persona—, asi que se declara para que el tipo no mienta.
   */
  email: string | null;
  identityType?: IdentityType;
}
