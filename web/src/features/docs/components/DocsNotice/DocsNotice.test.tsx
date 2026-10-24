import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DocsNotice } from './DocsNotice';

describe('DocsNotice', () => {
  it.each(['warning', 'error'] as const)('expone role=alert con el texto (%s)', (intent) => {
    render(<DocsNotice intent={intent}>Mensaje</DocsNotice>);
    expect(screen.getByRole('alert')).toHaveTextContent('Mensaje');
  });

  it('el ícono es decorativo', () => {
    const { container } = render(<DocsNotice intent="warning">x</DocsNotice>);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
