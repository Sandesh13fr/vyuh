import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Amounts and numbers right-align. */
  align?: "start" | "end";
  /** Mono with tabular numerals: addresses, hashes, amounts. */
  mono?: boolean;
}

export interface DataTableProps<T> {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}

export function DataTable<T>({ caption, columns, rows, rowKey, empty = "Nothing yet." }: DataTableProps<T>) {
  const cell = (c: Column<T>) => [c.align === "end" && styles.end, c.mono && styles.mono].filter(Boolean).join(" ") || undefined;
  return (
    <div className={styles.wrap} tabIndex={0} role="region" aria-label={caption}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === "end" ? styles.end : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={cell(c)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
