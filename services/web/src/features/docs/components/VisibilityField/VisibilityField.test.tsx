import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VisibilityField } from './VisibilityField';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

describe('VisibilityField', () => {
  it('TS-19: un user no ve Restringido y la ayuda se asocia', () => {
    render(<VisibilityField value="internal" onChange={vi.fn()} canRestrict={false} />);
    expect(screen.getByRole('radio', { name: 'Interno' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Visible para el cliente' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Restringido' })).not.toBeInTheDocument();
    const help = screen.getByText('Solo el equipo.');
    expect(screen.getByRole('radiogroup', { name: 'Visibilidad' })).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(help.id)
    );
  });

  it('TS-19: admin ve Restringido y su ayuda', async () => {
    const Harness = () => {
      const [v, setV] = React.useState<'internal' | 'public' | 'restricted'>('internal');
      return <VisibilityField value={v} onChange={setV} canRestrict />;
    };
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'Restringido' }));
    expect(screen.getByText('Solo la conducción. No se puede compartir.')).toBeInTheDocument();
  });

  it('TS-19: un user con un documento restringido ve todo deshabilitado', () => {
    render(<VisibilityField value="restricted" onChange={vi.fn()} canRestrict={false} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Restringido' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('TS-20: aviso al restringir y error asociado', () => {
    const { rerender } = render(
      <VisibilityField
        value="restricted"
        initialValue="internal"
        warnOnRestrict
        canRestrict
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText('Al guardar, los links compartidos de este documento dejan de funcionar.')
    ).toBeInTheDocument();
    rerender(
      <VisibilityField
        value="restricted"
        initialValue="internal"
        canRestrict
        onChange={vi.fn()}
        error="Solo la conducción puede restringir un documento."
      />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Solo la conducción puede restringir un documento.');
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(alert.id)
    );
  });
});
