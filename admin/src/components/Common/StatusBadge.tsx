import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getBadgeClass = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'ACTIVE':
      case 'SETTLED':
      case 'RECEIVED':
      case 'VERIFIED':
        return 'badge-success';
      case 'PAYMENT_PENDING':
      case 'PENDING':
      case 'PARTIAL':
      case 'PARTIALLY_PAID':
        return 'badge-warning';
      case 'INACTIVE':
      case 'CANCELLED':
        return 'badge-danger';
      case 'NEW':
        return 'badge-info';
      default:
        return 'badge-neutral';
    }
  };

  const getDotColor = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'ACTIVE':
      case 'SETTLED':
      case 'RECEIVED':
      case 'VERIFIED':
        return '#10b981';
      case 'PAYMENT_PENDING':
      case 'PENDING':
      case 'PARTIAL':
      case 'PARTIALLY_PAID':
        return '#f59e0b';
      case 'INACTIVE':
      case 'CANCELLED':
        return '#ef4444';
      case 'NEW':
        return '#3b82f6';
      default:
        return '#94a3b8';
    }
  };

  const formatText = (s: string) => {
    if (!s) return '';
    return s.replace(/_/g, ' ');
  };

  return (
    <span className={`badge ${getBadgeClass(status)}`}>
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: getDotColor(status),
          display: 'inline-block',
          boxShadow: `0 0 6px ${getDotColor(status)}`,
        }}
      />
      {formatText(status)}
    </span>
  );
};
