import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AddButton } from './AddButton';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/image', () => ({
  default: ({ alt, title }: { alt: string; title?: string }) => <img alt={alt} title={title} />,
}));

describe('AddButton', () => {
  it('TS-17 (S-067): tooltip dice "Crear una nueva tarea asociada"', () => {
    render(<AddButton href="/objectives/new" />);

    expect(screen.getByTitle('Crear una nueva tarea asociada')).toBeInTheDocument();
  });
});
