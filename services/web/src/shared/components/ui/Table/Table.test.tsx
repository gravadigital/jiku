import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Table } from './Table';

describe('Table — estructura base', () => {
  it('TS-1: renderiza una tabla real, no una grilla de div', () => {
    render(
      <Table
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'titulo', label: 'Título' },
        ]}
        rows={[{ id: '#151', titulo: 'Migrar el formulario' }]}
      />
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });

  it('TS-2: marca las cabeceras de columna con scope="col"', () => {
    render(
      <Table
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'titulo', label: 'Título' },
        ]}
        rows={[{ id: '#151', titulo: 'Migrar el formulario' }]}
      />
    );

    screen.getAllByRole('columnheader').forEach((th) => {
      expect(th).toHaveAttribute('scope', 'col');
    });
  });

  it('TS-3: renderiza una fila por dato, con sus celdas', () => {
    render(
      <Table
        columns={[{ key: 'id', label: 'ID' }]}
        rows={[{ id: '#151' }, { id: '#152' }]}
      />
    );

    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('#151')).toBeInTheDocument();
    expect(screen.getByText('#152')).toBeInTheDocument();
  });

  it('TS-4: aplica el variant light por defecto', () => {
    const { container } = render(
      <Table
        columns={[{ key: 'id', label: 'ID' }]}
        rows={[]}
        emptyState={<span>vacío</span>}
      />
    );

    const table = container.querySelector('table');
    expect(table?.className).toMatch(/light/i);
    expect(table?.className).not.toMatch(/dense/i);
    expect(table?.className).not.toMatch(/matrix/i);
  });

  it('TS-5: variant dense usa su propia clase de cabecera', () => {
    const { container } = render(
      <Table variant="dense" columns={[{ key: 'id', label: 'ID' }]} rows={[{ id: '#151' }]} />
    );

    const table = container.querySelector('table');
    expect(table?.className).toMatch(/dense/i);
    expect(table?.className).not.toMatch(/light/i);
  });

  it('TS-6: variant matrix marca los encabezados de fila con scope="row"', () => {
    render(
      <Table
        variant="matrix"
        columns={[
          { key: 'proyecto', label: '', scope: 'row' },
          { key: 'av', label: 'AV' },
        ]}
        rows={[{ proyecto: 'EXO · WashMach', av: '40 %' }]}
      />
    );

    const rowHeader = screen.getByRole('rowheader');
    expect(rowHeader).toHaveAttribute('scope', 'row');
    expect(rowHeader).toHaveTextContent('EXO · WashMach');
  });

  it('TS-7: expone el orden activo con aria-sort', () => {
    render(
      <Table
        columns={[{ key: 'cierre', label: 'Cierre', sortable: true }]}
        rows={[{ cierre: '25 ago' }]}
        sort={{ key: 'cierre', direction: 'asc' }}
        onSortChange={vi.fn()}
      />
    );

    expect(screen.getByRole('columnheader', { name: /Cierre/ })).toHaveAttribute(
      'aria-sort',
      'ascending'
    );
  });

  it('TS-8: no pone aria-sort en las columnas que no ordenan', () => {
    render(
      <Table
        columns={[
          { key: 'cierre', label: 'Cierre', sortable: true },
          { key: 'id', label: 'ID' },
        ]}
        rows={[{ cierre: '25 ago', id: '#151' }]}
        sort={{ key: 'cierre', direction: 'asc' }}
        onSortChange={vi.fn()}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'ID' })).not.toHaveAttribute('aria-sort');
  });

  it('TS-9: avisa el cambio de orden con la columna y la dirección invertida', async () => {
    const onSortChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Table
        columns={[{ key: 'cierre', label: 'Cierre', sortable: true }]}
        rows={[{ cierre: '25 ago' }]}
        sort={{ key: 'cierre', direction: 'asc' }}
        onSortChange={onSortChange}
      />
    );

    await user.click(screen.getByRole('columnheader', { name: /Cierre/ }));

    expect(onSortChange).toHaveBeenCalledWith({ key: 'cierre', direction: 'desc' });
  });

  it('TS-10: sin filas muestra el emptyState y no filas de datos', () => {
    render(
      <Table
        columns={[{ key: 'id', label: 'ID' }]}
        rows={[]}
        emptyState={<span>No se encontraron requisitos</span>}
      />
    );

    expect(screen.getByText('No se encontraron requisitos')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('TS-11: en estado de carga anuncia y no muestra el vacío', () => {
    render(
      <Table
        columns={[{ key: 'id', label: 'ID' }]}
        rows={[]}
        loading
        emptyState={<span>No se encontraron requisitos</span>}
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('No se encontraron requisitos')).not.toBeInTheDocument();
  });

  it('TS-12: marca la celda vencida con texto, no sólo con color', () => {
    render(
      <Table
        columns={[{ key: 'cierre', label: 'Cierre' }]}
        rows={[{ cierre: 'vencido hace 1 día', _overdue: ['cierre'] }]}
      />
    );

    const cell = screen.getByText('vencido hace 1 día');
    expect(cell).toBeInTheDocument();
    expect(cell.closest('td')?.className).toMatch(/overdue/i);
  });

  it('TS-13: no tiñe la fila completa con un color de sistema', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './Table.module.scss'), 'utf-8');
    // Ninguna regla de tr declara background-color con un token --state-*-full.
    expect(source).not.toMatch(/--state-[a-z-]*-full/);
    const trBlockMatch = source.match(/\.row\s*\{[^}]*\}/g) ?? [];
    trBlockMatch.forEach((block) => {
      expect(block).not.toMatch(/background-color:\s*var\(--state-/);
    });
  });
});
