import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'primary' | 'warning' | 'success' | 'info';
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  variant = 'primary',
  subtitle,
}) => {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${variant}`}>
        {icon}
      </div>
      <div className="stat-info">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{title}</div>
        {subtitle && <div style={{ fontSize: '11.5px', color: 'var(--text-light)', marginTop: '2px' }}>{subtitle}</div>}
      </div>
    </div>
  );
};
