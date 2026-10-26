interface EditorLabelInput {
  name?: string | null;
  sub?: string | null;
  currentUserId?: string | null;
}

/** "Editado por": `"vos"` si es la persona actual; si no, el nombre del servicio o `"—"`. */
export function editorLabel({ name, sub, currentUserId }: EditorLabelInput): string {
  if (sub && currentUserId && sub === currentUserId) return 'vos';
  return name?.trim() ? name : '—';
}
