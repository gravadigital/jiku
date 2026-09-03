'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPersons } from '@/features/auth';
import { getProjects } from '@/features/projects';
import { Input, Select } from '@/shared/components/ui';
import styles from './ObjectiveSearchFilters.module.scss';
import type { Project } from '@/shared/types';

interface ProjectOption {
  label: string;
  value: string;
}

const stateOptions = [
  { label: 'Activo', value: 'activo' },
  { label: 'Backlog', value: 'backlog' },
  { label: 'En revisión', value: 'en_revision' },
  { label: 'Cancelado', value: 'cancelado' },
  { label: 'Finalizado', value: 'finalizado' },
];

const useDebouncedValue = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

export function ObjectiveSearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState({
    initial: true,
    value: searchParams?.get('search') || '',
  });
  const debouncedSearch = useDebouncedValue(search, 300);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [persons, setPersons] = useState<{ label: string; value: number }[]>([]);

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams?.toString());

      params.set(name, value);
      if (name === 'state' || name !== 'page') {
        params.set('page', '1');
      }

      return params.toString();
    },
    [searchParams]
  );

  const changeFilter = useCallback(
    (field: string, value: string) => {
      router.push(`/objectives?${createQueryString(field, value)}`);
    },
    [createQueryString, router]
  );

  useEffect(() => {
    getPersons()
      .then((personsData) => {
        setPersons(
          personsData.map((person) => ({
            label: `${person.firstName} ${person.lastName}`,
            value: person.id ? Number(person.id) : 0,
          }))
        );
        return getProjects({ sort: 'name', state: 'activo,analisis' });
      })
      .then((allProjects) => {
        const projectsOptions = allProjects.map((project: Project) => ({
          label: project.name,
          value: project.id?.toString() || '',
        }));
        setProjects(projectsOptions);
      })
      .catch((error) => console.log(error));
  }, []);

  useEffect(() => {
    if (!debouncedSearch.initial) {
      changeFilter('search', debouncedSearch.value);
    }
  }, [changeFilter, debouncedSearch]);

  const selectedStates =
    searchParams?.get('state') === 'all' ? [] : (searchParams?.get('state')?.split(',') ?? ['activo']);

  return (
    <section className={styles.filterSection}>
      <div className={styles.searchSelect}>
        <Input
          variant="search"
          label="Búsqueda"
          value={search.value}
          onChange={(value) => setSearch({ initial: false, value })}
          placeholder="Buscar tarea"
        />
      </div>
      <div className={styles.stateSelect}>
        <Select
          variant="multiple"
          label="Estados"
          value={selectedStates}
          options={stateOptions}
          onChange={(value) => {
            changeFilter('state', value.length === 0 ? 'all' : value.join(','));
          }}
          placeholder="Todos"
        />
      </div>
      <div>
        <Select
          label="Proyecto"
          value={searchParams?.get('projectId') || 'all'}
          options={[{ label: 'Todos', value: 'all' }, ...projects]}
          onChange={(value) => {
            changeFilter('projectId', value);
          }}
        />
      </div>
      <div>
        <Select
          label="Responsable"
          value={searchParams?.get('personId') || 'all'}
          options={[
            { label: 'Cualquiera', value: 'all' },
            ...persons.map((person) => ({ label: person.label, value: person.value.toString() })),
          ]}
          onChange={(value) => {
            changeFilter('personId', value);
          }}
        />
      </div>
      <div>
        <Select
          label="Área"
          value={searchParams?.get('area') || 'all'}
          options={[
            { label: 'Todos', value: 'all' },
            { label: 'Desarrollo', value: 'desarrollo' },
            { label: 'Diseño', value: 'diseño' },
            { label: 'Gestión', value: 'gestion' },
            { label: 'Investigación', value: 'investigacion' },
          ]}
          onChange={(value) => {
            changeFilter('area', value);
          }}
        />
      </div>
      <div>
        <Select
          label="Ordenar por"
          value={searchParams?.get('sort') || '-createdAt'}
          options={[
            { label: 'Más recientes', value: '-createdAt' },
            { label: 'Más antiguos', value: 'createdAt' },
          ]}
          onChange={(value) => {
            changeFilter('sort', value);
          }}
        />
      </div>
    </section>
  );
}
