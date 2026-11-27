import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EditableCell } from './EditableCell';

describe('EditableCell — migración al Input del DS (S-058, TS-95)', () => {
  it('el campo tiene nombre accesible que identifica persona y proyecto', () => {
    render(
      <EditableCell
        personId={1}
        projectId={10}
        personName="Ana Gomez"
        projectName="Proyecto X"
        value={40}
        onChange={vi.fn()}
        hoursPerDay={6}
      />
    );

    expect(
      screen.getByRole('textbox', { name: 'Porcentaje de capacidad de Ana Gomez en Proyecto X' })
    ).toBeInTheDocument();
  });

  it('el label está oculto visualmente (no queda un <label> visible por celda)', () => {
    const { container } = render(
      <EditableCell
        personId={1}
        projectId={10}
        personName="Ana Gomez"
        projectName="Proyecto X"
        value={40}
        onChange={vi.fn()}
        hoursPerDay={6}
      />
    );

    const label = container.querySelector('label');
    expect(label).toHaveClass(/labelHidden/);
  });

  it('escribir en el campo invoca onChange con el número', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EditableCell
        personId={1}
        projectId={10}
        personName="Ana Gomez"
        projectName="Proyecto X"
        value={0}
        onChange={onChange}
        hoursPerDay={6}
      />
    );

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '50');

    expect(onChange).toHaveBeenLastCalledWith(50);
  });

  it('muestra las horas equivalentes al porcentaje', () => {
    render(
      <EditableCell
        personId={1}
        projectId={10}
        personName="Ana Gomez"
        projectName="Proyecto X"
        value={50}
        onChange={vi.fn()}
        hoursPerDay={6}
      />
    );

    // 50% de 30h semanales (6h x 5 días) = 15h
    expect(screen.getByText('15h')).toBeInTheDocument();
  });

  it('no queda un <input> crudo: usa el Input del DS', () => {
    const content = fs.readFileSync(path.resolve(__dirname, './EditableCell.tsx'), 'utf8');
    expect(content).not.toMatch(/<input/);
  });
});
