interface ParseResult {
  processedContent: string;
  imagePlaceholders: number[];
  filePlaceholders: number[];
  /** Ids de `files` (sin vínculo) embebidos como imagen. */
  fileImagePlaceholders: number[];
  /** Ids de `files` (sin vínculo) embebidos como archivo. */
  fileDownloadPlaceholders: number[];
}

/**
 * Normaliza el contenido markdown para renderizar adjuntos en línea.
 *
 * Formatos soportados:
 * - `![img:N]` — formato interno legacy (imagen)
 * - `![attach:N]` — formato opus (imagen), N = id de VÍNCULO
 * - `[attach:N]` — formato opus (archivo), N = id de VÍNCULO
 * - `![file:N]` / `[file:N]` — archivo SIN vínculo, N = id de `files`
 * - `![name](/api/attachments/N/preview)` — formato gestor (imagen)
 * - `[name](/api/attachments/N/preview)` — formato gestor (archivo)
 * - `![name](/api/files/N/preview)` — archivo sin vínculo (imagen)
 *
 * Todos se reescriben a URIs internas que MarkdownViewer intercepta:
 * - `placeholder:N`         → <ImagePlaceholder /> sobre un vínculo
 * - `fileplaceholder:N`     → <FilePlaceholder /> sobre un vínculo
 * - `filepreview:N`         → <ImagePlaceholder /> sobre un `fileId`
 * - `filedownload:N`        → <FilePlaceholder /> sobre un `fileId`
 *
 * Los dos espacios de identificadores NO se pueden mezclar: resolver un
 * `fileId` contra la ruta de vínculos daría un 404 o el preview de otro
 * adjunto que casualmente tenga ese id.
 */
export function parseMarkdownWithPlaceholders(content: string): ParseResult {
  const imagePlaceholders: number[] = [];
  const filePlaceholders: number[] = [];
  const fileImagePlaceholders: number[] = [];
  const fileDownloadPlaceholders: number[] = [];

  let processedContent = content;

  // 0. Links markdown a la ruta de archivos sin vínculo: [name](/api/files/N/preview)
  const fileLinkRegex = /(!)?\[([^\]\n]*)\]\(\/api\/files\/(\d+)\/preview\)/g;
  processedContent = processedContent.replace(fileLinkRegex, (_match, bang, name, id) => {
    const numericId = parseInt(id, 10);
    const safeName = name || '';
    if (bang === '!') {
      fileImagePlaceholders.push(numericId);
      return `![${safeName}](filepreview:${numericId})`;
    }
    fileDownloadPlaceholders.push(numericId);
    return `[${safeName}](filedownload:${numericId})`;
  });

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

  // 3.5. Placeholders de archivo SIN vínculo: ![file:N] y [file:N]
  const fileImageRegex = /!\[file:(\d+)\]/g;
  processedContent = processedContent.replace(fileImageRegex, (_match, id) => {
    const numericId = parseInt(id, 10);
    fileImagePlaceholders.push(numericId);
    return `![](filepreview:${numericId})`;
  });

  const fileFileRegex = /(?<!!)\[file:(\d+)\]/g;
  processedContent = processedContent.replace(fileFileRegex, (_match, id) => {
    const numericId = parseInt(id, 10);
    fileDownloadPlaceholders.push(numericId);
    return `[](filedownload:${numericId})`;
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
    /^[ \t]*(?:!\[[^\]]*\]\((?:placeholder|filepreview):\d+\)|\[[^\]]*\]\((?:fileplaceholder|filedownload):\d+\))[ \t]*$/gm;
  const inlineAttachmentRegex =
    /!\[[^\]]*\]\((?:placeholder|filepreview):\d+\)|\[[^\]]*\]\((?:fileplaceholder|filedownload):\d+\)/g;

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

  return {
    processedContent,
    imagePlaceholders,
    filePlaceholders,
    fileImagePlaceholders,
    fileDownloadPlaceholders,
  };
}
