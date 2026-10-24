/** Sugiere el nombre de archivo a partir del título: minúsculas, sin acentos, guiones, `.md`. */
export function slugifyFileName(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `${slug}.md` : '';
}

/** Recorta y agrega `.md` solo si no termina en `.md` (sin distinguir mayúsculas). */
export function normalizeFileName(name: string): string {
  const trimmed = name.trim();
  return /\.md$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
}
