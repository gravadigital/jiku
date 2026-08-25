import {
  BaseSpec,
  FilterableSpec,
  IncludableSpec,
  RelationSpec,
  ResourceSpec,
} from '../types';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../engine/validate-query';
import { enumLabeled, isRelation, resolveVariant } from '../engine/spec';

/**
 * LA PROYECCIÓN DE UNA FICHA A LA FORMA DE LA DESCRIPCIÓN.
 *
 * ESTE ARCHIVO NO CONOCE NINGÚN RECURSO: recibe una `ResourceSpec` y devuelve su descripción, con el
 * mismo criterio con que `engine/spec.ts` no nombra recursos. Es lo que hace que agregar el recurso
 * 17 no toque una línea de acá.
 *
 * LO QUE SE PROYECTA ES EL VOCABULARIO DEL CONTRATO Y NADA MÁS (ADR-004). La ficha lleva las dos
 * mitades —el nombre del contrato y el de la base— y esta función se queda SOLO con la primera. La
 * tabla completa de qué entra y qué no:
 *
 *   BaseFieldSpec           -> el nombre, `kind: 'field'`      | NO: `column`, `from`, `transform`
 *   BaseConstantSpec        -> el nombre, `kind: 'constant'`   | NO: el valor
 *   IncludableComputedSpec  -> el nombre, `kind: 'computed'`   | NO: `expr` (es SQL crudo)
 *   OneRelationSpec         -> cardinalidad, nombres de campos | NO: `table`, `localKey`, `targetKey`
 *   ManyRelationSpec        -> ídem + `cap` y `truncatedFlag`  | NO: `table`, `parentKey`, `join`,
 *                                                             |     `where`, `order`
 *   FilterableSpec          -> `kind`, el enum, si busca       | NO: `column`, `from`, `via`, las
 *                                                             |     columnas de `search`, `contains.column`
 *   SortableSpec            -> el nombre                       | NO: `column`, `nullable`
 *   ExternalScopeSpec       -> NADA                            | TODO
 *   `where` / `table` / `joins` -> NADA                        | TODO
 *
 * `externalScope` NO SE EXPONE, y no es una omisión: todos sus nombres son COLUMNAS DE LA BASE
 * (`project_id`, `visibility_level`, `user_id`), y publicarlos filtraría el esquema por un endpoint
 * que describe el contrato. CA-10 enumera qué devuelve la descripción y `externalScope` no está en
 * la lista. Además, el recorte no cambia el CONTRATO: cambia qué filas devuelve, y eso ya se ve
 * pidiendo.
 *
 * EL ORDEN DE LAS CLAVES IMPORTA y sale de `Object.keys` de la ficha: es el mismo orden que viaja en
 * `errorDetails.allowed`, y los tests de CA-12 comparan LISTAS, no conjuntos.
 */

export interface FieldDescription {
  readonly kind: 'field' | 'constant' | 'computed' | 'relation';
  readonly cardinality?: 'one' | 'many';
  /** Los NOMBRES de los campos de la relación, en el orden de la ficha. */
  readonly fields?: readonly string[];
  /** La relación 1:1 puede venir en `null`. */
  readonly optional?: boolean;
  /** Tope por item de una colección. Solo si la ficha lo declara. */
  readonly cap?: number;
  /** Clave HERMANA que marca la colección recortada: `commentsTruncated`. */
  readonly truncatedFlag?: string;
  /** La colección devuelve una lista de escalares de ESTE campo, no de objetos. */
  readonly scalar?: string;
}

export interface FilterDescription {
  readonly kind: string;
  /** Nombre del enum de `enums` cuyos valores acepta. */
  readonly enum?: string;
  /** Acepta texto libre y busca por coincidencia parcial. */
  readonly search?: boolean;
  /** La búsqueda libre SE DESVÍA A UN ID cuando el texto es solo dígitos. */
  readonly searchNumeric?: boolean;
  /** Filtro de contención sobre `jsonb`: las claves que el objeto del payload tiene que traer. */
  readonly contains?: { readonly shape: readonly string[] };
}

/** Lo que depende de la variante en un recurso con discriminador. */
export interface VariantDescription {
  readonly base: Readonly<Record<string, FieldDescription>>;
  readonly includable: Readonly<Record<string, FieldDescription>>;
  readonly filterable: Readonly<Record<string, FilterDescription>>;
  readonly enums: Readonly<Record<string, readonly { value: string; label: string }[]>>;
}

export interface ResourceDescription extends Partial<VariantDescription> {
  readonly sortable: readonly string[];
  readonly defaults: {
    readonly sort: readonly string[];
    readonly limit: number;
    readonly maxLimit: number;
  };
  readonly discriminator?: { readonly field: string; readonly values: readonly string[] };
  readonly variants?: Readonly<Record<string, VariantDescription>>;
}

