import { Transaction } from 'sequelize';
import { IdentityType, User } from '@jiku/models';
import logger from './logger';
import { pickPresent } from './commands/validate';

/**
 * El ÚNICO escritor de la fila de `users`, compartido por los DOS caminos que la espejan.
 *
 * VIVE EN `src/` Y NO EN `events/` NI EN `bus/` por lo mismo que `authorize-caller.ts`,
 * `config.ts` y `logger.ts`: la comparten módulos distintos y no pertenece a ninguno. Dejarlo en
 * `events/auth/` obligaría a `bus/dispatcher.ts` a importar del módulo de eventos, que es
 * exactamente el acoplamiento que `resolve-actor.ts` evitó subiendo un nivel.
 *
 * DOS ESCRITORES, UN SOLO CÓDIGO (CA-12 de S-029). El evento `{instance}.events.auth` (S-016) y
 * el comando con sobre escriben LA MISMA FILA. Escritos por separado divergen, y el síntoma
 * aparece meses después como "a esta persona el nombre se le borró sola".
 *
 * LA ÚNICA DIFERENCIA ESTÁ PARAMETRIZADA EN `mode`, y es qué hacer ante un campo de PERFIL que
 * no vino:
 *
 *     estricto (evento)      -> reemplazo total de los cinco campos. El evento trae la identidad
 *                               COMPLETA y Zitadel es la verdad. Un evento de persona sin `email`
 *                               ya fue DESCARTADO por el esquema Joi del despachador de eventos,
 *                               así que acá los cinco están siempre.
 *     best-effort (comando)  -> un campo de perfil que falta NO RECHAZA la escritura (D-7). Al
 *                               CREAR cae a `email` y después al `id` —`name` y `username` son
 *                               NOT NULL—; al ACTUALIZAR simplemente no se toca.
 *
 * `roles` e `identityType` NO son de perfil y NO participan del best-effort: son la entrada de la
 * autorización y el despachador ya los exigió antes de llamar acá.
 *
 * NO LOGUEA EL RESULTADO: devuelve `'created' | 'updated'` y EL LLAMADOR LOGUEA. Los dos caminos
 * tienen prefijo propio (`[events]` y `[dispatch]`) y sus tests afirman el texto exacto; un log
 * acá adentro los duplicaría.
 *
 * NO ABRE NI CIERRA TRANSACCIONES: la recibe. Es la misma imposibilidad estructural de ADR-003 —
 * quien es dueño de la transacción es el despachador que la abrió.
 *
 * `sequelize.upsert()` NO SE USA a propósito: `findByPk` + `create`/`update` es lo que deja el log
 * distinguiendo un alta de una actualización, que es el dato que se va a querer al diagnosticar
 * por qué una identidad no tiene los roles que debería. Un `upsert()` sobre PostgreSQL no da ese
 * discriminante de forma confiable, y sin él el contrato de retorno de esta función no existe.
 *
 * OJO CON EL JSONB: un `update` de `roles` REEMPLAZA EL VALOR ENTERO, no lo mergea. Es exactamente
 * la semántica que este handler quiere —el claim es la verdad completa, no un delta— pero es la
 * trampa clásica de JSONB con un ORM y por eso está escrito.
 *
 * LOS CAMPOS SE ENUMERAN, NUNCA UN SPREAD DEL PAYLOAD DE ORIGEN. En el camino del evento cinco de
 * los seis nombres coinciden entre el payload y el modelo, lo que hace tentador un `...event`: eso
 * metería `client_ip`, `session` y los otros cuatro ignorados en el `create`, y con el
 * `.unknown(true)` del esquema también cualquier campo nuevo del emisor. Por eso la traducción la
 * hace el llamador y acá entra una forma cerrada.
 */

/** Cómo tratar un campo de PERFIL que no vino. Es la única diferencia entre los dos caminos. */
export type MirrorMode = 'strict' | 'best-effort';

/** Qué se hizo con la fila. Lo consume el llamador para su log. */
export type MirrorOutcome = 'created' | 'updated';

/**
 * La identidad a espejar, ya traducida a los nombres del modelo.
 *
 * LA AUSENCIA DE UNA CLAVE ES SIGNIFICATIVA en modo best-effort: se distingue por
 * `hasOwnProperty`, no por truthiness. `name: undefined` presente y `name` ausente NO son lo
 * mismo para `pickPresent`, y es la diferencia entre "no lo mandaron" y "lo mandaron vacío".
 */
export interface MirrorIdentity {
  /** El `sub` de Zitadel, y la PK de la fila. */
  id: string;
  name?: string;
  username?: string;
  /**
   * `string | null` y no solo `string`: en el camino del evento el `null` es un valor
   * NORMALIZADO que significa "es una identidad de servicio". En el del comando, la ausencia es
   * ausencia. La asimetría es deliberada — ver el docblock de `Actor` en `@jiku/nats-protocol`.
   */
  email?: string | null;
  /** Del claim. Reemplazo total SIEMPRE, en los dos modos. */
  roles: string[];
  /** `'person'` para el comando, el del evento para el evento. Reemplazo total en los dos modos. */
  identityType: IdentityType;
}

