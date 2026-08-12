'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer/MarkdownViewer';
import { useClients } from '@/features/clients';
import { Loader } from '@/shared/components/ui';
import { ClientCard } from '../ClientCard/ClientCard';
import { ClientProjects } from '../ClientProjects/ClientProjects';
import styles from './ClientsBoard.module.scss';
import type { Client, ClientFilters, ClientStatus } from '@/features/clients/types/client.types';

const CARD_HEIGHT = 53;
const CARD_GAP = 16;
const BATCH_SIZE = 10;

const getClientStatus = (client: Client): ClientStatus => {
  const hasActive = client.projects?.some((p) => p.status === 'activo' || p.status === 'analisis');
  return hasActive ? 'activo' : 'inactivo';
};

const matchesSearch = (client: Client, search?: string) => {
  if (!search) return true;
  const query = search.toLowerCase();
  if (client.name.toLowerCase().includes(query)) return true;
  if (client.description?.toLowerCase().includes(query)) return true;
  return false;
};

const sortClients = (clients: Client[], sort?: string) => {
  return [...clients].sort((a, b) => {
    if (sort === 'status-name' || !sort) {
      const statusA = getClientStatus(a);
      const statusB = getClientStatus(b);
      if (statusA !== statusB) {
        return statusA === 'activo' ? -1 : 1;
      }
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sort === 'name') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sort === '-name') {
      return (b.name || '').localeCompare(a.name || '');
    }
    if (sort === 'createdAt') {
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    }
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
};

const applyFilters = (clients: Client[], filters: ClientFilters) => {
  const filtered = clients.filter((client) => {
    if (!matchesSearch(client, filters.search)) return false;
    if (filters.status) {
      const clientStatus = getClientStatus(client);
      if (clientStatus !== filters.status) return false;
    }
    return true;
  });
  return sortClients(filtered, filters.sort);
};

interface ClientsBoardProps {
  readonly filters: ClientFilters;
}

export function ClientsBoard({ filters }: ClientsBoardProps) {
  const stableFilters = useMemo(() => filters, [filters.search, filters.sort, filters.status]);
  const { data: clients, isLoading } = useClients({ filters: stableFilters });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    setExpandedId(null);
  }, [stableFilters]);

  const calculateVisibleCount = useCallback(() => {
    if (!containerRef.current) return;
    const viewportHeight = window.innerHeight;
    const containerTop = containerRef.current.getBoundingClientRect().top;
    const availableHeight = viewportHeight - containerTop - 60;
    const count = Math.max(BATCH_SIZE, Math.floor(availableHeight / (CARD_HEIGHT + CARD_GAP)));
    setVisibleCount(count);
  }, []);

  useEffect(() => {
    calculateVisibleCount();
    const handleResize = () => calculateVisibleCount();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateVisibleCount]);

  if (isLoading) {
    return <Loader label="Cargando actores..." />;
  }

  const allFiltered = applyFilters(clients || [], filters);

  if (allFiltered.length === 0) {
    return (
      <span className={styles.emptyState}>No hay actores que coincidan con estos filtros.</span>
    );
  }

  const showMore = allFiltered.length > visibleCount;
  const visibleClients = allFiltered.slice(0, visibleCount);

  const handleShowMore = () => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, allFiltered.length));
  };

  return (
    <div className={styles.boardContainer} ref={containerRef}>
      <div ref={headerRef}>
        {visibleClients.map((client) => {
          const isExpanded = expandedId === client.id;
          const status = getClientStatus(client);
          const sortedProjects = [...(client.projects || [])].sort(
            (a, b) => new Date(b.initDate).getTime() - new Date(a.initDate).getTime()
          );

          return (
            <div key={client.id} className={styles.clientSection}>
              <ClientCard
                client={client}
                status={status}
                expanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : client.id!)}
              />
              {isExpanded && (
                <div className={styles.expandedContent}>
                  {client.description && <MarkdownViewer content={client.description} />}
                  <ClientProjects projects={sortedProjects} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showMore && (
        <button type="button" className={styles.verMas} onClick={handleShowMore}>
          Ver más
        </button>
      )}
    </div>
  );
}
