import { Request, Response, Router } from 'express';
import joi from 'joi';
import { Op, fn, col } from 'sequelize';
import validateQueryParams from '../utils/validate-query-params';
import hasAnyRole from '../utils/middlewares/has-any-role';
import logger from '../logger';
import { Objective, Person, Project, Requirement, WorkedTime } from '@jiku/models';

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

interface PersonEntry {
  personId: number;
  personFirstName: string;
  personLastName: string;
  totalMinutes: number;
}

interface ObjectiveEntry {
  objectiveId: number | null;
  objectiveTitle: string | null;
  requirementId: number | null;
  requirementTitle: string | null;
  objectiveRequirementId: number | null;
  objectiveRequirementTitle: string | null;
  totalMinutes: number;
  persons: PersonEntry[];
}

function getReportByProject(req: Request, res: Response) {
  const dateFrom = new Date(`${req.query.dateFrom}T00:00:00.000Z`);
  const dateTo = new Date(`${req.query.dateTo}T23:59:59.999Z`);

  return WorkedTime.findAll({
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
  })
    .then((rows) => {
      const typedRows = rows as unknown as AggregatedRow[];
      const projectsMap = new Map<number, {
        projectId: number;
        projectName: string;
        projectCode: string;
        totalMinutes: number;
        objectivesMap: Map<string, ObjectiveEntry>;
        noObjectivePersonsMap: Map<number, PersonEntry>;
      }>();

      for (const row of typedRows) {
        const minutes = Number(row.totalMinutes);
        // Clave compuesta: separa objetivos y requisitos en filas distintas;
        // 'none' es solo-proyecto (sin objetivo ni requisito).
        const entryKey = row.objectiveId !== null
          ? `obj-${row.objectiveId}`
          : row.requirementId !== null
            ? `req-${row.requirementId}`
            : 'none';

        if (!projectsMap.has(row.projectId)) {
          projectsMap.set(row.projectId, {
            projectId: row.projectId,
            projectName: row.projects.name,
            projectCode: row.projects.code,
            totalMinutes: 0,
            objectivesMap: new Map(),
            noObjectivePersonsMap: new Map()
          });
        }
        const project = projectsMap.get(row.projectId)!;

        if (!project.objectivesMap.has(entryKey)) {
          project.objectivesMap.set(entryKey, {
            objectiveId: row.objectiveId ?? null,
            objectiveTitle: row.objective?.title ?? null,
            requirementId: row.requirementId ?? null,
            requirementTitle: row.requirement?.title ?? null,
            objectiveRequirementId: row.objective?.requirementId ?? null,
            objectiveRequirementTitle: row.objective?.requirement?.title ?? null,
            totalMinutes: 0,
            persons: []
          });
        }
        const objective = project.objectivesMap.get(entryKey)!;

        objective.persons.push({
          personId: row.personId,
          personFirstName: row.person.firstName,
          personLastName: row.person.lastName,
          totalMinutes: minutes
        });
        objective.totalMinutes += minutes;
        project.totalMinutes += minutes;

        // "Sin objetivo" (solo-proyecto) = sin objetivo Y sin requisito.
        if (row.objectiveId === null && row.requirementId === null) {
          project.noObjectivePersonsMap.set(row.personId, {
            personId: row.personId,
            personFirstName: row.person.firstName,
            personLastName: row.person.lastName,
            totalMinutes: minutes
          });
        }
      }

      const result = Array.from(projectsMap.values()).map((project) => ({
        projectId: project.projectId,
        projectName: project.projectName,
        projectCode: project.projectCode,
        totalMinutes: project.totalMinutes,
        objectives: Array.from(project.objectivesMap.values())
          // Mantiene objetivos y requisitos como filas; excluye solo-proyecto (va en `persons`).
          .filter((obj) => obj.objectiveId !== null || obj.requirementId !== null)
          .map((obj) => ({
            objectiveId: obj.objectiveId,
            objectiveTitle: obj.objectiveTitle,
            requirementId: obj.requirementId,
            requirementTitle: obj.requirementTitle,
            objectiveRequirementId: obj.objectiveRequirementId,
            objectiveRequirementTitle: obj.objectiveRequirementTitle,
            totalMinutes: obj.totalMinutes,
            persons: obj.persons
          })),
        persons: Array.from(project.noObjectivePersonsMap.values())
      }));

      return res.status(200).json(result);
    })
    .catch((error) => {
      logger.error(`GET /api/worked-times/report/by-project error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

router.get('/worked-times/report/by-project',
  hasAnyRole(['user', 'admin']),
  validateQueryParams(querySchema),
  getReportByProject
);

export default router;
