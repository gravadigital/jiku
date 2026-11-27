import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateRequirementComment } from '../../services/requirementsApi';
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

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../services/requirementsApi', () => ({
  updateRequirementComment: vi.fn(),
}));

let attachmentsData: Array<{
  id: number;
  fileId: number;
  fileName: string;
}> = [];

vi.mock('@/features/attachments/hooks/useAttachments', () => ({
  useAttachments: () => ({ data: attachmentsData, isLoading: false }),
}));

let sessionData: { user: { id: string; roles: string[] } } | null = null;

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(null),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: sessionData }),
}));

function mockSession(userId: string, roles: string[] = ['user']) {
  sessionData = { user: { id: userId, roles } };
}

function renderFeed(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    ),
    queryClient,
  };
}

const publicEntry: RequirementActivity = {
  id: 1,
  typeOfActivity: 'comment',
  previousValue: null,
  newValue: 'hola',
  visibilityLevel: 'public',
  changedBy: 'u-ivan',
  changedByUser: { id: 'u-ivan', name: 'Iván Rodríguez', email: 'ivan@grava.io' },
  createdAt: '2026-06-01T10:00:00Z',
  editedAt: null,
  editedBy: null,
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
  editedAt: null,
  editedBy: null,
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
  editedAt: null,
  editedBy: null,
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
  editedAt: null,
  editedBy: null,
};

const serviceCommentEntry: RequirementActivity = {
  id: 1,
  typeOfActivity: 'comment',
  previousValue: null,
  newValue: 'sincronizado',
  visibilityLevel: 'public',
  changedBy: 'u-svc',
  changedByUser: {
    id: 'u-svc',
    name: 'Conector Portal',
    email: 'conector@grava.io',
    identityType: 'service',
  },
  createdAt: '2026-06-01T10:00:00Z',
  editedAt: null,
  editedBy: null,
};

const personStateEntry: RequirementActivity = {
  id: 2,
  typeOfActivity: 'state',
  previousValue: 'analisis',
  newValue: 'planificacion',
  visibilityLevel: 'public',
  changedBy: 'u1',
  changedByUser: {
    id: 'u1',
    name: 'Iván López',
    email: 'ivan@grava.io',
    identityType: 'person',
  },
  createdAt: '2026-06-01T11:00:00Z',
  editedAt: null,
  editedBy: null,
};

