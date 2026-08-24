import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectGeneralInfo } from './ProjectGeneralInfo';
import type { Project } from '@/shared/types';

// El barrel `@/shared/utils` arrastra `decoded-token`, que importa next-auth y no resuelve
// en jsdom. Se mockea la capa de utils —no el componente— para poder testear el render.
vi.mock('@/shared/utils', () => ({
  getProjectStatus: (status: string) => (status === 'activo' ? 'Activo' : status),
}));

const baseProject: Project = {
  id: 1,
  code: 'PRJ-1',
  name: 'Proyecto de prueba',
  description: 'Descripción',
  status: 'activo',
  type: 'comercial',
  priority: 1,
  initDate: new Date('2026-03-01T00:00:00Z'),
  endDate: new Date('2026-09-01T00:00:00Z'),
  creator: { id: 'u1', name: 'Ana Pérez', email: 'ana@grava.io' },
  client: { id: 3, name: 'ACME' },
  keyValuePairs: { entorno: 'produccion' },
};

describe('ProjectGeneralInfo', () => {
  it('muestra las seis filas de la card de información general', () => {
    render(<ProjectGeneralInfo project={baseProject} />);

    [
      'Código',
      'Cliente',
      'Estado',
      'Creado por',
      'Fecha de inicio',
      'Fecha de cierre estimada',
    ].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe('Marca de identidad automática (S-019)', () => {
    it('TS-13: la fila "Creado por" muestra el nombre y la marca cuando el creador es una identidad de servicio', () => {
      render(
        <ProjectGeneralInfo
          project={{
            ...baseProject,
            creator: {
              id: 'u-svc',
              name: 'Conector Portal',
              email: 'conector@grava.io',
              identityType: 'service',
            },
          }}
        />
      );

      const row = screen.getByText('Creado por').closest('div');
      expect(row).toHaveTextContent('Conector Portal');
      expect(row).toHaveTextContent('Automático');
    });

    it('TS-14: la fila "Creado por" de una persona no muestra la marca', () => {
      render(
        <ProjectGeneralInfo
          project={{
            ...baseProject,
            creator: {
              id: 'u1',
              name: 'Ana Pérez',
              email: 'ana@grava.io',
              identityType: 'person',
            },
          }}
        />
      );

      const row = screen.getByText('Creado por').closest('div');
      expect(row).toHaveTextContent('Ana Pérez');
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('TS-15: con un creador de servicio hay exactamente una marca en toda la card', () => {
      render(
        <ProjectGeneralInfo
          project={{
            ...baseProject,
            creator: {
              id: 'u-svc',
              name: 'Conector Portal',
              email: 'conector@grava.io',
              identityType: 'service',
            },
          }}
        />
      );

      expect(screen.getAllByText('Automático')).toHaveLength(1);
    });

    it('no muestra la marca cuando el creador llega sin identityType (api vieja)', () => {
      render(<ProjectGeneralInfo project={baseProject} />);

      expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });
  });
});
