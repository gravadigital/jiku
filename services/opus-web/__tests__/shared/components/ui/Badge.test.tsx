import { render, screen } from '@testing-library/react';
import { Badge } from '@/shared/components/ui/Badge';

describe('Badge', () => {
  it('renderiza children correctamente', () => {
    render(<Badge>Badge text</Badge>);
    expect(screen.getByText('Badge text')).toBeInTheDocument();
  });

  it('aplica variante default por defecto', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveAttribute('data-variant', 'default');
  });

  it('aplica variante success', () => {
    render(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success')).toHaveAttribute('data-variant', 'success');
  });

  it('aplica variante warning', () => {
    render(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText('Warning')).toHaveAttribute('data-variant', 'warning');
  });

  it('aplica variante error', () => {
    render(<Badge variant="error">Error</Badge>);
    expect(screen.getByText('Error')).toHaveAttribute('data-variant', 'error');
  });

  it('aplica variante info', () => {
    render(<Badge variant="info">Info</Badge>);
    expect(screen.getByText('Info')).toHaveAttribute('data-variant', 'info');
  });

  it('aplica className personalizado', () => {
    render(<Badge className="custom-class">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('custom-class');
  });

  it('TS-8: sin las props de accesibilidad no emite role ni aria-label', () => {
    render(<Badge>Texto</Badge>);
    const badge = screen.getByText('Texto');
    expect(badge).not.toHaveAttribute('role');
    expect(badge).not.toHaveAttribute('aria-label');
  });

  it('TS-8: pasa role y aria-label al span cuando se los declara', () => {
    render(
      <Badge role="img" aria-label="Nombre accesible">
        Texto
      </Badge>
    );
    expect(screen.getByRole('img', { name: 'Nombre accesible' })).toBeInTheDocument();
  });
});
