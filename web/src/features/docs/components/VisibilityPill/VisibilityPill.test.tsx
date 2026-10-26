import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VisibilityPill } from './VisibilityPill';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

describe('VisibilityPill', () => {
  it('public y restricted llevan texto', () => {
    const { rerender } = render(<VisibilityPill visibility="public" />);
    expect(screen.getByText('Visible para el cliente')).toBeInTheDocument();
    rerender(<VisibilityPill visibility="restricted" />);
    expect(screen.getByText('Restringido')).toBeInTheDocument();
  });
  it('internal no lleva marca', () => {
    const { container } = render(<VisibilityPill visibility="internal" />);
    expect(container).toBeEmptyDOMElement();
  });
});
