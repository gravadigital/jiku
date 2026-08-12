import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ToggleGroup } from './ToggleGroup';

type Mode = 'a' | 'b';

const options: { key: Mode; label: string }[] = [
  { key: 'a', label: 'Opción A' },
  { key: 'b', label: 'Opción B' },
];

describe('ToggleGroup', () => {
  it('marca aria-pressed="true" en la opción activa y "false" en las demás (S-086)', () => {
    render(<ToggleGroup options={options} value="a" onChange={vi.fn()} />);

    expect(screen.getByText('Opción A')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Opción B')).toHaveAttribute('aria-pressed', 'false');
  });

  it('actualiza aria-pressed cuando cambia el value activo (S-086)', () => {
    const { rerender } = render(<ToggleGroup options={options} value="a" onChange={vi.fn()} />);
    rerender(<ToggleGroup options={options} value="b" onChange={vi.fn()} />);

    expect(screen.getByText('Opción A')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Opción B')).toHaveAttribute('aria-pressed', 'true');
  });
});
