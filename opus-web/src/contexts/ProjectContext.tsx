'use client';

import { createContext, useContext, useState } from 'react';

interface Project {
  id: number;
  name: string;
}

interface ProjectContextValue {
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useActiveProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useActiveProject must be used within ProjectProvider');
  }
  return context;
}
