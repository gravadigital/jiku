'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Project } from '@/features/projects/types/project.types';

// Tipos
interface ProjectContextValue {
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;
  clearActiveProject: () => void;
  isProjectSelected: boolean;
}

// Context
const ProjectContext = createContext<ProjectContextValue | null>(null);

// Provider Props
interface ProjectProviderProps {
  readonly children: React.ReactNode;
  readonly initialProject?: Project | null;
}

// Provider Component
function ProjectProvider({ children, initialProject = null }: ProjectProviderProps) {
  const [activeProject, setActiveProjectState] = useState<Project | null>(initialProject);

  const setActiveProject = useCallback((project: Project | null) => {
    setActiveProjectState(project);
    // Persistir en localStorage
    if (project) {
      localStorage.setItem('activeProjectId', String(project.id));
    } else {
      localStorage.removeItem('activeProjectId');
    }
  }, []);

  const clearActiveProject = useCallback(() => {
    setActiveProjectState(null);
    localStorage.removeItem('activeProjectId');
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      activeProject,
      setActiveProject,
      clearActiveProject,
      isProjectSelected: activeProject !== null,
    }),
    [activeProject, setActiveProject, clearActiveProject]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

// Hook para usar el context
function useActiveProject() {
  const context = useContext(ProjectContext);

  if (!context) {
    throw new Error('useActiveProject debe ser usado dentro de un ProjectProvider');
  }

  return context;
}

// Hook opcional para solo leer el proyecto (sin throw)
function useActiveProjectOptional() {
  return useContext(ProjectContext);
}

export { ProjectProvider, useActiveProject, useActiveProjectOptional };
