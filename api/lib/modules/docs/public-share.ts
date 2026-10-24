import { Request } from 'express';
import logger from '../../logger';
import { sendToModule } from '../client';
import { registryFor } from '../registry';

export const SHARE_TOKEN_PATTERN = /^jds_[A-Za-z0-9_-]{43}$/;

/** `data` de `shares.resolve` (jiku-docs-queries.yaml, ReplyShareResolve). */
export interface SharedDocument {
  shareId: string;
  documentId: string;
  title: string;
  version: number;
  html?: string;
  htmlUrl?: string;
  attachments?: Array<{ id: string; fileName: string; mimeType: string }>;
}

/** `data` de `shares.attachment` (ReplyShareAttachment). */
export interface ShareAttachmentTicket {
  downloadUrl: string;
  expiresIn: number;
}

/**
 * `ClientInfo` de jiku-docs (P-1): jiku-docs no ve al visitante, así que si la api no reenvía `ip` y
 * `userAgent` la auditoría de accesos al link queda vacía. `ip` <= 100 y `userAgent` <= 2000 (los
 * `maxLength` del contrato: mandar más sería `invalid_fields` y el link se vería como inválido).
 * Las claves ausentes se omiten.
 */
export function clientInfo(req: Request): { ip?: string; userAgent?: string } {
  const info: { ip?: string; userAgent?: string } = {};
  if (req.ip) info.ip = req.ip.slice(0, 100);
  const ua = req.get('user-agent');
  if (ua) info.userAgent = ua.slice(0, 2000);
  return info;
}

export type ShareResult<T> = { ok: true; data: T } | { ok: false; status: 404 | 503 };

/**
 * Pasos 4 y 5 de la cadena de la ruta pública. Payload SIN `actor` (DD-1): `{ ...payload, client? }`.
 * El 404 es UNO solo (Flujo 5): cualquier error de jiku-docs se colapsa en él. Solo se loguea el
 * código de error, nunca el mensaje ni el payload (lleva el token).
 */
export async function queryShare<T>(
  method: 'shares.resolve' | 'shares.attachment',
  req: Request,
  payload: Record<string, unknown>
): Promise<ShareResult<T>> {
  const state = registryFor('docs').status();
  if (state === 'unavailable') return { ok: false, status: 503 };
  if (state !== 'available') return { ok: false, status: 404 };

  const client = clientInfo(req);
  const body = { ...payload, ...(Object.keys(client).length ? { client } : {}) };

  const outcome = await sendToModule<T>('query', 'docs', method, body);
  switch (outcome.kind) {
  case 'data':
    if (outcome.data === null) {
      logger.error(`[public-docs] ${method}: reply sin data`);
      return { ok: false, status: 503 };
    }
    return { ok: true, data: outcome.data };
  case 'failure':
    if (outcome.reply.errorCode !== 'share_not_found') {
      logger.error(`[public-docs] ${method}: ${outcome.reply.errorCode}`);
    }
    return { ok: false, status: 404 };
  default:
    // timeout / unreachable: ya los logueó sendToModule.
    return { ok: false, status: 503 };
  }
}
