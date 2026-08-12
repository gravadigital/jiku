'use client';

import { useSession } from 'next-auth/react';
import { BoardHeader } from '../BoardHeader';
import { RequirementInfoPanel } from '../RequirementDetailModal/components/RequirementInfoPanel';
import { ActivityPanel } from '../RequirementDetailModal/components/ActivityPanel';
import { CommentInput } from '../RequirementDetailModal/components/CommentInput';
import type { RequirementDetail } from '../../types/requirement.types';
import styles from './RequirementDetailView.module.scss';

interface RequirementDetailViewProps {
  requirement: RequirementDetail;
  projectName: string;
  projectId: number;
}

export function RequirementDetailView({
  requirement,
  projectName,
  projectId,
}: RequirementDetailViewProps) {
  const { data: session } = useSession();
  const isExternalUser = session?.user?.roles?.includes('external-user') ?? false;
  const currentUserId = session?.user?.id ?? '';

  return (
    <div className={styles.wrapper}>
      <BoardHeader
        projectName={projectName}
        projectId={projectId}
        requirementId={requirement.id}
        isExternalUser={isExternalUser}
        currentUserId={currentUserId}
        subscribers={requirement.subscriptors}
      />

      <div className={styles.body}>
        {/* Panel izquierdo */}
        <div className={styles.leftPanel}>
          <RequirementInfoPanel requirement={requirement} />
        </div>

        {/* Panel derecho */}
        <div className={styles.rightPanel}>
          <div className={styles.rightPanelTopbar}>
            <span className={styles.rightPanelTitle}>ACTIVIDAD</span>
          </div>
          <div className={styles.activityFeed}>
            <ActivityPanel activities={requirement.requirementActivity} />
          </div>
          <div className={styles.commentInputWrapper}>
            <CommentInput requirementId={requirement.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
