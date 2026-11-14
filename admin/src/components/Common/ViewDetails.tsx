import React from 'react';
import { Eye } from 'lucide-react';
import { Modal } from './Modal';

export type DetailRow = { label: string; value?: React.ReactNode };

export const ViewButton: React.FC<{
  onClick: (e?: React.MouseEvent) => void;
  title?: string;
  compact?: boolean;
}> = ({ onClick, title = 'View Details', compact }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick(e);
    }}
    className="btn btn-outline btn-sm"
    title={title}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: compact ? 3 : 4,
      color: '#1d4ed8',
      borderColor: '#93c5fd',
      background: '#eff6ff',
      fontWeight: 700,
      padding: compact ? '2px 7px' : undefined,
      height: compact ? 24 : undefined,
      fontSize: compact ? 11 : undefined,
    }}
  >
    <Eye size={compact ? 12 : 14} /> View
  </button>
);

export const DetailsList: React.FC<{ rows: DetailRow[] }> = ({ rows }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    {rows
      .filter((r) => r.value !== undefined && r.value !== null && r.value !== '')
      .map((r) => (
        <div
          key={r.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            padding: '9px 0',
            borderBottom: '1px solid #e2e8f0',
            alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', flexShrink: 0 }}>{r.label}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>{r.value}</span>
        </div>
      ))}
  </div>
);

export const DetailsModal: React.FC<{
  isOpen: boolean;
  title: string;
  rows?: DetailRow[];
  onClose: () => void;
  children?: React.ReactNode;
  maxWidth?: string;
}> = ({ isOpen, title, rows, onClose, children, maxWidth = '520px' }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={maxWidth}>
    {rows ? <DetailsList rows={rows} /> : null}
    {children}
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
      <button type="button" className="btn btn-outline" onClick={onClose}>
        Close
      </button>
    </div>
  </Modal>
);
