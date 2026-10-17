import type { Column } from "@/lib/dashboard";

// Columnas por semana. Una serie por valor de cada columna; la leyenda dice qué es cada color.
export function ColumnChart({ columns, legend, empty }: { columns: Column[]; legend: string[]; empty: string }) {
  const max = Math.max(0, ...columns.flatMap((column) => column.values));
  if (max === 0) return <p className="muted">{empty}</p>;

  return (
    <figure className="column-figure" style={{ margin: 0 }}>
      <ul className="legend" aria-hidden="true">
        {legend.map((name, index) => (
          <li key={name}>
            <i className={index === 0 ? "" : "alt"} />
            {name}
          </li>
        ))}
      </ul>
      <div className="columns" role="img" aria-label={columns.map((column) => `${column.label}: ${column.values.join(" y ")}`).join("; ")}>
        {columns.map((column) => (
          <div key={column.label} className="column">
            <div className="column-bars">
              {column.values.map((value, index) => (
                <span
                  key={index}
                  className={index === 0 ? "column-bar" : "column-bar alt"}
                  title={`${legend[index]}: ${value}`}
                  style={{ height: value === 0 ? "0" : `${Math.max(4, (value / max) * 100)}%` }}
                />
              ))}
            </div>
            <span className="column-label">{column.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
