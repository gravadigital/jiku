import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocsSearchBar } from './DocsSearchBar';

vi.mock('../../hooks/useDocsSuggestions', () => ({
  useDocsSuggestions: vi.fn(() => ({ data: undefined })),
}));
vi.mock('@/features/projects/hooks/useProject', () => ({
  useProject: vi.fn(() => ({ data: { name: 'Videoconferencia' } })),
}));
vi.mock('@/features/clients/hooks/useClient', () => ({
  useClient: vi.fn(() => ({ isError: true, data: undefined })),
}));
vi.mock('@/features/auth/hooks/usePersons', () => ({
  usePersons: vi.fn(() => ({
    data: [{ userId: 'sub-ana', firstName: 'Ana', lastName: 'Pérez' }],
  })),
}));
vi.mock('@/features/requirements/hooks/useRequirement', () => ({
  useRequirement: vi.fn(() => ({ data: undefined })),
}));
vi.mock('@/features/objectives/hooks/useObjective', () => ({
  useObjective: vi.fn(() => ({ data: { title: 'Migrar video' } })),
}));

describe('DocsSearchBar — nombres de los tokens', () => {
  it('TS-29: los resuelve con lo que la web ya consulta y cae a #id', () => {
    render(
      <DocsSearchBar
        tokens={[
          { kind: 'proyecto', id: 12 },
          { kind: 'persona', sub: 'sub-ana' },
          { kind: 'cliente', id: 99 },
          { kind: 'tarea', id: 7 },
          { kind: 'texto', value: 'video' },
          { kind: 'sinTema' },
        ]}
        knownLabels={{}}
        disabled={false}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />
    );
    for (const label of [
      'Proyecto Videoconferencia',
      'Persona Ana Pérez',
      'Cliente #99',
      'Tarea Migrar video',
      '“video”',
      'Sin tema',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
