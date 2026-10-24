import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFolderTrail } from '../../hooks/useFolderTrail';
import { DocumentBreadcrumb } from './DocumentBreadcrumb';

vi.mock('../../hooks/useFolderTrail', () => ({ useFolderTrail: vi.fn() }));

const FOLDER_ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6F0';

describe('DocumentBreadcrumb', () => {
  beforeEach(() => vi.mocked(useFolderTrail).mockReturnValue({ data: undefined } as never));

  it('TS-60: niveles intermedios como texto y el último como link a la carpeta', () => {
    render(<DocumentBreadcrumb folder={{ id: FOLDER_ID, path: '/clientes/acme/' }} />);
    const nav = screen.getByRole('navigation', { name: 'Ruta' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Documentación' })).toHaveAttribute('href', '/docs');
    expect(screen.getByText('clientes')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'clientes' })).toBeNull();
    expect(screen.getByRole('link', { name: 'acme' })).toHaveAttribute(
      'href',
      `/docs?folder=${FOLDER_ID}`
    );
  });

  it('TS-61: documento en la raíz, solo Documentación', () => {
    render(<DocumentBreadcrumb folder={{ id: FOLDER_ID, path: '/' }} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Documentación' })).toHaveAttribute('href', '/docs');
  });

  it('TS-97: con el trail todos los niveles enlazan', () => {
    vi.mocked(useFolderTrail).mockReturnValue({
      data: {
        trail: [
          { id: '01J9Z3K8M2Q4R6T8V0W2Y4A6F1', name: 'clientes' },
          { id: FOLDER_ID, name: 'acme' },
        ],
      },
    } as never);
    render(<DocumentBreadcrumb folder={{ id: FOLDER_ID, path: '/clientes/acme/' }} />);
    expect(screen.getByRole('link', { name: 'Documentación' })).toHaveAttribute('href', '/docs');
    expect(screen.getByRole('link', { name: 'clientes' })).toHaveAttribute(
      'href',
      '/docs?folder=01J9Z3K8M2Q4R6T8V0W2Y4A6F1'
    );
    expect(screen.getByRole('link', { name: 'acme' })).toHaveAttribute(
      'href',
      `/docs?folder=${FOLDER_ID}`
    );
  });
});