/**
 * Los tres campos de PERFIL: los únicos que el modo cambia.
 *
 * `roles` e `identityType` quedan fuera a propósito y no es un olvido: son la entrada de la
 * autorización, y un best-effort sobre ellos dejaría una fila autorizando con datos viejos.
 */
const PROFILE_FIELDS: (keyof MirrorIdentity)[] = ['name', 'username', 'email'];

/** Los cinco campos tal como los espera el modelo, para el alta. */
function fieldsForCreate(identity: MirrorIdentity, mode: MirrorMode): Record<string, unknown> {
  if (mode === 'strict') {
    return {
      name: identity.name,
      username: identity.username,
      email: identity.email,
      roles: identity.roles,
      identityType: identity.identityType,
    };
  }

  // `name` y `username` son NOT NULL: sin fallback, un sobre sin ellos haría fallar el INSERT y
  // —por D-P1— el comando seguiría con la fila SIN CREAR, que es justo lo que el espejo existe
  // para evitar. El `email` primero y el `sub` después: el primero es legible para un humano.
  const fallback = identity.email ?? identity.id;

  return {
    name: identity.name ?? fallback,
    username: identity.username ?? fallback,
    // La columna acepta NULL desde REQ-005. Un sobre sin `email` deja la fila sin dirección, no
    // la rechaza.
    email: identity.email ?? null,
    roles: identity.roles,
    identityType: identity.identityType,
  };
}

/** Los campos a escribir sobre una fila que ya existe. */
function fieldsForUpdate(identity: MirrorIdentity, mode: MirrorMode): Record<string, unknown> {
  if (mode === 'strict') {
    // REEMPLAZO TOTAL, SIN `pickPresent`. Los 20 comandos usan `pickPresent` para no pisar lo que
    // el caller no mandó: eso es edición parcial, y un evento no es una edición.
    return {
      name: identity.name,
      username: identity.username,
      email: identity.email,
      roles: identity.roles,
      identityType: identity.identityType,
    };
  }

  return {
    // Solo los de perfil PRESENTES: un sobre sin `name` no puede borrar el nombre que la fila ya
    // tenía. Es `pickPresent` y no un armado a mano porque su semántica de ausente-vs-`null` ya
    // es exactamente esta, y dos implementaciones de la misma regla divergen.
    ...pickPresent(identity, PROFILE_FIELDS),
    // Siempre, y por fuera del `pickPresent`: el despachador ya garantizó que los dos vinieron.
    roles: identity.roles,
    identityType: identity.identityType,
  };
}

/**
 * Escribe la fila de `users` y devuelve si la creó o la actualizó.
 *
 * @param identity   la identidad ya traducida a los nombres del modelo
 * @param mode       qué hacer con un campo de perfil ausente
 * @param transaction la transacción del llamador — TODA operación va adentro, incluida la lectura
 * @param component  prefijo del `warn` de perfil incompleto, p. ej. `dispatch`
 */
export async function mirrorUser(
  identity: MirrorIdentity,
  mode: MirrorMode,
  transaction: Transaction,
  component: string
): Promise<MirrorOutcome> {
  if (mode === 'best-effort') {
    const missing = PROFILE_FIELDS.filter(
      (field) => !Object.prototype.hasOwnProperty.call(identity, field)
    );

    // `warn` y no `error`: es entrada incompleta que el servicio maneja bien, y la causa típica
    // es un `CALLOUT_IDP_ENRICH` mal configurado. Nombra QUÉ campos faltaron y el `id` —que ya es
    // la PK y viaja en el subject—, NUNCA su contenido: la convención `logging` prohíbe datos de
    // negocio fuera de `LOG_COMMANDS`.
    if (missing.length > 0) {
      logger.warn(
        `[${component}] ${identity.id}: el sobre de identidad no trae ${missing.join(', ')}. ` +
        'La fila se espeja igual: un campo de perfil no rechaza una escritura.'
      );
    }
  }

  // Con la transacción AUNQUE SEA UNA LECTURA: la convención `orm` no hace excepciones, y sin
  // ella la lectura vería un snapshot distinto del que la escritura va a modificar.
  const existing = await User.findByPk(identity.id, { transaction });

  if (!existing) {
    await User.create({ id: identity.id, ...fieldsForCreate(identity, mode) }, { transaction });
    return 'created';
  }

  // El `id` no entra en la escritura: es la PK, y la fila se encontró POR ella.
  await existing.update(fieldsForUpdate(identity, mode), { transaction });
  return 'updated';
}

export default mirrorUser;
