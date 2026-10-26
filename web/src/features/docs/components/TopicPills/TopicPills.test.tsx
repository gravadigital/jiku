import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopicPills } from './TopicPills';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

describe('TopicPills', () => {
  it('hasta 3 pills y "+n"', () => {
    render(<TopicPills topics={['a', 'b', 'c', 'd', 'e']} />);
    ['a', 'b', 'c', '+2'].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    expect(screen.queryByText('d')).not.toBeInTheDocument();
  });
  it('sin temas: emptyLabel o nada', () => {
    const { container, rerender } = render(<TopicPills topics={[]} emptyLabel="Sin tema" />);
    expect(screen.getByText('Sin tema')).toBeInTheDocument();
    rerender(<TopicPills topics={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
