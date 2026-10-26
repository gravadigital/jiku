import { describe, expect, it } from 'vitest';
import {
  buildNewDocumentContent,
  composeContent,
  normalizeTopic,
  parseContent,
  type ReadableContent,
} from './frontmatterDocument';

const CONTENT_RICH =
  '---\n' +
  'title: Arquitectura de videoconferencia # título visible\n' +
  '# notas del equipo\n' +
  'visibility: internal\n' +
  'topics: [video, arquitectura]\n' +
  'owner: ana\n' +
  'jiku:\n' +
  '  clients: [4]\n' +
  '  projects:\n' +
  '    - 12\n' +
  '    - 31\n' +
  '  requirements: [151]\n' +
  '  tasks: [7]\n' +
  '---\n' +
  '# Contexto\n\nTexto.\n';
const BODY_RICH = '# Contexto\n\nTexto.\n';
const CONTENT_BAD = '---\ntitle: [sin cerrar\n---\n# Cuerpo\n';
const CONTENT_NOFM = '# Solo cuerpo\n\nTexto.\n';

const readable = (content: string): ReadableContent => {
  const parsed = parseContent(content);
  if (!parsed.readable) throw new Error('unreadable');
  return parsed;
};

const RICH_PROPS = {
  title: 'Arquitectura de videoconferencia',
  visibility: 'internal' as const,
  topics: ['video', 'arquitectura'],
  clients: [4],
  projects: [12, 31],
};

describe('buildNewDocumentContent (TS-1, TS-2)', () => {
  it('arma el frontmatter completo', () => {
    expect(
      buildNewDocumentContent({
        title: 'Guía de despliegue',
        visibility: 'internal',
        topics: ['infra', 'accesos'],
        clients: [4],
        projects: [12],
        requirements: [],
        tasks: [],
      })
    ).toBe(
      '---\ntitle: Guía de despliegue\nvisibility: internal\ntopics: [infra, accesos]\njiku:\n  clients: [4]\n  projects: [12]\n---\n\n# Guía de despliegue\n'
    );
  });

  it('omite topics y jiku vacíos, cita títulos con dos puntos', () => {
    expect(
      buildNewDocumentContent({
        title: 'Plan: fase 2',
        visibility: 'public',
        topics: [],
        clients: [],
        projects: [],
        requirements: [],
        tasks: [],
      })
    ).toBe('---\ntitle: "Plan: fase 2"\nvisibility: public\n---\n\n# Plan: fase 2\n');
  });

  it('incluye el requisito precargado', () => {
    expect(
      buildNewDocumentContent({
        title: 'Notas',
        visibility: 'restricted',
        topics: [],
        clients: [4],
        projects: [12],
        requirements: [151],
        tasks: [],
      })
    ).toBe(
      '---\ntitle: Notas\nvisibility: restricted\njiku:\n  clients: [4]\n  projects: [12]\n  requirements: [151]\n---\n\n# Notas\n'
    );
  });
});

describe('parseContent (TS-3, TS-4)', () => {
  it('lee un frontmatter rico', () => {
    const parsed = parseContent(CONTENT_RICH);
    expect(parsed).toMatchObject({
      readable: true,
      body: BODY_RICH,
      values: {
        title: 'Arquitectura de videoconferencia',
        visibility: 'internal',
        topics: ['video', 'arquitectura'],
        clients: [4],
        projects: [12, 31],
        requirements: [151],
        tasks: [7],
      },
    });
  });

  it('sin frontmatter es legible', () => {
    expect(parseContent(CONTENT_NOFM)).toEqual({
      readable: true,
      frontmatter: null,
      raw: null,
      body: CONTENT_NOFM,
      values: {},
    });
  });

  it('bloque vacío y cierre con puntos', () => {
    expect(parseContent('---\n\n---\n# T\n')).toMatchObject({
      readable: true,
      values: {},
      body: '# T\n',
    });
    expect(parseContent('---\ntitle: X\n...\n# T\n')).toMatchObject({
      readable: true,
      values: { title: 'X' },
      body: '# T\n',
    });
  });

  it.each([
    CONTENT_BAD,
    '---\ntitle: a\ntitle: b\n---\n',
    '---\njust a string\n---\n',
    '---\nvisibility: secreto\n---\n',
    '---\ntopics: video\n---\n',
    '---\njiku:\n  projects: [abc]\n---\n',
    '---\njiku: 3\n---\n',
    '---\ntitle: X\n# sin cierre\n',
  ])('ilegible: %j', (content) => {
    expect(parseContent(content)).toEqual({ readable: false });
  });
});

describe('composeContent (TS-5 a TS-8)', () => {
  it('sin cambios conserva el bloque byte a byte', () => {
    const parsed = readable(CONTENT_RICH);
    expect(composeContent(parsed, RICH_PROPS, RICH_PROPS, BODY_RICH + 'Más.\n')).toBe(
      CONTENT_RICH + 'Más.\n'
    );
    const dots = readable('---\ntitle: X\n...\n# T\n');
    const props = {
      title: 'X',
      visibility: 'internal' as const,
      topics: [],
      clients: [],
      projects: [],
    };
    expect(composeContent(dots, props, props, '# T2\n')).toBe('---\ntitle: X\n...\n# T2\n');
  });

  it('cambia título, temas y proyectos conservando lo demás', () => {
    const parsed = readable(CONTENT_RICH);
    expect(
      composeContent(
        parsed,
        RICH_PROPS,
        { ...RICH_PROPS, title: 'Arquitectura v2', topics: ['video', 'infra'], projects: [40, 31] },
        BODY_RICH
      )
    ).toBe(
      '---\ntitle: Arquitectura v2 # título visible\n# notas del equipo\nvisibility: internal\ntopics: [video, infra]\nowner: ana\njiku:\n  clients: [4]\n  projects:\n    - 40\n    - 31\n  requirements: [151]\n  tasks: [7]\n---\n# Contexto\n\nTexto.\n'
    );
  });

  it('agrega claves ausentes', () => {
    const initial = {
      title: 'T',
      visibility: 'internal' as const,
      topics: [],
      clients: [],
      projects: [],
    };
    expect(
      composeContent(
        readable('---\nowner: ana\n---\n# T\n'),
        initial,
        { ...initial, visibility: 'public', projects: [12], clients: [4] },
        '# T\n'
      )
    ).toBe(
      '---\nowner: ana\nvisibility: public\njiku:\n  clients: [4]\n  projects: [12]\n---\n# T\n'
    );
    expect(
      composeContent(
        readable(CONTENT_NOFM),
        initial,
        { ...initial, topics: ['video'] },
        CONTENT_NOFM
      )
    ).toBe('---\ntopics: [video]\n---\n# Solo cuerpo\n\nTexto.\n');
  });

  it('vacía una lista existente', () => {
    const out = composeContent(
      readable(CONTENT_RICH),
      RICH_PROPS,
      { ...RICH_PROPS, projects: [], clients: [] },
      BODY_RICH
    );
    expect(out).toContain(
      'jiku:\n  clients: []\n  projects: []\n  requirements: [151]\n  tasks: [7]\n'
    );
  });
});

describe('normalizeTopic (TS-9)', () => {
  it.each([
    ['Video Llamadas', 'video-llamadas'],
    ['  Diseño/UX  ', 'diseno-ux'],
    ['--a--', 'a'],
    ['¡!', ''],
    ['infra', 'infra'],
  ])('%j -> %j', (input, output) => {
    expect(normalizeTopic(input)).toBe(output);
  });
});
