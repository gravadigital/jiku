'use client';

import { useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, LogOut } from 'lucide-react';
import Image from 'next/image';
import logo from '@/assets/logo.png';
import { useLogout } from '@/shared/hooks';
import { useProjects } from '../../hooks/useProjects';
import styles from './Sidebar.module.scss';

interface SidebarProps {
  onNewObjective?: () => void;
}

export function Sidebar({ onNewObjective }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: projects, isLoading, error, refetch } = useProjects();

  const activeProjectId = pathname?.match(/\/projects\/(\d+)/)?.[1];

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const userInitials = session?.user?.name
    ? session.user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('')
    : '?';

  const handleProjectClick = (projectId: number) => {
    router.push(`/projects/${projectId}/requirements?view=list`);
  };

  const handleLogout = useLogout();

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Image src={logo} alt="Opus" width={26} height={26} />
        </div>
        <span className={styles.logoText}>Opus</span>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <span className={styles.navLabel}>Proyectos</span>

        <div className={styles.navList}>
          {error ? (
            <>
              <p className={styles.error}>Error al cargar proyectos</p>
              <button onClick={() => refetch()} className={styles.retryButton}>
                Reintentar
              </button>
            </>
          ) : isLoading ? (
            <p className={styles.loading}>Cargando proyectos...</p>
          ) : sortedProjects.length > 0 ? (
            sortedProjects.map((project) => (
              <div
                key={project.id}
                className={`${styles.navItem} ${String(project.id) === activeProjectId ? styles.active : ''}`}
                onClick={() => handleProjectClick(project.id)}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                {project.name}
              </div>
            ))
          ) : (
            <p className={styles.empty}>No hay proyectos disponibles</p>
          )}
        </div>
      </nav>

      {/* Nuevo requisito */}
      <button className={styles.newOrderButton} onClick={onNewObjective}>
        <Plus size={14} strokeWidth={2.5} />
        <span>Nuevo requisito</span>
      </button>

      {/* User section */}
      <div className={styles.user}>
        <div className={styles.avatar}>{userInitials}</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{session?.user?.name}</div>
          <div className={styles.userRole}>{session?.user?.email}</div>
        </div>
        <button className={styles.logoutButton} onClick={handleLogout} title="Cerrar sesión">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
