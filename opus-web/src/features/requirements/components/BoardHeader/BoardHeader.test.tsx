import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardHeader } from './BoardHeader';
import { vi } from 'vitest';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: () => 'list' }),
}));

vi.mock('@/features/subscriptions/hooks/useSubscribe', () => ({
  useSubscribe: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/features/subscriptions/hooks/useUnsubscribe', () => ({
  useUnsubscribe: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('BoardHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sin requirementId (comportamiento actual)', () => {
    it('renderiza breadcrumb con proyecto y "Requisitos"', () => {
      render(<BoardHeader projectName="Proyecto Alpha" projectId={1} />);
      expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
      expect(screen.getByText('Requisitos')).toBeInTheDocument();
    });

    it('renderiza los botones de vista Lista y Columnas', () => {
      render(<BoardHeader projectName="Proyecto Alpha" projectId={1} />);
      expect(screen.getByText('Lista')).toBeInTheDocument();
      expect(screen.getByText('Columnas')).toBeInTheDocument();
    });

    it('"Requisitos" no es un botón clickeable', () => {
      render(<BoardHeader projectName="Proyecto Alpha" projectId={1} />);
      const elem = screen.getByText('Requisitos');
      expect(elem.tagName).not.toBe('BUTTON');
    });
  });

  describe('con requirementId', () => {
    it('renderiza breadcrumb completo: proyecto › Requisitos › #42', () => {
      render(<BoardHeader projectName="Proyecto Alpha" projectId={1} requirementId={42} />);
      expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
      expect(screen.getByText('Requisitos')).toBeInTheDocument();
      expect(screen.getByText('#42')).toBeInTheDocument();
    });

    it('"Requisitos" es un botón clickeable', () => {
      render(<BoardHeader projectName="Proyecto Alpha" projectId={1} requirementId={42} />);
      const btn = screen.getByRole('button', { name: /requisitos/i });
      expect(btn).toBeInTheDocument();
    });

    it('click en "Requisitos" navega al listado del proyecto', async () => {
      const user = userEvent.setup();
      render(<BoardHeader projectName="Proyecto Alpha" projectId={1} requirementId={42} />);
      const btn = screen.getByRole('button', { name: /requisitos/i });
      await user.click(btn);
      expect(mockPush).toHaveBeenCalledWith('/projects/1/requirements');
    });

    it('los botones de vista no se renderizan', () => {
      render(<BoardHeader projectName="Proyecto Alpha" projectId={1} requirementId={42} />);
      expect(screen.queryByText('Lista')).not.toBeInTheDocument();
      expect(screen.queryByText('Columnas')).not.toBeInTheDocument();
    });
  });

  describe('S-093 — cabecera mínima', () => {
    it('TS-15: breadcrumb de 2 niveles sin acciones ni toggles', () => {
      render(<BoardHeader projectName="Proyecto Alpha" projectId={12} minimal />);
      expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Requisitos' })).toBeInTheDocument();
      expect(screen.queryByText(/^#/)).toBeNull();
      expect(screen.queryByRole('button', { name: /Copiar enlace/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Suscribirse/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Volver al board/ })).toBeNull();
      expect(screen.queryByText('Lista')).toBeNull();
      expect(screen.queryByText('Columnas')).toBeNull();
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('TS-16: "Requisitos" navega al tablero', async () => {
      const user = userEvent.setup();
      render(<BoardHeader projectName="Proyecto Alpha" projectId={12} minimal />);
      await user.click(screen.getByRole('button', { name: 'Requisitos' }));
      expect(mockPush).toHaveBeenCalledWith('/projects/12/requirements');
    });
  });
});
