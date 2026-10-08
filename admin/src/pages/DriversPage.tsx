import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Edit2, Trash2, Search, Download, Eye,
  Phone, CreditCard, Camera, X, FileText, CheckCircle, User as UserIcon,
  Printer, ShieldCheck, AlertCircle, AlertTriangle, Calendar, Loader, ScanLine, Truck, Sparkles, Lock, Unlock
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { isPdfFile, extractTextFromFile } from '../utils/fileExtraction';
import { driverService } from '../services/adminService';
import { Driver } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';

import { formatDateDMY } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toIST = (d: string) => {
  return formatDateDMY(d);
};

const getDaysDifference = (expiryDateStr: string): number => {
  try {
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
};

const readAsBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const ADDRESS_PROOF_OPTIONS = [
  'Aadhar Card',
  'Family Card (Ration Card)',
  'Voter ID',
  'Passport',
];

// ─── Driver Profile View Modal ────────────────────────────────────────────────
interface ProfileModalProps {
  driver: Driver | null;
  onClose: () => void;
  onEdit?: (driver: Driver) => void;
}

const DriverProfileModal: React.FC<ProfileModalProps> = ({ driver, onClose, onEdit }) => {
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  if (!driver) return null;

  const expiryDays = driver.license_expiry_date ? getDaysDifference(driver.license_expiry_date) : null;
  const isLicenseExpired = expiryDays !== null && expiryDays < 0;
  const isLicenseExpiringSoon = expiryDays !== null && expiryDays >= 0 && expiryDays <= 30;

  const buildDriverProfileHtml = () => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Driver Record - ${driver.name}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      margin: 0 0 4px 0;
      font-size: 24px;
      color: #1e3a8a;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 0;
      color: #64748b;
      font-size: 13px;
    }
    .report-badge {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      text-align: right;
    }
    .top-section {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
      background: #f8fafc;
      padding: 18px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .passport-box {
      width: 120px;
      height: 150px;
      border: 2px dashed #cbd5e1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #fff;
      flex-shrink: 0;
    }
    .passport-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .details-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 20px;
    }
    .field label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .field p {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
    }
    .alert-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 10px 16px;
      border-radius: 6px;
      font-weight: 700;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e3a8a;
      margin: 24px 0 14px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .docs-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 30px;
    }
    .doc-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      background: #fff;
      text-align: center;
    }
    .doc-card h4 {
      margin: 0 0 10px 0;
      font-size: 12px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-img {
      max-width: 100%;
      max-height: 240px;
      object-fit: contain;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
    }
    .pdf-doc-box {
      padding: 36px 12px;
      background: #f8fafc;
      border: 1.5px dashed #94a3b8;
      border-radius: 6px;
      font-weight: 700;
      color: #1e3a8a;
      text-align: center;
      font-size: 13px;
    }
    .no-doc {
      padding: 40px 10px;
      color: #94a3b8;
      font-style: italic;
      font-size: 12px;
    }
    .footer-sign {
      display: flex;
      justify-content: space-between;
      margin-top: 50px;
      padding-top: 20px;
    }
    .sign-box {
      width: 200px;
      text-align: center;
      border-top: 1px solid #94a3b8;
      padding-top: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>KSP TRANSPORT SERVICES</h1>
      <p>Official Driver Master & Document Verification Record</p>
    </div>
    <div class="report-badge">
      <div>STATUS: ${driver.status}</div>
      <div style="font-size: 10px; font-weight: normal; color: #64748b; margin-top: 2px;">
        Generated: ${formatDateDMY(new Date())}
      </div>
    </div>
  </div>

  ${isLicenseExpired ? `
    <div class="alert-banner">
      ⚠️ NOTICE: Driving License EXPIRED on ${toIST(driver.license_expiry_date!)} (${Math.abs(expiryDays!)} days ago)! Renewal required.
    </div>
  ` : isLicenseExpiringSoon ? `
    <div class="alert-banner" style="background:#fffbeb;border-color:#fef08a;color:#b45309;">
      ⚠️ NOTICE: Driving License EXPIRING in ${expiryDays} days on ${toIST(driver.license_expiry_date!)}!
    </div>
  ` : ''}

  <div class="top-section">
    <div class="passport-box">
      ${driver.photo_url ? `<img src="${driver.photo_url}" alt="Passport Photo" />` : '<span style="color:#94a3b8;font-size:11px;">Passport Photo</span>'}
    </div>
    <div class="details-grid">
      <div class="field">
        <label>Driver Name</label>
        <p>${driver.name}</p>
      </div>
      <div class="field">
        <label>Phone / Mobile</label>
        <p>${driver.mobile_number || '—'}</p>
      </div>
      <div class="field">
        <label>License Type</label>
        <p>${driver.license_type === 'REGULAR' ? 'REGULAR (Light Motor Vehicle - LMV)' : 'HEAVY (Transport / Commercial / HMV)'}</p>
      </div>
      <div class="field">
        <label>License Number (DL No)</label>
        <p>${driver.license_number || 'Not Specified'}</p>
      </div>
      <div class="field">
        <label>License Expiry Date</label>
        <p>${driver.license_expiry_date ? toIST(driver.license_expiry_date) : 'Not Specified'}</p>
      </div>
      <div class="field">
        <label>Address Proof Type</label>
        <p>${driver.id_proof_type || '—'}</p>
      </div>
      <div class="field">
        <label>Status</label>
        <p>${driver.status}</p>
      </div>
      <div class="field">
        <label>Registered Date</label>
        <p>${driver.created_at ? toIST(driver.created_at) : '—'}</p>
      </div>
    </div>
  </div>

  <div class="section-title">Submitted Documents</div>
  <div class="docs-grid">
    <div class="doc-card">
      <h4>Driving License (Front Side)</h4>
      ${driver.license_photo_url ? (isPdfFile(driver.license_photo_url) ? '<div class="pdf-doc-box">📄 Driving License (Front) — PDF Document</div>' : `<img src="${driver.license_photo_url}" class="doc-img" alt="Driving License Front" />`) : '<div class="no-doc">No Front Photo Uploaded</div>'}
    </div>
    <div class="doc-card">
      <h4>Driving License (Back Side)</h4>
      ${driver.license_photo_back_url ? (isPdfFile(driver.license_photo_back_url) ? '<div class="pdf-doc-box">📄 Driving License (Back) — PDF Document</div>' : `<img src="${driver.license_photo_back_url}" class="doc-img" alt="Driving License Back" />`) : '<div class="no-doc">No Back Photo Uploaded</div>'}
    </div>
    <div class="doc-card">
      <h4>Address Proof (${driver.id_proof_type || 'Document'})</h4>
      ${driver.id_proof_url ? (isPdfFile(driver.id_proof_url) ? `<div class="pdf-doc-box">📄 ${driver.id_proof_type || 'Address Proof'} — PDF Document</div>` : `<img src="${driver.id_proof_url}" class="doc-img" alt="Address Proof" />`) : '<div class="no-doc">No Address Proof Uploaded</div>'}
    </div>
  </div>

  <div class="footer-sign">
    <div class="sign-box">Driver Signature</div>
    <div class="sign-box">Authorized Admin Signature</div>
  </div>
</body>
</html>
    `;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = buildDriverProfileHtml();
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = `${driver.name} - Driver Profile Record`;
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const handleDownload = () => {
    const html = buildDriverProfileHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Driver_Profile_${driver.name.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Info card helper for the header ──────────────────────────────────────
  const InfoChip = ({
    icon, label, value, highlight,
  }: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    highlight?: 'red' | 'yellow' | null;
  }) => (
    <div
      style={{
        background: highlight === 'red'
          ? 'rgba(239, 68, 68, 0.22)'
          : highlight === 'yellow'
          ? 'rgba(245, 158, 11, 0.20)'
          : 'rgba(255, 255, 255, 0.12)',
        border: `1.5px solid ${highlight === 'red' ? 'rgba(239, 68, 68, 0.5)' : highlight === 'yellow' ? 'rgba(245, 158, 11, 0.45)' : 'rgba(255, 255, 255, 0.22)'}`,
        borderRadius: '12px',
        padding: '10px 14px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '62px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.75)', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
        {icon} <span>{label}</span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: highlight === 'red' ? '#fca5a5' : highlight === 'yellow' ? '#fde68a' : '#ffffff', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  );

  // ── Document card helper ────────────────────────────────────────────────
  const DocCard = ({
    title, icon, iconColor, url, emptyText, isPortrait,
  }: {
    title: string;
    icon: React.ReactNode;
    iconColor: string;
    url?: string;
    emptyText: string;
    isPortrait?: boolean;
  }) => (
    <div
      style={{
        background: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#374151', alignSelf: 'flex-start' }}>
        <span style={{ color: iconColor }}>{icon}</span>
        {title}
      </div>
      {url ? (
        isPdfFile(url) ? (
          <div
            style={{
              cursor: 'pointer',
              width: '100%',
              height: isPortrait ? '120px' : '140px',
              borderRadius: '10px',
              background: '#fef2f2',
              border: '2px solid #fecaca',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onClick={() => window.open(url, '_blank')}
            title="Click to view PDF in new tab"
          >
            <FileText size={32} color="#dc2626" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>PDF Document</span>
            <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Eye size={11} /> Open / View PDF
            </div>
          </div>
        ) : (
          <div
            style={{ cursor: 'zoom-in', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            onClick={() => setZoomImage({ url, title })}
            title="Click to view full size"
          >
            <img
              src={url}
              alt={title}
              style={{
                width: isPortrait ? '90px' : '100%',
                height: isPortrait ? '120px' : '140px',
                objectFit: isPortrait ? 'cover' : 'contain',
                borderRadius: '10px',
                border: '2px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Eye size={11} /> Click to zoom
            </div>
          </div>
        )
      ) : (
        <div style={{ padding: '20px 12px', textAlign: 'center', color: '#cbd5e1' }}>
          <AlertCircle size={30} style={{ margin: '0 auto 6px', display: 'block' }} />
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{emptyText}</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(6, 12, 34, 0.78)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* ── Modal Card ─────────────────────────────────────────────────── */}
        <div
          style={{
            background: '#f8fafc',
            borderRadius: '22px',
            width: '100%',
            maxWidth: '860px',
            maxHeight: '94vh',
            overflowY: 'auto',
            boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >

          {/* ═══════════════════════════════════════════════════════════
              HEADER — deep blue gradient
          ═══════════════════════════════════════════════════════════ */}
          <div
            style={{
              background: 'linear-gradient(145deg, #0f1e5a 0%, #1a3aad 50%, #2563eb 100%)',
              padding: '22px 28px 24px',
              borderRadius: '22px 22px 0 0',
              position: 'relative',
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            {/* decorative circle */}
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-80px', left: '30%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#ffffff',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 1,
                transition: 'background 0.15s',
              }}
              title="Close"
            >
              <X size={16} />
            </button>

            {/* ── Top row: avatar + name + status ── */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>

              {/* Avatar */}
              <div style={{ flexShrink: 0 }}>
                {driver.photo_url ? (
                  <img
                    src={driver.photo_url}
                    alt={driver.name}
                    onClick={() => setZoomImage({ url: driver.photo_url!, title: `${driver.name} — Passport Photo` })}
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid rgba(255,255,255,0.75)',
                      boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                      cursor: 'zoom-in',
                    }}
                    title="Click to zoom"
                  />
                ) : (
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.18)',
                      border: '3px solid rgba(255,255,255,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '30px',
                      fontWeight: 800,
                      color: '#ffffff',
                      boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
                    }}
                  >
                    {driver.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name + status + title */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: '3px' }}>
                  DRIVER PROFILE DETAILS
                </div>
                <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 5px 0', color: '#ffffff', lineHeight: 1.15, letterSpacing: '-0.3px' }}>
                  {driver.name}
                </h2>
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: driver.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2.5px 12px',
                      borderRadius: '20px',
                      letterSpacing: '0.4px',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }} />
                    {driver.status}
                  </span>
                </div>
              </div>
            </div>

            {/* ── 6-chip info grid in header ── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginTop: '18px',
              }}
            >
              <InfoChip
                icon={<Phone size={12} />}
                label="Phone Number"
                value={driver.mobile_number || <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Not Provided</span>}
              />
              <InfoChip
                icon={<Truck size={12} />}
                label="License Type"
                value={driver.license_type === 'REGULAR' ? '🚗 REGULAR (LMV)' : '🚛 HEAVY (Transport / HMV)'}
              />
              <InfoChip
                icon={<CreditCard size={12} />}
                label="DL Number"
                value={<span style={{ fontFamily: 'monospace' }}>{driver.license_number || <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400, fontFamily: 'inherit' }}>Not Specified</span>}</span>}
              />
              <InfoChip
                icon={<Calendar size={12} />}
                label="License Expiry"
                highlight={isLicenseExpired ? 'red' : isLicenseExpiringSoon ? 'yellow' : null}
                value={
                  <span>
                    {driver.license_expiry_date ? toIST(driver.license_expiry_date) : <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Not Specified</span>}
                    {expiryDays !== null && (
                      <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '10.5px', fontWeight: 600, opacity: 0.9 }}>
                        {isLicenseExpired ? `(⚠ Expired)` : expiryDays === 0 ? '(Expires today)' : `(${expiryDays}d left)`}
                      </span>
                    )}
                  </span>
                }
              />
              <InfoChip
                icon={<ShieldCheck size={12} />}
                label="Address Proof"
                value={driver.id_proof_type || <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Not Specified</span>}
              />
              <InfoChip
                icon={<Calendar size={12} />}
                label="Registered"
                value={driver.created_at ? toIST(driver.created_at) : '—'}
              />
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              BODY
          ═══════════════════════════════════════════════════════════ */}
          <div style={{ padding: '22px 28px', flex: 1 }}>

            {/* Expiry alerts */}
            {isLicenseExpired && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 18px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#991b1b' }}>Driving License EXPIRED</div>
                  <div style={{ fontSize: '12px', color: '#b91c1c' }}>
                    Expired on {toIST(driver.license_expiry_date!)} — {Math.abs(expiryDays!)} days ago. Renewal required before dispatch.
                  </div>
                </div>
              </div>
            )}
            {isLicenseExpiringSoon && !isLicenseExpired && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde047', borderRadius: '12px', padding: '12px 18px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#92400e' }}>License Expiring in {expiryDays} days</div>
                  <div style={{ fontSize: '12px', color: '#b45309' }}>
                    Expires on {toIST(driver.license_expiry_date!)}. Please arrange renewal soon.
                  </div>
                </div>
              </div>
            )}

            {/* Documents section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <FileText size={16} color="#2563eb" />
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Submitted Documents & Photos</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                <DocCard
                  title="Passport Photo"
                  icon={<Camera size={14} />}
                  iconColor="#3b82f6"
                  url={driver.photo_url}
                  emptyText="No Passport Photo Uploaded"
                  isPortrait
                />
                <DocCard
                  title="License (Front Side)"
                  icon={<CreditCard size={14} />}
                  iconColor="#7c3aed"
                  url={driver.license_photo_url}
                  emptyText="No Front Photo Uploaded"
                />
                <DocCard
                  title="License (Back Side)"
                  icon={<CreditCard size={14} />}
                  iconColor="#9333ea"
                  url={driver.license_photo_back_url}
                  emptyText="No Back Photo Uploaded"
                />
                <DocCard
                  title={`Address Proof (${driver.id_proof_type || 'Document'})`}
                  icon={<FileText size={14} />}
                  iconColor="#10b981"
                  url={driver.id_proof_url}
                  emptyText="No Address Proof Uploaded"
                />
              </div>
            </div>

            {/* Footer actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '16px',
                marginTop: '4px',
                flexShrink: 0,
              }}
            >
              {onEdit ? (
                <button
                  onClick={() => { onClose(); onEdit(driver); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '9px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <Edit2 size={14} color="#2563eb" /> Edit Driver Details
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={onClose}
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '9px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handlePrint}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  title="Print Driver Record or Save as PDF"
                >
                  <Printer size={15} color="#475569" /> Print
                </button>
                <button
                  onClick={handleDownload}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '9px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(217,119,6,0.35)',
                    transition: 'transform 0.1s, box-shadow 0.15s',
                  }}
                  title="Download Driver Verification Record"
                >
                  <Download size={15} /> Download Details
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {zoomImage && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
          onClick={() => setZoomImage(null)}
        >
          <div
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', background: '#fff', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{zoomImage.title}</span>
              <button onClick={() => setZoomImage(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={15} />
              </button>
            </div>
            <img src={zoomImage.url} alt={zoomImage.title} style={{ maxWidth: '85vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} />
          </div>
        </div>
      )}
    </>
  );
};

// ─── Batch License Information Extracted Interface ───────────────────────────
interface BatchLicenseInfo {
  license_type: 'HEAVY' | 'REGULAR';
  license_type_label: string;
  license_type_detail: string;
  license_expiry_date: string | null;
  license_number: string | null;
  detected_name: string | null;
  raw_text: string;
}

// ─── Batch OCR: Extract Type (Heavy/Regular), Expiry Date, DL Number & Name from 2 Pages ───
const extractBatchLicenseInfo = (text: string): BatchLicenseInfo => {
  const t = text.toUpperCase().replace(/\r/g, '');

  // 1. License Type Detection: HEAVY (Transport / Commercial / HMV) vs REGULAR (LMV / Non-Transport)
  // Back page typically contains endorsements like TRANS, TR, HMV, HGV, HAZARDOUS, BADGE, TRUCK, BUS
  const heavyMatch = t.match(/\b(TRANS(?:PORT)?|HMV|HGV|HPV|HGMV|HPMV|MGV|HAZARD(?:OUS)?|TRAILER|HEAVY|COMMERCIAL|PSV|BADGE|TRUCK|BUS)\b/i);
  const regularMatch = t.match(/\b(LMV|LMV-NT|NON-?TRANS(?:PORT)?|MCWG|MCWOG|LIGHT\s*MOTOR)\b/i);

  let license_type: 'HEAVY' | 'REGULAR' = 'HEAVY';
  let license_type_label = 'Heavy (Transport / HMV)';
  let license_type_detail = 'Heavy / Commercial Transport';

  if (heavyMatch) {
    license_type = 'HEAVY';
    license_type_label = 'Heavy (Transport / HMV)';
    license_type_detail = `Vehicle endorsement: "${heavyMatch[0]}" (Commercial Transport)`;
  } else if (regularMatch) {
    license_type = 'REGULAR';
    license_type_label = 'Regular (Light Motor Vehicle - LMV)';
    license_type_detail = `Vehicle endorsement: "${regularMatch[0]}" (Non-Transport / LMV)`;
  } else {
    license_type = 'HEAVY';
    license_type_label = 'Heavy (Transport)';
    license_type_detail = 'Defaulted to Heavy Transport';
  }

  // 2. License Number (DL No) - usually on front page, sometimes repeated on back
  let license_number: string | null = null;
  const dlNumPattern = /\b([A-Z]{2}[-\s]?[0-9]{2}[A-Z]?[-\s]?(?:19|20)[0-9]{2}[-\s]?[0-9]{7})\b/i;
  const dlLabelPattern = /(?:DL\s*NO|DRIVING\s*LICEN[CS]E\s*NO|LICEN[CS]E\s*NO|LICENCE\s*NO|D\.L\.\s*NO)\s*[:\-.]?\s*([A-Z0-9\/\-\s]{9,24})/i;
  const dlOldPattern = /\b([A-Z]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{4,11}(?:\/[0-9]{2,4})?)\b/i;

  const mNum = t.match(dlNumPattern);
  if (mNum) {
    license_number = mNum[1].replace(/\s+/g, ' ').trim();
  } else {
    const mLabel = t.match(dlLabelPattern);
    if (mLabel) {
      license_number = mLabel[1].replace(/\s+/g, ' ').trim();
    } else {
      const mOld = t.match(dlOldPattern);
      if (mOld && mOld[1].length >= 10) {
        license_number = mOld[1].replace(/\s+/g, ' ').trim();
      }
    }
  }

  // 3. Expiry Date: prioritize Transport/TR validity (commercial) found on front or back page
  let license_expiry_date: string | null = null;
  const trValidityPattern = /(?:VALID(?:ITY)?\s*(?:TILL|UP\s*TO|UPTO)?\s*\(?TR(?:ANS)?\)?|TR(?:ANS)?\s*(?:VALID(?:ITY)?|VALID\s*UP\s*TO|TILL)?|AUTHORI[SZ]ATION\s*TO\s*DRIVE\s*TRANSPORT[^\n]*VALID(?:ITY)?\s*(?:TILL|UP\s*TO)?)\s*[:\-.]?\s*([0-9]{2}[\-\/\.][0-9]{2}[\-\/\.][0-9]{2,4}|[0-9]{2}-[A-Z]{3}-[0-9]{2,4})/i;
  const genValidityPattern = /(?:VALID(?:ITY)?\s*(?:TILL|UP\s*TO|UPTO)?|EXPIRY|EXPIR(?:ES|Y)?\s*(?:DATE|ON)?|VALID\s*UP\s*TO)\s*[:\-.]?\s*([0-9]{2}[\-\/\.][0-9]{2}[\-\/\.][0-9]{2,4}|[0-9]{2}-[A-Z]{3}-[0-9]{2,4})/i;

  const mTr = t.match(trValidityPattern);
  if (mTr && mTr[1]) {
    license_expiry_date = parseDateToISO(mTr[1]);
  }
  if (!license_expiry_date) {
    const mGen = t.match(genValidityPattern);
    if (mGen && mGen[1]) {
      license_expiry_date = parseDateToISO(mGen[1]);
    }
  }

  // Fallback: parse all dates, excluding DOB / DOI lines
  if (!license_expiry_date) {
    const allDates: string[] = [];
    const lines = t.split('\n');
    const dateRegex = /\b(\d{2}[\-\/\.\s]\d{2}[\-\/\.\s]\d{4})\b|\b(\d{2}-[A-Z]{3}-\d{4})\b/g;
    for (const line of lines) {
      if (/(?:DOB|BIRTH|D\.O\.B|DOI|ISSUE|ISSUED|D\.O\.I)/i.test(line) && !/VALID|EXPIR|TILL|UPTO|TR/i.test(line)) {
        continue;
      }
      let mDate: RegExpExecArray | null;
      while ((mDate = dateRegex.exec(line)) !== null) {
        const parsed = parseDateToISO(mDate[1] || mDate[2]);
        if (parsed) allDates.push(parsed);
      }
    }
    if (allDates.length > 0) {
      allDates.sort();
      license_expiry_date = allDates[allDates.length - 1];
    }
  }

  // 4. Name Detection
  let detected_name: string | null = null;
  const namePattern = /(?:NAME|NAME\s*OF\s*HOLDER|HOLDER['']?S?\s*NAME)\s*[:\-.]?\s*([A-Z\s.]{3,35})(?:\n|\r|DOB|S\/O|D\/O|W\/O|SON|DAUGHTER|FATHER|ADDRESS|RELATION|$)/i;
  const mName = t.match(namePattern);
  if (mName && mName[1]) {
    const cleanName = mName[1].replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanName.length >= 3 && !/^(DRIVING|LICENCE|UNION|INDIA|FORM|TRANSPORT)/i.test(cleanName)) {
      detected_name = cleanName;
    }
  }

  return {
    license_type,
    license_type_label,
    license_type_detail,
    license_expiry_date,
    license_number,
    detected_name,
    raw_text: text,
  };
};

const parseDateToISO = (raw: string): string | null => {
  try {
    // Replace separators
    const clean = raw.replace(/[.\/\s]/g, '-').toUpperCase();
    const parts = clean.split('-');
    if (parts.length !== 3) return null;

    const monthMap: Record<string, string> = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
    };

    let [p1, p2, p3] = parts;

    // DD-MON-YYYY
    if (p2.length === 3 && isNaN(Number(p2))) {
      const mm = monthMap[p2];
      if (!mm) return null;
      const yr = p3.length === 2 ? `20${p3}` : p3;
      return `${yr}-${mm}-${p1.padStart(2, '0')}`;
    }

    // DD-MM-YYYY or DD-MM-YY
    if (p1.length <= 2 && p2.length <= 2) {
      const yr = p3.length === 2 ? `20${p3}` : p3;
      return `${yr}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
    }

    return null;
  } catch {
    return null;
  }
};