function describeRelation(spec: RelationSpec): FieldDescription {
  if (spec.cardinality === 'one') {
    return {
      kind: 'relation',
      cardinality: 'one',
      fields: Object.keys(spec.fields),
      optional: spec.optional,
    };
  }

  return {
    kind: 'relation',
    cardinality: 'many',
    fields: Object.keys(spec.fields),
    // `cap` Y `truncatedFlag` SOLO SI LA FICHA LOS DECLARA: una relación sin tope no puede declarar
    // uno "por defecto", porque prometería un recorte que el motor no aplica.
    ...(spec.cap !== undefined ? { cap: spec.cap } : {}),
    ...(spec.truncatedFlag !== undefined ? { truncatedFlag: spec.truncatedFlag } : {}),
    ...(spec.scalar !== undefined ? { scalar: spec.scalar } : {}),
  };
}

function describeBase(spec: BaseSpec): FieldDescription {
  if (isRelation(spec)) {
    return describeRelation(spec);
  }
  if ('constant' in spec) {
    // EL VALOR NO SE PUBLICA. Hoy el único constante es `entityType`, que el caller ya eligió al
    // mandar el discriminador; publicarlo no agregaría nada y dejaría abierta la puerta a que la
    // próxima constante —que podría salir del esquema— viaje sin que nadie lo decida.
    return { kind: 'constant' };
  }
  return { kind: 'field' };
}

function describeIncludable(spec: IncludableSpec): FieldDescription {
  if (isRelation(spec)) {
    return describeRelation(spec);
  }
  if (spec.kind === 'computed') {
    // NUNCA `expr`: es SQL crudo con nombres de columna y subconsultas.
    return { kind: 'computed' };
  }
  return { kind: 'field' };
}

function describeFilter(spec: FilterableSpec): FilterDescription {
  return {
    // `kind` es OPCIONAL en la ficha y su ausencia significa texto: el validador cae a la rama
    // `default`, que acepta string o número. La descripción dice lo mismo que el validador hace.
    kind: spec.kind ?? 'string',
    ...(spec.enum !== undefined ? { enum: spec.enum } : {}),
    // `search: true` Y NO LA LISTA DE COLUMNAS: qué se busca es contrato, DÓNDE es esquema.
    ...(spec.search !== undefined ? { search: true } : {}),
    // LA REGLA QUE VA A SORPRENDER, declarada: `q` con texto de solo dígitos busca POR ID, no por
    // coincidencia de texto. `requirements-spec.ts` la dejó anotada para que se exponga acá.
    ...(spec.searchNumericColumn !== undefined ? { searchNumeric: true } : {}),
    // `shape` son claves DEL CONTRATO (`key`, `value`); la columna `jsonb` no se publica.
    ...(spec.contains !== undefined ? { contains: { shape: spec.contains.shape } } : {}),
  };
}

function describeVariant(spec: ResourceSpec): VariantDescription {
  const base: Record<string, FieldDescription> = {};
  for (const name of spec.baseNames) {
    base[name] = describeBase(spec.base[name]);
  }

  const includable: Record<string, FieldDescription> = {};
  for (const name of spec.includableNames) {
    includable[name] = describeIncludable(spec.includable[name]);
  }

  const filterable: Record<string, FilterDescription> = {};
  for (const name of spec.filterableNames) {
    filterable[name] = describeFilter(spec.filterable[name]);
  }

  const enums: Record<string, readonly { value: string; label: string }[]> = {};
  for (const name of Object.keys(spec.enums)) {
    enums[name] = enumLabeled(spec.enums[name]);
  }

  return { base, includable, filterable, enums };
}

/**
 * La descripción COMPLETA de un recurso.
 *
 * UN RECURSO CON DISCRIMINADOR SE DESCRIBE POR VARIANTE, y no es una elección de forma: su ficha NO
 * ESTÁ COMPLETA hasta que la variante se resuelve. `activity.enums.type` se pisa entero por variante
 * y `filterable.entityId` apunta a una columna distinta en cada una. DESCRIBIR LA UNIÓN SERÍA
 * MENTIR: declararía un `type` que en la mitad de las variantes responde `invalid_fields`, que es
 * exactamente lo que CA-12 prohíbe.
 *
 * `sortable` y `defaults` VAN AL NIVEL DEL RECURSO porque `ResourceVariant` no los declara: no se
 * pueden pisar, así que publicarlos por variante sugeriría una libertad que la ficha no tiene.
 *
 * LA VARIANTE SE ARMA CON `resolveVariant()`, la MISMA función que usa el motor antes de validar. Es
 * lo que hace que la descripción y el validador vuelvan a leer literalmente la misma estructura.
 */
export function describeResource(resource: ResourceSpec): ResourceDescription {
  const common = {
    sortable: resource.sortableNames,
    defaults: {
      sort: resource.defaults.sort,
      limit: DEFAULT_PAGE_LIMIT,
      // EL TOPE TAMBIÉN: un pedido mayor SE RECORTA SIN AVISAR —es `success`, no `failure`—, así que
      // sin este número un consumidor pide 500 y recibe 200 sin ninguna señal de por qué.
      maxLimit: MAX_PAGE_LIMIT,
    },
  };

  const discriminator = resource.discriminator;
  if (!discriminator) {
    return { ...describeVariant(resource), ...common };
  }

  const variants: Record<string, VariantDescription> = {};
  for (const value of discriminator.values) {
    variants[value] = describeVariant(resolveVariant(resource, value));
  }

  return {
    discriminator: { field: discriminator.field, values: discriminator.values },
    variants,
    ...common,
  };
}

export default describeResource;
