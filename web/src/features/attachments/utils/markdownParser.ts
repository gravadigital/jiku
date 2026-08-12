interface ParseResult {
  processedContent: string;
  imagePlaceholders: number[];
  filePlaceholders: number[];
}

/**
 * Normaliza el contenido markdown para renderizar adjuntos en línea.
 *
 * Formatos soportados:
 * - `![img:N]` — formato interno legacy (imagen)
 * - `![attach:N]` — formato opus (imagen)
 * - `[attach:N]` — formato opus (archivo)
 * - `![name](/api/attachments/N/preview)` — formato gestor (imagen)
 * - `[name](/api/attachments/N/preview)` — formato gestor (archivo)
 *
 * Todos se reescriben a URIs internas que MarkdownViewer intercepta:
 * - `placeholder:N`     → <ImagePlaceholder />
 * - `fileplaceholder:N` → <FilePlaceholder />
 */
export function parseMarkdownWithPlaceholders(content: string): ParseResult {
  const imagePlaceholders: number[] = [];
  const filePlaceholders: number[] = [];

  let processedContent = content;

  // 1. Links markdown al endpoint del gestor: [name](/api/attachments/N/preview)
  //    Se procesa primero porque consume un patrón más largo.
  const gestorLinkRegex = /(!)?\[([^\]\n]*)\]\(\/api\/attachments\/(\d+)\/preview\)/g;
  processedContent = processedContent.replace(gestorLinkRegex, (_match, bang, name, id) => {
    const numericId = parseInt(id, 10);
    const safeName = name || `Adjunto ${numericId}`;
    if (bang === '!') {
      imagePlaceholders.push(numericId);
      return `![${safeName}](placeholder:${numericId})`;
    }
    filePlaceholders.push(numericId);
    return `[${safeName}](fileplaceholder:${numericId})`;
  });

  // 2. Placeholder de imagen opus: ![attach:N]
  //    Sin nombre real embebido en el markdown: se deja el alt vacío para que
  //    el componente resuelva el fileName real vía useAttachmentMeta (no hay
  //    que inventar "Attachment N" acá, eso pisaría el nombre real).
  const opusImageRegex = /!\[attach:(\d+)\]/g;
  processedContent = processedContent.replace(opusImageRegex, (_match, id) => {
    const numericId = parseInt(id, 10);
    imagePlaceholders.push(numericId);
    return `![](placeholder:${numericId})`;
  });

  // 3. Placeholder de archivo opus: [attach:N]  (NO precedido por `!`)
  const opusFileRegex = /(?<!!)\[attach:(\d+)\]/g;
  processedContent = processedContent.replace(opusFileRegex, (_match, id) => {
    const numericId = parseInt(id, 10);
    filePlaceholders.push(numericId);
    return `[](fileplaceholder:${numericId})`;
  });

  // 4. Placeholder de imagen legacy interno: ![img:N]
  const legacyImageRegex = /!\[img:(\d+)\]/g;
  processedContent = processedContent.replace(legacyImageRegex, (_match, id) => {
    const numericId = parseInt(id, 10);
    imagePlaceholders.push(numericId);
    return `![](placeholder:${numericId})`;
  });

  // Mover todos los placeholders al final, separados del texto
  const attachmentLineRegex =
    /^[ \t]*(?:!\[[^\]]*\]\(placeholder:\d+\)|\[[^\]]*\]\(fileplaceholder:\d+\))[ \t]*$/gm;
  const inlineAttachmentRegex =
    /!\[[^\]]*\]\(placeholder:(\d+)\)|\[[^\]]*\]\(fileplaceholder:(\d+)\)/g;

  const attachmentLines: string[] = [];
  // Extraer líneas que son solo un attachment
  processedContent = processedContent.replace(attachmentLineRegex, (match) => {
    attachmentLines.push(match.trim());
    return '';
  });
  // Extraer attachments inline que quedaron dentro de texto
  processedContent = processedContent.replace(inlineAttachmentRegex, (match) => {
    attachmentLines.push(match.trim());
    return '';
  });

  const textPart = processedContent.replace(/\n{3,}/g, '\n\n').trim();
  const attachmentPart = attachmentLines.join('\n');
  processedContent = attachmentPart
    ? textPart
      ? `${textPart}\n\n${attachmentPart}`
      : attachmentPart
    : textPart;

  return { processedContent, imagePlaceholders, filePlaceholders };
}
