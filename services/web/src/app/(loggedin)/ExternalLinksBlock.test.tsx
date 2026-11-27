import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExternalLinksBlock } from './ExternalLinksBlock';

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
    height,
  }: {
    alt: string;
    src: string | { src: string };
    height?: number;
  }) => <img alt={alt} src={typeof src === 'string' ? src : src.src} height={height} />,
}));

describe('ExternalLinksBlock', () => {
  it('TS-93: sin externalLinks no renderiza nada', () => {
    const { container } = render(<ExternalLinksBlock />);

    expect(container).toBeEmptyDOMElement();
  });

  it('TS-93: renderiza un enlace por cada entrada válida, con su href y label', () => {
    const externalLinks = JSON.stringify([
      { tool: 'github', href: 'https://github.com/x', label: 'Código' },
      { tool: 'mattermost', href: 'https://chat.x', label: 'Chat' },
    ]);

    render(<ExternalLinksBlock externalLinks={externalLinks} />);

    const codeLink = screen.getByTitle('Código');
    expect(codeLink).toHaveAttribute('href', 'https://github.com/x');
    expect(codeLink).toHaveAttribute('target', '_blank');

    const chatLink = screen.getByTitle('Chat');
    expect(chatLink).toHaveAttribute('href', 'https://chat.x');
  });
});
