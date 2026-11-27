import { Request, Response, Router } from 'express';
import joi from 'joi';
import { Op, fn, col } from 'sequelize';
import validateQueryParams from '../utils/validate-query-params';
import hasAnyRole from '../utils/middlewares/has-any-role';
import logger from '../logger';
import { Objective, Person, Project, Requirement, UnworkedTime, WorkedTime } from '@jiku/models';

const router: Router = Router();

const querySchema = joi.object({
  dateFrom: joi.date().iso().required(),
  dateTo: joi.date().iso().min(joi.ref('dateFrom')).required()
});

interface AggregatedRow {
  personId: number;
  projectId: number;
  objectiveId: number | null;
  requirementId: number | null;
  totalMinutes: string;
  person: Person;
  projects: Project;
  objective: (Objective & { requirement: Requirement | null }) | null;
  requirement: Requirement | null;
}

interface UnworkedAggregatedRow {
  personId: number;
  totalMinutes: string;
  person: Person;
}

async function getReportByPerson(req: Request, res: Response) {
  const dateFrom = new Date(`${req.query.dateFrom}T00:00:00.000Z`);
  const dateTo = new Date(`${req.query.dateTo}T23:59:59.999Z`);

  try {
    const [workedRows, unworkedRows] = await Promise.all([
      WorkedTime.findAll({
        attributes: [
          'personId',
          'projectId',
          'objectiveId',
          'requirementId',
          [fn('SUM', col('minutes')), 'totalMinutes']
        ],
        where: {
          date: { [Op.between]: [dateFrom, dateTo] }
        },
        group: ['personId', 'projectId', 'objectiveId', 'requirementId', 'person.id', 'projects.id', 'objective.id', 'objective.requirement_id', 'objective->requirement.id', 'requirement.id'],
        include: [
          { model: Person, as: 'person', attributes: ['id', 'firstName', 'lastName'] },
          { model: Project, as: 'projects', attributes: ['id', 'name', 'code'] },
          {
            model: Objective,
            as: 'objective',
            attributes: ['id', 'title', 'requirementId'],
            include: [
              { model: Requirement, as: 'requirement', attributes: ['id', 'title'] }
            ]
          },
          { model: Requirement, as: 'requirement', attributes: ['id', 'title'] }
        ],
        raw: true,
        nest: true
      }),
      UnworkedTime.findAll({
        attributes: [
          'personId',
          [fn('SUM', col('minutes')), 'totalMinutes']
        ],
        where: {
          date: { [Op.between]: [dateFrom, dateTo] }
        },
        group: ['personId', 'person.id'],
        include: [
          { model: Person, as: 'person', attributes: ['id', 'firstName', 'lastName'] }
        ],
        raw: true,
        nest: true
      })
    ]);

    const unworkedAdaptedAsWorked = (unworkedRows as unknown as UnworkedAggregatedRow[]).map((row) => ({
      ...row,
      projectId: 0, // Static ID for "Unworked"
      objectiveId: null,
      requirementId: null,
      projects: { id: 0, name: 'Ausencia', code: 'AUS' },
      objective: null,
      requirement: null
    }));

    const allRows = [
      ...workedRows as unknown as AggregatedRow[],
      ...unworkedAdaptedAsWorked
    ];

    const personsMap = new Map<number, {
      personId: number;
      personFirstName: string;
      personLastName: string;
      totalMinutes: number;
      projects: Map<number, {
        projectId: number;
        projectName: string;
        projectCode: string;
        totalMinutes: number;
        objectives: Array<{
          objectiveId: number | null;
          objectiveTitle: string | null;
          requirementId: number | null;
          requirementTitle: string | null;
          objectiveRequirementId: number | null;
          objectiveRequirementTitle: string | null;
          totalMinutes: number;
        }>;
      }>;
    }>();

    for (const row of allRows) {
      const minutes = Number(row.totalMinutes);

      if (!personsMap.has(row.personId)) {
        personsMap.set(row.personId, {
          personId: row.personId,
          personFirstName: row.person.firstName,
          personLastName: row.person.lastName,
          totalMinutes: 0,
          projects: new Map()
        });
      }
      const person = personsMap.get(row.personId)!;

      if (!person.projects.has(row.projectId)) {
        person.projects.set(row.projectId, {
          projectId: row.projectId,
          projectName: row.projects.name,
          projectCode: row.projects.code,
          totalMinutes: 0,
          objectives: []
        });
      }
      const project = person.projects.get(row.projectId)!;

      project.objectives.push({
        objectiveId: row.objectiveId ?? null,
        objectiveTitle: row.objective?.title ?? null,
        requirementId: row.requirementId ?? null,
        requirementTitle: row.requirement?.title ?? null,
        objectiveRequirementId: row.objective?.requirementId ?? null,
        objectiveRequirementTitle: row.objective?.requirement?.title ?? null,
        totalMinutes: minutes
      });

      project.totalMinutes += minutes;
      person.totalMinutes += minutes;
    }

    const result = Array.from(personsMap.values()).map((person) => ({
      personId: person.personId,
      personFirstName: person.personFirstName,
      personLastName: person.personLastName,
      totalMinutes: person.totalMinutes,
      projects: Array.from(person.projects.values()).map((project) => ({
        projectId: project.projectId,
        projectName: project.projectName,
        projectCode: project.projectCode,
        totalMinutes: project.totalMinutes,
        objectives: project.objectives
      }))
    }));

    return res.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`GET /api/worked-times/report/by-person error: ${errorMessage}`);
    return res.status(500).json({
      code: 'internal_error',
      message: 'Internal error'
    });
  }
}

router.get('/worked-times/report/by-person',
  hasAnyRole(['user', 'admin']),
  validateQueryParams(querySchema),
  getReportByPerson
);

export default router;
