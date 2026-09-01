import { Request, Response, Router } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../models';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateRequirement from '../utils/middlewares/validate-requirement';

const router: Router = Router();

// La fila cruda: `minutes` llega como string porque el SUM de PostgreSQL es bigint y `pg`
// lo entrega así para no perder precisión.
type PersonMinutesRow = {
  personId: number;
  firstName: string;
  lastName: string;
  minutes: string;
};

function getWorkedHours(req: Request, res: Response) {
  const requirementId = req.requirement.id;

  // Una sola consulta agrupada, no dos independientes: `totalMinutes` es la suma de las filas
  // de `byPerson`, así que la invariante total = desglose es estructural y no depende de que
  // dos consultas separadas coincidan.
  //
  // UNION ALL y no UNION: los dos conjuntos son disjuntos por la exclusión mutua
  // objective_id ↔ requirement_id de worked_times, y deduplicar borraría dos imputaciones
  // legítimas de igual monto de la misma persona.
  //
  // El INNER JOIN a people va sin predicado sobre enabled / end_date / user_id: una persona
  // deshabilitada, con baja, o sin Usuario vinculado igual trabajó esas horas, y si se la
  // filtrara la suma del desglose dejaría de dar el total.
  return sequelize.query<PersonMinutesRow>(
    `SELECT p.id AS "personId", p.first_name AS "firstName", p.last_name AS "lastName",
            SUM(src.minutes)::bigint AS minutes
       FROM (
         SELECT wt.person_id, wt.minutes FROM worked_times wt WHERE wt.requirement_id = :reqId
         UNION ALL
         SELECT wt.person_id, wt.minutes FROM worked_times wt
           INNER JOIN objectives o ON o.id = wt.objective_id WHERE o.requirement_id = :reqId
       ) AS src
       INNER JOIN people p ON p.id = src.person_id
      GROUP BY p.id, p.first_name, p.last_name
      ORDER BY minutes DESC, p.id ASC`,
    {
      replacements: { reqId: requirementId },
      type: QueryTypes.SELECT,
    }
  )
    .then((rows) => {
      const byPerson = rows.map((row) => ({
        personId: Number(row.personId),
        firstName: row.firstName,
        lastName: row.lastName,
        minutes: Number(row.minutes),
      }));
      const totalMinutes = byPerson.reduce((acc, person) => acc + person.minutes, 0);

      return res.status(200).json({ requirementId, totalMinutes, byPerson });
    })
    .catch((error: Error) => {
      logger.error(`GET /requirements/:reqid/worked-hours error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

router.get('/requirements/:reqid/worked-hours',
  hasAnyRole(['user', 'admin']),
  validateRequirement,
  getWorkedHours
);

export default router;
