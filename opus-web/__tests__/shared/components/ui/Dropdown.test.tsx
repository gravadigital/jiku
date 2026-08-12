import { render, screen, fireEvent } from '@testing-library/react';
import { Dropdown } from '@/shared/components/ui/Dropdown';
import { vi } from 'vitest';

describe('Dropdown', () => {
  const mockItems = [
    { id: 1, label: 'Item 1' },
    { id: 2, label: 'Item 2' },
    { id: 3, label: 'Item 3' },
  ];

  const mockOnSelect = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  it('renderiza el trigger correctamente', () => {
    render(<Dropdown trigger="Select option" items={mockItems} onSelect={mockOnSelect} />);
    expect(screen.getByText('Select option')).toBeInTheDocument();
  });

  it('abre el menú al hacer clic en el trigger', () => {
    render(<Dropdown trigger="Select option" items={mockItems} onSelect={mockOnSelect} />);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('cierra el menú al hacer clic en el trigger nuevamente', () => {
    render(<Dropdown trigger="Select option" items={mockItems} onSelect={mockOnSelect} />);

    const trigger = screen.getByRole('button', { name: /Select option/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('muestra todos los items cuando está abierto', () => {
    render(<Dropdown trigger="Select option" items={mockItems} onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('llama onSelect cuando se selecciona un item', () => {
    render(<Dropdown trigger="Select option" items={mockItems} onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Item 2'));

    expect(mockOnSelect).toHaveBeenCalledWith({ id: 2, label: 'Item 2' });
  });

  it('cierra el menú después de seleccionar un item', () => {
    render(<Dropdown trigger="Select option" items={mockItems} onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Item 1'));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('cierra el menú al presionar Escape', () => {
    render(<Dropdown trigger="Select option" items={mockItems} onSelect={mockOnSelect} />);

    const trigger = screen.getByRole('button', { name: /Select option/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(trigger.parentElement!, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('tiene aria-expanded correctamente', () => {
    render(<Dropdown trigger="Select option" items={mockItems} onSelect={mockOnSelect} />);

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
