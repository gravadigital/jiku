import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type Mock } from 'vitest';
import { useProjects } from '@/features/projects';
import { DocumentHeader } from './DocumentHeader';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/projects', () => ({ useProjects: vi.fn() }));

describe('DocumentHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useProjects as Mock).mockReturnValue({ data: [{ id: 12, name: 'Proyecto Acme' }] });
  });

  it('TS-48: breadcrumb de tres niveles y Volver', async () => {
    render(<DocumentHeader projectId={12} title="Guía de despliegue" />);
    const nav = screen.getByRole('navigation', { name: 'Ubicación' });
    expect(within(nav).getByRole('link', { name: 'Proyecto Acme' })).toHaveAttribute(
      'href',
      '/projects/12/requirements'
    );
    expect(within(nav).getByRole('link', { name: 'Documentación' })).toHaveAttribute(
      'href',
      '/projects/12/requirements'
    );
    expect(within(nav).getByText('Guía de despliegue')).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(push).toHaveBeenCalledWith('/projects/12/requirements');
  });

  it('TS-58: sin nombre resoluble usa "Proyecto"', () => {
    (useProjects as Mock).mockReturnValue({ data: undefined, isError: true });
    render(<DocumentHeader projectId={12} title="Doc" />);
    expect(screen.getByRole('link', { name: 'Proyecto' })).toBeInTheDocument();
  });

  it('sin título muestra solo Volver', () => {
    render(<DocumentHeader projectId={12} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });
});
