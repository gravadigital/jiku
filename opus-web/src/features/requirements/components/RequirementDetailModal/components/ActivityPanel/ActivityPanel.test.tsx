import { render, screen } from '@testing-library/react';
import { ActivityPanel } from './ActivityPanel';
import type { RequirementActivity } from '../../../../types/requirement.types';
// Se importa la hoja para pinear el nodo RAIZ del comentario: la variant va ahi, no en
// el avatar. Se usa `styles.comment` y no el literal porque Vite hashea la clase.
import styles from './ActivityPanel.module.scss';

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
  describe('marca de identidad automática', () => {
    const servicio = {
      id: 'u-svc',
      name: 'Conector Portal',
      email: 'conector@grava.io',
      identityType: 'service' as const,
    };
    const persona = {
      id: 'u1',
      name: 'Juan Pérez',
      email: 'juan@x.com',
      identityType: 'person' as const,
    };

    it('TS-21: el comentario de una identidad de servicio lleva las dos señales', () => {
      const { container } = render(
        <ActivityPanel
          activities={[
            buildActivity({
              typeOfActivity: 'comment',
              newValue: 'sincronizado desde el portal',
              user: servicio,
            }),
          ]}
        />
      );
      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.getByText('Automático')).toBeInTheDocument();
      // El avatar deja de mostrar iniciales: "CP" es indistinguible de "Carla Perez".
      expect(screen.queryByText('CP')).not.toBeInTheDocument();
      // La variant vive en el nodo raiz del comentario, no en el avatar.
      expect(container.querySelector('[data-variant="identidad-automatica"]')).toHaveClass(
        styles.comment
      );
    });

    it('TS-22: el comentario de una persona conserva las iniciales y no lleva marca', () => {
      const { container } = render(
        <ActivityPanel
          activities={[
            buildActivity({ typeOfActivity: 'comment', newValue: 'un comentario', user: persona }),
          ]}
        />
      );
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.getByText('JP')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
      expect(container.querySelector('[data-variant="persona"]')).toHaveClass(styles.comment);
    });

    it('TS-23: el cambio de campo de una identidad de servicio lleva la marca', () => {
      render(
        <ActivityPanel
          activities={[
            buildActivity({
              typeOfActivity: 'state',
              previousValue: 'analisis',
              newValue: 'en_cola',
              user: servicio,
            }),
          ]}
        />
      );
      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.getByText(/cambió/)).toBeInTheDocument();
      expect(screen.getByText('Estado')).toBeInTheDocument();
      expect(screen.getByText(/Análisis/)).toBeInTheDocument();
      expect(screen.getByText('En cola')).toBeInTheDocument();
      expect(screen.getByText('Automático')).toBeInTheDocument();
    });

    it('TS-24: el cambio de campo de una persona no lleva marca', () => {
      render(
        <ActivityPanel
          activities={[
            buildActivity({ previousValue: 'analisis', newValue: 'en_cola', user: persona }),
          ]}
        />
      );
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('TS-25: en un feed mixto hay exactamente una marca, en la entrada del servicio', () => {
      const { container } = render(
        <ActivityPanel
          activities={[
            buildActivity({
              id: 1,
              typeOfActivity: 'comment',
              newValue: 'sincronizado desde el portal',
              createdAt: '2026-07-01T00:00:00Z',
              user: servicio,
            }),
            buildActivity({
              id: 2,
              typeOfActivity: 'state',
              previousValue: 'analisis',
              newValue: 'en_cola',
              createdAt: '2026-07-02T00:00:00Z',
              user: { id: 'u1', name: 'Juan', email: 'juan@x.com', identityType: 'person' },
            }),
          ]}
        />
      );
      const marcas = screen.getAllByText('Automático');
      expect(marcas).toHaveLength(1);
      expect(container.querySelectorAll('[data-variant="identidad-automatica"]')).toHaveLength(1);
      // La marca cuelga de la entrada del servicio, no de la de la persona.
      expect(marcas[0].closest('[data-variant="identidad-automatica"]')).not.toBeNull();

      // El feed va en orden ascendente por createdAt: el comentario del servicio va primero.
      const texto = container.textContent ?? '';
      expect(texto.indexOf('Conector Portal')).toBeLessThan(texto.indexOf('Juan'));
    });

    it('TS-26: una entrada sin identityType no lleva marca y conserva las iniciales', () => {
      const { container } = render(
        <ActivityPanel
          activities={[
            buildActivity({
              typeOfActivity: 'comment',
              newValue: 'sincronizado desde el portal',
              user: { id: 'u-svc', name: 'Conector Portal', email: 'conector@grava.io' },
            }),
          ]}
        />
      );
      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
      expect(screen.getByText('CP')).toBeInTheDocument();
      expect(container.querySelector('[data-variant="persona"]')).toHaveClass(styles.comment);
    });

    it('TS-27: el fallback "Usuario" de autor ausente no gana marca', () => {
      render(
        <ActivityPanel
          activities={[buildActivity({ typeOfActivity: 'comment', newValue: 'texto', user: null })]}
        />
      );
      expect(screen.getByText('Usuario')).toBeInTheDocument();
      // getInitials('Usuario') da una sola letra, no dos.
      expect(screen.getByText('U')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('TS-28: un feed vacío no se rompe ni muestra marca', () => {
      render(<ActivityPanel activities={[]} />);
      expect(screen.getByText('No hay actividad registrada')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });
  });
});
