/** Une clases CSS ignorando valores falsy. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Divide texto plano en párrafos (líneas en blanco). Se renderiza como texto, nunca como HTML. */
export function paragraphs(text: string | undefined): string[] {
  return (text ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}
