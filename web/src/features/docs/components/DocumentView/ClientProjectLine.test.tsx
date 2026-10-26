import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClientProjectLine } from './ClientProjectLine';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

const EXO = { id: 4, name: 'EXO' };
const VIDEO = { id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4 };
const PORTAL = { id: 31, name: 'Portal', code: 'POR', clientId: 2 };

describe('ClientProjectLine (TS-26)', () => {
  it('sin nada: "Sin cliente · Sin proyecto"', () => {
    const { container } = render(<ClientProjectLine clientRefs={[]} projectRefs={[]} />);
    expect(container).toHaveTextContent('Sin cliente · Sin proyecto');
  });

  it('solo cliente', () => {
    const { container } = render(<ClientProjectLine clientRefs={[EXO]} projectRefs={[]} />);
    expect(container).toHaveTextContent('EXO · Sin proyecto');
  });

  it('proyecto enlazado con #id y "+n" por lista', () => {
    const { container } = render(
      <ClientProjectLine clientRefs={[EXO]} projectRefs={[VIDEO, PORTAL]} />
    );
    expect(container).toHaveTextContent('EXO · Videoconferencia #12 +1');
    expect(screen.getByRole('link', { name: 'Videoconferencia' })).toHaveAttribute(
      'href',
      '/projects/12'
    );
  });

  it('proyecto desconocido: #id sin enlace', () => {
    const { container } = render(
      <ClientProjectLine
        clientRefs={[EXO]}
        projectRefs={[{ id: 99, name: null, code: null, clientId: null }]}
      />
    );
    expect(container).toHaveTextContent('EXO · #99');
    expect(screen.queryByRole('link')).toBeNull();
  });
});
