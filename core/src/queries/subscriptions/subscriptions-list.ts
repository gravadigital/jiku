import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { subscriptionsSpec } from './subscriptions-spec';

/**
 * Colección paginada de suscripciones.
 *
 * `filter.entityType` es OBLIGATORIO por la misma razón que en los otros dos recursos de S-025:
 * son DOS TABLAS —`objectives_subscriptors` y `requirement_subscriptors`— y sus ids se pisan.
 *
 * EN MODO EXTERNO DEVUELVE SOLO LAS PROPIAS, no "las de los proyectos que veo": el recorte lo
 * declara la ficha y el motor lo antepone al `WHERE`.
 *
 * NO HAY `subscriptions.get`: el patrón no está registrado.
 */
/** El payload de `subscriptions.list` DESPUÉS de validar. Alias del tipo del motor. */
export type SubscriptionsListPayload = ValidatedListQuery;

export const subscriptionsList: Query<SubscriptionsListPayload> = {
  pattern: 'subscriptions.list',

  validate: (payload: unknown) => validateList(subscriptionsSpec, payload),

  execute: (payload, ctx) => runList(subscriptionsSpec, payload, ctx),
};

export default subscriptionsList;
