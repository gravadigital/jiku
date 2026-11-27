import { render, screen } from '@testing-library/react';
import AuthLayout from '@/app/(auth)/layout';

describe('AuthLayout', () => {
  it('renderiza children correctamente', () => {
    render(
      <AuthLayout>
        <div data-testid="child">Child Content</div>
      </AuthLayout>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('no renderiza elementos de navegación', () => {
    render(
      <AuthLayout>
        <div>Content</div>
      </AuthLayout>
    );
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });
});
