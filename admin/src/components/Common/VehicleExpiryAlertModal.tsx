import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Truck, Calendar, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { vehicleService } from '../../services/adminService';
import { Vehicle } from '../../types';
import { useNavigate } from 'react-router-dom';

const getDaysDifference = (expiryDateStr: string) => {
  const expiry = new Date(expiryDateStr);
  const today = new Date();
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

import { formatDateDMY } from '../../utils/dateUtils';

const formatDate = (dateStr: string) => {
  return formatDateDMY(dateStr);
};

interface DocAlert {
  label: string;
  expiryDate: string;
  days: number;
}

const THRESHOLD = 30;

const getVehicleAlerts = (vehicle: Vehicle): DocAlert[] => {
  const alerts: DocAlert[] = [];
  const docs: { label: string; date: string | undefined }[] = [
    { label: 'TDS Certificate', date: vehicle.tds_expiry_date || vehicle.dts_expiry_date },
    { label: 'Insurance', date: vehicle.insurance_expiry_date },
    { label: 'Permit', date: vehicle.permit_expiry_date },
    { label: 'FC (Fitness Certificate)', date: vehicle.fc_expiry_date },
    { label: 'Yearly Road Tax', date: vehicle.tax_expiry_date },
  ];
  for (const doc of docs) {
    if (doc.date) {
      const days = getDaysDifference(doc.date);
      if (days <= THRESHOLD) {
        alerts.push({ label: doc.label, expiryDate: doc.date, days });
      }
    }
  }
  return alerts;
};

interface Props {
  isOpenManually?: boolean;
  onCloseManual?: () => void;
  vehicleId?: number;
}

export const VehicleExpiryAlertModal: React.FC<Props> = ({
  isOpenManually,
  onCloseManual,
  vehicleId,
}) => {
  const [expiringVehicles, setExpiringVehicles] = useState<Vehicle[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkExpiry();
  }, [vehicleId]);

  useEffect(() => {
    if (isOpenManually !== undefined) setIsOpen(isOpenManually);
  }, [isOpenManually]);

  const checkExpiry = async () => {
    try {
      const res = await vehicleService.getExpiringVehicles(THRESHOLD);
      if (res.data && res.data.length > 0) {
        const relevant = vehicleId ? res.data.filter((v) => v.id === vehicleId) : res.data;
        setExpiringVehicles(relevant);
        if (relevant.length > 0) {
          const dismissed = sessionStorage.getItem('ksp_vehicle_expiry_dismissed');
          if (!dismissed) setIsOpen(true);
        }
      }
    } catch { /* silent */ }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('ksp_vehicle_expiry_dismissed', 'true');
    setIsOpen(false);
    if (onCloseManual) onCloseManual();
  };

  const handleNavigateToVehicles = () => {
    handleDismiss();
    navigate('/vehicles');
  };

  if (!isOpen || expiringVehicles.length === 0) return null;

  const totalAlerts = expiringVehicles.reduce((acc, v) => acc + getVehicleAlerts(v).length, 0);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
    >
      <div
        style={{
          background: '#ffffff', borderRadius: '20px',
          width: '100%', maxWidth: '720px', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 70px rgba(0,0,0,0.35)',
          border: '1px solid #ffedd5', overflow: 'hidden',
          animation: 'slideUp 0.25s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #92400e 0%, #d97706 55%, #f59e0b 100%)',
            padding: '22px 24px', color: '#ffffff', position: 'relative', flexShrink: 0,
          }}
        >
          <button
            onClick={handleDismiss}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: '50%', width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff', cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '50px', height: '50px', borderRadius: '14px',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Truck size={26} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', marginBottom: '3px' }}>
                Fleet Compliance Alert
              </div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
                Vehicle Document Expiry — Within 30 Days
              </h3>
              <div style={{ marginTop: '4px', fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
                {expiringVehicles.length} vehicle{expiringVehicles.length > 1 ? 's' : ''} &nbsp;&middot;&nbsp; {totalAlerts} document alert{totalAlerts > 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#475569', lineHeight: 1.6 }}>
            The following active vehicles have one or more compliance documents that are <strong>already expired</strong> or will expire within the next <strong>30 days</strong>. Please take action to renew them promptly.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {expiringVehicles.map((vehicle) => {
              const alerts = getVehicleAlerts(vehicle).sort((a, b) => a.days - b.days);
              const mostUrgent = alerts[0];
              const isExpanded = expandedId === vehicle.id;
              const hasExpired = alerts.some((a) => a.days < 0);

              return (
                <div
                  key={vehicle.id}
                  style={{
                    border: `1px solid ${hasExpired ? '#fecaca' : '#fde68a'}`,
                    borderRadius: '14px',
                    background: hasExpired ? '#fff5f5' : '#fffbeb',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 18px', gap: '12px', flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '42px', height: '42px', borderRadius: '10px',
                          background: hasExpired ? '#fee2e2' : '#fef3c7',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}
                      >
                        <Truck size={20} color={hasExpired ? '#dc2626' : '#d97706'} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                          {vehicle.lorry_number}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          {vehicle.vehicle_type || 'Vehicle'} &nbsp;&middot;&nbsp; {alerts.length} document alert{alerts.length > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                          background: mostUrgent.days < 0 ? '#fee2e2' : '#fef3c7',
                          color: mostUrgent.days < 0 ? '#b91c1c' : '#b45309',
                          border: `1px solid ${mostUrgent.days < 0 ? '#fca5a5' : '#fde047'}`,
                        }}
                      >
                        <ShieldAlert size={13} />
                        {mostUrgent.days < 0
                          ? `${mostUrgent.label} EXPIRED`
                          : mostUrgent.days === 0
                          ? `${mostUrgent.label} — TODAY`
                          : `${mostUrgent.label} in ${mostUrgent.days}d`}
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : (vehicle.id ?? null))}
                        style={{
                          background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px',
                          padding: '5px 10px', cursor: 'pointer', color: '#64748b',
                          display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                        }}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        borderTop: `1px solid ${hasExpired ? '#fecaca' : '#fde68a'}`,
                        padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px',
                        background: 'rgba(255,255,255,0.65)',
                      }}
                    >
                      {alerts.map((alert) => (
                        <div
                          key={alert.label}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '9px 14px', borderRadius: '10px',
                            background: alert.days < 0 ? '#fef2f2' : '#fffdf0',
                            border: `1px solid ${alert.days < 0 ? '#fecaca' : '#fef08a'}`,
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>
                            {alert.label}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b' }}>
                              <Calendar size={12} />
                              <span>{formatDate(alert.expiryDate)}</span>
                            </div>
                            <div
                              style={{
                                padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                                background: alert.days < 0 ? '#fee2e2' : alert.days <= 15 ? '#fff7ed' : '#fef9c3',
                                color: alert.days < 0 ? '#b91c1c' : alert.days <= 15 ? '#ea580c' : '#a16207',
                              }}
                            >
                              {alert.days < 0
                                ? `Expired ${Math.abs(alert.days)}d ago`
                                : alert.days === 0
                                ? 'Expires Today'
                                : `${alert.days} days left`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
          }}
        >
          <button
            onClick={handleNavigateToVehicles}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Eye size={15} /> Open Vehicle Master
          </button>
          <button
            onClick={handleDismiss}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#d97706', borderColor: '#d97706' }}
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
