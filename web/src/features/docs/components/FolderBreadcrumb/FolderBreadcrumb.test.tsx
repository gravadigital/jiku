import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FolderBreadcrumb } from './FolderBreadcrumb';

describe('FolderBreadcrumb', () => {
  it('niveles con enlace, último sin enlace y aria-current', () => {
    render(
      <FolderBreadcrumb
        trail={[
          { id: 'F1', name: 'clientes' },
          { id: 'F0', name: 'acme' },
        ]}
      />
    );
    expect(screen.getByRole('navigation', { name: 'Ruta de la carpeta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/docs');
    expect(screen.getByRole('link', { name: 'clientes' })).toHaveAttribute(
      'href',
      '/docs?folder=F1'
    );
    expect(screen.queryByRole('link', { name: 'acme' })).toBeNull();
    expect(screen.getByText('acme')).toHaveAttribute('aria-current', 'page');
  });

  it('un ancestro ilegible es texto', () => {
    render(
      <FolderBreadcrumb
        trail={[
          { id: null, name: 'clientes' },
          { id: 'F0', name: 'acme' },
        ]}
      />
    );
    expect(screen.queryByRole('link', { name: 'clientes' })).toBeNull();
    expect(screen.getByText('clientes')).toBeInTheDocument();
  });

  it('en la raíz solo Inicio, sin enlace', () => {
    render(<FolderBreadcrumb trail={[]} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Inicio')).toHaveAttribute('aria-current', 'page');
  });
});
