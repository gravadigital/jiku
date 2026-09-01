import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InputMultipleSelect } from './InputMultipleSelect';

const OPTIONS = [
  { label: 'Análisis', value: 'analisis' },
  { label: 'Planificación', value: 'planificacion' },
  { label: 'En cola', value: 'en_cola' },
  { label: 'Desarrollo', value: 'desarrollo' },
  { label: 'Revisión', value: 'revision' },
];

const selected = (...values: string[]) =>
  values.map((v) => ({ label: OPTIONS.find((o) => o.value === v)!.label, value: v }));

function openMenu(container: HTMLElement) {
  const input = within(container).getByRole('combobox');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
}

// El texto de la opción incluye el glifo del check, así que se busca por la etiqueta contenida.
function optionByLabel(name: string): HTMLElement {
  return screen.getAllByRole('option').find((el) => el.textContent?.includes(name))!;
}

describe('InputMultipleSelect', () => {
  // El menú es la única vista donde se ven todos los estados a la vez: los chips del control
  // están recortados por el "+N", así que sacar de la lista los ya elegidos —el default de
  // react-select con isMulti— dejaba sin forma de deseleccionar los que quedaban colapsados.
  describe('menú desplegable', () => {
    it('lista todas las opciones, incluidas las ya seleccionadas', () => {
      const { container } = render(
        <InputMultipleSelect
          label="Estados"
          code="state"
          options={OPTIONS}
          value={selected('analisis', 'en_cola')}
          onChange={vi.fn()}
        />
      );

      openMenu(container);

      const optionLabels = screen.getAllByRole('option').map((el) => el.textContent);
      expect(optionLabels).toHaveLength(OPTIONS.length);
      OPTIONS.forEach((option, index) => {
        expect(optionLabels[index]).toContain(option.label);
      });
    });

    it('marca como seleccionadas las opciones elegidas y no las demás', () => {
      const { container } = render(
        <InputMultipleSelect
          label="Estados"
          code="state"
          options={OPTIONS}
          value={selected('analisis', 'en_cola')}
          onChange={vi.fn()}
        />
      );

      openMenu(container);

      expect(optionByLabel('Análisis')).toHaveAttribute('aria-selected', 'true');
      expect(optionByLabel('En cola')).toHaveAttribute('aria-selected', 'true');
      expect(optionByLabel('Planificación')).toHaveAttribute('aria-selected', 'false');
      expect(optionByLabel('Revisión')).toHaveAttribute('aria-selected', 'false');
    });

    it('clickear una opción no seleccionada la agrega', () => {
      const onChange = vi.fn();
      const { container } = render(
        <InputMultipleSelect
          label="Estados"
          code="state"
          options={OPTIONS}
          value={selected('analisis')}
          onChange={onChange}
        />
      );

      openMenu(container);
      fireEvent.click(optionByLabel('Revisión'));

      expect(onChange).toHaveBeenCalledWith([
        { label: 'Análisis', value: 'analisis' },
        { label: 'Revisión', value: 'revision' },
      ]);
    });

    it('clickear una opción ya seleccionada la quita', () => {
      const onChange = vi.fn();
      const { container } = render(
        <InputMultipleSelect
          label="Estados"
          code="state"
          options={OPTIONS}
          value={selected('analisis', 'en_cola')}
          onChange={onChange}
        />
      );

      openMenu(container);
      fireEvent.click(optionByLabel('Análisis'));

      expect(onChange).toHaveBeenCalledWith([{ label: 'En cola', value: 'en_cola' }]);
    });

    it('deseleccionar desde el menú permite vaciar la selección por completo', () => {
      const onChange = vi.fn();
      const { container } = render(
        <InputMultipleSelect
          label="Estados"
          code="state"
          options={OPTIONS}
          value={selected('revision')}
          onChange={onChange}
        />
      );

      openMenu(container);
      fireEvent.click(optionByLabel('Revisión'));

      expect(onChange).toHaveBeenCalledWith([]);
    });

    // Sin esto, elegir una opción cierra el menú y hay que reabrirlo para marcar la siguiente.
    it('el menú sigue abierto después de elegir una opción', () => {
      const { container } = render(
        <InputMultipleSelect
          label="Estados"
          code="state"
          options={OPTIONS}
          value={[]}
          onChange={vi.fn()}
        />
      );

      openMenu(container);
      fireEvent.click(optionByLabel('Revisión'));

      expect(screen.getAllByRole('option').length).toBe(OPTIONS.length);
    });
  });

  it('renderiza un chip por cada valor seleccionado cuando entran todos', () => {
    render(
      <InputMultipleSelect
        label="Estados"
        code="state"
        options={OPTIONS}
        value={selected('analisis', 'desarrollo')}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Análisis')).toBeInTheDocument();
    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
  });

  // El control vive en una fila de filtros de 40px de alto. Sin un tope de chips visibles,
  // react-select los envuelve en varias filas y el campo crece hasta desalinear la fila entera.
  it('colapsa el excedente en un resumen "+N" en vez de envolver los chips', () => {
    render(
      <InputMultipleSelect
        label="Estados"
        code="state"
        options={OPTIONS}
        value={selected('analisis', 'planificacion', 'en_cola', 'desarrollo')}
        onChange={vi.fn()}
      />
    );

    // Se ven los dos primeros y el resto queda resumido.
    expect(screen.getByText('Análisis')).toBeInTheDocument();
    expect(screen.getByText('Planificación')).toBeInTheDocument();
    expect(screen.queryByText('En cola')).not.toBeInTheDocument();
    expect(screen.queryByText('Desarrollo')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('no muestra resumen cuando la selección no supera el máximo visible', () => {
    render(
      <InputMultipleSelect
        label="Estados"
        code="state"
        options={OPTIONS}
        value={selected('analisis', 'planificacion')}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it('muestra el placeholder cuando no hay nada seleccionado', () => {
    render(
      <InputMultipleSelect
        label="Estados"
        code="state"
        options={OPTIONS}
        value={[]}
        placeholder="Todos los estados"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Todos los estados')).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it('asocia el label a su control por htmlFor', () => {
    render(
      <InputMultipleSelect
        label="Estados"
        code="filter-state"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />
    );

    const label = screen.getByText(/^estados$/i);
    const htmlFor = label.getAttribute('for');
    expect(htmlFor).toBeTruthy();
    expect(document.getElementById(htmlFor as string)).toBeTruthy();
  });

  // El modo compacto es el de las filas de filtros; el default sigue siendo el de formulario,
  // que es el que usa ObjectiveSearchFilters junto a InputText e InputSelect.
  it('colapsa el excedente también en modo compacto', () => {
    render(
      <InputMultipleSelect
        compact
        label="Estados"
        code="state"
        options={OPTIONS}
        value={selected('analisis', 'planificacion', 'en_cola')}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.queryByText('En cola')).not.toBeInTheDocument();
  });

  it('respeta el label recibido sin forzar mayúsculas, como el resto de los filtros', () => {
    render(
      <InputMultipleSelect
        label="Estados"
        code="state"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Estados')).toBeInTheDocument();
  });
});
