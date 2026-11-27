import { render, screen } from '@testing-library/react';
import type { Subscriber } from '@/features/subscriptions/types/subscription.types';
import { SubscribersList } from '@/features/subscriptions/components/SubscribersList';

const ana: Subscriber = { id: 'u1', name: 'Ana López', email: 'ana@test.com' };
const juan: Subscriber = { id: 'u2', name: 'Juan García', email: 'juan@test.com' };

describe('SubscribersList', () => {
  it('TS-5: muestra nombres de todos los suscriptores', () => {
    render(<SubscribersList subscribers={[ana, juan]} />);
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('Juan García')).toBeInTheDocument();
  });

  it('TS-7: no muestra ningún botón de acción', () => {
    render(<SubscribersList subscribers={[ana, juan]} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('TS-8: muestra "Sin suscriptores" cuando subscribers está vacío', () => {
    render(<SubscribersList subscribers={[]} />);
    expect(screen.getByText('Sin suscriptores')).toBeInTheDocument();
  });
});
