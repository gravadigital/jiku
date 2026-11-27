import { Request, Response, Router } from 'express';
import { sendCommand } from '../utils/bus/send-command';
import { DownloadTicket, redirectToPresigned } from '../utils/bus/download-ticket';
import validateToken from '../utils/middlewares/validate-token';

const router: Router = Router();

/**
 * Vista previa de un archivo POR SU `fileId`, sin pasar por ningún vínculo (REQ-001, S-005).
 *
 * Un archivo sin vínculo es un ESTADO VÁLIDO: el usuario que subió tres archivos y todavía
 * no guardó el requisito tiene que poder previsualizar lo que acaba de subir, y los dos
 * frontends ya muestran preview antes de guardar. Sin vínculo no hay id de `attachments`
 * con el que pedirlo, así que este camino recibe el id del archivo.
 *
 * SU AUTORIZACIÓN ES SOLO EL JWT, y es una decisión, no un descuido: sin vínculo no hay
 * entidad contra la que validar permiso de proyecto, exactamente igual que en la subida.
 * No lleva `hasAnyRole` ni consulta `user_project_permissions`.
 *
 * La consecuencia está registrada en la revisión de ADR-007: cualquier usuario autenticado
 * puede pedir la URL de cualquier archivo del catálogo por su id. Es el mismo modelo que el
 * comando ya expone en el bus. Mitigarlo con un `attachmentId` opcional se evaluó y SE
 * DESCARTÓ; no agregar una validación de `uploaded_by` "por las dudas", que rompería el caso
 * legítimo de un archivo compartido.
 */
async function previewFile(req: Request, res: Response) {
  const fileId = parseInt(req.params.id as string);
  if (isNaN(fileId)) {
    return res.status(400).json({ code: 'invalid_id', message: 'File ID must be a valid integer' });
  }

  // NO se consulta la base: la existencia, la retención y el `byte_status` los valida core,
  // que es el dueño del storage. Traducir esas reglas acá sería duplicarlas en dos servicios
  // y dejarlas divergir. Por eso este handler es el más corto de la story: es la señal de
  // que el corte de responsabilidades cierra.
  const data = await sendCommand<DownloadTicket>(
    res,
    `files.${fileId}.request-download`,
    { disposition: 'inline' }
  );
  if (!data) return;

  return redirectToPresigned(req, res, data, 'inline');
}

router.get('/files/:id/preview', validateToken, previewFile);

export default router;
