import { describe, it, expect } from 'vitest';
import { parseMarkdownWithPlaceholders } from './markdownParser';

describe('parseMarkdownWithPlaceholders', () => {
  describe('formato legacy interno ![img:N]', () => {
    it('detecta un placeholder simple y lo convierte', () => {
      const result = parseMarkdownWithPlaceholders('texto ![img:123] más texto');
      expect(result.imagePlaceholders).toEqual([123]);
      expect(result.processedContent).toContain('placeholder:123');
      expect(result.processedContent).toContain('![](placeholder:123)');
    });

    it('detecta múltiples placeholders', () => {
      const result = parseMarkdownWithPlaceholders('![img:1] y ![img:2]');
      expect(result.imagePlaceholders).toEqual([1, 2]);
      expect(result.processedContent).toContain('placeholder:1');
      expect(result.processedContent).toContain('placeholder:2');
    });

    it('ignora sintaxis inválida sin dígitos', () => {
      const content = '![img:]';
      const result = parseMarkdownWithPlaceholders(content);
      expect(result.imagePlaceholders).toEqual([]);
      expect(result.processedContent).toBe(content);
    });

    it('maneja IDs de 0 y grandes', () => {
      const result = parseMarkdownWithPlaceholders('![img:0] y ![img:99999]');
      expect(result.imagePlaceholders).toEqual([0, 99999]);
    });
  });

  describe('formato opus ![attach:N] (imagen)', () => {
    it('convierte ![attach:N] a un placeholder de imagen', () => {
      const result = parseMarkdownWithPlaceholders('antes ![attach:42] después');
      expect(result.imagePlaceholders).toEqual([42]);
      expect(result.filePlaceholders).toEqual([]);
      expect(result.processedContent).toContain('![](placeholder:42)');
    });

    it('detecta múltiples ![attach:N]', () => {
      const result = parseMarkdownWithPlaceholders('![attach:10]![attach:20]');
      expect(result.imagePlaceholders).toEqual([10, 20]);
    });

    it('ignora ![attach:] sin dígitos', () => {
      const content = '![attach:]';
      const result = parseMarkdownWithPlaceholders(content);
      expect(result.imagePlaceholders).toEqual([]);
      expect(result.processedContent).toBe(content);
    });
  });

  describe('formato opus [attach:N] (archivo)', () => {
    it('convierte [attach:N] a un placeholder de archivo', () => {
      const result = parseMarkdownWithPlaceholders('ver [attach:77] adjunto');
      expect(result.filePlaceholders).toEqual([77]);
      expect(result.imagePlaceholders).toEqual([]);
      expect(result.processedContent).toContain('](fileplaceholder:77)');
    });

    it('NO convierte [attach:N] cuando está precedido por ! (es imagen)', () => {
      const result = parseMarkdownWithPlaceholders('![attach:5]');
      expect(result.filePlaceholders).toEqual([]);
      expect(result.imagePlaceholders).toEqual([5]);
    });

    it('detecta combinación de imagen y archivo', () => {
      const result = parseMarkdownWithPlaceholders('[attach:1]![attach:2][attach:3]');
      expect(result.imagePlaceholders).toEqual([2]);
      expect(result.filePlaceholders).toEqual([1, 3]);
    });
  });

  describe('formato markdown [texto](/api/attachments/N/preview) del gestor', () => {
    it('convierte link de imagen ![name](/api/attachments/N/preview)', () => {
      const content = '![foto.png](/api/attachments/7/preview)';
      const result = parseMarkdownWithPlaceholders(content);
      expect(result.imagePlaceholders).toEqual([7]);
      expect(result.filePlaceholders).toEqual([]);
      expect(result.processedContent).toContain('![foto.png](placeholder:7)');
    });

    it('convierte link de archivo [name](/api/attachments/N/preview)', () => {
      const content = '[reporte.pdf](/api/attachments/9/preview)';
      const result = parseMarkdownWithPlaceholders(content);
      expect(result.filePlaceholders).toEqual([9]);
      expect(result.imagePlaceholders).toEqual([]);
      expect(result.processedContent).toContain('[reporte.pdf](fileplaceholder:9)');
    });

    it('respeta nombres con espacios y acentos', () => {
      const content = '[Mi Reporté Final.pdf](/api/attachments/15/preview)';
      const result = parseMarkdownWithPlaceholders(content);
      expect(result.filePlaceholders).toEqual([15]);
      expect(result.processedContent).toContain('[Mi Reporté Final.pdf](fileplaceholder:15)');
    });

    it('no altera links http(s) que no son de attachments', () => {
      const content = '[Google](https://google.com)';
      const result = parseMarkdownWithPlaceholders(content);
      expect(result.imagePlaceholders).toEqual([]);
      expect(result.filePlaceholders).toEqual([]);
      expect(result.processedContent).toBe(content);
    });
  });

  describe('casos comunes', () => {
    it('retorna content sin cambios cuando no hay placeholders', () => {
      const content = 'sin placeholders';
      const result = parseMarkdownWithPlaceholders(content);
      expect(result.imagePlaceholders).toEqual([]);
      expect(result.filePlaceholders).toEqual([]);
      expect(result.processedContent).toBe(content);
    });

    it('maneja string vacío', () => {
      const result = parseMarkdownWithPlaceholders('');
      expect(result.imagePlaceholders).toEqual([]);
      expect(result.filePlaceholders).toEqual([]);
      expect(result.processedContent).toBe('');
    });

    it('no altera markdown estándar (headings, negrita)', () => {
      const content = '# Título\n**negrita** y _cursiva_\n- lista';
      const result = parseMarkdownWithPlaceholders(content);
      expect(result.imagePlaceholders).toEqual([]);
      expect(result.filePlaceholders).toEqual([]);
      expect(result.processedContent).toBe(content);
    });

    it('soporta mezcla de todos los formatos en un solo contenido', () => {
      const content = [
        'Texto inicial',
        '![attach:1]',
        '[attach:2]',
        '![img:3]',
        '![imagen.jpg](/api/attachments/4/preview)',
        '[doc.pdf](/api/attachments/5/preview)',
        'Texto final',
      ].join(' ');

      const result = parseMarkdownWithPlaceholders(content);

      expect(result.imagePlaceholders.sort()).toEqual([1, 3, 4]);
      expect(result.filePlaceholders.sort()).toEqual([2, 5]);
      expect(result.processedContent).toContain('(placeholder:1)');
      expect(result.processedContent).toContain('(fileplaceholder:2)');
      expect(result.processedContent).toContain('(placeholder:3)');
      expect(result.processedContent).toContain('(placeholder:4)');
      expect(result.processedContent).toContain('(fileplaceholder:5)');
    });
  });
});
