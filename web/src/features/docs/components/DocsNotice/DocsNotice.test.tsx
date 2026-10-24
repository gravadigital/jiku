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

  it('P-13: info es neutral y role=alert por defecto', () => {
    render(<DocsNotice intent="info">Aviso</DocsNotice>);
    expect(screen.getByRole('alert')).toHaveTextContent('Aviso');
  });

  it('P-13: role none no anuncia', () => {
    render(
      <DocsNotice intent="info" role="none">
        Aviso
      </DocsNotice>
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Aviso')).toBeInTheDocument();
  });
});
