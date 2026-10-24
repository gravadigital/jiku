import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownViewer } from './MarkdownViewer';

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6D1';
const OWN = `/docs/attachments/${ID}`;

const renderDoc = (content: string) => render(<MarkdownViewer mode="document" content={content} />);

describe('MarkdownViewer mode="document"', () => {
  it('TS-32: no ejecuta script ni deja atributos on*', () => {
    const { container } = renderDoc(
      'Hola\n\n<script>window.__xss = 1</script>\n\n<img src="x" onerror="window.__xss = 2">'
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it('TS-33: elimina enlaces javascript:', () => {
    const { container } = renderDoc(
      '[a](javascript:alert(1)) [b](JavaScript:alert(1)) [c](  javascript:alert(1))'
    );
    for (const a of Array.from(container.querySelectorAll('a[href]'))) {
      expect(a.getAttribute('href')!.trim().toLowerCase().startsWith('javascript:')).toBe(false);
    }
  });

  it('TS-35: imágenes adjuntas relativa y absoluta apuntan al propio origen', () => {
    renderDoc(`![diagrama](${OWN})\n\n![b](https://jiku.example.com${OWN})`);
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('src', OWN);
    expect(imgs[0]).toHaveAttribute('alt', 'diagrama');
    expect(imgs[1]).toHaveAttribute('src', OWN);
    expect(imgs[1]).toHaveAttribute('alt', 'b');
  });

  it('TS-36: el enlace a un adjunto abre en pestaña nueva', () => {
    renderDoc(`[export.csv](${OWN})`);
    const link = screen.getByRole('link', { name: 'export.csv' });
    expect(link).toHaveAttribute('href', OWN);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('TS-37: desplaza los títulos un nivel', () => {
    const { container } = renderDoc('# Uno\n\n## Dos\n\n###### Seis');
    expect(screen.getByRole('heading', { level: 2, name: 'Uno' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Dos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'Seis' })).toBeInTheDocument();
    expect(container.querySelector('h1')).toBeNull();
  });

  it('TS-38: ignora saltos simples y placeholders de Jiku', () => {
    const { container } = renderDoc('línea 1\nlínea 2\n\n[file:3]');
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent('línea 1 línea 2');
    expect(container.querySelector('br')).toBeNull();
    expect(paragraphs[1].textContent).toBe('[file:3]');
  });

  it('renderiza tablas GFM', () => {
    renderDoc('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
