import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkdownViewer } from './MarkdownViewer';

const scssContent = fs.readFileSync(
  path.resolve(__dirname, './MarkdownViewer.module.scss'),
  'utf8'
);

// Extrae el bloque `{ ... }` de un selector contando llaves balanceadas, en vez de un regex
// `[^}]*` que corta en el primer `}` de un selector anidado (ej. `h1, h2 { ... }` dentro de `.viewer`).
function extractBlock(source: string, selectorPattern: RegExp): string {
  const match = source.match(selectorPattern);
  if (!match || match.index === undefined) return '';
  const openBraceIndex = source.indexOf('{', match.index);
  if (openBraceIndex === -1) return '';
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openBraceIndex, i + 1);
    }
  }
  return '';
}

vi.mock('./AttachmentPlaceholder', () => ({
  AttachmentPlaceholder: ({
    attachmentId,
    fileName,
  }: {
    attachmentId: number;
    fileName?: string;
  }) => (
    <span data-testid={`attachment-placeholder-${attachmentId}`}>
      AttachmentPlaceholder:{attachmentId}:{fileName ?? ''}
    </span>
  ),
}));

vi.mock('./AttachmentImagePreview', () => ({
  AttachmentImagePreview: ({
    attachmentId,
    fileName,
  }: {
    attachmentId: number;
    fileName?: string;
  }) => (
    <span data-testid={`attachment-image-preview-${attachmentId}`}>
      AttachmentImagePreview:{attachmentId}:{fileName ?? ''}
    </span>
  ),
}));

