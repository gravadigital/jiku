const escapeName = (name: string): string => name.replace(/[[\]\\]/g, (c) => `\\${c}`);

/** P-9: `![nombre](link)` para imágenes, `[nombre](link)` para el resto. */
export function attachmentMarkdown(attachment: {
  fileName: string;
  mimeType: string;
  link: string;
}): string {
  const label = `[${escapeName(attachment.fileName)}](${attachment.link})`;
  return attachment.mimeType.startsWith('image/') ? `!${label}` : label;
}
