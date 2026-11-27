'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button, Dropdown, Spinner } from '@/shared/components/ui';
import { useLogout } from '@/shared/hooks';
import styles from './MobileMenu.module.scss';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  projects: { id: string | number; label: string }[];
  onProjectSelect: (project: { id: string | number; label: string }) => void;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function MobileMenu({
  isOpen,
  onClose,
  projects,
  onProjectSelect,
  isLoading,
  error,
  onRetry,
}: MobileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const logout = useLogout();

  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  function handleLogout() {
    logout();
    onClose();
  }

  function handleOverlayClick(event: React.MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function renderProjectsSection() {
    if (isLoading) {
      return (
        <div className={styles.loadingContainer}>
          <Spinner size="sm" />
          <span className={styles.loadingText}>Cargando proyectos...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.errorContainer}>
          <span className={styles.errorText}>{error}</span>
          {onRetry && (
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              Reintentar
            </button>
          )}
        </div>
      );
    }

    return (
      <Dropdown
        trigger="Proyectos"
        items={projects}
        onSelect={(project) => {
          onProjectSelect(project);
          onClose();
        }}
        className={styles.dropdown}
      />
    );
  }

  if (!isOpen) return null;

  const menuContent = (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
    >
      <div className={styles.menu} ref={menuRef}>
        <div className={styles.header}>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navItem}>{renderProjectsSection()}</div>

          <div className={styles.separator} />

          <a href="#" className={styles.navLink}>
            Suscriptores
          </a>
        </nav>

        <div className={styles.actions}>
          <Button variant="primary" size="md" className={styles.actionButton}>
            Nueva tarea
          </Button>

          <Button variant="danger" size="md" onClick={handleLogout} className={styles.actionButton}>
            Cerrar sesión
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
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;

  return createPortal(menuContent, document.body);
}
