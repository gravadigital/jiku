import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DateLabel } from './DateLabel';

// `DateLabel` importa `formatDate` del barrel `@/shared/utils`, que reexporta `decodedToken` y
// con el `@/lib/auth`. Sin este mock el test arrastra next-auth y no resuelve.
vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(null),
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe('DateLabel', () => {
  it('muestra la cantidad de días transcurridos desde la fecha', () => {
    const hace3Dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    render(<DateLabel date={hace3Dias} label="Creación" cardClass="default" />);

    expect(screen.getByText('3 días')).toBeInTheDocument();
    expect(screen.getByText('Creación')).toBeInTheDocument();
  });

  it('muestra "Hoy" cuando la fecha es de hoy', () => {
    render(<DateLabel date={new Date()} label="Modificación" cardClass="default" />);

    expect(screen.getByText('Hoy')).toBeInTheDocument();
  });

  it('muestra "N/D" cuando no hay fecha', () => {
    render(<DateLabel label="Creación" cardClass="default" />);

    expect(screen.getByText('N/D')).toBeInTheDocument();
  });

  // Es el caso real: `Objective.createdAt` está tipado `Date` pero la api lo manda como
  // string ISO, y al no derivar los tipos de `@jiku/models` nada lo detecta en compilación.
  it('acepta un string ISO, que es lo que la api devuelve en realidad', () => {
    const hace2Dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    render(
      <DateLabel date={hace2Dias as unknown as Date} label="Creación" cardClass="default" />
    );

    expect(screen.getByText('2 días')).toBeInTheDocument();
  });
});
