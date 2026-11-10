import { isValidElement, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';

export type Column<T> = { key: string; header: ReactNode; align?: 'left' | 'right'; render: (row: T) => ReactNode };
/** Styled table: tabular numbers, hairline rows, hover. Scrolls horizontally inside its own box. */
/** `empty` shows when there are no rows: text becomes an EmptyState title; pass an <EmptyState> for an icon or a way out (e.g. a reset-filters button). */
export function DataTable<T>({ columns, rows, rowKey, caption, empty = 'Chưa có dữ liệu' }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; caption?: string; empty?: ReactNode }) {
  return (
    <>
      <div className="dtx-table-wrap">
        <table className="dtx-table">
          {caption && <caption className="dtx-sr">{caption}</caption>}
          <thead><tr>{columns.map(c => <th key={c.key} className={c.align === 'right' ? 'dtx-r' : undefined}>{c.header}</th>)}</tr></thead>
          <tbody>
            {rows.map(r => <tr key={rowKey(r)}>{columns.map(c => <td key={c.key} className={c.align === 'right' ? 'dtx-r' : undefined}>{c.render(r)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      {/* outside the scroll box, so it stays in view when the columns are wider than the screen */}
      {!rows.length && (isValidElement(empty) ? empty : <EmptyState size="sm" title={empty} />)}
    </>
  );
}
