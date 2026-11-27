interface EditorLabelInput {
  name?: string | null;
  sub?: string | null;
  currentUserSub?: string | null;
}

/** "Editado por": `"vos"` si es la persona actual; si no, el nombre del servicio o `"—"`. */
export function editorLabel({ name, sub, currentUserSub }: EditorLabelInput): string {
  if (sub && currentUserSub && sub === currentUserSub) return 'vos';
  return name?.trim() ? name : '—';
}
