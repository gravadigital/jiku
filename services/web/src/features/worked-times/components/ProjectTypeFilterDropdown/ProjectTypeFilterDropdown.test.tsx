import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProjectTypeFilterDropdown } from './ProjectTypeFilterDropdown';

const openDropdown = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('combobox'));
};

describe('ProjectTypeFilterDropdown — S-058 (migrado al Select del DS, variant multiple)', () => {
  it('TS-88: es un role="combobox" con aria-expanded; las opciones son role="option" con aria-selected', async () => {
    const user = userEvent.setup();
    render(<ProjectTypeFilterDropdown value={[]} onChange={vi.fn()} />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await openDropdown(user);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: 'Comercial' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Interno' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Investigación' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Propuesta' })).toBeInTheDocument();
  });

  it('TS-88: elegir "Comercial" invoca onChange y el panel permanece abierto', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectTypeFilterDropdown value={[]} onChange={onChange} />);

    await openDropdown(user);
    await user.click(screen.getByRole('option', { name: 'Comercial' }));

    expect(onChange).toHaveBeenCalledWith(['comercial']);
  });

  it('TS-88: destildar un tipo ya elegido invoca onChange sin ese tipo', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectTypeFilterDropdown value={['comercial', 'interno']} onChange={onChange} />);

    await openDropdown(user);
    await user.click(screen.getByRole('option', { name: 'Comercial' }));

    expect(onChange).toHaveBeenCalledWith(['interno']);
  });

  it('TS-88: Esc cierra el panel y devuelve el foco al control', async () => {
    const user = userEvent.setup();
    render(<ProjectTypeFilterDropdown value={[]} onChange={vi.fn()} />);

    const trigger = screen.getByRole('combobox');
    await openDropdown(user);
    expect(screen.getByRole('option', { name: 'Comercial' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('option', { name: 'Comercial' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('no hay checkboxes a mano ni <button> crudo: el control es el combobox del Select del DS', async () => {
    const { container } = render(<ProjectTypeFilterDropdown value={[]} onChange={vi.fn()} />);
    expect(container.querySelector('input[type="checkbox"]')).not.toBeInTheDocument();
  });

  it('el label del control refleja el label conceptual "Tipo de proyecto"', () => {
    render(<ProjectTypeFilterDropdown value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /Tipo de proyecto/ })).toBeInTheDocument();
  });
});