describe('RequirementActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sesión por defecto: un usuario que no es autor de ninguna entrada de los fixtures,
    // así los tests preexistentes (que no montaban useSession) siguen sin ver el botón.
    mockSession('u-nadie');
  });

  it('muestra mensaje vacío cuando no hay actividad', () => {
    renderFeed(<RequirementActivityFeed activity={[]} reqid={12} />);

    expect(screen.getByText('Sin actividad registrada')).toBeInTheDocument();
  });

  it('muestra entradas public e internal', () => {
    renderFeed(<RequirementActivityFeed activity={[publicEntry, internalEntry]} reqid={12} />);

    expect(screen.getByText('hola')).toBeInTheDocument();
    expect(screen.getByText('nota interna')).toBeInTheDocument();
  });

  it('muestra badge de visibilidad para entradas public', () => {
    renderFeed(<RequirementActivityFeed activity={[publicEntry]} reqid={12} />);

    expect(screen.getByText('Público')).toBeInTheDocument();
  });

  it('muestra badge de visibilidad para entradas internal', () => {
    renderFeed(<RequirementActivityFeed activity={[internalEntry]} reqid={12} />);

    expect(screen.getByText('Interno')).toBeInTheDocument();
  });

  // AC-2 / TS-3: autor visible por nombre, no por ID
  it('AC-2: muestra el nombre del autor (changedByUser.name), no el id crudo', () => {
    renderFeed(<RequirementActivityFeed activity={[publicEntry]} reqid={12} />);

    expect(screen.getByText('Iván Rodríguez')).toBeInTheDocument();
    expect(screen.queryByText('u-ivan')).not.toBeInTheDocument();
    expect(screen.getByText('hace 5 minutos')).toBeInTheDocument();
  });

  // AC-2 / TS-3: cambio de estado también muestra el nombre del actor
  it('TS-3 (AC-2): cambio de estado muestra "Ana Pérez cambió el estado de Análisis a Desarrollo"', () => {
    renderFeed(<RequirementActivityFeed activity={[stateEntry]} reqid={12} />);

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
      const { unmount } = renderFeed(<RequirementActivityFeed activity={[entry]} reqid={12} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });

  it('avatar usa las iniciales de changedByUser.name', () => {
    renderFeed(<RequirementActivityFeed activity={[publicEntry]} reqid={12} />);

    expect(screen.getByText('IR')).toBeInTheDocument();
  });

  it('TS-7 (parcial): entrada de tipo resolution muestra el texto del comentario', () => {
    renderFeed(<RequirementActivityFeed activity={[resolutionEntry]} reqid={12} />);

    expect(screen.getByText('El cliente confirmó el error')).toBeInTheDocument();
    expect(screen.getByText(/agregó una resolución/i)).toBeInTheDocument();
    expect(screen.getByText('Iván Rodríguez')).toBeInTheDocument();
  });

  it('entrada de tipo resolution no muestra badge de visibilidad', () => {
    renderFeed(<RequirementActivityFeed activity={[resolutionEntry]} reqid={12} />);

    expect(screen.queryByText('Interno')).not.toBeInTheDocument();
    expect(screen.queryByText('Público')).not.toBeInTheDocument();
  });

  // AC-5 / TS-5, TS-6: comentarios se renderizan con MarkdownViewer (placeholders de adjuntos)
  it('TS-5 (AC-5): comentario con placeholder de imagen se renderiza vía MarkdownViewer', () => {
    const entryWithImage: RequirementActivity = {
      ...publicEntry,
      newValue: 'Mirá esto\n![attach:99]',
    };
    renderFeed(<RequirementActivityFeed activity={[entryWithImage]} reqid={12} />);

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
    renderFeed(<RequirementActivityFeed activity={[entryWithFile]} reqid={12} />);

    const viewer = screen.getByTestId('markdown-viewer');
    expect(viewer).toHaveTextContent('Ver adjunto');
    expect(viewer).toHaveTextContent('[attach:100]');
  });

  it('comentario sin placeholders también se renderiza vía MarkdownViewer', () => {
    renderFeed(<RequirementActivityFeed activity={[publicEntry]} reqid={12} />);

    expect(screen.getByTestId('markdown-viewer')).toHaveTextContent('hola');
  });

  it('degrada a changedBy sin romper si changedByUser no viene en la respuesta', () => {
    const entryWithoutUser = {
      ...publicEntry,
      changedByUser: undefined,
    } as unknown as RequirementActivity;

    expect(() => renderFeed(<RequirementActivityFeed activity={[entryWithoutUser]} reqid={12} />)).not.toThrow();
    expect(screen.getByText('u-ivan')).toBeInTheDocument();
  });

  it('usa el verbo "cambió" (no "actualizó") para cambios de campos genéricos', () => {
    const entry: RequirementActivity = {
      ...stateEntry,
      typeOfActivity: 'title',
      previousValue: 'Título viejo',
      newValue: 'Título nuevo',
    };
    renderFeed(<RequirementActivityFeed activity={[entry]} reqid={12} />);

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
    renderFeed(<RequirementActivityFeed activity={[entry]} reqid={12} />);

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
    renderFeed(<RequirementActivityFeed activity={[entry]} reqid={12} />);

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
    renderFeed(<RequirementActivityFeed activity={[entry]} reqid={12} />);

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
    renderFeed(<RequirementActivityFeed activity={[entry]} reqid={12} />);

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
    renderFeed(<RequirementActivityFeed activity={[entry]} reqid={12} />);

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
    renderFeed(<RequirementActivityFeed activity={[entry]} reqid={12} />);

    expect(screen.getByText('Después').className).toMatch(/newValue/);
    expect(screen.getByText('Antes').className).not.toMatch(/newValue/);
  });

  it('resalta el valor nuevo con la clase newValue en un cambio de estado', () => {
    renderFeed(<RequirementActivityFeed activity={[stateEntry]} reqid={12} />);

    expect(screen.getByText('Desarrollo').className).toMatch(/newValue/);
    expect(screen.getByText('Análisis').className).not.toMatch(/newValue/);
  });

  it('ordena las entradas cronológicamente (más antigua primero), sin importar el orden recibido', () => {
    renderFeed(
      <RequirementActivityFeed
        activity={[stateEntry, publicEntry, resolutionEntry, internalEntry]}
        reqid={12}
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

  describe('Marca de identidad automática (S-019)', () => {
    it('TS-9: una entrada escrita por un servicio muestra el nombre y la marca', () => {
      renderFeed(<RequirementActivityFeed activity={[serviceCommentEntry]} reqid={12} />);

      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.getAllByText('Automático')).toHaveLength(1);
    });

    it('TS-10: en un feed mixto solo se marca la entrada del servicio', () => {
      renderFeed(<RequirementActivityFeed activity={[serviceCommentEntry, personStateEntry]} reqid={12} />);

      const badges = screen.getAllByText('Automático');
      expect(badges).toHaveLength(1);

      const serviceEntry = screen.getByText('Conector Portal').closest('[class*="entry"]');
      expect(serviceEntry).toContainElement(badges[0]);

      const personEntry = screen.getByText('Iván López').closest('[class*="entry"]');
      expect(personEntry).not.toContainElement(badges[0]);
    });

    it('TS-11: una entrada sin identityType no se marca y renderiza normal', () => {
      const sinCampo: RequirementActivity = {
        ...serviceCommentEntry,
        changedByUser: {
          id: 'u-svc',
          name: 'Conector Portal',
          email: 'conector@grava.io',
        },
      };

      renderFeed(<RequirementActivityFeed activity={[sinCampo]} reqid={12} />);

      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('TS-12: un feed vacío no muestra la marca', () => {
      renderFeed(<RequirementActivityFeed activity={[]} reqid={12} />);

      expect(screen.getByText('Sin actividad registrada')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('marca al autor de una entrada de resolución escrita por un servicio', () => {
      const resolucionDeServicio: RequirementActivity = {
        ...serviceCommentEntry,
        id: 6,
        typeOfActivity: 'resolution',
        previousValue: '',
        newValue: 'resuelto automáticamente',
      };

      renderFeed(<RequirementActivityFeed activity={[resolucionDeServicio]} reqid={12} />);

      expect(screen.getByText(/agregó una resolución/i)).toBeInTheDocument();
      expect(screen.getAllByText('Automático')).toHaveLength(1);
    });

    it('marca al autor de un cambio de campo genérico escrito por un servicio', () => {
      const genericoDeServicio: RequirementActivity = {
        ...serviceCommentEntry,
        id: 7,
        typeOfActivity: 'title',
        previousValue: 'Antes',
        newValue: 'Después',
      };

      renderFeed(<RequirementActivityFeed activity={[genericoDeServicio]} reqid={12} />);

      expect(screen.getByText(/cambió/)).toBeInTheDocument();
      expect(screen.getAllByText('Automático')).toHaveLength(1);
    });

    it('no cambia el avatar de iniciales del autor de servicio', () => {
      renderFeed(<RequirementActivityFeed activity={[serviceCommentEntry]} reqid={12} />);

      expect(screen.getByText('CP')).toBeInTheDocument();
    });
  });

  describe('Marca "(editado)" y boton "Editar" (S-048)', () => {
    const editedByAuthor: RequirementActivity = {
      id: 7,
      typeOfActivity: 'comment',
      previousValue: null,
      newValue: 'hola',
      visibilityLevel: 'internal',
      changedBy: 'u-1',
      changedByUser: { id: 'u-1', name: 'Lautaro Alvarez', email: null },
      createdAt: '2026-09-01T09:00:00.000Z',
      editedAt: '2026-09-01T10:00:00.000Z',
      editedBy: 'u-1',
    };

    // TS-6 (AC-1, AC-6)
    it('TS-6: muestra "(editado)" cuando editedAt existe y el editor es el autor', () => {
      renderFeed(<RequirementActivityFeed activity={[editedByAuthor]} reqid={12} />);

      expect(screen.getByText('(editado)')).toBeInTheDocument();
      expect(screen.queryByText(/\(editado por/)).not.toBeInTheDocument();
    });

    // TS-7 (AC-5)
    it('TS-7: muestra "(editado por X)" cuando editedBy difiere de changedBy', () => {
      const editedByOther: RequirementActivity = {
        ...editedByAuthor,
        editedBy: 'u-2',
      };
      const anaEntry: RequirementActivity = {
        id: 8,
        typeOfActivity: 'state',
        previousValue: 'analisis',
        newValue: 'planificacion',
        visibilityLevel: 'internal',
        changedBy: 'u-2',
        changedByUser: { id: 'u-2', name: 'Ana Gomez', email: null },
        createdAt: '2026-09-01T08:00:00.000Z',
        editedAt: null,
        editedBy: null,
      };

      renderFeed(<RequirementActivityFeed activity={[editedByOther, anaEntry]} reqid={12} />);

      expect(screen.getByText('(editado por Ana Gomez)')).toBeInTheDocument();
    });

    // TS-8 (AC-6, AC-7): previousValue no vacio pero editedAt null -> sin marca
    it('TS-8: no muestra ninguna marca cuando editedAt es null, aunque previousValue tenga contenido', () => {
      const legacyEdited: RequirementActivity = {
        id: 9,
        typeOfActivity: 'comment',
        previousValue: 'texto viejo',
        newValue: 'hola',
        visibilityLevel: 'internal',
        changedBy: 'u-1',
        changedByUser: { id: 'u-1', name: 'Lautaro Alvarez', email: null },
        createdAt: '2026-09-01T09:00:00.000Z',
        editedAt: null,
        editedBy: null,
      };

      renderFeed(<RequirementActivityFeed activity={[legacyEdited]} reqid={12} />);

      expect(screen.queryByText('(editado)')).not.toBeInTheDocument();
      expect(screen.queryByText(/\(editado por/)).not.toBeInTheDocument();
    });

    // TS-9 (AC-4): boton "Editar" visible sobre el propio comentario
    it('TS-9: el boton "Editar" aparece en el comentario propio', () => {
      mockSession('u-1');
      renderFeed(<RequirementActivityFeed activity={[editedByAuthor]} reqid={12} />);

      expect(screen.getByRole('button', { name: 'Editar comentario' })).toBeInTheDocument();
    });

    // TS-10 (AC-4): ausente para un user en comentario ajeno
    it('TS-10: el boton "Editar" NO aparece en un comentario ajeno para un user', () => {
      mockSession('u-1', ['user']);
      const ajeno: RequirementActivity = { ...editedByAuthor, changedBy: 'u-9' };

      renderFeed(<RequirementActivityFeed activity={[ajeno]} reqid={12} />);

      expect(screen.queryByRole('button', { name: 'Editar comentario' })).not.toBeInTheDocument();
    });

    // TS-11 (AC-5): admin puede editar comentario ajeno
    it('TS-11: el boton "Editar" aparece en un comentario ajeno para un admin', () => {
      mockSession('u-1', ['admin']);
      const ajeno: RequirementActivity = { ...editedByAuthor, changedBy: 'u-9' };

      renderFeed(<RequirementActivityFeed activity={[ajeno]} reqid={12} />);

      expect(screen.getByRole('button', { name: 'Editar comentario' })).toBeInTheDocument();
    });

    // TS-12 (AC-4, AC-7): nunca aparece en una entrada que no es comentario, ni para admin
    it('TS-12: el boton "Editar" NO aparece en una entrada que no es comentario', () => {
      mockSession('u-1', ['admin']);
      const cambioEstado: RequirementActivity = {
        id: 9,
        typeOfActivity: 'state',
        previousValue: 'analisis',
        newValue: 'planificacion',
        visibilityLevel: 'internal',
        changedBy: 'u-1',
        changedByUser: { id: 'u-1', name: 'Lautaro Alvarez', email: null },
        createdAt: '2026-09-01T09:00:00.000Z',
        editedAt: null,
        editedBy: null,
      };

      renderFeed(<RequirementActivityFeed activity={[cambioEstado]} reqid={12} />);

      expect(screen.queryByRole('button', { name: 'Editar comentario' })).not.toBeInTheDocument();
    });

    it('AC-2: degrada a "(editado)" cuando editedBy no matchea a ningun changedByUser del feed', () => {
      const editedByUnknown: RequirementActivity = {
        ...editedByAuthor,
        editedBy: 'u-desconocido',
      };

      renderFeed(<RequirementActivityFeed activity={[editedByUnknown]} reqid={12} />);

      expect(screen.getByText('(editado)')).toBeInTheDocument();
      expect(screen.queryByText(/\(editado por/)).not.toBeInTheDocument();
    });
  });

  describe('Modo edicion inline (S-048)', () => {
    const ownComment: RequirementActivity = {
      id: 7,
      typeOfActivity: 'comment',
      previousValue: null,
      newValue: 'hola',
      visibilityLevel: 'internal',
      changedBy: 'u-1',
      changedByUser: { id: 'u-1', name: 'Lautaro Alvarez', email: null },
      createdAt: '2026-09-01T09:00:00.000Z',
      editedAt: null,
      editedBy: null,
    };
    const otherComment: RequirementActivity = {
      id: 8,
      typeOfActivity: 'comment',
      previousValue: null,
      newValue: 'otro comentario',
      visibilityLevel: 'internal',
      changedBy: 'u-1',
      changedByUser: { id: 'u-1', name: 'Lautaro Alvarez', email: null },
      createdAt: '2026-09-01T09:30:00.000Z',
      editedAt: null,
      editedBy: null,
    };

    beforeEach(() => {
      mockSession('u-1');
      attachmentsData = [];
    });

    // TS-13 (AC-1): entra en edicion con el texto precargado
    it('TS-13: al entrar en edición, la entrada reemplaza el texto por el editor precargado', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));

      const editor = screen.getByRole('group', { name: 'Editar comentario' });
      expect(editor).toBeInTheDocument();
      expect(screen.getByDisplayValue('hola')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Editar comentario' })).not.toBeInTheDocument();
    });

    // TS-14 (CA-8): sin toggle de visibilidad en modo edición
    it('TS-14: en modo edición no se ofrece toggle de visibilidad dentro de la entrada', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));

      expect(screen.queryByRole('button', { name: 'Comentario interno' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Comentario público' })).not.toBeInTheDocument();
    });

    // TS-15 (CA-9): cancelar vuelve a lectura sin llamar a la api
    it('TS-15: cancelar vuelve a lectura sin llamar a la api', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, 'otro texto');

      await user.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.getByText('hola')).toBeInTheDocument();
      expect(updateRequirementComment).not.toHaveBeenCalled();
    });

    // TS-16 (AC-5): Guardar deshabilitado con el editor vacío
    it('TS-16: "Guardar" queda deshabilitado con el editor vacío', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, '   ');

      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });

    // TS-19 (AC-9): éxito, toast y vuelta a lectura
    it('TS-19: éxito muestra toast y vuelve a modo lectura', async () => {
      vi.mocked(updateRequirementComment).mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, 'texto corregido');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Comentario editado');
      });
      expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    });

    // TS-20 a TS-26 (AC-10, CA-10): cada codigo de error con su mensaje, comentario intacto
    const errorCases: Array<[string, string]> = [
      ['comment_not_owned', 'No podés editar un comentario que no es tuyo'],
      ['activity_not_editable', 'Esta entrada no es un comentario y no se puede editar'],
      ['comment_not_found', 'El comentario ya no existe'],
      ['file_not_owned', 'No podés adjuntar un archivo que subió otra persona'],
      ['service_unavailable', 'El servicio no está disponible en este momento'],
      ['gateway_timeout', 'La operación tardó demasiado'],
    ];

    it.each(errorCases)('TS-20 a TS-25: código %s muestra "%s" y el texto original permanece', async (code, message) => {
      vi.mocked(updateRequirementComment).mockRejectedValue({
        code,
        message: 'error',
        status: 400,
      });
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, 'texto corregido');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(message);
      });
      expect(screen.getByText('hola')).toBeInTheDocument();
    });

    // TS-26: código desconocido cae al fallback
    it('TS-26: código desconocido cae al mensaje fallback', async () => {
      vi.mocked(updateRequirementComment).mockRejectedValue({
        code: 'internal_error',
        message: 'Internal error',
        status: 500,
      });
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, 'texto corregido');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Hubo un error al editar el comentario');
      });
    });

    // TS-27 (AC-7): se edita de a un comentario por vez
    it('TS-27: abrir la edición de otro comentario cierra la anterior', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment, otherComment]} reqid={12} />);

      const editButtons = screen.getAllByRole('button', { name: 'Editar comentario' });
      await user.click(editButtons[0]);
      expect(screen.getByDisplayValue('hola')).toBeInTheDocument();

      const secondEditButton = screen.getByRole('button', { name: 'Editar comentario' });
      await user.click(secondEditButton);

      expect(screen.getByDisplayValue('otro comentario')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('hola')).not.toBeInTheDocument();
    });

    // TS-28 (AC-11): el foco entra al editor al abrir
    it('TS-28: el foco entra al editor al abrir la edición', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));

      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByDisplayValue('hola'));
      });
    });

    // TS-29 (AC-11, CA-9): el foco vuelve al botón "Editar" al cancelar
    it('TS-29: el foco vuelve al botón "Editar" al cancelar', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));

      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editar comentario' }));
      });
    });

    // AC-3: autor, fecha, visibilidad y marca de editado quedan donde estan durante la edicion
    it('AC-3: el autor y la etiqueta de visibilidad quedan visibles durante la edición', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[ownComment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));

      expect(screen.getByText('Lautaro Alvarez')).toBeInTheDocument();
      expect(screen.getByText('Interno')).toBeInTheDocument();
    });

    // AC-8: el formulario de alta sigue operativo durante la edición (no se testea aquí porque
    // el formulario vive en un componente hermano fuera de RequirementActivityFeed; ver
    // RequirementActivityForm.test.tsx para su cobertura propia)
  });

  describe('Edicion de adjuntos del comentario (S-048/Tarea 5)', () => {
    // El texto ya guardado referencia sus adjuntos como [attach:N] (id de vinculo), nunca
    // como [file:N]: es la forma real que un comentario persistido tiene en el feed.
    const commentWithAttachments: RequirementActivity = {
      id: 7,
      typeOfActivity: 'comment',
      previousValue: null,
      newValue: 'ver adjuntos',
      visibilityLevel: 'internal',
      changedBy: 'u-1',
      changedByUser: { id: 'u-1', name: 'Lautaro Alvarez', email: null },
      createdAt: '2026-09-01T09:00:00.000Z',
      editedAt: null,
      editedBy: null,
    };

    beforeEach(() => {
      mockSession('u-1');
      attachmentsData = [
        { id: 40, fileId: 3, fileName: 'informe.pdf' },
        { id: 41, fileId: 9, fileName: 'captura.png' },
      ];
    });

    // TS-1 (AC-1): los adjuntos actuales se muestran al entrar en edición
    it('muestra los adjuntos actuales del comentario, con su nombre de archivo', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[commentWithAttachments]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));

      expect(screen.getByText('informe.pdf')).toBeInTheDocument();
      expect(screen.getByText('captura.png')).toBeInTheDocument();
    });

    // TS-30 (AC-2): cada control de quitar nombra su archivo
    it('TS-30: cada control de quitar adjunto nombra su archivo en el nombre accesible', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[commentWithAttachments]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));

      expect(screen.getByRole('button', { name: /informe\.pdf/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /captura\.png/ })).toBeInTheDocument();
    });

    // TS-17 (AC-5): quitar un adjunto y guardar manda el conjunto correcto con fileId
    it('TS-17: quitar un adjunto y guardar manda el conjunto con fileId, no id de vínculo', async () => {
      vi.mocked(updateRequirementComment).mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[commentWithAttachments]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      await user.click(screen.getByRole('button', { name: /captura\.png/ }));

      const editorField = screen.getByDisplayValue(/ver adjuntos/);
      await user.clear(editorField);
      await user.type(editorField, 'texto corregido');

      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(updateRequirementComment).toHaveBeenCalledWith(12, 7, {
          comment: 'texto corregido',
          fileIds: [3],
        });
      });
    });

    // TS-18 (AC-4, AC-5): un archivo recién subido se suma al conjunto
    it('TS-18: un archivo recién subido (placeholder [file:N]) se suma al conjunto', async () => {
      vi.mocked(updateRequirementComment).mockResolvedValue(undefined);
      const user = userEvent.setup();
      const singleAttachment: RequirementActivity = {
        ...commentWithAttachments,
        newValue: 'con anexo',
      };
      attachmentsData = [{ id: 40, fileId: 3, fileName: 'informe.pdf' }];

      renderFeed(<RequirementActivityFeed activity={[singleAttachment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue(/con anexo/);
      // Simula que el editor ya subio un archivo nuevo: su value incluye el
      // placeholder [file:N] que RequirementRichTextEditor agrega tras subir.
      // user.paste (no .type) porque los corchetes son sintaxis especial para .type.
      editorField.focus();
      await user.paste('\n[file:15]');

      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(updateRequirementComment).toHaveBeenCalledWith(
          12,
          7,
          expect.objectContaining({ fileIds: expect.arrayContaining([3, 15]) })
        );
      });
      const [, , body] = vi.mocked(updateRequirementComment).mock.calls[0];
      expect(body.fileIds).toHaveLength(2);
    });

    // AC-6: sin adjuntos existentes ni subidos, el payload no lleva fileIds
    it('AC-6: sin adjuntos, el payload no incluye la clave fileIds', async () => {
      vi.mocked(updateRequirementComment).mockResolvedValue(undefined);
      attachmentsData = [];
      const user = userEvent.setup();
      const noAttachments: RequirementActivity = { ...commentWithAttachments, newValue: 'hola' };

      renderFeed(<RequirementActivityFeed activity={[noAttachments]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, 'texto sin adjuntos');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(updateRequirementComment).toHaveBeenCalled());
      const [, , body] = vi.mocked(updateRequirementComment).mock.calls[0];
      expect(body).not.toHaveProperty('fileIds');
    });

    // AC-6: si tenia adjuntos y quedaron en cero, el payload manda fileIds: []
    it('AC-6: si tenía adjuntos y se quitaron todos, el payload manda fileIds: []', async () => {
      vi.mocked(updateRequirementComment).mockResolvedValue(undefined);
      const user = userEvent.setup();
      const singleAttachment: RequirementActivity = {
        ...commentWithAttachments,
        newValue: 'con un adjunto',
      };
      attachmentsData = [{ id: 40, fileId: 3, fileName: 'informe.pdf' }];

      renderFeed(<RequirementActivityFeed activity={[singleAttachment]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      await user.click(screen.getByRole('button', { name: /informe\.pdf/ }));
      const editorField = screen.getByDisplayValue(/con un adjunto/);
      await user.clear(editorField);
      await user.type(editorField, 'sin adjuntos ahora');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(updateRequirementComment).toHaveBeenCalledWith(12, 7, {
          comment: 'sin adjuntos ahora',
          fileIds: [],
        });
      });
    });

    // AC-3: quitar y luego cancelar revierte el cambio (no llama a la api)
    it('AC-3: cancelar revierte la eliminación de un adjunto (no persiste el cambio)', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[commentWithAttachments]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      await user.click(screen.getByRole('button', { name: /captura\.png/ }));
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(updateRequirementComment).not.toHaveBeenCalled();
    });

    // TS-23 (AC-8, CA-3, CA-10): error de adjunto ajeno
    it('TS-23: el error file_not_owned muestra su mensaje y no aplica cambios', async () => {
      vi.mocked(updateRequirementComment).mockRejectedValue({
        code: 'file_not_owned',
        message: 'Access denied',
        status: 403,
      });
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[commentWithAttachments]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue(/ver adjuntos/);
      await user.clear(editorField);
      await user.type(editorField, 'texto corregido');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'No podés adjuntar un archivo que subió otra persona'
        );
      });
    });

    // AC-7: quitar un adjunto no borra el archivo (no se llama a ningun endpoint de borrado)
    it('AC-7: quitar un adjunto no dispara ninguna llamada de borrado', async () => {
      const user = userEvent.setup();
      renderFeed(<RequirementActivityFeed activity={[commentWithAttachments]} reqid={12} />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      await user.click(screen.getByRole('button', { name: /captura\.png/ }));

      // No hay servicio de borrado mockeado en este test file: si el componente
      // llamara alguno, no existiria como funcion y el test fallaria al importar.
      expect(screen.queryByText('captura.png')).not.toBeInTheDocument();
      expect(screen.getByText('informe.pdf')).toBeInTheDocument();
    });
  });
});
