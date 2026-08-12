import { render } from '@testing-library/react';
import { RequirementCard } from './RequirementCard';

describe('RequirementCard', () => {
  it.each([
    'analisis',
    'planificacion',
    'en_cola',
    'desarrollo',
    'revision',
    'resuelto',
    'cancelado',
  ])('setea data-state="%s" para el estado vigente %s', (state) => {
    const { container } = render(
      <RequirementCard id={1} title="X" state={state} createdAt="2026-07-01T00:00:00Z" />
    );
    expect(container.querySelector('article')).toHaveAttribute('data-state', state);
  });
});
