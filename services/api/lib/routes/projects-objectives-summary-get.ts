import { Request, Response, Router } from 'express';
const router: Router = Router();
import { Op, literal } from 'sequelize';
import logger from '../logger';
import { Objective, Person, Project, WorkedTime } from '@jiku/models';

function getProjectsObjectivesSummary(_req: Request, res: Response) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  return Project.findAll({
    where: {
      status: {
        [Op.in]: ['activo', 'analisis']
      }
    },
    attributes: ['id', 'name', 'code', 'status', 'type'],
    include: [
      {
        model: Objective,
        as: 'objectives',
        where: {
          state: {
            [Op.in]: ['activo', 'en_revision']
          }
        },
        required: true,
        attributes: [
          'id', 'title', 'description', 'state', 'area', 'priority',
          'projectId', 'estimatedFinishDate', 'finishedAt',
          'createdAt', 'updatedAt', 'visibilityLevel'
        ],
        include: [
          {
            model: Person,
            through: { attributes: ['isLeader'] },
            attributes: ['id', 'firstName', 'lastName']
          },
          {
            model: WorkedTime,
            as: 'workedTime',
            required: false,
            attributes: ['id', 'minutes', 'personId'],
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['id', 'firstName', 'lastName']
              }
            ]
          }
        ]
      }
    ],
    order: [
      ['name', 'ASC'],
      [{ model: Objective, as: 'objectives' }, 'estimatedFinishDate', 'ASC']
    ]
  })
    .then((projects) => {
      if (!projects || projects.length === 0) {
        res.status(200).json([]);
        return Promise.resolve(null);
      }

      const projectIds = projects.map(p => p.id);
      const objectiveIds = projects.flatMap(p =>
        p.objectives?.map(o => o.id) || []
      );

      return Promise.all([
        Promise.resolve(projects),

        WorkedTime.findAll({
          attributes: [
            [literal('CAST("WorkedTime"."project_id" AS INTEGER)'), 'projectId'],
            [literal('SUM("WorkedTime"."minutes")'), 'totalMinutes']
          ],
          where: {
            projectId: { [Op.in]: projectIds }
          },
          group: ['projectId'],
          raw: true
        }),

        WorkedTime.findAll({
          attributes: [
            [literal('CAST("WorkedTime"."project_id" AS INTEGER)'), 'projectId'],
            [literal('SUM("WorkedTime"."minutes")'), 'totalMinutes']
          ],
          where: {
            projectId: { [Op.in]: projectIds },
            date: {
              [Op.gte]: new Date(currentYear, currentMonth - 1, 1),
              [Op.lt]: new Date(currentYear, currentMonth, 1)
            }
          },
          group: ['projectId'],
          raw: true
        }),

        WorkedTime.findAll({
          attributes: [
            [literal('CAST("WorkedTime"."objective_id" AS INTEGER)'), 'objectiveId'],
            [literal('SUM("WorkedTime"."minutes")'), 'totalMinutes']
          ],
          where: {
            objectiveId: { [Op.in]: objectiveIds }
          },
          group: ['objectiveId'],
          raw: true
        })
      ]);
    })
    .then((results) => {
      if (!Array.isArray(results)) {
        return;
      }

      const [projects, projectTotalHours, projectMonthHours, objectiveHours] = results;

      const result = (projects as Project[]).map((project) => {
        const projectData = project.toJSON();

        const totalHours = (projectTotalHours as any[]).find(
          h => Number(h.projectId) === project.id
        );
        const monthHours = (projectMonthHours as any[]).find(
          h => Number(h.projectId) === project.id
        );

        const objectives = (projectData.objectives || []).map((obj: any) => {
          const objHours = (objectiveHours as any[]).find(
            h => Number(h.objectiveId) === obj.id
          );

          return {
            ...obj,
            project: {
              id: project.id,
              name: project.name,
              code: project.code,
              status: project.status,
              type: project.type
            },
            workedMinutes: objHours ? Number(objHours.totalMinutes) : 0
            // Mantener workedTime del include (necesario para tooltip)
          };
        });

        return {
          project: {
            id: project.id,
            name: project.name,
            code: project.code,
            status: project.status,
            type: project.type
          },
          objectives,
          stages: projectData.stages || [],
          totalWorkedMinutes: totalHours ? Number(totalHours.totalMinutes) : 0,
          monthWorkedMinutes: monthHours ? Number(monthHours.totalMinutes) : 0
        };
      });

      return res.status(200).json(result);
    })
    .catch((error) => {
      logger.error(`GET /api/projects/objectives-summary error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get projects objectives summary
 * @description Get active objectives grouped by project with worked hours calculation (optimized).
 *   Fetches projects with active objectives and calculates hours using SQL aggregations.
 *   - Projects: Only those with active/en_revision objectives
 *   - Objectives: Only activo/en_revision states (without WorkedTime details to reduce payload)
 *   - Hours: Calculated via SQL GROUP BY (includes finished objectives for accurate totals)
 *   - Query optimization: 1 main query + 3 aggregation queries (vs previous 5 complex queries)
 * @route {GET} /api/projects/objectives-summary
 * @response {200} OK
 * @responsebody {array<object>} [projects] Projects with objectives and hours
 * @responsebody {object} [projects[].project] Project information
 * @responsebody {number} [projects[].project.id] Project identifier
 * @responsebody {string} [projects[].project.name] Project name
 * @responsebody {string} [projects[].project.code] Project code
 * @responsebody {string} [projects[].project.status] Project status
 * @responsebody {string} [projects[].project.type] Project type
 * @responsebody {array<object>} [projects[].objectives] Active objectives with persons
 * @responsebody {number} [projects[].objectives[].workedMinutes] Total worked minutes for this objective
 * @responsebody {array<object>} [projects[].stages] Active stages
 * @responsebody {number} [projects[].totalWorkedMinutes] Total worked minutes in project (includes finished objectives)
 * @responsebody {number} [projects[].monthWorkedMinutes] Current month worked minutes (includes finished objectives)
 * @response {500} Internal error
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */
router.get('/projects/objectives-summary', getProjectsObjectivesSummary);

export default router;
