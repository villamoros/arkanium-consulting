/** Aviso de resultado de una acción. Un solo componente para todos los módulos. */
export function Notice({ state }: { state: { ok: boolean; message: string } | null | undefined }) {
  if (!state) return null;
  return (
    <p role="status" className={state.ok ? "notice-ok" : "notice-bad"}>
      {state.message}
    </p>
  );
}
