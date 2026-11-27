import { createHash } from 'crypto';

/**
 * `Checksum` de jiku-docs (`^sha256:[0-9a-f]{64}$`) del contenido de texto que la api envía (DD-8).
 *
 * Se calcula sobre el mismo string que viaja en `content` (sin normalizar finales de línea ni
 * espacios): describe los bytes UTF-8 que la api manda. NO es el checksum de la convención
 * `storage`, que hashea el binario de una subida que la api ya no recibe (REQ-001): el del binario
 * de un adjunto lo calcula quien tiene el archivo, el navegador.
 */
export function contentChecksum(content: string): string {
  return 'sha256:' + createHash('sha256').update(content, 'utf8').digest('hex');
}
