import { render, screen } from '@testing-library/react';
import { Card } from '@/shared/components/ui/Card';

describe('Card', () => {
  it('renderiza children correctamente', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renderiza título cuando se proporciona', () => {
    render(<Card title="Card Title">Content</Card>);
    expect(screen.getByRole('heading', { name: 'Card Title' })).toBeInTheDocument();
  });

  it('no renderiza título cuando no se proporciona', () => {
    render(<Card>Content</Card>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('aplica className personalizado', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
