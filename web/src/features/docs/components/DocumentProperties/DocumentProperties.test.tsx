import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentProperties } from './DocumentProperties';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

describe('DocumentProperties (TS-25)', () => {
  it('visibilidad y versión, sin ruta', () => {
    const { container } = render(<DocumentProperties visibility="public" version={6} />);
    expect(screen.getByRole('heading', { name: 'Propiedades' })).toBeInTheDocument();
    expect(screen.getByText('Visibilidad').nextElementSibling).toHaveTextContent(
      'Visible para el cliente'
    );
    expect(screen.getByText('Versión').nextElementSibling).toHaveTextContent('6');
    expect(container).not.toHaveTextContent('Ruta');
  });
});
