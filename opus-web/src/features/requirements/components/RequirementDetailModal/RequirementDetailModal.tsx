'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRequirement } from '../../hooks/useRequirement';
import { useIsMobile } from '@/shared/hooks';
import { Spinner } from '@/shared/components/ui';
import { ModalTopbar } from './components/ModalTopbar';
import { RequirementInfoPanel } from './components/RequirementInfoPanel';
import { ActivityPanel } from './components/ActivityPanel';
import { CommentInput } from './components/CommentInput';
import type { RequirementDetailModalProps, ActiveTab } from './RequirementDetailModal.types';
import styles from './RequirementDetailModal.module.scss';

export function RequirementDetailModal({
  requirementId,
  isOpen,
  onClose,
  projectName: projectNameProp,
}: RequirementDetailModalProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<ActiveTab>('detalle');
  const { data: requirement, isLoading, isError } = useRequirement({ requirementId });
  const { data: session } = useSession();
  const isExternalUser = session?.user?.roles?.includes('external-user') ?? false;
  const currentUserId = session?.user?.id ?? '';

  if (!isOpen || !requirementId) return null;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={styles.overlay} data-testid="modal-overlay" onClick={handleOverlayClick}>
        <div className={styles.container}>
          <div className={styles.centered}>
            <Spinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (isError || !requirement) {
    return (
      <div className={styles.overlay} data-testid="modal-overlay" onClick={handleOverlayClick}>
        <div className={styles.container}>
          <div className={styles.centered}>
            <p role="alert" className={styles.errorText}>
              Error al cargar el requisito. Intentá de nuevo más tarde.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile layout (tabs) ─────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className={styles.overlayMobile} data-testid="modal-overlay">
        <div className={styles.containerMobile}>
          <ModalTopbar
            projectName={projectNameProp ?? requirement.project?.name ?? ''}
            requirementId={requirement.id}
            projectId={requirement.projectId}
            onClose={onClose}
            isExternalUser={isExternalUser}
            currentUserId={currentUserId}
            subscribers={requirement.subscriptors}
          />

          {/* Tabs */}
          <div className={styles.tabs} role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'detalle'}
              className={styles.tab}
              data-active={activeTab === 'detalle'}
              onClick={() => setActiveTab('detalle')}
              type="button"
            >
              Detalle
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'actividad'}
              className={styles.tab}
              data-active={activeTab === 'actividad'}
              onClick={() => setActiveTab('actividad')}
              type="button"
            >
              Actividad
            </button>
          </div>

          {/* Tab content */}
          <div className={styles.tabContent}>
            {activeTab === 'detalle' ? (
              <RequirementInfoPanel requirement={requirement} />
            ) : (
              <div className={styles.activityTabWrapper}>
                <div className={styles.activityFeedMobile}>
                  <ActivityPanel activities={requirement.requirementActivity} />
                </div>
                <div className={styles.commentInputWrapper}>
                  <CommentInput requirementId={requirement.id} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop layout (two panels) ──────────────────────────────────────────
  return (
    <div className={styles.overlay} data-testid="modal-overlay" onClick={handleOverlayClick}>
      <div className={styles.container}>
        <ModalTopbar
          projectName={projectNameProp ?? requirement.project?.name ?? ''}
          requirementId={requirement.id}
          projectId={requirement.projectId}
          onClose={onClose}
          isExternalUser={isExternalUser}
          currentUserId={currentUserId}
          subscribers={requirement.subscriptors}
        />

        <div className={styles.body}>
          {/* Left panel */}
          <div className={styles.leftPanel}>
            <RequirementInfoPanel requirement={requirement} />
          </div>

          {/* Right panel */}
          <div className={styles.rightPanel}>
            <div className={styles.rightPanelTopbar}>
              <span className={styles.rightPanelTitle}>Actividad</span>
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
    </div>
  );
}
