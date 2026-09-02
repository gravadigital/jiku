import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequirementResolutionCard } from './RequirementResolutionCard';
import type { Requirement } from '../../types/requirement.types';

const baseRequirement: Requirement = {
  id: 5,
  title: 'Req test',
  description: '',
  type: 'funcionalidad',
  priority: 'alta',
  state: 'analisis',
  visibilityLevel: 'public',
  estimatedFinishDate: null,
  projectId: 1,
  project: { id: 1, name: 'PRJ-1' },
  responsiblePeople: [],
  createdBy: 'ivan@grava.io',
  creator: { id: 'u1', name: 'Iván López', email: 'ivan@grava.io' },
  tags: [],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  activity: [],
  resolutionType: null,
  resolutionConclusion: null,
  resolutionComment: null,
  scope: null,
  technicalSolution: null,
  acceptanceCriteria: null,
};

describe('RequirementResolutionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el título "Resolución"', () => {
    render(<RequirementResolutionCard requirement={baseRequirement} onUpdate={vi.fn()} />);
    expect(screen.getByText('Resolución')).toBeInTheDocument();
  });

  it('con estimatedFinishDate cargado, muestra "Cierre estimado" con la fecha formateada', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, estimatedFinishDate: '2026-08-15T12:00:00Z' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Cierre estimado')).toBeInTheDocument();
    expect(screen.getByText('15/08/2026')).toBeInTheDocument();
  });

  it('sin estimatedFinishDate, no muestra "Cierre estimado"', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, estimatedFinishDate: null }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.queryByText('Cierre estimado')).not.toBeInTheDocument();
  });

  it('en un paso de trabajo, muestra los botones "Resolver" y "Cancelar"', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, state: 'desarrollo' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /^resolver$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeInTheDocument();
  });

  it('para type distinto de incidencia (sin campos que guardar), "Resolver" dispara onUpdate solo con state: resuelto', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, type: 'funcionalidad', state: 'desarrollo' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^resolver$/i }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ state: 'resuelto' });
  });

  it('click en "Cancelar" dispara onUpdate con state: cancelado', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, state: 'desarrollo' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));
    expect(onUpdate).toHaveBeenCalledWith({ state: 'cancelado' });
  });

  it('en cualquier paso de trabajo (no solo el actual), ambos botones siguen disponibles y habilitados', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, state: 'analisis' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /^resolver$/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /^cancelar$/i })).not.toBeDisabled();
  });

  it('en estado Resuelto, muestra la fecha de finalización en vez de los botones de acción', () => {
    render(
      <RequirementResolutionCard
        requirement={{
          ...baseRequirement,
          state: 'resuelto',
          activity: [
            {
              id: 1,
              typeOfActivity: 'state',
              previousValue: 'revision',
              newValue: 'resuelto',
              visibilityLevel: 'internal',
              changedBy: 'u1',
              changedByUser: { id: 'u1', name: 'x', email: 'x' },
              createdAt: '2026-07-15T12:00:00Z',
              editedAt: null,
              editedBy: null,
            },
          ],
        }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Fecha de finalización')).toBeInTheDocument();
    expect(screen.getByText('15/07/2026')).toBeInTheDocument();
    expect(screen.queryByText('Resuelto')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^resolver$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).not.toBeInTheDocument();
  });

  it('en estado Resuelto sin historial de actividad, muestra "-" como fecha de finalización', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, state: 'resuelto', activity: [] }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Fecha de finalización')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('en estado Cancelado, muestra un badge de resultado en vez de los botones de acción', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, state: 'cancelado' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^resolver$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).not.toBeInTheDocument();
  });

  it('TS-14: en estado Resuelto, muestra el botón "Reabrir" (REQ-012, CA-4)', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, state: 'resuelto' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
  });

  it('TS-15: en estado Cancelado, muestra el botón "Reabrir" junto al badge "Cancelado"', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, state: 'cancelado' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
  });

  it('TS-16: en un estado de trabajo, no muestra "Reabrir" y sí "Resolver"/"Cancelar"', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, state: 'desarrollo' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Reabrir' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('TS-17: click en "Reabrir" desde un requisito resuelto con los 3 campos cargados manda exactamente { state: "desarrollo" }', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementResolutionCard
        requirement={{
          ...baseRequirement,
          state: 'resuelto',
          resolutionType: 'error_interno',
          resolutionConclusion: 'Se corrigió el cálculo',
          resolutionComment: 'Ya está disponible',
        }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ state: 'desarrollo' });
  });

  it('TS-18: "Reabrir" queda deshabilitado mientras hay una mutación en vuelo (isPending)', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, state: 'resuelto' }}
        onUpdate={vi.fn()}
        isPending
      />
    );

    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeDisabled();
  });

  it('TS-28: los campos de resolución siguen disabled con el requisito ya Resuelto', () => {
    render(
      <RequirementResolutionCard
        requirement={{
          ...baseRequirement,
          type: 'incidencia',
          state: 'resuelto',
          resolutionType: 'error_interno',
        }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Tipo de resolución')).toBeDisabled();
    expect(screen.getByLabelText('Conclusión interna')).toBeDisabled();
    expect(screen.getByLabelText('Nota para cliente')).toBeDisabled();
  });

  it('TS-29: en Resuelto se conservan "Cierre estimado", "Fecha de finalización" y "Reabrir"; no se ven "Resolver" ni "Cancelar"', () => {
    render(
      <RequirementResolutionCard
        requirement={{
          ...baseRequirement,
          state: 'resuelto',
          estimatedFinishDate: '2026-08-15T12:00:00Z',
          activity: [
            {
              id: 1,
              typeOfActivity: 'state',
              previousValue: 'revision',
              newValue: 'resuelto',
              visibilityLevel: 'public',
              changedBy: 'u1',
              changedByUser: { id: 'u1', name: 'Iván López', email: 'ivan@grava.io' },
              createdAt: '2026-09-02T10:00:00Z',
              editedAt: null,
              editedBy: null,
            },
          ],
        }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Cierre estimado')).toBeInTheDocument();
    expect(screen.getByText('15/08/2026')).toBeInTheDocument();
    expect(screen.getByText('Fecha de finalización')).toBeInTheDocument();
    expect(screen.getByText('02/09/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^resolver$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).not.toBeInTheDocument();
  });

  it('no existe ningún botón "Guardar" separado — los campos se guardan al confirmar Resolver', () => {
    render(
      <RequirementResolutionCard
        requirement={{ ...baseRequirement, type: 'incidencia', state: 'desarrollo' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /^guardar$/i })).not.toBeInTheDocument();
  });

  describe('TS-1/TS-2: Campos de resolución para incidencias, visibles sin importar el estado', () => {
    it('TS-1: para type=incidencia en un paso de trabajo, muestra Tipo de resolución, Conclusión interna y Nota para cliente', () => {
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /^resolver$/i })).toBeInTheDocument();
      expect(screen.getByLabelText('Tipo de resolución')).toBeInTheDocument();
      expect(screen.getByLabelText('Conclusión interna')).toBeInTheDocument();
      expect(screen.getByLabelText('Nota para cliente')).toBeInTheDocument();
    });

    it('TS-5: para type=incidencia en Resuelto, muestra los 3 campos', () => {
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'resuelto' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Tipo de resolución')).toBeInTheDocument();
      expect(screen.getByLabelText('Conclusión interna')).toBeInTheDocument();
      expect(screen.getByLabelText('Nota para cliente')).toBeInTheDocument();
    });

    it('TS-6: para type=incidencia en Cancelado, también muestra los 3 campos', () => {
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'cancelado' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Tipo de resolución')).toBeInTheDocument();
      expect(screen.getByLabelText('Conclusión interna')).toBeInTheDocument();
      expect(screen.getByLabelText('Nota para cliente')).toBeInTheDocument();
    });

    it('TS-2: para type distinto de incidencia, NO muestra ninguno de los 3 campos en ningún estado', () => {
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'funcionalidad', state: 'resuelto' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.queryByLabelText('Tipo de resolución')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Conclusión interna')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Nota para cliente')).not.toBeInTheDocument();
    });

    it('el Tipo de resolución ya guardado se muestra seleccionado', () => {
      render(
        <RequirementResolutionCard
          requirement={{
            ...baseRequirement,
            type: 'incidencia',
            state: 'resuelto',
            resolutionType: 'discutible',
          }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Tipo de resolución')).toHaveValue('discutible');
    });

    it('sin Tipo de resolución cargado, el select muestra "Seleccioná una opción" como opción por defecto', () => {
      render(
        <RequirementResolutionCard
          requirement={{
            ...baseRequirement,
            type: 'incidencia',
            state: 'resuelto',
            resolutionType: null,
          }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('option', { name: 'Seleccioná una opción' })).toBeInTheDocument();
      expect(screen.getByLabelText('Tipo de resolución')).toHaveValue('');
    });

    it('la Conclusión interna ya guardada se muestra como texto libre en el textarea', () => {
      render(
        <RequirementResolutionCard
          requirement={{
            ...baseRequirement,
            type: 'incidencia',
            state: 'resuelto',
            resolutionConclusion: 'El equipo confirmó el bug en el endpoint de horas',
          }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Conclusión interna')).toHaveValue(
        'El equipo confirmó el bug en el endpoint de horas'
      );
    });
  });

  describe('TS-19/TS-22: resolver una funcionalidad no exige tipo ni conclusión (CA-5, D-5)', () => {
    it('TS-19: para type=funcionalidad, no muestra Tipo de resolución ni Conclusión interna', () => {
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'funcionalidad', state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.queryByLabelText('Tipo de resolución')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Conclusión interna')).not.toBeInTheDocument();
    });

    it('TS-20: para type=funcionalidad con los 3 campos en null, "Resolver" no está disabled', () => {
      render(
        <RequirementResolutionCard
          requirement={{
            ...baseRequirement,
            type: 'funcionalidad',
            state: 'desarrollo',
            resolutionType: null,
            resolutionConclusion: null,
            resolutionComment: null,
          }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Resolver' })).not.toBeDisabled();
    });

    it('TS-22: para type=incidencia, los tres campos de resolución están presentes', () => {
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Tipo de resolución')).toBeInTheDocument();
      expect(screen.getByLabelText('Conclusión interna')).toBeInTheDocument();
      expect(screen.getByLabelText('Nota para cliente')).toBeInTheDocument();
    });

    it('complemento: para type=mejora, tampoco se muestran los campos de resolución', () => {
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'mejora', state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.queryByLabelText('Tipo de resolución')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Conclusión interna')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Nota para cliente')).not.toBeInTheDocument();
    });

    it('complemento: para type=otro, tampoco se muestran los campos de resolución', () => {
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'otro', state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.queryByLabelText('Tipo de resolución')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Conclusión interna')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Nota para cliente')).not.toBeInTheDocument();
    });
  });

  describe('TS-3/TS-4: "Resolver" guarda los campos de resolución cambiados y transiciona', () => {
    it('TS-3: con los 3 campos cargados, "Resolver" dispara onUpdate con los 3 campos + state: resuelto', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'desarrollo' }}
          onUpdate={onUpdate}
        />
      );

      fireEvent.change(screen.getByLabelText('Tipo de resolución'), {
        target: { value: 'error_interno' },
      });
      fireEvent.change(screen.getByLabelText('Conclusión interna'), {
        target: { value: 'Bug en el endpoint de horas' },
      });
      fireEvent.change(screen.getByLabelText('Nota para cliente'), {
        target: { value: 'El problema fue resuelto' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^resolver$/i }));

      expect(onUpdate).toHaveBeenCalledWith({ resolutionType: 'error_interno' });
      expect(onUpdate).toHaveBeenCalledWith({
        resolutionConclusion: 'Bug en el endpoint de horas',
      });
      expect(onUpdate).toHaveBeenCalledWith({ resolutionComment: 'El problema fue resuelto' });
      expect(onUpdate).toHaveBeenCalledWith({ state: 'resuelto' });
    });

    it('TS-4: con incidencia sin cambios en los campos, "Resolver" dispara onUpdate solo con state: resuelto', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementResolutionCard
          requirement={{
            ...baseRequirement,
            type: 'incidencia',
            state: 'desarrollo',
            resolutionType: 'otro',
            resolutionConclusion: 'x',
            resolutionComment: 'y',
          }}
          onUpdate={onUpdate}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^resolver$/i }));

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith({ state: 'resuelto' });
    });

    it('"Cancelar" NO guarda los campos de resolución cargados, solo cambia el estado', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'desarrollo' }}
          onUpdate={onUpdate}
        />
      );

      fireEvent.change(screen.getByLabelText('Tipo de resolución'), {
        target: { value: 'error_interno' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith({ state: 'cancelado' });
    });
  });

  describe('TS-5/TS-6/TS-7: con el requisito cerrado, los 3 campos se ven pero quedan de solo lectura', () => {
    // Decisión: resolutionType/resolutionConclusion son requeridos (gate de API) antes de
    // transicionar a resuelto, así que ya están completos al llegar a ese estado. Sin un
    // botón "Resolver"/"Cancelar" visible en estado cerrado, no hay mecanismo de guardado —
    // los 3 campos quedan visibles como registro histórico, pero deshabilitados.
    it('TS-5: con el requisito ya Resuelto, los 3 campos de resolución están disabled', () => {
      render(
        <RequirementResolutionCard
          requirement={{
            ...baseRequirement,
            type: 'incidencia',
            state: 'resuelto',
            resolutionType: 'otro',
            resolutionConclusion: 'x',
            resolutionComment: 'y',
          }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Tipo de resolución')).toBeDisabled();
      expect(screen.getByLabelText('Conclusión interna')).toBeDisabled();
      expect(screen.getByLabelText('Nota para cliente')).toBeDisabled();
    });

    it('TS-6: con el requisito ya Cancelado, los 3 campos de resolución están disabled', () => {
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'cancelado' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Tipo de resolución')).toBeDisabled();
      expect(screen.getByLabelText('Conclusión interna')).toBeDisabled();
      expect(screen.getByLabelText('Nota para cliente')).toBeDisabled();
    });

    it('TS-7: en un paso de trabajo (no cerrado), los 3 campos NO están disabled', () => {
      render(
        <RequirementResolutionCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Tipo de resolución')).not.toBeDisabled();
      expect(screen.getByLabelText('Conclusión interna')).not.toBeDisabled();
      expect(screen.getByLabelText('Nota para cliente')).not.toBeDisabled();
    });
  });

  describe('TS-23/TS-27: el formulario sugiere los valores de la resolución anterior al reresolver (CA-6, CA-7)', () => {
    it('TS-23: tras reabrir, el formulario sugiere los valores anteriores', () => {
      const requirement: Requirement = {
        ...baseRequirement,
        type: 'incidencia',
        state: 'resuelto',
        resolutionType: 'error_interno',
        resolutionConclusion: 'Se corrigió el cálculo',
        resolutionComment: 'Ya está disponible',
      };
      const { rerender } = render(
        <RequirementResolutionCard requirement={requirement} onUpdate={vi.fn()} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));

      rerender(
        <RequirementResolutionCard
          requirement={{
            ...requirement,
            state: 'desarrollo',
            resolutionType: null,
            resolutionConclusion: null,
            resolutionComment: null,
          }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Tipo de resolución')).toHaveValue('error_interno');
      expect(screen.getByLabelText('Conclusión interna')).toHaveValue('Se corrigió el cálculo');
      expect(screen.getByLabelText('Nota para cliente')).toHaveValue('Ya está disponible');
    });

    it('TS-24: la sugerencia no se aplica si el requisito nunca tuvo resolución', () => {
      const requirement: Requirement = {
        ...baseRequirement,
        type: 'incidencia',
        state: 'resuelto',
        resolutionType: null,
        resolutionConclusion: null,
        resolutionComment: null,
      };
      const { rerender } = render(
        <RequirementResolutionCard requirement={requirement} onUpdate={vi.fn()} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));

      rerender(
        <RequirementResolutionCard
          requirement={{ ...requirement, state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Tipo de resolución')).toHaveValue('');
      expect(screen.getByLabelText('Conclusión interna')).toHaveValue('');
      expect(screen.getByLabelText('Nota para cliente')).toHaveValue('');
    });

    it('TS-25: los valores sugeridos son editables y se guardan los editados', () => {
      const requirement: Requirement = {
        ...baseRequirement,
        type: 'incidencia',
        state: 'resuelto',
        resolutionType: 'error_interno',
        resolutionConclusion: 'Se corrigió el cálculo',
        resolutionComment: 'Ya está disponible',
      };
      const onUpdate = vi.fn();
      const { rerender } = render(
        <RequirementResolutionCard requirement={requirement} onUpdate={onUpdate} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));

      const reopened: Requirement = {
        ...requirement,
        state: 'desarrollo',
        resolutionType: null,
        resolutionConclusion: null,
        resolutionComment: null,
      };
      rerender(<RequirementResolutionCard requirement={reopened} onUpdate={onUpdate} />);

      fireEvent.change(screen.getByLabelText('Tipo de resolución'), {
        target: { value: 'fuera_de_alcance' },
      });
      fireEvent.change(screen.getByLabelText('Conclusión interna'), {
        target: { value: 'Se decidió no hacerlo' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Resolver' }));

      const payloads = onUpdate.mock.calls.map((call) => call[0]);
      expect(payloads).toContainEqual({ resolutionType: 'fuera_de_alcance' });
      expect(payloads).toContainEqual({ resolutionConclusion: 'Se decidió no hacerlo' });
      expect(payloads).not.toContainEqual({ resolutionType: 'error_interno' });
      expect(payloads).not.toContainEqual({ resolutionConclusion: 'Se corrigió el cálculo' });
      expect(payloads).toContainEqual({ state: 'resuelto' });
    });

    it('TS-26: aceptar la sugerencia sin editarla la guarda tal cual', () => {
      const requirement: Requirement = {
        ...baseRequirement,
        type: 'incidencia',
        state: 'resuelto',
        resolutionType: 'error_interno',
        resolutionConclusion: 'Se corrigió el cálculo',
        resolutionComment: 'Ya está disponible',
      };
      const onUpdate = vi.fn();
      const { rerender } = render(
        <RequirementResolutionCard requirement={requirement} onUpdate={onUpdate} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));

      rerender(
        <RequirementResolutionCard
          requirement={{
            ...requirement,
            state: 'desarrollo',
            resolutionType: null,
            resolutionConclusion: null,
            resolutionComment: null,
          }}
          onUpdate={onUpdate}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Resolver' }));

      const payloads = onUpdate.mock.calls.map((call) => call[0]);
      expect(payloads).toContainEqual({ resolutionType: 'error_interno' });
      expect(payloads).toContainEqual({ resolutionConclusion: 'Se corrigió el cálculo' });
      expect(payloads).toContainEqual({ resolutionComment: 'Ya está disponible' });
      expect(payloads).toContainEqual({ state: 'resuelto' });
    });

    it('TS-27: un requisito cancelado reabierto conserva sus campos por la vía normal (el servidor no limpia al salir de cancelado)', () => {
      const requirement: Requirement = {
        ...baseRequirement,
        type: 'incidencia',
        state: 'cancelado',
        resolutionType: 'discutible',
        resolutionConclusion: 'Sin acuerdo',
      };
      const { rerender } = render(
        <RequirementResolutionCard requirement={requirement} onUpdate={vi.fn()} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));

      rerender(
        <RequirementResolutionCard
          requirement={{ ...requirement, state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Tipo de resolución')).toHaveValue('discutible');
      expect(screen.getByLabelText('Conclusión interna')).toHaveValue('Sin acuerdo');
    });

    it('Regresión AC-8: un re-render con requirement de nueva referencia pero mismos valores no pisa un draft sin guardar', () => {
      const requirement: Requirement = {
        ...baseRequirement,
        type: 'incidencia',
        state: 'desarrollo',
        resolutionConclusion: 'valor persistido',
      };
      const { rerender } = render(
        <RequirementResolutionCard requirement={requirement} onUpdate={vi.fn()} />
      );

      fireEvent.change(screen.getByLabelText('Conclusión interna'), {
        target: { value: 'texto sin guardar' },
      });

      // Nueva referencia del objeto, mismos valores de los tres campos de resolución —
      // simula el rollback optimista de useUpdateRequirement tras un error.
      rerender(<RequirementResolutionCard requirement={{ ...requirement }} onUpdate={vi.fn()} />);

      expect(screen.getByLabelText('Conclusión interna')).toHaveValue('texto sin guardar');
    });
  });
});
