import { render, screen } from '@testing-library/react';
import { PageContainer } from '@/shared/components/layout/PageContainer';
// Se compara contra el mapeo real del CSS module en vez de contra el nombre literal:
// el hash depende del compilador, el mapeo no.
import styles from '@/shared/components/layout/PageContainer/PageContainer.module.scss';

describe('PageContainer', () => {
  it('renderiza children correctamente', () => {
    render(
      <PageContainer>
        <div data-testid="child">Content</div>
      </PageContainer>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('aplica className personalizado', () => {
    const { container } = render(<PageContainer className="custom-class">Content</PageContainer>);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('aplica maxWidth xl por defecto', () => {
    const { container } = render(<PageContainer>Content</PageContainer>);
    expect(container.firstChild).toHaveClass(styles.xl);
  });

  it('aplica maxWidth sm cuando se especifica', () => {
    const { container } = render(<PageContainer maxWidth="sm">Content</PageContainer>);
    expect(container.firstChild).toHaveClass(styles.sm);
  });

  it('aplica maxWidth md cuando se especifica', () => {
    const { container } = render(<PageContainer maxWidth="md">Content</PageContainer>);
    expect(container.firstChild).toHaveClass(styles.md);
  });

  it('aplica maxWidth lg cuando se especifica', () => {
    const { container } = render(<PageContainer maxWidth="lg">Content</PageContainer>);
    expect(container.firstChild).toHaveClass(styles.lg);
  });

  it('aplica maxWidth full cuando se especifica', () => {
    const { container } = render(<PageContainer maxWidth="full">Content</PageContainer>);
    expect(container.firstChild).toHaveClass(styles.full);
  });
});
