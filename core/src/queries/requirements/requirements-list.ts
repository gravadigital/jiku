import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { requirementsSpec } from './requirements-spec';

/**
 * Colección paginada de requisitos.
 *
 * ES LA FICHA MÁS GRANDE DE LAS TRES y la que ejercita las cuatro extensiones del motor a la vez
 * —el campo calculado, el filtro de contención, el desvío numérico de `q` y el recorte con
 * visibilidad—, y aun así este archivo es tan corto como el de `tasks`: es la medida de que el
 * motor quedó bien factorizado.
 */
/** El payload de `requirements.list` DESPUÉS de validar. Alias del tipo genérico del motor. */
export type RequirementsListPayload = ValidatedListQuery;

export const requirementsList: Query<RequirementsListPayload> = {
  pattern: 'requirements.list',

  validate: (payload: unknown) => validateList(requirementsSpec, payload),

  execute: (payload, ctx) => runList(requirementsSpec, payload, ctx),
};

export default requirementsList;
