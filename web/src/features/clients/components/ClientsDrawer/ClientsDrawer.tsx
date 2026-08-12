'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useClients } from '@/features/clients';
import { Loader } from '@/shared/components/ui';
import styles from './ClientsDrawer.module.scss';

interface ClientsDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function ClientsDrawer({ isOpen, onClose }: ClientsDrawerProps) {
  const { push } = useRouter();
  const { data: clients, isLoading } = useClients({ enabled: isOpen });

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <div className={`${styles.drawer} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <h2>Actores</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.body}>
          {isLoading && <Loader label="Cargando..." />}
          {!isLoading && (!clients || clients.length === 0) && (
            <p className={styles.empty}>No hay actores disponibles.</p>
          )}
          {!isLoading &&
            clients?.map((client) => (
              <div key={client.id} className={styles.clientRow}>
                <div className={styles.clientName}>
                  <span>{client.name}</span>
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.actionBtn}
                    title="Editar"
                    onClick={() => push(`/clients/edit/${client.id}`)}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
