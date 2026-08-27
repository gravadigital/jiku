import { Transaction } from 'sequelize';
import { Actor, Reply } from '@jiku/nats-protocol';

/**
 * Contexto de un comando.
 *
 * `caller` sale del subject y dice qué SERVICIO publicó (hoy siempre `api`). NO ES EL USUARIO
 * FINAL, porque la api usa un único service_user para todas las personas.
 *
 * DÓNDE VIAJA EL USUARIO FINAL, desde S-029, y son dos lugares distintos:
 *
 *   - en el SOBRE (`actor`), cuando lo manda el publicador de confianza. Es la clave reservada
 *     que el despachador extrae del cuerpo antes de validar, y la fuente que MANDA.
 *   - en el CAMPO DE DOMINIO (`creator` / `author` / `editor` / `uploader`) cuando NO hay sobre.
 *     Con sobre, ese campo es REDUNDANTE y por eso es `.optional()` en Joi: el publicador de
 *     confianza ya no tiene que repetir en el cuerpo lo que mandó en `actor.id`, y si lo repite
 *     tiene que coincidir (`extractActor` lo rechaza si difiere). Sin sobre —una persona o un
 *     conector publicando directo— el campo tampoco se usa: la identidad sale del subject vía
 *     `ctx.caller`. Quien SIGUE yendo a la columna (`created_by`, `changed_by`, `uploaded_by`)
 *     es el actor YA RESUELTO por `resolveActor`, no el campo crudo del payload.
 */
export interface CommandContext {
  /** Servicio que publicó el mensaje, leído del subject. */
  caller: string;
  /** Partes variables del subject: `clients.{id}.edit` deja `{ id: '7' }`. */
  params: Record<string, string>;
  /** Transacción abierta por el despachador; todo el comando escribe adentro. */
  transaction: Transaction;
  /**
   * Quién actúa detrás del comando, si el publicador de confianza lo declaró.
   *
   * OPCIONAL Y NO REQUERIDO, y es lo que hace que los 20 comandos compilen sin cambios: un caller
   * directo del bus no manda sobre y su identidad sigue saliendo del subject (CA-4). Cuando está,
   * el despachador ya garantizó que tiene `id` y `roles`, y que no choca con el campo de dominio.
   *
   * NINGÚN COMANDO LO LEE DIRECTO: se consume a través de `resolveActor`, que es donde vive la
   * precedencia entre las tres fuentes.
   */
  actor?: Actor;
  /**
   * Los roles de quien actúa, resueltos por el despachador y pasados sin ninguna consulta nueva.
   *
   * DE DÓNDE SALE EL ARRAY EN CADA UNO DE LOS TRES CANALES (S-031):
   *
   *   - SOBRE: `actor.roles`, el claim que la api YA VERIFICÓ contra Zitadel. No se lee la base.
   *   - DIRECTO (una persona publicando al bus): `users.roles` de `ctx.caller`, la misma lectura
   *     que la compuerta ya hizo — el MISMO valor, no una segunda consulta.
   *   - EXENTO (el publicador de confianza sin sobre): `[]`, porque ese canal no toca la base a
   *     propósito (S-017 CA-1) y no hay roles que leer.
   *
   * `[]` SIGNIFICA "EL CANAL NO TRAE ROLES", NO "LA PERSONA NO TIENE NINGUNO". Un comando que
   * decide sobre este array tiene que tratar el vacío como "no puedo afirmar nada del actor", que
   * es exactamente lo que hacen los comandos de tiempos: sin actor no evalúan las reglas
   * derivadas del actor (ver D-1 de S-031 y la clase `connector` de S-030).
   *
   * NO ES OPCIONAL: el despachador SIEMPRE sabe cuál es, así que un `roles?:` obligaría a cada
   * comando a un `?? []` y crearía un cuarto estado —"no vino"— que no existe.
   */
  roles: readonly string[];
}

/**
 * Un comando: valida su payload y escribe.
 *
 * DESDE S-031 UN COMANDO SÍ PUEDE VALIDAR PERMISOS, y es un cambio de reparto, no una licencia:
 * hasta S-029 core no conocía al usuario final —la identidad del subject es el service user de la
 * api (ADR-007)— y por eso estas reglas vivían allá. Con el sobre core lo conoce, así que los
 * comandos de tiempos aplican la ventana de carga (C-40), quién imputa a otra persona (C-41) y la
 * titularidad del registro. Lo que sigue siendo del DESPACHADOR es la compuerta —"¿tu rol habilita
 * este método?"—; el comando decide "¿podés hacer esto con estos datos?".
 *
 * Tampoco abre ni cierra la transacción: la maneja el despachador, que hace commit si el comando
 * responde `success` y rollback en cualquier otro caso.
 */
export interface Command<TPayload = any, TData = unknown> {
  /**
   * Patrón del subject, con `{param}` para las partes variables:
   *   `clients.new`
   *   `clients.{id}.edit`
   */
  readonly pattern: string;

  /** Valida y normaliza el payload. Devuelve el error del protocolo si no es válido. */
  validate(payload: unknown): { value: TPayload } | { error: Reply<never> };

  /** Ejecuta la escritura. */
  execute(payload: TPayload, ctx: CommandContext): Promise<Reply<TData>>;
}
