'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Select } from '@/shared/components/ui';
import styles from './ProjectListFilters.module.scss';

export function ProjectListFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState({
    initial: true,
    value: searchParams?.get('search') || '',
  });
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [state, setState] = useState(searchParams?.get('state') || 'activo');

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams?.toString());

      if (value === 'all') {
        params.delete(name);
      } else {
        params.set(name, value);
      }

      return params.toString();
    },
    [searchParams]
  );

  const changeFilter = useCallback(
    (field: string, value: string) => {
      router.push(`/projects?${createQueryString(field, value)}`);
    },
    [createQueryString, router]
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  useEffect(() => {
    if (debouncedSearch.initial) {
      return;
    }
    changeFilter('search', debouncedSearch.value);
  }, [changeFilter, debouncedSearch]);

  return (
    <section className={styles.filterSection}>
      <div className={styles.search}>
        <Input
          variant="search"
          label="Búsqueda"
          value={search.value}
          onChange={(value) => {
            setSearch({
              initial: false,
              value,
            });
          }}
          placeholder="Buscar proyecto"
        />
      </div>
      <div className={styles.filter}>
        <Select
          label="Tipo"
          value={searchParams?.get('type') || 'all'}
          options={[
            { label: 'Todos', value: 'all' },
            { label: 'Interno', value: 'interno' },
            { label: 'Comercial', value: 'comercial' },
            { label: 'Investigación', value: 'investigacion' },
            { label: 'Propuesta', value: 'propuesta' },
          ]}
          onChange={(value) => {
            changeFilter('type', value);
          }}
        />
      </div>
      <div className={styles.filter}>
        <Select
          label="Estado"
          value={state}
          options={[
            { label: 'Todos', value: 'all' },
            { label: 'Activo', value: 'activo' },
            { label: 'Análisis', value: 'analisis' },
            { label: 'Inactivo', value: 'inactivo' },
            { label: 'Finalizado', value: 'finalizado' },
            { label: 'Cancelado', value: 'cancelado' },
          ]}
          onChange={(value) => {
            setState(value);
            changeFilter('state', value === 'all' ? '' : value);
          }}
        />
      </div>
      <div className={styles.filter}>
        <Select
          label="Ordenar por"
          value={searchParams?.get('sort') || '-initDate'}
          options={[
            { label: 'Más recientes', value: '-initDate' },
            { label: 'Más antiguos', value: 'initDate' },
          ]}
          onChange={(value) => {
            changeFilter('sort', value);
          }}
        />
      </div>
    </section>
  );
}
