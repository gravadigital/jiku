import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RequirementsReport from './page';

// El barrel de @/shared/components/ui arrastra CommentEditor -> next-auth/react. Mismo
// patrón que ui/index.test.ts documenta para el barrel completo.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));

vi.mock('@/features/requirements', () => ({
  RequirementsReportPage: () => <div>reporte</div>,
}));

describe('RequirementsReport — TS-98/S-060: cabecera migrada a ViewHeader', () => {
  it('renderiza "Reporte de Requisitos" como <h1>', () => {
    render(<RequirementsReport />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Reporte de Requisitos' })
    ).toBeInTheDocument();
  });
});
