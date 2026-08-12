import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';
import { vi } from 'vitest';

const mockSignIn = vi.fn();

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

beforeEach(() => {
  mockSignIn.mockClear();
});

// TS-1: Página renderiza estructura completa
describe('TS-1: Estructura completa', () => {
  it('renderiza el contenedor principal, título y botón', () => {
    render(<LoginPage />);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});

// TS-2: Título con texto correcto
describe('TS-2: Título correcto', () => {
  it('muestra el título "¡Bienvenido a OPUS!"', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('¡Bienvenido a OPUS!');
  });
});

// TS-3: Texto descriptivo visible
describe('TS-3: Texto descriptivo', () => {
  it('muestra el texto descriptivo del producto', () => {
    render(<LoginPage />);
    expect(screen.getByText(/Seguí el avance/)).toBeInTheDocument();
  });
});

// TS-4: Botón "Iniciar sesión" presente
describe('TS-4: Botón presente', () => {
  it('renderiza el botón "Iniciar sesión"', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});

// TS-5: Click en botón llama signIn('zitadel')
describe('TS-5: Click llama signIn', () => {
  it('llama signIn con zitadel y callbackUrl al hacer click', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(mockSignIn).toHaveBeenCalledWith('zitadel', { callbackUrl: '/login/enter' });
  });
});

// TS-6: Botón deshabilitado durante loading
describe('TS-6: Botón deshabilitado mientras carga', () => {
  it('deshabilita el botón inmediatamente al hacer click', () => {
    // signIn no resuelve de inmediato para simular navegación en curso
    mockSignIn.mockImplementation(() => new Promise(() => {}));
    render(<LoginPage />);
    const button = screen.getByRole('button', { name: 'Iniciar sesión' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
  });
});
