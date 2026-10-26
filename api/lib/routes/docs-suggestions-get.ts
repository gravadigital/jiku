import { Request, Response, Router } from 'express';
import joi from 'joi';
import { Op } from 'sequelize';
import { Client, Person, Project } from '@jiku/models';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { activeProjectIdsOf } from '../modules/docs/active-projects';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

const SCHEMA = joi.object({
  q: joi.string().trim().min(1).max(100).required(),
  clientId: joi.number().integer().positive(),
  // Tope POR grupo.
  limit: joi.number().integer().min(1).max(10).default(5),
});

// Tope de candidatos de proyecto antes de rankear en memoria: acota tablas chicas y evita un
// `literal` con ids para ordenar por "mis proyectos".
const PROJECT_CANDIDATES_MAX = 200;

async function suggest(req: Request, res: Response) {
  const query = SCHEMA.validate(req.query).value;
  const q: string = query.q;
  const limit: number = query.limit;
  try {
    // Fail-closed como el embudo: sin identidad verificada no se consulta ni la base ni el bus.
    const sub = req.decodedToken?.sub;
    if (!sub) return res.status(401).json({ code: 'unauthorized', message: 'Unauthorized' });

    // La sugerencia busca texto, no patrones: se escapan los comodines de ILIKE (`\`, `%`, `_`).
    const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%';

    // Primero la base, después el bus: si `topics.list` falla no se devuelven parciales.
    const [mine, candidates, clients, people] = await Promise.all([
      activeProjectIdsOf(sub),
      Project.findAll({
        where: {
          [Op.and]: [
            { [Op.or]: [{ name: { [Op.iLike]: like } }, { code: { [Op.iLike]: like } }] },
            ...(query.clientId !== undefined ? [{ clientId: query.clientId }] : []), // solo limita proyectos
          ],
        },
        attributes: ['id', 'name', 'code', 'clientId', 'status'],
        include: [{ model: Client, as: 'client', attributes: ['name'] }],
        order: [['name', 'ASC']],
        limit: PROJECT_CANDIDATES_MAX,
      }),
      Client.findAll({ where: { name: { [Op.iLike]: like } }, attributes: ['id', 'name'], order: [['name', 'ASC']], limit }),
      Person.findAll({
        where: {
          enabled: true,
          userId: { [Op.ne]: null },
          [Op.or]: [{ firstName: { [Op.iLike]: like } }, { lastName: { [Op.iLike]: like } }],
        },
        attributes: ['firstName', 'lastName', 'userId'],
        order: [['firstName', 'ASC'], ['lastName', 'ASC']],
        limit,
      }),
    ]);

    const mineSet = new Set(mine);
    const rank = (p: any) => (mineSet.has(p.id) ? 0 : p.status === 'activo' ? 1 : 2);
    // `sort` es estable: dentro de cada grupo queda el orden por `name` de la consulta.
    const projects = [...candidates].sort((a: any, b: any) => rank(a) - rank(b)).slice(0, limit).map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      clientId: p.clientId ?? null,
      clientName: p.client?.name ?? null,
      mine: mineSet.has(p.id),
    }));

    // El prefijo va sin escapar: no es un LIKE de la api, jiku-docs lo trata como prefijo.
    const topics = await moduleQuery(res, 'docs', 'topics.list', { filter: { prefix: q }, page: { limit } });
    if (!topics) return;

    return res.status(200).json({
      projects,
      clients: clients.map((c: any) => ({ id: c.id, name: c.name })),
      persons: people.map((p: any) => ({ userId: p.userId, name: `${p.firstName} ${p.lastName}` })),
      topics: topics.items ?? [],
    });
  } catch (error: any) {
    logger.error(`GET /api/docs/suggestions suggest error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Documentation search suggestions
 * @description Sugerencias agrupadas del buscador (REQ-021 / S-094): proyectos (los activos de la
 * persona primero, `clientId` opcional), clientes y personas desde la base, y temas de
 * `topics.list`. Los temas solo coinciden por PREFIJO ("vid" encuentra "video", no
 * "pedido-video"). "Buscar «q»" y "Sin proyecto/cliente/tema" los arma la web.
 * @route {GET} /api/docs/suggestions
 * @response {200} OK - `{ projects, clients, persons, topics }`
 * @response {400} Invalid fields
 * @response {401} Unauthorized
 * @response {403} Access denied
 * @response {404} Module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.get('/docs/suggestions', requireModule('docs'), hasAnyRole(['admin', 'user']), validateQueryParams(SCHEMA), suggest);

export default router;
