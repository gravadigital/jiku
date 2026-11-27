import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from '@/shared/components/ui/MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('renderiza texto plano correctamente', () => {
    render(<MarkdownRenderer content="Texto simple" />);
    expect(screen.getByText('Texto simple')).toBeInTheDocument();
  });

  it('renderiza negritas correctamente', () => {
    render(<MarkdownRenderer content="Texto **negrita** aquí" />);
    const boldElement = screen.getByText('negrita');
    expect(boldElement.tagName).toBe('STRONG');
  });

  it('renderiza cursivas correctamente', () => {
    render(<MarkdownRenderer content="Texto *cursiva* aquí" />);
    const italicElement = screen.getByText('cursiva');
    expect(italicElement.tagName).toBe('EM');
  });

  it('renderiza listas no ordenadas correctamente', () => {
    const content = `- Item 1
- Item 2
- Item 3`;
    render(<MarkdownRenderer content={content} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
  });

  it('renderiza listas ordenadas correctamente', () => {
    const content = `1. Primero
2. Segundo
3. Tercero`;
    render(<MarkdownRenderer content={content} />);
    expect(screen.getByText('Primero')).toBeInTheDocument();
    expect(screen.getByText('Segundo')).toBeInTheDocument();
    expect(screen.getByText('Tercero')).toBeInTheDocument();
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
  });

  it('renderiza headers de nivel 1 correctamente', () => {
    render(<MarkdownRenderer content="# Título H1" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Título H1');
  });

  it('renderiza headers de nivel 2 correctamente', () => {
    render(<MarkdownRenderer content="## Título H2" />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Título H2');
  });

  it('renderiza headers de nivel 3 correctamente', () => {
    render(<MarkdownRenderer content="### Título H3" />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Título H3');
  });

  it('renderiza código inline correctamente', () => {
    render(<MarkdownRenderer content="Usa `console.log()` para debug" />);
    const codeElement = screen.getByText('console.log()');
    expect(codeElement.tagName).toBe('CODE');
  });

  it('renderiza bloques de código multilinea correctamente', () => {
    const codeBlock = '```\nconst x = 1;\nconst y = 2;\n```';
    render(<MarkdownRenderer content={codeBlock} />);
    expect(screen.getByText(/const x = 1/)).toBeInTheDocument();
  });

  it('renderiza enlaces con target="_blank" y rel="noopener noreferrer"', () => {
    render(<MarkdownRenderer content="Visita [Google](https://google.com)" />);
    const link = screen.getByRole('link', { name: 'Google' });
    expect(link).toHaveAttribute('href', 'https://google.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('no rompe el componente con contenido vacío', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container).toBeInTheDocument();
  });

  it('renderiza contenido mal formateado sin errores', () => {
    const malformedContent = '**negrita sin cerrar\n*cursiva sin cerrar\n[link sin cerrar(';
    const { container } = render(<MarkdownRenderer content={malformedContent} />);
    expect(container).toBeInTheDocument();
  });

  it('acepta y aplica className personalizado', () => {
    const { container } = render(<MarkdownRenderer content="Contenido" className="custom-class" />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('renderiza múltiples elementos markdown combinados', () => {
    const content = `# Título

Este es un párrafo con **negrita** y *cursiva*.

- Item 1
- Item 2

Código: \`const x = 1\``;

    render(<MarkdownRenderer content={content} />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('negrita')).toBeInTheDocument();
    expect(screen.getByText('cursiva')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('const x = 1')).toBeInTheDocument();
  });
});
