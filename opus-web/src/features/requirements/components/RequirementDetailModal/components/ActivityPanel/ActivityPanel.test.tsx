import { render, screen } from '@testing-library/react';
import { ActivityPanel } from './ActivityPanel';
import type { RequirementActivity } from '../../../../types/requirement.types';

function buildActivity(overrides: Partial<RequirementActivity> = {}): RequirementActivity {
  return {
    id: 1,
    typeOfActivity: 'state',
    visibilityLevel: 'public',
    createdAt: '2026-07-01T00:00:00Z',
    user: { id: 'u1', name: 'Juan', email: 'juan@x.com' },
    ...overrides,
  };
}

describe('ActivityPanel', () => {
  it('renderiza una transición entre valores nuevos con labels vigentes', () => {
    render(
      <ActivityPanel
        activities={[
          buildActivity({
            previousValue: 'analisis',
            newValue: 'en_cola',
            user: { id: 'u1', name: 'Juan', email: 'juan@x.com' },
          }),
        ]}
      />
    );
    expect(screen.getByText(/Juan/)).toBeInTheDocument();
    expect(screen.getByText(/Análisis/)).toBeInTheDocument();
    expect(screen.getByText('En cola')).toBeInTheDocument();
  });

  it('renderiza una transición vieja→vieja persistida con labels legibles', () => {
    render(
      <ActivityPanel
        activities={[
          buildActivity({
            previousValue: 'programado',
            newValue: 'finalizado',
            user: { id: 'u2', name: 'Ana', email: 'ana@x.com' },
          }),
        ]}
      />
    );
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText(/Programado/)).toBeInTheDocument();
    expect(screen.getByText('Finalizado')).toBeInTheDocument();
  });

  it('renderiza una transición mixta viejo→nuevo', () => {
    render(
      <ActivityPanel
        activities={[
          buildActivity({
            previousValue: 'programado',
            newValue: 'planificacion',
            user: { id: 'u2', name: 'Ana', email: 'ana@x.com' },
          }),
        ]}
      />
    );
    expect(screen.getByText(/Programado/)).toBeInTheDocument();
    expect(screen.getByText('Planificación')).toBeInTheDocument();
  });

  it('muestra el label humanizado "Título" (no "title") cuando cambia el título', () => {
    render(
      <ActivityPanel
        activities={[
          buildActivity({
            typeOfActivity: 'title',
            previousValue: 'Antes',
            newValue: 'Después',
          }),
        ]}
      />
    );
    expect(screen.getByText('Título')).toBeInTheDocument();
    expect(screen.queryByText('title')).not.toBeInTheDocument();
  });

  it('muestra el label humanizado del valor cuando cambia el tipo (Mejora, no mejora)', () => {
    render(
      <ActivityPanel
        activities={[
          buildActivity({
            typeOfActivity: 'type',
            previousValue: 'funcionalidad',
            newValue: 'mejora',
          }),
        ]}
      />
    );
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Mejora')).toBeInTheDocument();
    const eventText = document.querySelector('[class*="eventText"]');
    expect(eventText).toHaveTextContent('de Funcionalidad a Mejora');
    expect(eventText?.textContent).not.toMatch(/\bfuncionalidad\b/);
    expect(eventText?.textContent).not.toMatch(/\bmejora\b/);
  });

  it('muestra el label humanizado "Descripción" (no "description") sin mostrar el contenido antes/después', () => {
    render(
      <ActivityPanel
        activities={[
          buildActivity({
            typeOfActivity: 'description',
            previousValue: 'Descripción vieja muy larga',
            newValue: 'Descripción nueva muy larga',
          }),
        ]}
      />
    );
    expect(screen.getByText('Descripción')).toBeInTheDocument();
    expect(screen.queryByText('description')).not.toBeInTheDocument();
    expect(screen.queryByText('Descripción vieja muy larga')).not.toBeInTheDocument();
    expect(screen.queryByText('Descripción nueva muy larga')).not.toBeInTheDocument();
  });
});
