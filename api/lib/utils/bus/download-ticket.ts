import { Request, Response } from 'express';

/**
 * El `data` del reply de `files.{fileId}.request-download` (core, S-002).
 *
 * Vive acá y no en cada archivo de ruta porque los cinco caminos de lectura de la api
 * consumen exactamente el mismo contrato, y `lib/utils/bus/` es la carpeta que la
 * convención reserva para las traducciones de contrato del bus.
 */
export interface DownloadTicket {
  downloadUrl: string;
  expiresIn: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Cierra los caminos de lectura igual: 302 a la prefirmada que firmó core, con los
 * metadatos del reply en los headers. La api no toca el byte (REQ-001, S-005).
 *
 * Los metadatos van en el 302 A PROPÓSITO (CA-10): los frontends hacen `HEAD` al preview
 * para resolver nombre y tamaño antes de renderizar embebido, y un `HEAD` sin
 * `Content-Disposition` rompe el renderer EN RUNTIME —los tipos de web y opus-web están
 * escritos a mano y no fallan en compilación si divergen—. Es redundante con el
 * `Content-Disposition` que ya viaja firmado dentro de la URL, y así tiene que quedar.
 *
 * DOS DETALLES QUE PARECEN DE ESTILO Y NO LO SON:
 *
 * 1. No se usa `res.redirect()`. Internamente hace `format()` + `send(body)`, que pisan el
 *    `Content-Type` con `text/html` y el `Content-Length` con el largo de su cuerpo de
 *    cortesía. Con eso el `HEAD` perdería justo los metadatos que este 302 existe para dar.
 *
 * 2. El `Content-Length` con el tamaño del ARCHIVO solo se manda en `HEAD`. Un `HEAD` no
 *    lleva body, así que el header describe el recurso y no miente. En un `GET` sería un
 *    `Content-Length` que promete bytes que esta respuesta no tiene: el cliente se queda
 *    esperando y la conexión termina abortada. El tamaño en un GET no le sirve a nadie
 *    —el navegador sigue la redirección y lo obtiene de S3—, así que no se pierde nada.
 */
export function redirectToPresigned(
  req: Request,
  res: Response,
  data: DownloadTicket,
  disposition: 'inline' | 'attachment'
) {
  res.setHeader('Content-Type', data.mimeType);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(data.fileName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', data.fileSize);
  }

  res.setHeader('Location', data.downloadUrl);
  return res.status(302).end();
}
