import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProjectTypeFilterDropdown } from './ProjectTypeFilterDropdown';

describe('ProjectTypeFilterDropdown — S-071', () => {
  it('TS-9: click en el botón abre el panel con los 4 checkboxes', async () => {
    const user = userEvent.setup();
    render(<ProjectTypeFilterDropdown value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Tipo de proyecto' }));

    expect(screen.getByRole('checkbox', { name: 'Comercial' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Interno' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Investigación' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Propuesta' })).toBeInTheDocument();
  });

  it('TS-10: tildar "Comercial" invoca onChange y el panel permanece abierto', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectTypeFilterDropdown value={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Tipo de proyecto' }));
    await user.click(screen.getByRole('checkbox', { name: 'Comercial' }));

    expect(onChange).toHaveBeenCalledWith(['comercial']);
    expect(screen.getByRole('checkbox', { name: 'Comercial' })).toBeInTheDocument();
  });

  it('TS-11: destildar un tipo ya tildado invoca onChange sin ese tipo', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectTypeFilterDropdown value={['comercial', 'interno']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Tipo de proyecto (2)' }));
    await user.click(screen.getByRole('checkbox', { name: 'Comercial' }));

    expect(onChange).toHaveBeenCalledWith(['interno']);
  });

  it('TS-12: el botón muestra el contador cuando hay tipos tildados', () => {
    render(<ProjectTypeFilterDropdown value={['comercial', 'interno']} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Tipo de proyecto (2)' })).toBeInTheDocument();
  });

  it('TS-13: el botón no muestra contador cuando no hay tildes', () => {
    render(<ProjectTypeFilterDropdown value={[]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Tipo de proyecto' })).toBeInTheDocument();
  });

  it('TS-14: click afuera del panel lo cierra', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ProjectTypeFilterDropdown value={[]} onChange={vi.fn()} />
        <button type="button">afuera</button>
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Tipo de proyecto' }));
    expect(screen.getByRole('checkbox', { name: 'Comercial' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'afuera' }));

    expect(screen.queryByRole('checkbox', { name: 'Comercial' })).not.toBeInTheDocument();
  });

  it('TS-15: tecla Escape cierra el panel', async () => {
    const user = userEvent.setup();
    render(<ProjectTypeFilterDropdown value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Tipo de proyecto' }));
    expect(screen.getByRole('checkbox', { name: 'Comercial' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('checkbox', { name: 'Comercial' })).not.toBeInTheDocument();
  });

  it('muestra las 4 opciones en el orden Comercial, Interno, Investigación, Propuesta', async () => {
    const user = userEvent.setup();
    render(<ProjectTypeFilterDropdown value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Tipo de proyecto' }));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(
      checkboxes.map((cb) => cb.getAttribute('aria-label') ?? cb.closest('label')?.textContent)
    ).toEqual(['Comercial', 'Interno', 'Investigación', 'Propuesta']);
  });

  it('el botón indica visualmente que es desplegable con un chevron', () => {
    render(<ProjectTypeFilterDropdown value={[]} onChange={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Tipo de proyecto' });
    expect(trigger.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
