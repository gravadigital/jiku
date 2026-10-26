import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { RequirementUnavailable } from './RequirementUnavailable';

const TITLE = 'El requisito no está disponible o no tenés acceso';
const BODY =
  'Puede que no exista o que no tengas permiso para verlo. Si te compartieron este enlace, pedile acceso a tu contacto en el equipo.';

describe('RequirementUnavailable', () => {
  it('TS-12: contenido y semántica', () => {
    render(<RequirementUnavailable onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
    expect(screen.getByText(BODY)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volver al tablero/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('TS-13: click en "Volver al tablero" llama onBack', async () => {
    const onBack = vi.fn();
    render(<RequirementUnavailable onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /Volver al tablero/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('TS-14: ícono decorativo y botón primary', () => {
    const { container } = render(<RequirementUnavailable onBack={vi.fn()} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
    expect(screen.getByRole('button', { name: /Volver al tablero/ })).toHaveAttribute(
      'data-variant',
      'primary'
    );
  });
});
