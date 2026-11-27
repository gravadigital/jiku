import { Transaction } from 'sequelize';
import { Project, Requirement } from '@jiku/models';
import { Actor, NotificationDeclaration, NotificationPayload } from '@jiku/nats-protocol';
import { resolveEventActor } from '../events/domain/actor';
import { getOpusUrl } from '../config';

/**
 * Arma el payload congelado de una declaración (D-7 · CA-10 a CA-13): todo se resuelve EN EL
 * MOMENTO DEL ENCOLADO, dentro de la transacción del comando, y queda fijo para siempre en la
 * columna `notification_outbox.payload` — si el requisito cambia de título después, el mail que
 * ya está en la cola sigue diciendo el título de cuando ocurrió el hecho (CA-10, TS-18).
 *
 * SE ARMA UNA VEZ POR DECLARACIÓN, no una vez por destinatario: D-6 decide una fila por
 * destinatario, y eso ya duplica el payload en la base (la duplicación aceptada del REQ), pero
 * recalcularlo por destinatario abriría la puerta a que dos filas del mismo hecho difieran
 * —título, proyecto y link son los mismos para todos los destinatarios de un mismo hecho—.
 *
 * `entity` COPIA LA FORMA DE `EventEntityRef` (D-7): no se inventa un segundo vocabulario para lo
 * mismo, se copia directamente de la declaración.
 *
 * `actor` sale de `resolveEventActor()` TAL CUAL (CA-11): el mismo fallback `name -> email ->
 * ctx.actorName -> id` que ya usan los 16 eventos de dominio, sin reescribirlo acá.
 *
 * `link` se arma ACÁ, no al enviar (CA-12): `${OPUS_URL}/projects/${projectId}/requirements/${id}`,
 * SIN normalizar — si `OPUS_URL` trae una barra final el link tendrá dos, y es preferible que sea
 * visible (y se corrija en la instalación) a que un `replace` silencioso esconda una configuración
 * mal puesta.
 *
 * EL SEGMENTO `/projects/${projectId}/` NO ES OPCIONAL, y su ausencia era un 404. RF-28 del REQ-015
 * y S-071 documentan `${OPUS_URL}/requirements/${id}`, pero esa ruta NO EXISTE en `opus-web`: su
 * única ruta de requisito es `src/app/(dashboard)/projects/[projectId]/requirements/[requirementId]`,
 * anidada bajo el proyecto. El link del mail se abría con 404 para todos los destinatarios. Acá el
 * código se aparta deliberadamente de la especificación porque la especificación nombra una ruta
 * que no responde; RF-28 y S-071 quedan por corregir.
 *
 * `projectId` sale de `declaration.entity.projectId` y NO cuesta una consulta nueva: ya viaja en la
 * declaración y la regla 4 del filtrado (`recipients.ts`) lo usa para el permiso de proyecto.
 *
 * `project.name` puede ser `null` (CA-13) y se congela tal cual, sin lanzar ni inventar un texto
 * de reemplazo: la plantilla (S-073) es quien decide cómo presentarlo.
 */
export async function buildNotificationPayload(
  declaration: NotificationDeclaration,
  actorId: string,
  actorEnvelope: Actor | undefined,
  actorName: string | undefined,
  transaction: Transaction
): Promise<NotificationPayload> {
  const requirement = await Requirement.findByPk(declaration.entity.id, { transaction });
  // Ya pasó por la regla 1 (visibilidad) antes de llegar acá, así que la fila existe. Un título
  // vacío es más honesto que un `!` que oculta el caso si algún día deja de ser cierto.
  const title = requirement ? requirement.title : '';

  // `projects.name` cuesta una consulta propia: `Requirement` solo trae `projectId`, no el
  // nombre del proyecto. Va dentro de la misma transacción del comando.
  const project = await Project.findByPk(declaration.entity.projectId, { transaction });

  return {
    entity: declaration.entity,
    actor: resolveEventActor(actorId, actorEnvelope, actorName),
    title,
    // Puede no existir la fila (no debería, hay FK) o su `name` puede ser `null` en la base — en
    // los dos casos se congela `null`, nunca un texto inventado.
    project: { name: project ? project.name : null },
    link: `${getOpusUrl()}/projects/${declaration.entity.projectId}/requirements/${declaration.entity.id}`,
    data: declaration.data,
  };
}

export default buildNotificationPayload;
