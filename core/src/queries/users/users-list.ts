import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { usersSpec } from './users-spec';

/**
 * Colección paginada de usuarios: el espejo de identidad, recortado.
 *
 * EN MODO EXTERNO DEVUELVE "LOS DE MIS PROYECTOS, MÁS YO MISMO" (CA-14): sin la segunda mitad, un
 * caller externo recién dado de alta no podría ni resolver su propio nombre. El recorte lo declara
 * la ficha y el motor lo antepone al `WHERE`.
 *
 * NO HAY `users.get`: el patrón no se registra (CA-15). `user_not_found` EXISTE en el catálogo de
 * `@jiku/nats-protocol` Y NO SE USA ACÁ: lo emiten los comandos, y este recurso no tiene `get` — por
 * eso la ficha tampoco declara `notFoundCode`.
 */
/** El payload de `users.list` DESPUÉS de validar. Alias del tipo del motor. */
export type UsersListPayload = ValidatedListQuery;

export const usersList: Query<UsersListPayload> = {
  pattern: 'users.list',

  validate: (payload: unknown) => validateList(usersSpec, payload),

  execute: (payload, ctx) => runList(usersSpec, payload, ctx),
};

export default usersList;
