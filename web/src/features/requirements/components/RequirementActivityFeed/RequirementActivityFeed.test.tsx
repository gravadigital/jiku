import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RequirementActivityFeed } from './RequirementActivityFeed';
import type { RequirementActivity } from '../../types/requirement.types';

vi.mock('@/shared/utils/calculate-time-since', () => ({
  calculateTimeSince: () => '5 minutos',
}));

vi.mock('@/features/attachments/components/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => (
    <div data-testid="markdown-viewer">{content}</div>
  ),
}));

const publicEntry: RequirementActivity = {
  id: 1,
  typeOfActivity: 'comment',
  previousValue: null,
  newValue: 'hola',
  visibilityLevel: 'public',
  changedBy: 'u-ivan',
  changedByUser: { id: 'u-ivan', name: 'Iván Rodríguez', email: 'ivan@grava.io' },
  createdAt: '2026-06-01T10:00:00Z',
};

const internalEntry: RequirementActivity = {
  id: 2,
  typeOfActivity: 'comment',
  previousValue: null,
  newValue: 'nota interna',
  visibilityLevel: 'internal',
  changedBy: 'u-pedro',
  changedByUser: { id: 'u-pedro', name: 'Pedro López', email: 'pedro@grava.io' },
  createdAt: '2026-06-01T11:00:00Z',
};

const resolutionEntry: RequirementActivity = {
  id: 3,
  typeOfActivity: 'resolution',
  previousValue: '',
  newValue: 'El cliente confirmó el error',
  visibilityLevel: 'internal',
  changedBy: 'u-ivan',
  changedByUser: { id: 'u-ivan', name: 'Iván Rodríguez', email: 'ivan@grava.io' },
  createdAt: '2026-06-01T12:00:00Z',
};

const stateEntry: RequirementActivity = {
  id: 4,
  typeOfActivity: 'state',
  previousValue: 'analisis',
  newValue: 'desarrollo',
  visibilityLevel: 'internal',
  changedBy: 'u-ana',
  changedByUser: { id: 'u-ana', name: 'Ana Pérez', email: 'ana@grava.io' },
  createdAt: '2026-06-01T13:00:00Z',
};

