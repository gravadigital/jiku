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
  email: string;
  identityType?: IdentityType;
}
