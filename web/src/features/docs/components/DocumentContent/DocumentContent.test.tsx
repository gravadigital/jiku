import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentContent } from './DocumentContent';

const CONTENT_FM =
  '---\ntitle: Arquitectura\njiku:\n  projects: [12]\n---\n# Contexto\n\nTexto.\n\n## Decisiones\n\nMás texto.\n';

describe('DocumentContent', () => {
  it('TS-19: quita el frontmatter y pone anclas en los encabezados', () => {
    const { container } = render(<DocumentContent content={CONTENT_FM} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Contexto' })).toHaveAttribute(
      'id',
      'contexto'
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Decisiones' })).toHaveAttribute(
      'id',
      'decisiones'
    );
    expect(container).not.toHaveTextContent('jiku:');
    expect(container).not.toHaveTextContent('title: Arquitectura');
  });
});
