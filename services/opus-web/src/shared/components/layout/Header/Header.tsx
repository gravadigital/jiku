'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button, Dropdown, Spinner } from '@/shared/components/ui';
import { MobileMenu } from '@/shared/components/layout/MobileMenu';
import { useProjects, type Project } from '@/features/projects';
import { CreateRequirementModal } from '@/features/requirements';
import { useActiveProject } from '@/contexts/ProjectContext';
import { useLogout } from '@/shared/hooks';
import styles from './Header.module.scss';

export function Header() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: projects, isLoading, error, refetch } = useProjects();
  const { activeProject, setActiveProject } = useActiveProject();
  const logout = useLogout();

  const isExternalUser = session?.user?.roles?.includes('external-user');

  function handleProjectSelect(item: { id: string | number; label: string }) {
    const project: Project = {
      id: Number(item.id),
      name: item.label,
    };
    setActiveProject(project);
    router.push(`/projects/${project.id}/requirements`);
  }

  function openMobileMenu() {
    setIsMobileMenuOpen(true);
  }

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  const projectItems = projects?.map((p) => ({ id: p.id, label: p.name })) ?? [];
  const triggerLabel = activeProject?.name ?? 'Proyectos';

  function renderProjectsDropdown() {
    if (isLoading) {
      return (
        <div className={styles.loadingContainer}>
          <Spinner size="sm" />
          <span className={styles.loadingText}>Cargando...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.errorContainer}>
          <span className={styles.errorText}>Error al cargar proyectos</span>
          <button type="button" className={styles.retryButton} onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      );
    }

    return <Dropdown trigger={triggerLabel} items={projectItems} onSelect={handleProjectSelect} />;
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.logo}>Opus</span>

        <nav className={styles.nav}>
          {renderProjectsDropdown()}
          <a href="#" className={styles.navLink}>
            Suscriptores
          </a>
        </nav>
      </div>

      <div className={styles.right}>
        {isExternalUser && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={!activeProject}
          >
            Nueva tarea
          </Button>
        )}

        <button
          type="button"
          className={styles.logoutButton}
          onClick={logout}
          aria-label="Cerrar sesión"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        className={styles.hamburger}
        onClick={openMobileMenu}
        aria-label="Abrir menú"
        aria-expanded={isMobileMenuOpen}
      >
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
      </button>

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        projects={projectItems}
        onProjectSelect={handleProjectSelect}
        isLoading={isLoading}
        error={error ? 'Error al cargar proyectos' : undefined}
        onRetry={() => refetch()}
      />

      <CreateRequirementModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </header>
  );
}
