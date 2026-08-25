import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { peopleSpec } from './people-spec';

/**
 * Colección paginada de personas del equipo.
 *
 * EN MODO EXTERNO DEVUELVE LAS ASIGNADAS A PROYECTOS PERMITIDOS: el recorte lo declara la ficha y
 * el motor lo antepone al `WHERE`, así que un filtro no lo desactiva — pedir a alguien de otro
 * proyecto devuelve `items: []` y NO acceso.
 *
 * NO HAY `people.get`, Y LA AUSENCIA ES EL CONTRATO: no hay pantalla de detalle de una persona
 * (RF-2), y traer varias por id es `list` + `filter.id: [1,2,3]`. El patrón simplemente no se
 * registra, y el despachador responde `unknown_command` sin código propio.
 */
/** El payload de `people.list` DESPUÉS de validar. Alias del tipo del motor. */
export type PeopleListPayload = ValidatedListQuery;

export const peopleList: Query<PeopleListPayload> = {
  pattern: 'people.list',

  validate: (payload: unknown) => validateList(peopleSpec, payload),

  execute: (payload, ctx) => runList(peopleSpec, payload, ctx),
};

export default peopleList;
