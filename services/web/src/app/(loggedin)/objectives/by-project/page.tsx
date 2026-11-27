import { getProjectsObjectivesSummary, ProjectObjectiveSummary } from '@/features/projects';
import { ProjectObjectives } from '@/features/projects';
import { ViewHeader } from '@/shared/components/ui';
import { ScrollToProject } from './ScrollToProject';

export default async function Objectives() {
  let projectsList: ProjectObjectiveSummary[] = [];

  try {
    projectsList = await getProjectsObjectivesSummary();
  } catch (error) {
    console.error('Error fetching projects objectives summary:', error);
  }

  return (
    <>
      <ViewHeader variant="list" title="Tareas por proyecto" />
      <ScrollToProject />
      <main>
        {projectsList.map((projectData) => {
          const currentMonthHours = Math.floor(projectData.monthWorkedMinutes / 60);
          const currentMonthMinutes = projectData.monthWorkedMinutes % 60;

          return (
            <ProjectObjectives
              key={`project-${projectData.project.id}`}
              projectId={projectData.project.id}
              projectName={projectData.project.name}
              objectives={projectData.objectives}
              currentMonthHours={currentMonthHours}
              currentMonthMinutes={currentMonthMinutes}
            />
          );
        })}
      </main>
    </>
  );
}
