import { Request, Response, Router } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../models';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateQueryParams from '../utils/validate-query-params';
import joi from 'joi';

const router: Router = Router();

const querySchema = joi.object({
  projectId: joi.number().integer().required(),
  keyQuery: joi.string().optional(),
});

function getTagSuggestions(req: Request, res: Response) {
  const { projectId, keyQuery } = req.query as any;

  return sequelize.query<{ key: string; value: string }>(
    `SELECT DISTINCT
      jsonb_array_elements(tags)->>'key' AS key,
      jsonb_array_elements(tags)->>'value' AS value
    FROM requirements
    WHERE project_id = :projectId
    AND tags IS NOT NULL`,
    {
      replacements: { projectId: Number(projectId) },
      type: QueryTypes.SELECT,
    }
  )
    .then((rows) => {
      const grouped: Record<string, string[]> = {};
      for (const { key, value } of rows) {
        if (keyQuery && !key.includes(String(keyQuery))) continue;
        if (!grouped[key]) grouped[key] = [];
        if (!grouped[key].includes(value)) grouped[key].push(value);
      }
      const result = Object.entries(grouped).map(([key, values]) => ({ key, values }));
      return res.status(200).json(result);
    })
    .catch((error) => {
      logger.error(`[GET /requirements/tags/suggestions] error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

router.get('/requirements/tags/suggestions',
  hasAnyRole(['user', 'admin']),
  validateQueryParams(querySchema),
  getTagSuggestions
);

export default router;
