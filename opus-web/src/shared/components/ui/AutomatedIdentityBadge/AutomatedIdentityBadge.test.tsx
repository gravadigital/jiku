import { render, screen } from '@testing-library/react';
import { AutomatedIdentityBadge } from './AutomatedIdentityBadge';
// Se importa la hoja de `Badge` para asertar SU clase: es la prueba de que el badge
// compone `Badge` y no tiene estilos propios. Se usa `styles.badge` en vez del literal
// porque el `generateScopedName: '[local]'` de `vitest.config.mts` ya no lo respeta la
// version actual de Vite. Es el patron de `PageContainer.test.tsx`.
import styles from '../Badge/Badge.module.scss';

describe('AutomatedIdentityBadge', () => {
  it('TS-1: renderiza el texto exacto "Automático" cuando la identidad es de servicio', () => {
    render(<AutomatedIdentityBadge identityType="service" />);
    expect(screen.getByText('Automático')).toBeInTheDocument();
  });

  it('TS-2: su nombre accesible es el aprobado por UX, expuesto con un rol real', () => {
    render(<AutomatedIdentityBadge identityType="service" />);
    expect(
      screen.getByRole('img', { name: 'Identidad automática: no es una persona' })
    ).toBeInTheDocument();
  });

  it('TS-3: una persona no produce bloque ni espacio reservado', () => {
    const { container } = render(<AutomatedIdentityBadge identityType="person" />);
    expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('TS-4: identityType ausente no marca — degradación segura de api vieja', () => {
    const { container } = render(<AutomatedIdentityBadge identityType={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('TS-5: un valor inesperado no marca', () => {
    const { container } = render(<AutomatedIdentityBadge identityType={'robot' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('TS-6: el badge no es interactivo ni enfocable', () => {
    render(<AutomatedIdentityBadge identityType="service" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    const badge = screen.getByText('Automático');
    expect(badge).not.toHaveAttribute('tabindex');
    expect(badge).not.toHaveAttribute('title');
  });

  it('TS-7: compone Badge en vez de una hoja de estilos propia', () => {
    render(<AutomatedIdentityBadge identityType="service" />);
    const badge = screen.getByText('Automático');
    expect(badge).toHaveAttribute('data-variant', 'default');
    expect(badge).toHaveClass(styles.badge);
  });

  it('reenvía className al punto de inserción', () => {
    render(<AutomatedIdentityBadge identityType="service" className="ajuste-de-layout" />);
    expect(screen.getByText('Automático')).toHaveClass('ajuste-de-layout');
  });
});
