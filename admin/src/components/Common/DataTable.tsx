import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T, index: number) => React.ReactNode);
  render?: (row: T, index: number) => React.ReactNode;
  width?: string;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  total?: number;
  page?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  emptyMessage?: string;
  showSerialNumber?: boolean;
  footer?: React.ReactNode;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  isLoading = false,
  total = 0,
  page = 1,
  limit = 20,
  onPageChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  actions,
  emptyMessage = 'No records found.',
  showSerialNumber = true,
  footer,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / limit) || 1;
  const colSpanCount = columns.length + (showSerialNumber ? 1 : 0);
  const [localSearch, setLocalSearch] = useState(searchValue || '');

  useEffect(() => {
    setLocalSearch(searchValue || '');
  }, [searchValue]);

  useEffect(() => {
    if (onSearchChange === undefined) return;
    if ((searchValue || '') === localSearch) return;
    const timer = setTimeout(() => onSearchChange(localSearch), 400);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange, searchValue]);

  return (
    <div>
      {(onSearchChange !== undefined || actions) && (
        <div className="search-filter-bar">
          {onSearchChange !== undefined ? (
            <div className="search-input-wrapper">
              <Search />
              <input
                type="text"
                className="form-control"
                placeholder={searchPlaceholder}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
            </div>
          ) : <div />}
          {actions && <div className="table-toolbar-actions">{actions}</div>}
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {showSerialNumber && <th style={{ width: '44px', textAlign: 'center' }}>#</th>}
              {columns.map((col, idx) => (
                <th key={idx} className={col.className} style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpanCount} style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Loading records...</div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={colSpanCount} style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>{emptyMessage}</div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => {
                const serialNumber = (page - 1) * limit + rowIdx + 1;
                return (
                  <tr key={row.id !== undefined ? String(row.id) : rowIdx}>
                    {showSerialNumber && (
                      <td style={{ textAlign: 'center', width: '44px' }}>
                        <span className="sno-badge">{serialNumber}</span>
                      </td>
                    )}
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className={col.className}>
                        {col.render
                          ? col.render(row, rowIdx)
                          : typeof col.accessor === 'function'
                          ? col.accessor(row, rowIdx)
                          : col.accessor
                          ? (row[col.accessor] as any)
                          : null}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>

      {onPageChange && total > limit && (
        <div className="pagination">
          <div>
            Showing <strong>{(page - 1) * limit + 1}</strong> to{' '}
            <strong>{Math.min(page * limit, total)}</strong> of <strong>{total}</strong> results
          </div>
          <div className="pagination-controls">
            <button
              className="btn btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 600 }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