// ─── Main Drivers Page Component ──────────────────────────────────────────────
export const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    mobile_number: '',
    license_number: '',
    license_type: 'HEAVY' as 'HEAVY' | 'REGULAR',
    id_proof_type: 'Aadhar Card',
    photo_url: '',
    license_photo_url: '',
    license_photo_back_url: '',
    license_expiry_date: '',
    id_proof_url: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Batch OCR state for 2-page extraction
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [scanningSide, setScanningSide] = useState<'front' | 'back' | null>(null);
  const [frontOcrText, setFrontOcrText] = useState('');
  const [backOcrText, setBackOcrText] = useState('');
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'scanning' | 'found' | 'not_found'>('idle');
  const [batchOcrResult, setBatchOcrResult] = useState<BatchLicenseInfo | null>(null);
  const [isManualEdit, setIsManualEdit] = useState(false);

  // Profile View Modal state
  const [profileDriver, setProfileDriver] = useState<Driver | null>(null);

  // File Input References
  const photoInputRef = useRef<HTMLInputElement>(null);
  const licenseFrontInputRef = useRef<HTMLInputElement>(null);
  const licenseBackInputRef = useRef<HTMLInputElement>(null);
  const idProofInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDrivers();
  }, [page, search]);

  const loadDrivers = async () => {
    try {
      setIsLoading(true);
      const res = await driverService.getDrivers({
        page,
        limit: 10,
        search: search || undefined,
      });
      setDrivers(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load drivers', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'photo_url' | 'license_photo_url' | 'license_photo_back_url' | 'id_proof_url'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = isPdfFile(file);
    if (!isImage && !isPdf) {
      alert('Please select a valid image file (PNG, JPG, JPEG, WEBP) or PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be under 10 MB.');
      return;
    }
    const base64 = await readAsBase64(file);
    setFormData((prev) => ({ ...prev, [field]: base64 }));
    e.target.value = '';

    // ── Run Batch OCR for Driving License Front or Back ──────────────────────
    if (field === 'license_photo_url' || field === 'license_photo_back_url') {
      const isFront = field === 'license_photo_url';
      setScanningSide(isFront ? 'front' : 'back');
      setIsOcrScanning(true);
      setOcrStatus('scanning');
      try {
        const text = await extractTextFromFile(file);

        console.log(`[Batch OCR] Extracted text from License ${isFront ? 'FRONT' : 'BACK'}:`, text);

        const newFrontText = isFront ? text : frontOcrText;
        const newBackText = isFront ? backOcrText : text;
        if (isFront) setFrontOcrText(text);
        else setBackOcrText(text);

        // Combine text from both sides so all details are merged
        const combinedText = [newFrontText, newBackText].filter(Boolean).join('\n---\n');
        const batchInfo = extractBatchLicenseInfo(combinedText);
        setBatchOcrResult(batchInfo);

        // Auto-update license fields from 2-page extraction
        setFormData((prev) => ({
          ...prev,
          license_type: batchInfo.license_type,
          ...(batchInfo.license_expiry_date ? { license_expiry_date: batchInfo.license_expiry_date } : {}),
          ...(batchInfo.license_number ? { license_number: batchInfo.license_number } : {}),
        }));

        if (batchInfo.license_expiry_date || batchInfo.license_number || batchInfo.license_type) {
          setOcrStatus('found');
        } else {
          setOcrStatus('not_found');
        }
      } catch (err) {
        console.error('[Batch OCR] Error:', err);
        setOcrStatus('not_found');
      } finally {
        setIsOcrScanning(false);
        setScanningSide(null);
      }
    }
  };

  const handleRemoveLicensePage = (side: 'front' | 'back') => {
    if (side === 'front') {
      const remainingBack = backOcrText;
      setFrontOcrText('');
      setFormData((prev) => ({ ...prev, license_photo_url: '' }));
      if (remainingBack) {
        const info = extractBatchLicenseInfo(remainingBack);
        setBatchOcrResult(info);
        setFormData((prev) => ({
          ...prev,
          license_type: info.license_type,
          ...(info.license_expiry_date ? { license_expiry_date: info.license_expiry_date } : {}),
          ...(info.license_number ? { license_number: info.license_number } : {}),
        }));
      } else {
        setBatchOcrResult(null);
        setOcrStatus('idle');
      }
    } else {
      const remainingFront = frontOcrText;
      setBackOcrText('');
      setFormData((prev) => ({ ...prev, license_photo_back_url: '' }));
      if (remainingFront) {
        const info = extractBatchLicenseInfo(remainingFront);
        setBatchOcrResult(info);
        setFormData((prev) => ({
          ...prev,
          license_type: info.license_type,
          ...(info.license_expiry_date ? { license_expiry_date: info.license_expiry_date } : {}),
          ...(info.license_number ? { license_number: info.license_number } : {}),
        }));
      } else {
        setBatchOcrResult(null);
        setOcrStatus('idle');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Driver name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload = {
        name: formData.name.trim(),
        mobile_number: formData.mobile_number.trim() || undefined,
        license_number: formData.license_number.trim() || undefined,
        license_type: formData.license_type || 'HEAVY',
        id_proof_type: formData.id_proof_type || undefined,
        photo_url: formData.photo_url || undefined,
        license_photo_url: formData.license_photo_url || undefined,
        license_photo_back_url: formData.license_photo_back_url || undefined,
        license_expiry_date: formData.license_expiry_date || undefined,
        id_proof_url: formData.id_proof_url || undefined,
      };

      if (selectedDriver) {
        await driverService.updateDriver(selectedDriver.id, payload);
      } else {
        await driverService.createDriver(payload);
      }

      setIsModalOpen(false);
      setSelectedDriver(null);
      resetForm();
      loadDrivers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save driver.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (driver: Driver) => {
    if (!confirm(`Are you sure you want to delete driver "${driver.name}"?`)) return;
    try {
      await driverService.deleteDriver(driver.id);
      loadDrivers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete driver.');
    }
  };

  const openCreate = () => {
    setSelectedDriver(null);
    resetForm();
    setOcrStatus('idle');
    setIsOcrScanning(false);
    setBatchOcrResult(null);
    setFrontOcrText('');
    setBackOcrText('');
    setScanningSide(null);
    setIsManualEdit(false);
    setIsModalOpen(true);
  };

  const openEdit = (driver: Driver) => {
    setSelectedDriver(driver);
    setFormData({
      name: driver.name,
      mobile_number: driver.mobile_number || '',
      license_number: driver.license_number || '',
      license_type: (driver.license_type as 'HEAVY' | 'REGULAR') || 'HEAVY',
      id_proof_type: driver.id_proof_type || 'Aadhar Card',
      photo_url: driver.photo_url || '',
      license_photo_url: driver.license_photo_url || '',
      license_photo_back_url: driver.license_photo_back_url || '',
      license_expiry_date: driver.license_expiry_date ? driver.license_expiry_date.split('T')[0] : '',
      id_proof_url: driver.id_proof_url || '',
    });
    setFormError('');
    setOcrStatus('idle');
    setIsOcrScanning(false);
    setBatchOcrResult(null);
    setFrontOcrText('');
    setBackOcrText('');
    setScanningSide(null);
    setIsManualEdit(true);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      mobile_number: '',
      license_number: '',
      license_type: 'HEAVY',
      id_proof_type: 'Aadhar Card',
      photo_url: '',
      license_photo_url: '',
      license_photo_back_url: '',
      license_expiry_date: '',
      id_proof_url: '',
    });
    setFormError('');
    setBatchOcrResult(null);
    setFrontOcrText('');
    setBackOcrText('');
    setScanningSide(null);
  };

  // ─── Table Columns ─────────────────────────────────────────────────────────
  const columns: Column<Driver>[] = [
    {
      header: 'Driver Name',
      accessor: 'name',
      render: (d) => (
        <button
          onClick={() => setProfileDriver(d)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
          title="Click to view driver details"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {d.photo_url ? (
              <img
                src={d.photo_url}
                alt={d.name}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #e2e8f0',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  flexShrink: 0,
                }}
              >
                {d.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div
                style={{
                  fontWeight: 700,
                  color: '#2563eb',
                  fontSize: '14px',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                  textUnderlineOffset: '3px',
                }}
              >
                {d.name}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Eye size={11} color="#94a3b8" /> Click to view profile
              </div>
            </div>
          </div>
        </button>
      ),
    },
    {
      header: 'Phone Number',
      accessor: (d) => d.mobile_number || '—',
      render: (d) => (
        d.mobile_number ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <Phone size={13} color="#64748b" />
            {d.mobile_number}
          </div>
        ) : <span style={{ color: '#94a3b8' }}>—</span>
      ),
    },
    {
      header: 'License Type & DL No',
      accessor: (d) => d.license_type || 'HEAVY',
      render: (d) => {
        const isHeavy = (d.license_type || 'HEAVY').toUpperCase() === 'HEAVY';
        return (
          <div>
            <span
              style={{
                background: isHeavy ? '#eff6ff' : '#f0fdfa',
                color: isHeavy ? '#1d4ed8' : '#0f766e',
                border: `1px solid ${isHeavy ? '#bfdbfe' : '#99f6e4'}`,
                padding: '3px 9px',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title={isHeavy ? 'Heavy Commercial / Transport Vehicle License' : 'Regular / Light Motor Vehicle (LMV) License'}
            >
              {isHeavy ? <Truck size={12} color="#2563eb" /> : <CreditCard size={12} color="#0d9488" />}
              {isHeavy ? 'HEAVY (Transport)' : 'REGULAR (LMV)'}
            </span>
            {d.license_number && (
              <div style={{ fontSize: '11px', color: '#475569', fontWeight: 700, marginTop: '3px', fontFamily: 'monospace' }}>
                {d.license_number}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'License Expiry',
      accessor: (d) => d.license_expiry_date || '—',
      render: (d) => {
        if (!d.license_expiry_date) return <span style={{ color: '#94a3b8' }}>—</span>;
        const days = getDaysDifference(d.license_expiry_date);
        const isExpired = days < 0;
        const isExpiringSoon = days >= 0 && days <= 30;

        if (isExpired) {
          return (
            <span
              style={{
                background: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={`License expired ${Math.abs(days)} days ago`}
            >
              <AlertTriangle size={12} color="#dc2626" />
              Expired ({toIST(d.license_expiry_date)})
            </span>
          );
        }

        if (isExpiringSoon) {
          return (
            <span
              style={{
                background: '#fffbeb',
                color: '#b45309',
                border: '1px solid #fde047',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={`Expiring in ${days} days`}
            >
              <AlertTriangle size={12} color="#d97706" />
              {days === 0 ? 'Today' : `${days}d left`} ({toIST(d.license_expiry_date)})
            </span>
          );
        }

        return (
          <span
            style={{
              background: '#f0fdf4',
              color: '#15803d',
              border: '1px solid #bbf7d0',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 600,
            }}
          >
            {toIST(d.license_expiry_date)}
          </span>
        );
      },
    },
    {
      header: 'Address Proof',
      accessor: (d) => d.id_proof_type || '—',
      render: (d) => (
        d.id_proof_type ? (
          <span
            style={{
              background: '#eff6ff',
              color: '#2563eb',
              fontSize: '12px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '20px',
              border: '1px solid #bfdbfe',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShieldCheck size={12} />
            {d.id_proof_type}
          </span>
        ) : <span style={{ color: '#94a3b8' }}>—</span>
      ),
    },
    {
      header: 'Documents',
      accessor: 'name',
      render: (d) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Passport Photo */}
          <span
            title={d.photo_url ? 'Passport Photo: Uploaded' : 'Passport Photo: Not uploaded'}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: d.photo_url ? '#dcfce7' : '#f1f5f9',
              color: d.photo_url ? '#166534' : '#94a3b8',
              border: `1px solid ${d.photo_url ? '#bbf7d0' : '#e2e8f0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {d.photo_url ? '📷' : <Camera size={13} color="#cbd5e1" />}
          </span>

          {/* License Photo (Front & Back) */}
          <span
            title={
              d.license_photo_url && d.license_photo_back_url
                ? 'Driving License: Front & Back Uploaded'
                : d.license_photo_url
                ? 'Driving License: Front Side Uploaded'
                : d.license_photo_back_url
                ? 'Driving License: Back Side Uploaded'
                : 'Driving License: Not uploaded'
            }
            style={{
              minWidth: '26px',
              height: '26px',
              padding: d.license_photo_url && d.license_photo_back_url ? '0 5px' : '0',
              borderRadius: '6px',
              background: d.license_photo_url || d.license_photo_back_url ? '#ede9fe' : '#f1f5f9',
              color: d.license_photo_url || d.license_photo_back_url ? '#5b21b6' : '#94a3b8',
              border: `1px solid ${d.license_photo_url || d.license_photo_back_url ? '#ddd6fe' : '#e2e8f0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {d.license_photo_url && d.license_photo_back_url
              ? '🪪 2/2'
              : d.license_photo_url || d.license_photo_back_url
              ? '🪪 1/2'
              : <CreditCard size={13} color="#cbd5e1" />}
          </span>

          {/* Address Proof Document */}
          <span
            title={d.id_proof_url ? `Address Proof (${d.id_proof_type || 'Doc'}): Uploaded` : 'Address Proof: Not uploaded'}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: d.id_proof_url ? '#e0f2fe' : '#f1f5f9',
              color: d.id_proof_url ? '#0369a1' : '#94a3b8',
              border: `1px solid ${d.id_proof_url ? '#bae6fd' : '#e2e8f0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {d.id_proof_url ? '📄' : <FileText size={13} color="#cbd5e1" />}
          </span>
        </div>
      ),
    },
    {
      header: 'Joined Date',
      accessor: (d) => (d.created_at ? toIST(d.created_at) : '—'),
    },
    {
      header: 'Actions',
      render: (d) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setProfileDriver(d)}
            className="btn btn-outline btn-sm"
            title="View Details & Download"
            style={{ color: '#2563eb', borderColor: '#bfdbfe' }}
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => openEdit(d)}
            className="btn btn-outline btn-sm"
            title="Edit Driver"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDelete(d)}
            className="btn btn-danger btn-sm"
            title="Delete Driver"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  // ─── File Upload Box Helper Component ──────────────────────────────────────
  const UploadCard = ({
    title,
    subtitle,
    previewUrl,
    inputRef,
    field,
    badge,
    isScanning,
  }: {
    title: string;
    subtitle: string;
    previewUrl: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    field: 'photo_url' | 'license_photo_url' | 'license_photo_back_url' | 'id_proof_url';
    badge?: string;
    isScanning?: boolean;
  }) => (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{title}</div>
        {badge && (
          <span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>{subtitle}</div>

      {previewUrl ? (
        <div style={{ position: 'relative', textAlign: 'center', marginTop: 'auto' }}>
          {isPdfFile(previewUrl) ? (
            <div
              onClick={() => window.open(previewUrl, '_blank')}
              style={{
                cursor: 'pointer',
                padding: '16px 12px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
              title="Click to preview PDF"
            >
              <FileText size={28} color="#dc2626" />
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#991b1b' }}>PDF Document</span>
              <span style={{ fontSize: '10.5px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Eye size={10} /> View PDF
              </span>
            </div>
          ) : (
            <img
              src={previewUrl}
              alt={title}
              style={{
                maxHeight: '140px',
                maxWidth: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
                border: isScanning ? '2px solid #7c3aed' : '2px solid #3b82f6',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                opacity: isScanning ? 0.7 : 1,
              }}
            />
          )}
          {isScanning && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(109, 40, 217, 0.12)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}>
              <ScanLine size={22} color="#7c3aed" style={{ animation: 'pulse 1.2s ease-in-out infinite' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#6d28d9', background: 'rgba(255,255,255,0.85)', padding: '2px 8px', borderRadius: '10px' }}>Scanning...</span>
            </div>
          )}
          {!isScanning && (
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, [field]: '' }))}
              style={{
                position: 'absolute',
                top: '-8px',
                right: '10px',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              }}
              title="Remove file"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '10px',
            padding: '20px 10px',
            textAlign: 'center',
            cursor: 'pointer',
            background: '#ffffff',
            marginTop: 'auto',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f6';
            (e.currentTarget as HTMLDivElement).style.background = '#eff6ff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#cbd5e1';
            (e.currentTarget as HTMLDivElement).style.background = '#ffffff';
          }}
        >
          <Camera size={24} style={{ color: '#94a3b8', margin: '0 auto 6px' }} />
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>Click to upload</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>JPG, PNG or PDF up to 10MB</div>
        </div>
      )}

      <input
        type="file"
        ref={inputRef}
        accept="image/*,application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e, field)}
      />
    </div>
  );

  return (
    <div>
      {/* Page Header */}
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Driver Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Manage driver profiles, driving license photos & expiry dates, and address proofs
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add Driver
        </button>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="form-control"
              placeholder="Search driver by name, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={drivers}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
        />
      </div>

      {/* ─── Add / Edit Driver Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDriver(null);
        }}
        title={selectedDriver ? `Edit Driver: ${selectedDriver.name}` : 'Add New Driver'}
      >
        {formError && (
          <div
            style={{
              color: '#b91c1c',
              background: '#fef2f2',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              border: '1px solid #fecaca',
            }}
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 1: UPLOAD DRIVING LICENSE (FRONT & BACK PAGES)             */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div
            style={{
              background: formData.license_photo_url && formData.license_photo_back_url
                ? '#f0fdf4'
                : formData.license_photo_url || formData.license_photo_back_url
                ? '#eff6ff'
                : '#f8fafc',
              border: formData.license_photo_url && formData.license_photo_back_url
                ? '1.5px solid #86efac'
                : formData.license_photo_url || formData.license_photo_back_url
                ? '1.5px solid #93c5fd'
                : '2px dashed #93c5fd',
              borderRadius: '16px',
              padding: '18px 20px',
              marginBottom: '22px',
              boxShadow: formData.license_photo_url || formData.license_photo_back_url
                ? '0 4px 12px rgba(37, 99, 235, 0.08)'
                : 'none',
              transition: 'all 0.2s',
            }}
          >
            {/* Header with Title and Status Badges */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="#2563eb" />
                <span style={{ fontWeight: 800, fontSize: '14.5px', color: '#0f172a' }}>
                  Step 1: Upload Driving License (Front & Back Pages)
                </span>
                <span
                  style={{
                    background: formData.license_photo_url && formData.license_photo_back_url
                      ? '#dcfce7'
                      : formData.license_photo_url || formData.license_photo_back_url
                      ? '#dbeafe'
                      : '#f1f5f9',
                    color: formData.license_photo_url && formData.license_photo_back_url
                      ? '#15803d'
                      : formData.license_photo_url || formData.license_photo_back_url
                      ? '#1d4ed8'
                      : '#64748b',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: `1px solid ${
                      formData.license_photo_url && formData.license_photo_back_url
                        ? '#bbf7d0'
                        : formData.license_photo_url || formData.license_photo_back_url
                        ? '#bfdbfe'
                        : '#e2e8f0'
                    }`,
                  }}
                >
                  {formData.license_photo_url && formData.license_photo_back_url
                    ? '✅ Both Sides Uploaded'
                    : formData.license_photo_url
                    ? '🪪 Front Uploaded (Upload Back for Vehicle Class/TR Expiry)'
                    : formData.license_photo_back_url
                    ? '🔄 Back Uploaded (Upload Front for DL No/Name)'
                    : '⚡ 2-Page Smart Auto-Fill'}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>
              Upload both the <strong>Front Page</strong> (Driver Photo, DL Number & Name) and <strong>Back Page</strong> (Vehicle Endorsement Classes, TR Transport Validity & Address). Details from both pages are automatically merged and extracted below.
            </p>

            {/* 2-Column Upload Cards for Front & Back */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              {/* FRONT PAGE UPLOAD CARD */}
              <div
                style={{
                  background: '#ffffff',
                  border: formData.license_photo_url ? '1.5px solid #86efac' : '1.5px dashed #93c5fd',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={15} color="#2563eb" />
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>Front Page</strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>(Photo, DL No & Name)</span>
                  </div>
                  {formData.license_photo_url && (
                    <span style={{ fontSize: '10.5px', color: '#166534', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      ✓ Uploaded
                    </span>
                  )}
                </div>

                {isOcrScanning && scanningSide === 'front' ? (
                  <div style={{ padding: '20px', textAlign: 'center', background: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
                    <ScanLine size={24} color="#7c3aed" style={{ animation: 'pulse 1.2s ease-in-out infinite', margin: '0 auto 6px' }} />
                    <div style={{ fontWeight: 700, fontSize: '12px', color: '#6d28d9' }}>Scanning Front Page...</div>
                  </div>
                ) : formData.license_photo_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isPdfFile(formData.license_photo_url) ? (
                      <div
                        onClick={() => window.open(formData.license_photo_url, '_blank')}
                        style={{
                          width: '90px',
                          height: '60px',
                          borderRadius: '6px',
                          border: '1.5px solid #ef4444',
                          background: '#fef2f2',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="Click to view PDF"
                      >
                        <FileText size={20} color="#dc2626" />
                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#991b1b' }}>PDF Front</span>
                      </div>
                    ) : (
                      <img
                        src={formData.license_photo_url}
                        alt="License Front"
                        style={{
                          width: '90px',
                          height: '60px',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          border: '1.5px solid #22c55e',
                          background: '#f8fafc',
                        }}
                      />
                    )}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => licenseFrontInputRef.current?.click()}
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#1d4ed8',
                          cursor: 'pointer',
                        }}
                      >
                        Change Front Page
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveLicensePage('front')}
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#dc2626',
                          cursor: 'pointer',
                        }}
                      >
                        Remove Front
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => licenseFrontInputRef.current?.click()}
                    style={{
                      border: '1.5px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '16px 12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: '#f8fafc',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#2563eb';
                      (e.currentTarget as HTMLDivElement).style.background = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#cbd5e1';
                      (e.currentTarget as HTMLDivElement).style.background = '#f8fafc';
                    }}
                  >
                    <Camera size={24} style={{ color: '#3b82f6', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1d4ed8' }}>
                      Click to Upload Front Page
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      DL No, Photo & Name
                    </div>
                  </div>
                )}
              </div>

              {/* BACK PAGE UPLOAD CARD */}
              <div
                style={{
                  background: '#ffffff',
                  border: formData.license_photo_back_url ? '1.5px solid #86efac' : '1.5px dashed #93c5fd',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={15} color="#7c3aed" />
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>Back Page</strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>(Vehicle Class, TR Expiry)</span>
                  </div>
                  {formData.license_photo_back_url && (
                    <span style={{ fontSize: '10.5px', color: '#166534', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      ✓ Uploaded
                    </span>
                  )}
                </div>

                {isOcrScanning && scanningSide === 'back' ? (
                  <div style={{ padding: '20px', textAlign: 'center', background: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
                    <ScanLine size={24} color="#7c3aed" style={{ animation: 'pulse 1.2s ease-in-out infinite', margin: '0 auto 6px' }} />
                    <div style={{ fontWeight: 700, fontSize: '12px', color: '#6d28d9' }}>Scanning Back Page...</div>
                  </div>
                ) : formData.license_photo_back_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isPdfFile(formData.license_photo_back_url) ? (
                      <div
                        onClick={() => window.open(formData.license_photo_back_url, '_blank')}
                        style={{
                          width: '90px',
                          height: '60px',
                          borderRadius: '6px',
                          border: '1.5px solid #ef4444',
                          background: '#fef2f2',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="Click to view PDF"
                      >
                        <FileText size={20} color="#dc2626" />
                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#991b1b' }}>PDF Back</span>
                      </div>
                    ) : (
                      <img
                        src={formData.license_photo_back_url}
                        alt="License Back"
                        style={{
                          width: '90px',
                          height: '60px',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          border: '1.5px solid #22c55e',
                          background: '#f8fafc',
                        }}
                      />
                    )}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => licenseBackInputRef.current?.click()}
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#1d4ed8',
                          cursor: 'pointer',
                        }}
                      >
                        Change Back Page
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveLicensePage('back')}
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#dc2626',
                          cursor: 'pointer',
                        }}
                      >
                        Remove Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => licenseBackInputRef.current?.click()}
                    style={{
                      border: '1.5px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '16px 12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: '#f8fafc',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#7c3aed';
                      (e.currentTarget as HTMLDivElement).style.background = '#f5f3ff';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#cbd5e1';
                      (e.currentTarget as HTMLDivElement).style.background = '#f8fafc';
                    }}
                  >
                    <Camera size={24} style={{ color: '#7c3aed', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#6d28d9' }}>
                      Click to Upload Back Page
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      Vehicle Class, TR Expiry & Badge
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Scanning Banner */}
            {isOcrScanning && (
              <div
                style={{
                  background: '#f5f3ff',
                  border: '1.5px solid #ddd6fe',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}
              >
                <ScanLine size={24} color="#7c3aed" style={{ animation: 'pulse 1.2s ease-in-out infinite' }} />
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#6d28d9' }}>
                  Scanning {scanningSide === 'front' ? 'Front Page' : 'Back Page'} & extracting details across both sides...
                </div>
              </div>
            )}

            {/* Extracted Details Summary (Shown whenever at least 1 page is uploaded) */}
            {(formData.license_photo_url || formData.license_photo_back_url) && !isOcrScanning && (
              <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803d', fontWeight: 800, fontSize: '13px' }}>
                    <CheckCircle size={15} /> All Details Auto-Extracted Successfully
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {formData.license_photo_url && formData.license_photo_back_url
                      ? '✨ Combined extraction from both Front and Back pages'
                      : formData.license_photo_url
                      ? 'Extracted from Front page (Tip: Upload Back page for vehicle class & TR expiry)'
                      : 'Extracted from Back page (Tip: Upload Front page for DL number & photo)'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>License Class</div>
                    <div style={{ fontWeight: 800, fontSize: '12.5px', color: formData.license_type === 'HEAVY' ? '#1d4ed8' : '#0f766e' }}>
                      {formData.license_type === 'HEAVY' ? '🚛 HEAVY (Transport / HMV)' : '🚗 REGULAR (LMV)'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>DL Number</div>
                    <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#0f172a', fontFamily: 'monospace' }}>
                      {formData.license_number || 'Detected'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Transport Expiry Date</div>
                    <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#15803d' }}>
                      {formData.license_expiry_date ? toIST(formData.license_expiry_date) : 'Detected'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hidden File Inputs for Front & Back */}
            <input
              type="file"
              ref={licenseFrontInputRef}
              accept="image/*,application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e, 'license_photo_url')}
            />
            <input
              type="file"
              ref={licenseBackInputRef}
              accept="image/*,application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e, 'license_photo_back_url')}
            />
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 2: AUTO-EXTRACTED DRIVER DETAILS (LOCKED / NO TYPING)      */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#2563eb" />
              <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                Step 2: Auto-Extracted Driver Details
              </span>
              <span
                style={{
                  fontSize: '11px',
                  background: isManualEdit ? '#fef3c7' : '#ecfdf5',
                  color: isManualEdit ? '#b45309' : '#059669',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  border: `1px solid ${isManualEdit ? '#fde68a' : '#a7f3d0'}`,
                }}
              >
                {isManualEdit ? '✏️ Manual Edit Enabled' : '🔒 Locked (Auto-Read from DL)'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsManualEdit(!isManualEdit)}
              style={{
                background: isManualEdit ? '#f8fafc' : '#eff6ff',
                border: `1px solid ${isManualEdit ? '#cbd5e1' : '#bfdbfe'}`,
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                color: isManualEdit ? '#475569' : '#2563eb',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Click to unlock if you need to manually change any value"
            >
              {isManualEdit ? <Lock size={12} /> : <Unlock size={12} />}
              {isManualEdit ? 'Lock (No Typing)' : 'Unlock to Edit Manually'}
            </button>
          </div>

          {/* Driver Name & Phone */}
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">
                <UserIcon size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Driver Name * (Manual Entry)
              </label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="Type Driver Name (e.g. SIVAKUMAR)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                Type the driver's full name manually.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Phone size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Driver Phone Number
              </label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g. 9876543210 (Optional)"
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
              />
            </div>
          </div>

          {/* License Type (Heavy / Regular) & License Number */}
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Truck size={14} style={{ color: '#2563eb' }} />
                  License Type (Vehicle Class) *
                </span>
                {!isManualEdit && (
                  <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Lock size={10} /> Auto-detected
                  </span>
                )}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  disabled={!isManualEdit}
                  onClick={() => setFormData({ ...formData, license_type: 'HEAVY' })}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: formData.license_type === 'HEAVY' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: formData.license_type === 'HEAVY' ? '#eff6ff' : '#ffffff',
                    color: formData.license_type === 'HEAVY' ? '#1e40af' : '#64748b',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: isManualEdit ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    opacity: !isManualEdit && formData.license_type !== 'HEAVY' ? 0.6 : 1,
                  }}
                >
                  <Truck size={14} color={formData.license_type === 'HEAVY' ? '#2563eb' : '#64748b'} />
                  Heavy (Transport / HMV)
                </button>

                <button
                  type="button"
                  disabled={!isManualEdit}
                  onClick={() => setFormData({ ...formData, license_type: 'REGULAR' })}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: formData.license_type === 'REGULAR' ? '2px solid #0d9488' : '1px solid #cbd5e1',
                    background: formData.license_type === 'REGULAR' ? '#f0fdfa' : '#ffffff',
                    color: formData.license_type === 'REGULAR' ? '#0f766e' : '#64748b',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: isManualEdit ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    opacity: !isManualEdit && formData.license_type !== 'REGULAR' ? 0.6 : 1,
                  }}
                >
                  <CreditCard size={14} color={formData.license_type === 'REGULAR' ? '#0d9488' : '#64748b'} />
                  Regular (LMV / Light)
                </button>
              </div>
              <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                🚛 Heavy drivers are authorized for lorries & transport vehicles.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CreditCard size={14} style={{ color: '#6366f1' }} />
                  Driving License Number (DL No)
                </span>
                {!isManualEdit && (
                  <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Lock size={10} /> Auto-read from DL
                  </span>
                )}
              </label>
              <input
                type="text"
                className="form-control"
                readOnly={!isManualEdit}
                placeholder={formData.license_photo_url ? 'DL number auto-extracted' : 'Upload license above to auto-fill'}
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value.toUpperCase() })}
                style={
                  !isManualEdit
                    ? {
                        background: formData.license_number ? '#f0fdf4' : '#f8fafc',
                        borderColor: formData.license_number ? '#bbf7d0' : '#e2e8f0',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        cursor: 'default',
                      }
                    : {}
                }
              />
            </div>
          </div>

          {/* License Expiry Date & Address Proof Type */}
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={13} style={{ color: '#dc2626' }} />
                  License Expiry Date
                </span>
                {!isManualEdit && (
                  <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Lock size={10} /> Auto-read from DL
                  </span>
                )}
              </label>

              <DateField
                readOnly={!isManualEdit}
                value={formData.license_expiry_date}
                onChange={(e) => setFormData({ ...formData, license_expiry_date: e.target.value })}
                style={
                  !isManualEdit
                    ? {
                        background: formData.license_expiry_date ? '#f0fdf4' : '#f8fafc',
                        borderColor: formData.license_expiry_date ? '#bbf7d0' : '#e2e8f0',
                        fontWeight: 700,
                        color: '#0f172a',
                        cursor: 'default',
                      }
                    : {}
                }
              />
              <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                ⚠️ System alerts admin & managers 30 days before this date.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <ShieldCheck size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Address Proof Type
              </label>
              <select
                className="form-control form-select"
                value={formData.id_proof_type}
                onChange={(e) => setFormData({ ...formData, id_proof_type: e.target.value })}
              >
                {ADDRESS_PROOF_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 3: ADDITIONAL PHOTOS / DOCUMENTS (OPTIONAL)                */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div style={{ margin: '18px 0 16px', borderTop: '1px solid #e2e8f0', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                top: '-10px',
                left: '12px',
                background: '#ffffff',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Step 3: Other Photos & Documents (Optional)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {/* 1. Passport Size Photo */}
            <UploadCard
              title="Passport Size Photo"
              subtitle="Driver passport photo for profile"
              previewUrl={formData.photo_url}
              inputRef={photoInputRef}
              field="photo_url"
              badge="Photo"
            />

            {/* 2. Address Proof */}
            <UploadCard
              title="Address Proof"
              subtitle={`${formData.id_proof_type || 'Aadhar / Family Card'}`}
              previewUrl={formData.id_proof_url}
              inputRef={idProofInputRef}
              field="id_proof_url"
              badge="Address"
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setSelectedDriver(null);
              }}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : selectedDriver ? 'Update Driver' : 'Save Driver'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Profile Details & Download Modal ────────────────────────────── */}
      <DriverProfileModal
        driver={profileDriver}
        onClose={() => setProfileDriver(null)}
        onEdit={openEdit}
      />
    </div>
  );
};
