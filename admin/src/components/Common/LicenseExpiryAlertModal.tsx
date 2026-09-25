import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, ShieldAlert, Phone, Calendar, ArrowRight, Eye } from 'lucide-react';
import { driverService } from '../../services/adminService';
import { Driver } from '../../types';
import { useNavigate } from 'react-router-dom';

const getDaysDifference = (expiryDateStr: string) => {
  const expiry = new Date(expiryDateStr);
  const today = new Date();
  // Reset times to compare dates only
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return dateStr;
  }
};

interface Props {
  isOpenManually?: boolean;
  onCloseManual?: () => void;
}

export const LicenseExpiryAlertModal: React.FC<Props> = ({ isOpenManually, onCloseManual }) => {
  const [expiringDrivers, setExpiringDrivers] = useState<Driver[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkExpiringLicenses();
  }, []);

  useEffect(() => {
    if (isOpenManually !== undefined) {
      setIsOpen(isOpenManually);
    }
  }, [isOpenManually]);

  const checkExpiringLicenses = async () => {
    try {
      setIsLoading(true);
      const res = await driverService.getExpiringDrivers(45);
      if (res.data && res.data.length > 0) {
        setExpiringDrivers(res.data);

        // Check if already dismissed in this browser session
        const dismissed = sessionStorage.getItem('ksp_license_alert_dismissed');
        if (!dismissed) {
          setIsOpen(true);
        }
      }
    } catch (err) {
      console.error('Failed to check expiring licenses', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('ksp_license_alert_dismissed', 'true');
    setIsOpen(false);
    if (onCloseManual) onCloseManual();
  };

  const handleNavigateToDrivers = () => {
    handleDismiss();
    navigate('/drivers');
  };

  if (!isOpen || expiringDrivers.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
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
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
          border: '1px solid #fee2e2',
          overflow: 'hidden',
          animation: 'slideUp 0.25s ease',
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 60%, #ea580c 100%)',
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
              background: 'rgba(255, 255, 255, 0.2)',
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
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={26} color="#ffffff" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.85)',
                  marginBottom: '2px',
                }}
              >
                Immediate Attention Required
              </div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                Driver License Expiry Alert (Within 45 Days)
              </h3>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
            The following <strong>{expiringDrivers.length} active driver(s)</strong> have driving licenses that are already expired or will expire within the next 45 days. Please contact them for timely license renewal.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {expiringDrivers.map((driver) => {
              const days = driver.days_remaining !== undefined
                ? Number(driver.days_remaining)
                : driver.license_expiry_date
                ? getDaysDifference(driver.license_expiry_date)
                : 0;

              const isExpired = days < 0;
              const isToday = days === 0;

              return (
                <div
                  key={driver.id}
                  style={{
                    background: isExpired ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${isExpired ? '#fecaca' : '#fef08a'}`,
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {driver.photo_url ? (
                      <img
                        src={driver.photo_url}
                        alt={driver.name}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #e2e8f0',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: isExpired ? '#fee2e2' : '#fef3c7',
                          color: isExpired ? '#dc2626' : '#d97706',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '16px',
                        }}
                      >
                        {driver.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                        {driver.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        {driver.mobile_number ? (
                          <>
                            <Phone size={12} color="#64748b" />
                            <span>{driver.mobile_number}</span>
                          </>
                        ) : (
                          <span>No phone number recorded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: isExpired ? '#fee2e2' : '#fef3c7',
                        color: isExpired ? '#b91c1c' : '#b45309',
                        border: `1px solid ${isExpired ? '#fca5a5' : '#fde047'}`,
                        marginBottom: '4px',
                      }}
                    >
                      <ShieldAlert size={13} />
                      {isExpired
                        ? `EXPIRED ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
                        : isToday
                        ? 'EXPIRES TODAY'
                        : `Expires in ${days} day${days === 1 ? '' : 's'}`}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <Calendar size={11} /> Expiry: <strong>{driver.license_expiry_date ? formatDate(driver.license_expiry_date) : 'N/A'}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={handleNavigateToDrivers}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Eye size={15} /> Open Driver Master
          </button>

          <button
            onClick={handleDismiss}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#dc2626', borderColor: '#dc2626' }}
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
