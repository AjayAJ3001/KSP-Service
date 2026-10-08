import React, { useState, useEffect } from 'react';
import { AlertCircle, X, Clock, IndianRupee, Building2, ArrowRight, Eye } from 'lucide-react';
import { tripService } from '../../services/adminService';
import { Trip } from '../../types';
import { useNavigate } from 'react-router-dom';
import { formatDateDMY } from '../../utils/dateUtils';

const STORAGE_KEY = 'ksp_overdue_payment_alert_dismissed_date';

function getDaysPending(tripDate: string): number {
  const bill = new Date(tripDate);
  const today = new Date();
  bill.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - bill.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(val: number | string) {
  const num = parseFloat(String(val)) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
  isOpenManually?: boolean;
  onCloseManual?: () => void;
}

export const OverduePaymentAlertModal: React.FC<Props> = ({ isOpenManually, onCloseManual }) => {
  const [overdueTrips, setOverdueTrips] = useState<Trip[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadOverduePayments();
  }, []);

  useEffect(() => {
    if (isOpenManually !== undefined) {
      setIsOpen(isOpenManually);
    }
  }, [isOpenManually]);

  const loadOverduePayments = async () => {
    try {
      const res = await tripService.getTrips({
        page: 1,
        limit: 500,
        status: 'PAYMENT_PENDING',
      });
      const items: Trip[] = res.data?.items || [];

      // Keep only trips that are 30+ days pending
      const overdue = items.filter((t) => getDaysPending(t.trip_date) >= 30);

      if (overdue.length === 0) return;

      setOverdueTrips(overdue);

      // Auto-open once per day (dismissed state stored in localStorage)
      const lastDismissed = localStorage.getItem(STORAGE_KEY);
      const today = new Date().toISOString().split('T')[0];
      if (lastDismissed !== today) {
        setIsOpen(true);
      }
    } catch (err) {
      console.error('Failed to check overdue payments', err);
    }
  };

  const handleDismiss = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY, today);
    setIsOpen(false);
    if (onCloseManual) onCloseManual();
  };

  const handleGoToPayments = () => {
    handleDismiss();
    navigate('/payments');
  };

  if (!isOpen || overdueTrips.length === 0) return null;

  const totalOverdue = overdueTrips.reduce(
    (sum, t) => sum + parseFloat(String(t.balance_due ?? t.total_freight ?? 0)),
    0
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 28px 64px rgba(0, 0, 0, 0.38)',
          border: '1px solid #fde68a',
          overflow: 'hidden',
          animation: 'slideUp 0.25s ease',
        }}
      >
        {/* ── Header Banner ─────────────────────────────── */}
        <div
          style={{
            background: 'linear-gradient(135deg, #92400e 0%, #d97706 60%, #f59e0b 100%)',
            padding: '22px 24px',
            color: '#ffffff',
            position: 'relative',
          }}
        >
          <button
            onClick={handleDismiss}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
            }}
            title="Dismiss"
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '13px',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={28} color="#ffffff" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.85)',
                  marginBottom: '3px',
                }}
              >
                Overdue Payment Alert
              </div>
              <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#ffffff' }}>
                {overdueTrips.length} Trip{overdueTrips.length !== 1 ? 's' : ''} — Payment Pending &gt; 30 Days
              </h3>
            </div>
          </div>

          {/* Summary Strip */}
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '7px 13px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              <AlertCircle size={14} color="#fde68a" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                {overdueTrips.length} overdue trip{overdueTrips.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '7px 13px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              <IndianRupee size={14} color="#fde68a" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                Total Outstanding: {formatCurrency(totalOverdue)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────── */}
        <div style={{ padding: '18px 24px', flex: 1, overflowY: 'auto' }}>
          <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: '#475569', lineHeight: 1.55 }}>
            The following <strong>{overdueTrips.length} trip(s)</strong> have{' '}
            <strong>PAYMENT PENDING</strong> status and the bill was generated more than{' '}
            <strong>30 days ago</strong>. Please follow up with the respective parties immediately.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {overdueTrips.map((trip) => {
              const days = getDaysPending(trip.trip_date);
              const balanceDue = parseFloat(String(trip.balance_due ?? trip.total_freight ?? 0));
              const isCritical = days >= 60;

              return (
                <div
                  key={trip.id}
                  style={{
                    background: isCritical ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${isCritical ? '#fca5a5' : '#fde68a'}`,
                    borderLeft: `4px solid ${isCritical ? '#dc2626' : '#f59e0b'}`,
                    borderRadius: '10px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Left: Trip Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: isCritical ? '#fee2e2' : '#fef3c7',
                        color: isCritical ? '#dc2626' : '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '12px',
                        flexShrink: 0,
                      }}
                    >
                      #{trip.id}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '14px',
                          color: '#0f172a',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Building2 size={13} color="#64748b" />
                        {trip.party_name || '—'}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginTop: '3px',
                          display: 'flex',
                          gap: '10px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>Bill Date: <strong>{formatDateDMY(trip.trip_date)}</strong></span>
                        {trip.to_location && <span>Unit: {trip.to_location}</span>}
                        {trip.lorry_number && <span>Lorry: {trip.lorry_number}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: Badge + Amount */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        background: isCritical ? '#fee2e2' : '#fef3c7',
                        color: isCritical ? '#b91c1c' : '#b45309',
                        border: `1px solid ${isCritical ? '#fca5a5' : '#fde047'}`,
                        marginBottom: '5px',
                      }}
                    >
                      <Clock size={11} />
                      {days} days overdue
                    </div>
                    <div
                      style={{ fontSize: '15px', fontWeight: 800, color: isCritical ? '#b91c1c' : '#b45309' }}
                    >
                      {formatCurrency(balanceDue)}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Balance Due</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div
          style={{
            padding: '14px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={handleGoToPayments}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Eye size={15} /> Open Party Payments <ArrowRight size={14} />
          </button>

          <button
            onClick={handleDismiss}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#d97706',
              borderColor: '#d97706',
            }}
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
