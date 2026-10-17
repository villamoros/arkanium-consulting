import type { Bar } from "@/lib/dashboard";

// Barras horizontales: para comparar categorías. Cada valor va escrito, así no depende solo del color.
export function BarList({ rows, empty }: { rows: Bar[]; empty: string }) {
  const max = Math.max(0, ...rows.map((row) => row.value));
  if (max === 0) return <p className="muted">{empty}</p>;

  return (
    <ul className="bar-list" aria-label={rows.map((row) => `${row.label}: ${row.value}`).join(", ")}>
      {rows.map((row) => (
        <li key={row.label} className="bar-row">
          <span>{row.label}</span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <b>{row.value}</b>
        </li>
      ))}
    </ul>
  );
}
