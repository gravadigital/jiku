import { Request, Response, Router } from 'express';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';

const router: Router = Router();

async function getFolder(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isUlid(id)) return respondDocsNotFound(res, 'folder_not_found');

  try {
    // Sin `acl`: la administración de permisos de carpeta está fuera de alcance.
    const data = await moduleQuery(res, 'docs', 'folders.get', { id, include: ['effectivePermission'] });
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`GET /api/docs/folders/:id getFolder error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Get folder
 * @description Una carpeta con el permiso efectivo de la persona (REQ-016, ruta 7): `folders.get`.
 * @route {GET} /api/docs/folders/:id
 * @response {200} OK
 * @response {403} Access denied
 * @response {404} Folder not found / module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.get('/docs/folders/:id', requireModule('docs'), hasAnyRole(['admin', 'user']), getFolder);

export default router;
