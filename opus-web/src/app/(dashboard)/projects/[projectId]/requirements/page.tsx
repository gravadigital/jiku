'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useActiveProject } from '@/contexts/ProjectContext';
import {
  useRequirementsByStatus,
  KanbanBoard,
  ListView,
  MobileRequirementsBoard,
  RequirementDetailModal,
  BoardHeader,
  CreateRequirementModal,
} from '@/features/requirements';
import type { ColumnData } from '@/features/requirements/components/KanbanBoard/KanbanBoard';
import type { StateData } from '@/features/requirements/components/MobileRequirementsBoard/MobileRequirementsBoard';
import { useIsMobile } from '@/shared/hooks';
import { useProjects } from '@/features/projects';
import { Spinner } from '@/shared/components/ui';
import styles from './page.module.scss';

const COLUMN_STATES = {
  analisis: ['analisis'],
  planificacion: ['planificacion'],
  en_cola: ['en_cola'],
  desarrollo: ['desarrollo'],
  revision: ['revision'],
  resuelto: ['resuelto'],
  cancelado: ['cancelado'],
};

export default function RequirementsPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const projectId = Number(params.projectId);
  const view = searchParams?.get('view') || 'list';
  const { activeProject, setActiveProject } = useActiveProject();
  const { data: projects } = useProjects();
  const isMobile = useIsMobile();
  const [selectedRequirementId, setSelectedRequirementId] = useState<number | null>(null);
  const [isNewRequirementModalOpen, setIsNewRequirementModalOpen] = useState(false);

  const analisisQuery = useRequirementsByStatus({ projectId, status: COLUMN_STATES.analisis });
  const planificacionQuery = useRequirementsByStatus({
    projectId,
    status: COLUMN_STATES.planificacion,
  });
  const enColaQuery = useRequirementsByStatus({ projectId, status: COLUMN_STATES.en_cola });
  const desarrolloQuery = useRequirementsByStatus({ projectId, status: COLUMN_STATES.desarrollo });
  const revisionQuery = useRequirementsByStatus({ projectId, status: COLUMN_STATES.revision });
  const resueltoQuery = useRequirementsByStatus({ projectId, status: COLUMN_STATES.resuelto });
  const canceladoQuery = useRequirementsByStatus({ projectId, status: COLUMN_STATES.cancelado });

  const queries = [
    analisisQuery,
    planificacionQuery,
    enColaQuery,
    desarrolloQuery,
    revisionQuery,
    resueltoQuery,
    canceladoQuery,
  ];
  const isLoading = queries.some((q) => q.isLoading);

  useEffect(() => {
    if (activeProject?.id !== projectId && projectId > 0 && projects) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setActiveProject(project);
      }
    }
  }, [projectId, activeProject, setActiveProject, projects]);

  const columnsData = useMemo(
    (): Record<string, ColumnData> => ({
      analisis: {
        requirements: analisisQuery.data?.pages.flat() ?? [],
        hasMore: analisisQuery.hasNextPage ?? false,
        isLoadingMore: analisisQuery.isFetchingNextPage,
        onLoadMore: () => analisisQuery.fetchNextPage(),
      },
      planificacion: {
        requirements: planificacionQuery.data?.pages.flat() ?? [],
        hasMore: planificacionQuery.hasNextPage ?? false,
        isLoadingMore: planificacionQuery.isFetchingNextPage,
        onLoadMore: () => planificacionQuery.fetchNextPage(),
      },
      en_cola: {
        requirements: enColaQuery.data?.pages.flat() ?? [],
        hasMore: enColaQuery.hasNextPage ?? false,
        isLoadingMore: enColaQuery.isFetchingNextPage,
        onLoadMore: () => enColaQuery.fetchNextPage(),
      },
      desarrollo: {
        requirements: desarrolloQuery.data?.pages.flat() ?? [],
        hasMore: desarrolloQuery.hasNextPage ?? false,
        isLoadingMore: desarrolloQuery.isFetchingNextPage,
        onLoadMore: () => desarrolloQuery.fetchNextPage(),
      },
      revision: {
        requirements: revisionQuery.data?.pages.flat() ?? [],
        hasMore: revisionQuery.hasNextPage ?? false,
        isLoadingMore: revisionQuery.isFetchingNextPage,
        onLoadMore: () => revisionQuery.fetchNextPage(),
      },
      resuelto: {
        requirements: resueltoQuery.data?.pages.flat() ?? [],
        hasMore: resueltoQuery.hasNextPage ?? false,
        isLoadingMore: resueltoQuery.isFetchingNextPage,
        onLoadMore: () => resueltoQuery.fetchNextPage(),
      },
      cancelado: {
        requirements: canceladoQuery.data?.pages.flat() ?? [],
        hasMore: canceladoQuery.hasNextPage ?? false,
        isLoadingMore: canceladoQuery.isFetchingNextPage,
        onLoadMore: () => canceladoQuery.fetchNextPage(),
      },
    }),
    [
      analisisQuery,
      planificacionQuery,
      enColaQuery,
      desarrolloQuery,
      revisionQuery,
      resueltoQuery,
      canceladoQuery,
    ]
  );

  const statesData = useMemo((): Record<string, StateData> => columnsData, [columnsData]);

  const currentProjectName = useMemo(
    () => projects?.find((p) => p.id === projectId)?.name ?? activeProject?.name ?? 'Proyecto',
    [projects, projectId, activeProject]
  );

  function handleRequirementClick(requirementId: number) {
    setSelectedRequirementId(requirementId);
  }

  function handleCloseDrawer() {
    setSelectedRequirementId(null);
  }

  function handleOpenNewRequirementModal() {
    setIsNewRequirementModalOpen(true);
  }

  function handleCloseNewRequirementModal() {
    setIsNewRequirementModalOpen(false);
  }

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.centered}>
          <Spinner size="lg" />
          <p className={styles.loadingText}>Cargando requisitos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <BoardHeader
        projectName={currentProjectName}
        projectId={projectId}
        onNewRequirement={handleOpenNewRequirementModal}
      />
      {isMobile ? (
        <MobileRequirementsBoard states={statesData} projectId={projectId} />
      ) : view === 'list' ? (
        <ListView
          sections={columnsData}
          projectId={projectId}
          onRequirementClick={handleRequirementClick}
        />
      ) : (
        <KanbanBoard
          columns={columnsData}
          projectId={projectId}
          onRequirementClick={handleRequirementClick}
        />
      )}
      <RequirementDetailModal
        requirementId={selectedRequirementId ?? 0}
        isOpen={selectedRequirementId !== null}
        onClose={handleCloseDrawer}
        projectName={currentProjectName}
      />
      <CreateRequirementModal
        isOpen={isNewRequirementModalOpen}
        onClose={handleCloseNewRequirementModal}
      />
    </div>
  );
}
