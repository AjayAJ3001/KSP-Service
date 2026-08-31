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

  const formatText = (s: string) => {
    if (!s) return '';
    return s.replace(/_/g, ' ');
  };

  return (
    <span className={`badge ${getBadgeClass(status)}`}>
      {formatText(status)}
    </span>
  );
};
