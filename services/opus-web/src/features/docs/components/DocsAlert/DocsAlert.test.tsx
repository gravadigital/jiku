import { render, screen } from '@testing-library/react';
import { DocsAlert } from './DocsAlert';

describe('DocsAlert', () => {
  it('error usa role alert y data-variant', () => {
    render(<DocsAlert variant="error">Falló</DocsAlert>);
    const el = screen.getByRole('alert');
    expect(el).toHaveTextContent('Falló');
    expect(el).toHaveAttribute('data-variant', 'error');
  });

  it('warning usa role status y data-variant', () => {
    render(<DocsAlert variant="warning">Aviso</DocsAlert>);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('Aviso');
    expect(el).toHaveAttribute('data-variant', 'warning');
  });
});
