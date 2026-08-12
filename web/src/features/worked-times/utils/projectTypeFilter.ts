import type { ReportByPerson, ReportByProject } from '../types/worked-time.types';
import type { ProjectType } from '@/features/projects/types/project.types';

export function matchesProjectType(
  type: ProjectType | undefined,
  selectedTypes: ProjectType[]
): boolean {
  if (selectedTypes.length === 0) return true;
  if (type === undefined) return false;

  return selectedTypes.includes(type);
}

export function filterReportByPerson(
  data: ReportByPerson[] | undefined,
  projectTypeMap: Map<number, ProjectType>,
  selectedTypes: ProjectType[]
): ReportByPerson[] | undefined {
  if (data === undefined) return undefined;
  if (selectedTypes.length === 0) return data;

  return data.reduce<ReportByPerson[]>((result, person) => {
    const filteredProjects = person.projects.filter((p) =>
      matchesProjectType(projectTypeMap.get(p.projectId), selectedTypes)
    );

    if (filteredProjects.length === 0) return result;

    result.push({
      ...person,
      projects: filteredProjects,
      totalMinutes: filteredProjects.reduce((sum, p) => sum + p.totalMinutes, 0),
    });

    return result;
  }, []);
}

export function filterReportByProject(
  data: ReportByProject[] | undefined,
  projectTypeMap: Map<number, ProjectType>,
  selectedTypes: ProjectType[]
): ReportByProject[] | undefined {
  if (data === undefined) return undefined;
  if (selectedTypes.length === 0) return data;

  return data.filter((project) =>
    matchesProjectType(projectTypeMap.get(project.projectId), selectedTypes)
  );
}