describe('MarkdownViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza un heading h1', () => {
    render(<MarkdownViewer content="# Título" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Título');
  });

  it('renderiza negrita', () => {
    render(<MarkdownViewer content="**negrita**" />);
    const strong = document.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('negrita');
  });

  it('renderiza una lista', () => {
    render(<MarkdownViewer content={'- item 1\n- item 2'} />);
    const list = document.querySelector('ul');
    expect(list).toBeInTheDocument();
  });

  it('un salto de línea simple entre renglones se renderiza como <br>, no como espacio (S-086)', () => {
    render(<MarkdownViewer content={'Primera línea\nSegunda línea'} />);

    const paragraph = document.querySelector('p')!;
    expect(paragraph.querySelector('br')).toBeInTheDocument();
    expect(paragraph).toHaveTextContent('Primera línea');
    expect(paragraph).toHaveTextContent('Segunda línea');
  });

  it('una línea en blanco entre bloques se renderiza como un elemento espaciador propio, no como margin-bottom fijo (S-086)', () => {
    render(<MarkdownViewer content={'Primer bloque\n\nSegundo bloque'} />);

    const paragraphs = document.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent('Primer bloque');
    expect(paragraphs[1]).toHaveTextContent('Segundo bloque');

    const spacers = document.querySelectorAll('[data-testid="blank-line"]');
    expect(spacers).toHaveLength(1);
  });

  it('dos líneas en blanco consecutivas agregan exactamente dos elementos espaciadores (S-086)', () => {
    render(<MarkdownViewer content={'Primer bloque\n\n\nSegundo bloque'} />);

    const spacers = document.querySelectorAll('[data-testid="blank-line"]');
    expect(spacers).toHaveLength(2);

    const paragraphs = document.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent('Primer bloque');
    expect(paragraphs[1]).toHaveTextContent('Segundo bloque');
  });

  it('sin líneas en blanco, solo un salto simple entre renglones, agrega un único <br> (S-086)', () => {
    render(<MarkdownViewer content={'Primer renglón\nSegundo renglón'} />);

    const paragraphs = document.querySelectorAll('p');
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].querySelectorAll('br')).toHaveLength(1);
  });

  it('el código inline usa la clase del módulo con la tipografía base, no un tamaño reducido (S-086)', () => {
    // El tamaño real (14px, var(--font-size-base)) vive en MarkdownViewer.module.scss —
    // jsdom no computa CSS Modules, así que acá solo se valida que el <code> queda dentro
    // del contenedor con esa clase (verificación visual real: revisión manual/e2e).
    render(<MarkdownViewer content="`código inline`" />);
    const code = document.querySelector('code')!;
    expect(code.closest('[class*="viewer"]')).toBeInTheDocument();
  });

  describe('imágenes', () => {
    it('renderiza AttachmentImagePreview para placeholder legacy ![img:N]', () => {
      render(<MarkdownViewer content="Texto ![img:123] más" />);
      expect(screen.getByTestId('attachment-image-preview-123')).toBeInTheDocument();
    });

    it('renderiza AttachmentImagePreview para placeholder opus ![attach:N]', () => {
      render(<MarkdownViewer content="Texto ![attach:42]" />);
      expect(screen.getByTestId('attachment-image-preview-42')).toBeInTheDocument();
    });

    it('renderiza AttachmentImagePreview para link markdown de imagen del gestor', () => {
      render(<MarkdownViewer content="![foto.jpg](/api/attachments/7/preview)" />);
      const el = screen.getByTestId('attachment-image-preview-7');
      expect(el).toBeInTheDocument();
      expect(el).toHaveTextContent('foto.jpg');
    });

    it('renderiza múltiples placeholders de imagen', () => {
      render(
        <MarkdownViewer content="![img:1] y ![attach:2] y ![imagen.png](/api/attachments/3/preview)" />
      );
      expect(screen.getByTestId('attachment-image-preview-1')).toBeInTheDocument();
      expect(screen.getByTestId('attachment-image-preview-2')).toBeInTheDocument();
      expect(screen.getByTestId('attachment-image-preview-3')).toBeInTheDocument();
    });
  });

  describe('archivos', () => {
    it('renderiza AttachmentPlaceholder para placeholder opus [attach:N]', () => {
      render(<MarkdownViewer content="ver [attach:55]" />);
      expect(screen.getByTestId('attachment-placeholder-55')).toBeInTheDocument();
    });

    it('renderiza AttachmentPlaceholder para link markdown del gestor (no-imagen)', () => {
      render(<MarkdownViewer content="[reporte.pdf](/api/attachments/9/preview)" />);
      const el = screen.getByTestId('attachment-placeholder-9');
      expect(el).toBeInTheDocument();
      expect(el).toHaveTextContent('reporte.pdf');
    });

    it('maneja imagen y archivo opus en el mismo contenido sin confundirlos', () => {
      render(<MarkdownViewer content="![attach:1] y [attach:2]" />);
      expect(screen.getByTestId('attachment-image-preview-1')).toBeInTheDocument();
      expect(screen.getByTestId('attachment-placeholder-2')).toBeInTheDocument();
    });
  });

  describe('links externos', () => {
    it('renderiza un link externo normal como <a>', () => {
      render(<MarkdownViewer content="[Google](https://google.com)" />);
      const link = screen.getByRole('link', { name: 'Google' });
      expect(link).toHaveAttribute('href', 'https://google.com');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  it('no ejecuta HTML malicioso (XSS)', () => {
    render(<MarkdownViewer content="<script>alert('xss')</script>" />);
    const scripts = document.querySelectorAll('script');
    expect(scripts).toHaveLength(0);
  });

  it('maneja contenido vacío sin errores', () => {
    expect(() => {
      render(<MarkdownViewer content="" />);
    }).not.toThrow();
  });

  it('texto sin placeholders se renderiza sin cambios en contenido', () => {
    render(<MarkdownViewer content="Texto normal sin imágenes" />);
    expect(screen.getByText('Texto normal sin imágenes')).toBeInTheDocument();
  });

  it('renderiza escenario mixto: imágenes + archivos + texto', () => {
    const content =
      'Adjunto un archivo ![attach:10] y un PDF [attach:20], también [otro.doc](/api/attachments/30/preview)';
    render(<MarkdownViewer content={content} />);
    expect(screen.getByTestId('attachment-image-preview-10')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-placeholder-20')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-placeholder-30')).toBeInTheDocument();
  });

  // S-089 (CA-4/CA-5, TS-6/TS-7): el contenedor .viewer tiene overflow-x: auto y max-width: 100%.
  // Este único cambio en el componente base cubre tanto la Card Contexto (RequirementDetail)
  // como el modo Vista previa de la Card Estado (MarkdownEditorWithPreview), que reusan
  // MarkdownViewer sin duplicar la regla — no se puede verificar con getComputedStyle en jsdom
  // porque el SCSS no se inyecta en los tests, por eso se verifica sobre el archivo fuente.
  it('S-089 TS-6/TS-7: .viewer define overflow-x: auto y max-width: 100%', () => {
    const viewerBlock = extractBlock(scssContent, /\.viewer\s*{/);
    expect(viewerBlock).not.toBe('');
    expect(viewerBlock).toMatch(/overflow-x:\s*auto/);
    expect(viewerBlock).toMatch(/max-width:\s*100%/);
  });

  // S-089 (CA-4, TS-8, no-regresión): el overflow-x propio de los bloques de código (pre) no se rompe
  it('S-089 TS-8 (no-regresión): la regla overflow-x: auto de "pre" (bloques de código) sigue presente', () => {
    const preBlock = extractBlock(scssContent, /\bpre\s*{/);
    expect(preBlock).not.toBe('');
    expect(preBlock).toMatch(/overflow-x:\s*auto/);
  });
});
