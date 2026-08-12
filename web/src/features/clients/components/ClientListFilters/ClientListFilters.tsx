'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { InputSelect, InputText } from '@/shared/components/ui';
import styles from './ClientListFilters.module.scss';

export function ClientListFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState({
    initial: true,
    value: searchParams?.get('search') || '',
  });
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams?.toString());

      if (!value || value === 'all') {
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
      router.push(`/clients?${createQueryString(field, value)}`);
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
        <InputText
          label="Búsqueda"
          code="search"
          value={search.value}
          onChange={(value) => setSearch({ initial: false, value })}
          placeholder="Buscar actor"
        />
      </div>
      <div>
        <InputSelect
          label="Estado"
          code="status"
          value={searchParams?.get('status') || 'all'}
          options={[
            { label: 'Todos', value: 'all' },
            { label: 'Activo', value: 'activo' },
            { label: 'Inactivo', value: 'inactivo' },
          ]}
          onChange={(value) => changeFilter('status', value)}
        />
      </div>
      <div>
        <InputSelect
          label="Ordenar por"
          code="sort"
          value={searchParams?.get('sort') || 'status-name'}
          options={[
            { label: 'Activos primero (A-Z)', value: 'status-name' },
            { label: 'Más recientes', value: '-createdAt' },
            { label: 'Más antiguos', value: 'createdAt' },
            { label: 'Nombre (A-Z)', value: 'name' },
            { label: 'Nombre (Z-A)', value: '-name' },
          ]}
          onChange={(value) => changeFilter('sort', value)}
        />
      </div>
    </section>
  );
}
