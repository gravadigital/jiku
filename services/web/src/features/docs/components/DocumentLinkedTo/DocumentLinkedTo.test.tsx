import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentLinkedTo } from './DocumentLinkedTo';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

describe('DocumentLinkedTo (TS-23, TS-24)', () => {
  it('filas con nombres de la api y enlaces', () => {
    render(
      <DocumentLinkedTo
        clientRefs={[{ id: 4, name: 'EXO' }]}
        projectRefs={[{ id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4 }]}
        requirementRefs={[{ id: 151, title: 'Login con SSO', projectId: 12 }]}
        taskRefs={[{ id: 7, title: 'Migrar video', projectId: 12 }]}
      />
    );
    expect(screen.getByText('EXO')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'EXO' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Videoconferencia' })).toHaveAttribute(
      'href',
      '/projects/12'
    );
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Login con SSO' })).toHaveAttribute(
      'href',
      '/requirements/151'
    );
    expect(screen.getByRole('link', { name: 'Migrar video' })).toHaveAttribute(
      'href',
      '/objectives/7'
    );
  });

  it('sin nombre se muestra #id sin enlace', () => {
    render(
      <DocumentLinkedTo
        clientRefs={[]}
        projectRefs={[{ id: 99, name: null, code: null, clientId: null }]}
        requirementRefs={[]}
        taskRefs={[]}
      />
    );
    expect(screen.getByText('#99')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('vacío', () => {
    render(
      <DocumentLinkedTo clientRefs={[]} projectRefs={[]} requirementRefs={[]} taskRefs={[]} />
    );
    expect(
      screen.getByText(
        'Este documento no está vinculado a ningún cliente, proyecto, requisito ni tarea.'
      )
    ).toBeInTheDocument();
  });
});
