import { Response } from 'express';
import joi from 'joi';

/** `Ulid` de jiku-docs-queries.yaml. */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isUlid(value: unknown): boolean {
  return typeof value === 'string' && ULID_PATTERN.test(value);
}

export const joiUlid = () => joi.string().pattern(ULID_PATTERN);

export type DocsNotFoundCode = 'document_not_found' | 'folder_not_found' | 'attachment_not_found' | 'share_not_found';

const NOT_FOUND_MESSAGES: Record<DocsNotFoundCode, string> = {
  document_not_found: 'Documento no encontrado',
  folder_not_found: 'Carpeta no encontrada',
  attachment_not_found: 'Adjunto no encontrado',
  share_not_found: 'Link compartido no encontrado',
};

/**
 * 404 de un recurso de documentación. Un id con forma inválida responde igual que uno inexistente
 * (S-023 CA-14: no se distingue "no existe" de "mal escrito") y sin llamar al bus.
 */
export function respondDocsNotFound(res: Response, code: DocsNotFoundCode) {
  return res.status(404).json({ code, message: NOT_FOUND_MESSAGES[code] });
}