describe('RequirementActivityFeed', () => {
  it('muestra mensaje vacío cuando no hay actividad', () => {
    render(<RequirementActivityFeed activity={[]} />);

    expect(screen.getByText('Sin actividad registrada')).toBeInTheDocument();
  });

  it('muestra entradas public e internal', () => {
    render(<RequirementActivityFeed activity={[publicEntry, internalEntry]} />);

    expect(screen.getByText('hola')).toBeInTheDocument();
    expect(screen.getByText('nota interna')).toBeInTheDocument();
  });

  it('muestra badge de visibilidad para entradas public', () => {
    render(<RequirementActivityFeed activity={[publicEntry]} />);

    expect(screen.getByText('Público')).toBeInTheDocument();
  });

  it('muestra badge de visibilidad para entradas internal', () => {
    render(<RequirementActivityFeed activity={[internalEntry]} />);

    expect(screen.getByText('Interno')).toBeInTheDocument();
  });

  // AC-2 / TS-3: autor visible por nombre, no por ID
  it('AC-2: muestra el nombre del autor (changedByUser.name), no el id crudo', () => {
    render(<RequirementActivityFeed activity={[publicEntry]} />);

    expect(screen.getByText('Iván Rodríguez')).toBeInTheDocument();
    expect(screen.queryByText('u-ivan')).not.toBeInTheDocument();
    expect(screen.getByText('hace 5 minutos')).toBeInTheDocument();
  });

  // AC-2 / TS-3: cambio de estado también muestra el nombre del actor
  it('TS-3 (AC-2): cambio de estado muestra "Ana Pérez cambió el estado de Análisis a Desarrollo"', () => {
    render(<RequirementActivityFeed activity={[stateEntry]} />);

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Análisis')).toBeInTheDocument();
    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
    expect(screen.queryByText('u-ana')).not.toBeInTheDocument();
  });

  it('muestra el label humanizado del estado para todos los valores del enum', () => {
    const cases: Array<[string, string]> = [
      ['analisis', 'Análisis'],
      ['planificacion', 'Planificación'],
      ['desarrollo', 'Desarrollo'],
      ['revision', 'Revisión'],
      ['resuelto', 'Resuelto'],
      ['cancelado', 'Cancelado'],
    ];

    cases.forEach(([value, label]) => {
      const entry: RequirementActivity = { ...stateEntry, previousValue: null, newValue: value };
      const { unmount } = render(<RequirementActivityFeed activity={[entry]} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });

  it('avatar usa las iniciales de changedByUser.name', () => {
    render(<RequirementActivityFeed activity={[publicEntry]} />);

    expect(screen.getByText('IR')).toBeInTheDocument();
  });

  it('TS-7 (parcial): entrada de tipo resolution muestra el texto del comentario', () => {
    render(<RequirementActivityFeed activity={[resolutionEntry]} />);

    expect(screen.getByText('El cliente confirmó el error')).toBeInTheDocument();
    expect(screen.getByText(/agregó una resolución/i)).toBeInTheDocument();
    expect(screen.getByText('Iván Rodríguez')).toBeInTheDocument();
  });

  it('entrada de tipo resolution no muestra badge de visibilidad', () => {
    render(<RequirementActivityFeed activity={[resolutionEntry]} />);

    expect(screen.queryByText('Interno')).not.toBeInTheDocument();
    expect(screen.queryByText('Público')).not.toBeInTheDocument();
  });

  // AC-5 / TS-5, TS-6: comentarios se renderizan con MarkdownViewer (placeholders de adjuntos)
  it('TS-5 (AC-5): comentario con placeholder de imagen se renderiza vía MarkdownViewer', () => {
    const entryWithImage: RequirementActivity = {
      ...publicEntry,
      newValue: 'Mirá esto\n![attach:99]',
    };
    render(<RequirementActivityFeed activity={[entryWithImage]} />);

    const viewer = screen.getByTestId('markdown-viewer');
    expect(viewer).toBeInTheDocument();
    expect(viewer).toHaveTextContent('Mirá esto');
    expect(viewer).toHaveTextContent('![attach:99]');
  });

  it('TS-6 (AC-5): comentario con placeholder de archivo se renderiza vía MarkdownViewer', () => {
    const entryWithFile: RequirementActivity = {
      ...publicEntry,
      newValue: 'Ver adjunto\n[attach:100]',
    };
    render(<RequirementActivityFeed activity={[entryWithFile]} />);

    const viewer = screen.getByTestId('markdown-viewer');
    expect(viewer).toHaveTextContent('Ver adjunto');
    expect(viewer).toHaveTextContent('[attach:100]');
  });

  it('comentario sin placeholders también se renderiza vía MarkdownViewer', () => {
    render(<RequirementActivityFeed activity={[publicEntry]} />);

    expect(screen.getByTestId('markdown-viewer')).toHaveTextContent('hola');
  });

  it('degrada a changedBy sin romper si changedByUser no viene en la respuesta', () => {
    const entryWithoutUser = {
      ...publicEntry,
      changedByUser: undefined,
    } as unknown as RequirementActivity;

    expect(() => render(<RequirementActivityFeed activity={[entryWithoutUser]} />)).not.toThrow();
    expect(screen.getByText('u-ivan')).toBeInTheDocument();
  });

  it('usa el verbo "cambió" (no "actualizó") para cambios de campos genéricos', () => {
    const entry: RequirementActivity = {
      ...stateEntry,
      typeOfActivity: 'title',
      previousValue: 'Título viejo',
      newValue: 'Título nuevo',
    };
    render(<RequirementActivityFeed activity={[entry]} />);

    expect(screen.getByText(/cambió/)).toBeInTheDocument();
    expect(screen.queryByText(/actualizó/)).not.toBeInTheDocument();
  });

  it('muestra el label humanizado del campo (Título) en vez del nombre crudo (title)', () => {
    const entry: RequirementActivity = {
      ...stateEntry,
      typeOfActivity: 'title',
      previousValue: 'Antes',
      newValue: 'Después',
    };
    render(<RequirementActivityFeed activity={[entry]} />);

    const text = document.querySelector('[class*="text"]');
    expect(text).toHaveTextContent('cambió Título de Antes a Después');
    expect(text?.textContent).not.toMatch(/\btitle\b/);
  });

  it('cambio de title muestra valor anterior y valor nuevo', () => {
    const entry: RequirementActivity = {
      ...stateEntry,
      typeOfActivity: 'title',
      previousValue: 'Título viejo',
      newValue: 'Título nuevo',
    };
    render(<RequirementActivityFeed activity={[entry]} />);

    expect(screen.getByText('Título viejo')).toBeInTheDocument();
    expect(screen.getByText('Título nuevo')).toBeInTheDocument();
  });

  it('cambio de description NO muestra valor anterior/nuevo (contenido largo)', () => {
    const entry: RequirementActivity = {
      ...stateEntry,
      typeOfActivity: 'description',
      previousValue: 'Descripción vieja muy larga',
      newValue: 'Descripción nueva muy larga',
    };
    render(<RequirementActivityFeed activity={[entry]} />);

    expect(screen.getByText(/Descripción/)).toBeInTheDocument();
    expect(screen.queryByText('Descripción vieja muy larga')).not.toBeInTheDocument();
    expect(screen.queryByText('Descripción nueva muy larga')).not.toBeInTheDocument();
  });

  it('cambio de type muestra el label humanizado del valor (Funcionalidad), no el enum crudo', () => {
    const entry: RequirementActivity = {
      ...stateEntry,
      typeOfActivity: 'type',
      previousValue: 'mejora',
      newValue: 'funcionalidad',
    };
    render(<RequirementActivityFeed activity={[entry]} />);

    expect(screen.getByText('Mejora')).toBeInTheDocument();
    expect(screen.getByText('Funcionalidad')).toBeInTheDocument();
    expect(screen.queryByText('mejora')).not.toBeInTheDocument();
    expect(screen.queryByText('funcionalidad')).not.toBeInTheDocument();
  });

  it('cambio de priority muestra el label humanizado del valor (Alta), no el enum crudo', () => {
    const entry: RequirementActivity = {
      ...stateEntry,
      typeOfActivity: 'priority',
      previousValue: 'media',
      newValue: 'alta',
    };
    render(<RequirementActivityFeed activity={[entry]} />);

    expect(screen.getByText('Media')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('resalta el valor nuevo con la clase newValue en un cambio genérico', () => {
    const entry: RequirementActivity = {
      ...stateEntry,
      typeOfActivity: 'title',
      previousValue: 'Antes',
      newValue: 'Después',
    };
    render(<RequirementActivityFeed activity={[entry]} />);

    expect(screen.getByText('Después').className).toMatch(/newValue/);
    expect(screen.getByText('Antes').className).not.toMatch(/newValue/);
  });

  it('resalta el valor nuevo con la clase newValue en un cambio de estado', () => {
    render(<RequirementActivityFeed activity={[stateEntry]} />);

    expect(screen.getByText('Desarrollo').className).toMatch(/newValue/);
    expect(screen.getByText('Análisis').className).not.toMatch(/newValue/);
  });

  it('ordena las entradas cronológicamente (más antigua primero), sin importar el orden recibido', () => {
    render(
      <RequirementActivityFeed
        activity={[stateEntry, publicEntry, resolutionEntry, internalEntry]}
      />
    );

    const texts = screen
      .getAllByText(/cambió el estado|comentó|agregó una resolución/)
      .map((el) => el.textContent);
    expect(texts).toEqual([
      expect.stringContaining('Iván Rodríguez'),
      expect.stringContaining('Pedro López'),
      expect.stringContaining('Iván Rodríguez'),
      expect.stringContaining('Ana Pérez'),
    ]);
  });
});
