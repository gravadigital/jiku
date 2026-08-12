'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPersons } from '@/features/auth';
import { getProjects } from '@/features/projects';
import { InputMultipleSelect, InputSelect, InputText } from '@/shared/components/ui';
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

const getStateLabel = (value: string) => {
  const stateOption = stateOptions.find((option) => option.value === value);
  return stateOption ? stateOption.label : value;
};

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
    (field: string, value: string | { label: string; value: string }[]) => {
      let formattedValue: string = '';

      if (Array.isArray(value)) {
        formattedValue = value.length === 0 ? 'all' : value.map((item) => item.value).join(',');
      } else {
        formattedValue = value;
      }

      router.push(`/objectives?${createQueryString(field, formattedValue)}`);
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

  return (
    <section className={styles.filterSection}>
      <div className={styles.searchSelect}>
        <InputText
          label="Búsqueda"
          code="search"
          value={search.value}
          onChange={(value) => {
            setSearch({
              initial: false,
              value,
            });
          }}
          placeholder="Buscar tarea"
        />
      </div>
      <div className={styles.stateSelect}>
        <InputMultipleSelect
          label="Estado"
          code="state"
          value={
            searchParams?.get('state') === 'all'
              ? []
              : searchParams
                  ?.get('state')
                  ?.split(',')
                  .map((state) => ({ label: getStateLabel(state), value: state })) || [
                  { label: 'Activo', value: 'activo' },
                ]
          }
          options={[...stateOptions]}
          onChange={(value) => {
            if (value.some((item) => item.value === 'all')) {
              changeFilter(
                'state',
                value.length === 1 ? 'all' : value.filter((item) => item.value !== 'all')
              );
            } else {
              changeFilter('state', value);
            }
          }}
          placeholder="Todos"
        />
      </div>
      <div className={styles.projectSelect}>
        <InputSelect
          label="Proyecto"
          code="projectId"
          value={searchParams?.get('projectId') || 'all'}
          options={[{ label: 'Todos', value: 'all' }, ...projects]}
          onChange={(value) => {
            changeFilter('projectId', value);
          }}
        />
      </div>
      <div>
        <InputSelect
          label="Responsable"
          code="personId"
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
        <InputSelect
          label="Área"
          code="area"
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
        <InputSelect
          label="Ordenar por"
          code="sort"
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
