import { Response } from 'express';

/** El `data` de `attachments.{id}.request-download` (jiku-docs-commands.yaml). */
export interface ModuleDownloadTicket {
  id: string;
  downloadUrl: string;
  expiresIn: number;
}

/**
 * 302 a la `downloadUrl` de jiku-docs (REQ-016, rutas 17 y 23).
 *
 * No reusa `redirectToPresigned` (`lib/utils/bus/download-ticket.ts`): su contrato trae
 * `fileName`/`mimeType`/`fileSize` y arma `Content-Type`/`Content-Disposition`, y el reply de
 * jiku-docs no los trae. Tampoco usa `res.redirect()`: ese agrega un cuerpo HTML de cortesía y
 * la respuesta debe ir sin cuerpo. La `downloadUrl` nunca se loguea.
 */
export function redirectToModuleDownload(res: Response, data: Pick<ModuleDownloadTicket, 'downloadUrl'> & Partial<ModuleDownloadTicket>) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Location', data.downloadUrl);
  return res.status(302).end();
}
