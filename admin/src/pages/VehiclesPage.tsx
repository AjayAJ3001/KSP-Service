import React, { useState, useEffect, useRef } from 'react';
import {
  Truck, Plus, Edit2, Search, Trash2, Eye, Download, Printer, X, Share2, Copy, Check,
  Calendar, ShieldCheck, FileText, CreditCard, AlertTriangle, AlertCircle,
  Camera, CheckCircle, User as UserIcon, Building, DollarSign,
  ScanLine, Loader, RefreshCw
} from 'lucide-react';
import { vehicleService } from '../services/adminService';
import { Vehicle } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import Tesseract from 'tesseract.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toIST = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return d;
  }
};

const getDaysDifference = (expiryDateStr?: string | null): number | null => {
  if (!expiryDateStr) return null;
  try {
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

const readAsBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const formatCurrency = (val: number | string | undefined) => {
  const num = parseFloat(String(val)) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ─── OCR Date Extraction ──────────────────────────────────────────────────────
const parseIndianDate = (text: string): string | null => {
  // Normalise OCR noise
  const t = text.replace(/[oO]/g, '0').replace(/[lI|]/g, '1');

  const patterns = [
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/g,
    // YYYY/MM/DD
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/g,
    // DD Mon YYYY  e.g. 15 Mar 2026
    /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/g,
    // Mon YYYY  (e.g. MAR 2026 – treat as last day of month)
    /([A-Za-z]{3,9})\s+(\d{4})/g,
  ];

  const months: Record<string, string> = {
    jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
    jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
    january:'01', february:'02', march:'03', april:'04', june:'06',
    july:'07', august:'08', september:'09', october:'10', november:'11', december:'12',
  };

  const candidates: Date[] = [];

  // Pattern 1: DD/MM/YYYY
  const p1 = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/g;
  let m;
  while ((m = p1.exec(t)) !== null) {
    const d = new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
    if (!isNaN(d.getTime())) candidates.push(d);
  }

  // Pattern 2: YYYY/MM/DD
  const p2 = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/g;
  while ((m = p2.exec(t)) !== null) {
    const d = new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`);
    if (!isNaN(d.getTime())) candidates.push(d);
  }

  // Pattern 3: DD Mon YYYY
  const p3 = /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/g;
  while ((m = p3.exec(t)) !== null) {
    const mo = months[m[2].toLowerCase()];
    if (mo) {
      const d = new Date(`${m[3]}-${mo}-${m[1].padStart(2,'0')}`);
      if (!isNaN(d.getTime())) candidates.push(d);
    }
  }

  // Pattern 4: Mon YYYY
  const p4 = /([A-Za-z]{3,9})\s+(\d{4})/g;
  while ((m = p4.exec(t)) !== null) {
    const mo = months[m[1].toLowerCase()];
    if (mo) {
      const lastDay = new Date(parseInt(m[2]), parseInt(mo), 0).getDate();
      const d = new Date(`${m[2]}-${mo}-${String(lastDay).padStart(2,'0')}`);
      if (!isNaN(d.getTime())) candidates.push(d);
    }
  }

  if (candidates.length === 0) return null;

  // Prefer the latest future date that looks like an expiry (or the max date found)
  const today = new Date();
  const future = candidates.filter(d => d > today);
  const target = future.length > 0
    ? future.reduce((a, b) => (a < b ? a : b)) // nearest future date
    : candidates.reduce((a, b) => (a > b ? a : b)); // most recent past

  return target.toISOString().slice(0, 10);
};

const extractDocNumber = (text: string, docType: 'fc' | 'insurance' | 'permit' | 'dts' | 'pan' | 'rc' | 'bank'): string | null => {
  const t = text.toUpperCase();
  const patterns: Record<string, RegExp[]> = {
    pan: [/[A-Z]{5}[0-9]{4}[A-Z]/],
    rc: [/[A-Z]{2}\s?\d{2}\s?[A-Z]{1,2}\s?\d{4}/],
    insurance: [
      /POLICY\s*(?:NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z0-9\-\/]{6,20})/,
      /(?:POLICY|POL)\s*[:\-]?\s*([A-Z0-9\-\/]{6,20})/,
    ],
    permit: [
      /PERMIT\s*(?:NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z0-9\-\/]{4,20})/,
    ],
    fc: [
      /(?:CERT|CERTIFICATE|FC)\s*(?:NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z0-9\-\/]{4,20})/,
    ],
    dts: [
      /(?:DTS|CERT|CERTIFICATE)\s*(?:NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z0-9\-\/]{4,20})/,
    ],
    bank: [
      /\b\d{9,18}\b/,
      /[A-Z]{4}0[A-Z0-9]{6}/,
    ],
  };
  for (const pat of (patterns[docType] || [])) {
    const m = t.match(pat);
    if (m) return m[1] || m[0];
  }
  return null;
};

// ─── Truck Profile & Verification View Modal ─────────────────────────────────
interface TruckProfileModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onEdit?: (vehicle: Vehicle) => void;
}

const TruckProfileModal: React.FC<TruckProfileModalProps> = ({ vehicle, onClose, onEdit }) => {
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  if (!vehicle) return null;

  const fcDays = getDaysDifference(vehicle.fc_expiry_date);
  const insDays = getDaysDifference(vehicle.insurance_expiry_date);
  const permitDays = getDaysDifference(vehicle.permit_expiry_date);
  const taxDays = getDaysDifference(vehicle.tax_expiry_date);
  const dtsDays = getDaysDifference(vehicle.dts_expiry_date);

  const isFcExpired = fcDays !== null && fcDays < 0;
  const isFcExpiringSoon = fcDays !== null && fcDays >= 0 && fcDays <= 45;

  const isInsExpired = insDays !== null && insDays < 0;
  const isInsExpiringSoon = insDays !== null && insDays >= 0 && insDays <= 45;

  const isPermitExpired = permitDays !== null && permitDays < 0;
  const isPermitExpiringSoon = permitDays !== null && permitDays >= 0 && permitDays <= 45;

  const isTaxExpired = taxDays !== null && taxDays < 0;
  const isTaxExpiringSoon = taxDays !== null && taxDays >= 0 && taxDays <= 45;

  const isDtsExpired = dtsDays !== null && dtsDays < 0;
  const isDtsExpiringSoon = dtsDays !== null && dtsDays >= 0 && dtsDays <= 45;

  const alertList: { name: string; date: string; days: number; isExpired: boolean }[] = [];
  if (vehicle.fc_expiry_date && fcDays !== null && fcDays <= 45) {
    alertList.push({ name: 'Fitness Certificate (FC)', date: vehicle.fc_expiry_date, days: fcDays, isExpired: isFcExpired });
  }
  if (vehicle.insurance_expiry_date && insDays !== null && insDays <= 45) {
    alertList.push({ name: 'Insurance Policy', date: vehicle.insurance_expiry_date, days: insDays, isExpired: isInsExpired });
  }
  if (vehicle.permit_expiry_date && permitDays !== null && permitDays <= 45) {
    alertList.push({ name: 'Road Permit', date: vehicle.permit_expiry_date, days: permitDays, isExpired: isPermitExpired });
  }
  if (vehicle.tax_expiry_date && taxDays !== null && taxDays <= 45) {
    alertList.push({ name: 'Yearly Road Tax', date: vehicle.tax_expiry_date, days: taxDays, isExpired: isTaxExpired });
  }
  if (vehicle.dts_expiry_date && dtsDays !== null && dtsDays <= 45) {
    alertList.push({ name: 'DTS Certificate', date: vehicle.dts_expiry_date, days: dtsDays, isExpired: isDtsExpired });
  }

  const buildTruckProfileHtml = () => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Truck Master Record - ${vehicle.lorry_number}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      font-size: 12.5px;
      line-height: 1.45;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #2563eb;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0 0 3px 0;
      font-size: 22px;
      color: #1e3a8a;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 0;
      color: #64748b;
      font-size: 12px;
    }
    .badge {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      padding: 5px 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      text-align: right;
    }
    .alert-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 9px 14px;
      border-radius: 6px;
      font-weight: 700;
      margin-bottom: 16px;
      font-size: 12px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #1e3a8a;
      margin: 18px 0 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .info-table th, .info-table td {
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      text-align: left;
    }
    .info-table th {
      background: #f8fafc;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      width: 25%;
    }
    .info-table td {
      font-weight: 600;
      color: #0f172a;
    }
    .docs-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .doc-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #fff;
      text-align: center;
      page-break-inside: avoid;
    }
    .doc-card h4 {
      margin: 0 0 8px 0;
      font-size: 11.5px;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-img {
      max-width: 100%;
      max-height: 180px;
      object-fit: contain;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
    }
    .no-doc {
      padding: 30px 10px;
      color: #94a3b8;
      font-style: italic;
      font-size: 11.5px;
    }
    .footer-sign {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      padding-top: 16px;
    }
    .sign-box {
      width: 200px;
      text-align: center;
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>KSP TRANSPORT SERVICES</h1>
      <p>Official Fleet Truck Master & Verification Record</p>
    </div>
    <div class="badge">
      <div>STATUS: ${vehicle.status}</div>
      <div style="font-size: 9.5px; font-weight: normal; color: #64748b; margin-top: 2px;">
        Generated: ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
      </div>
    </div>
  </div>

  ${alertList.length > 0 ? `
    <div class="alert-banner">
      ⚠️ 45-DAY COMPLIANCE EXPIRY NOTICE — ACTION REQUIRED BEFORE DISPATCH:
      <ul style="margin: 6px 0 0 16px; padding: 0;">
        ${alertList.map(a => `<li><strong>${a.name}:</strong> ${a.isExpired ? '<span style="color:#b91c1c; font-weight: bold;">EXPIRED (' + toIST(a.date) + ')</span>' : '<span style="color:#b45309; font-weight: bold;">Expires in ' + a.days + ' days (' + toIST(a.date) + ')</span>'}</li>`).join('')}
      </ul>
    </div>
  ` : ''}

  <div class="section-title">1. Vehicle & Loading Specifications</div>
  <table class="info-table">
    <tr>
      <th>Lorry / Truck No</th>
      <td><strong>${vehicle.lorry_number}</strong></td>
      <th>Vehicle Type</th>
      <td>${vehicle.vehicle_type || '—'}</td>
    </tr>
    <tr>
      <th>Capacity (Tons)</th>
      <td>${vehicle.capacity_tons ? `${vehicle.capacity_tons} Tons` : '—'}</td>
      <th>Goodshed Loading Exp.</th>
      <td>${formatCurrency(vehicle.goodshed_loading_expense)}</td>
    </tr>
    <tr>
      <th>RC / Reg No</th>
      <td>${vehicle.rc_number || vehicle.lorry_number}</td>
      <th>Status</th>
      <td>${vehicle.status}</td>
    </tr>
  </table>

  <div class="section-title">2. Validity & Compliance Dates</div>
  <table class="info-table">
    <tr>
      <th>Fitness Cert (FC)</th>
      <td>${vehicle.fc_number ? `No: ${vehicle.fc_number} | ` : ''}${vehicle.fc_expiry_date ? toIST(vehicle.fc_expiry_date) : 'Not Specified'} ${fcDays !== null ? (fcDays < 0 ? '(EXPIRED)' : `(${fcDays}d left)`) : ''}</td>
      <th>Insurance Policy</th>
      <td>${vehicle.insurance_policy_number ? `No: ${vehicle.insurance_policy_number} | ` : ''}${vehicle.insurance_expiry_date ? toIST(vehicle.insurance_expiry_date) : 'Not Specified'} ${insDays !== null ? (insDays < 0 ? '(EXPIRED)' : `(${insDays}d left)`) : ''}</td>
    </tr>
    <tr>
      <th>Road Permit</th>
      <td>${vehicle.permit_number ? `No: ${vehicle.permit_number} | ` : ''}${vehicle.permit_expiry_date ? toIST(vehicle.permit_expiry_date) : 'Not Specified'} ${permitDays !== null ? (permitDays < 0 ? '(EXPIRED)' : `(${permitDays}d left)`) : ''}</td>
      <th>Yearly Road Tax</th>
      <td>${vehicle.tax_expiry_date ? toIST(vehicle.tax_expiry_date) : 'Not Specified'} ${taxDays !== null ? (taxDays < 0 ? '(EXPIRED)' : `(${taxDays}d left)`) : ''}</td>
    </tr>
    <tr>
      <th>DTS Certificate</th>
      <td>${vehicle.dts_number ? `No: ${vehicle.dts_number} | ` : ''}${vehicle.dts_expiry_date ? toIST(vehicle.dts_expiry_date) : '—'}</td>
      <th>Registered Date</th>
      <td>${vehicle.created_at ? toIST(vehicle.created_at) : '—'}</td>
    </tr>
  </table>

  <div class="section-title">3. Bank Account & PAN Card Details</div>
  <table class="info-table">
    <tr>
      <th>Account Holder</th>
      <td>${vehicle.account_holder_name || '—'}</td>
      <th>Account Number</th>
      <td>${vehicle.account_number ? `<span style="font-family:monospace">${vehicle.account_number}</span>` : '—'}</td>
    </tr>
    <tr>
      <th>Bank Name</th>
      <td>${vehicle.bank_name || '—'}</td>
      <th>IFSC Code</th>
      <td>${vehicle.ifsc_code ? `<span style="font-family:monospace">${vehicle.ifsc_code}</span>` : '—'}</td>
    </tr>
    <tr>
      <th>PAN Number</th>
      <td colspan="3">${vehicle.pan_number ? `<span style="font-family:monospace">${vehicle.pan_number}</span>` : '—'}</td>
    </tr>
  </table>

  <div class="section-title">4. Submitted Document Verification Scans</div>
  <div class="docs-grid">
    <div class="doc-card">
      <h4>Registration Certificate (RC Photo)</h4>
      ${vehicle.rc_photo_url ? `<img src="${vehicle.rc_photo_url}" class="doc-img" alt="RC Photo" />` : '<div class="no-doc">No RC Photo Uploaded</div>'}
    </div>
    <div class="doc-card">
      <h4>Fitness Certificate (FC)</h4>
      ${vehicle.fc_photo_url ? `<img src="${vehicle.fc_photo_url}" class="doc-img" alt="FC Certificate" />` : '<div class="no-doc">No FC Document Uploaded</div>'}
    </div>
    <div class="doc-card">
      <h4>Insurance Document</h4>
      ${vehicle.insurance_photo_url ? `<img src="${vehicle.insurance_photo_url}" class="doc-img" alt="Insurance" />` : '<div class="no-doc">No Insurance Document Uploaded</div>'}
    </div>
    <div class="doc-card">
      <h4>Road Permit</h4>
      ${vehicle.permit_photo_url ? `<img src="${vehicle.permit_photo_url}" class="doc-img" alt="Permit" />` : '<div class="no-doc">No Permit Document Uploaded</div>'}
    </div>
    <div class="doc-card">
      <h4>Road Tax Receipt (Yearly Tax)</h4>
      ${vehicle.tax_photo_url ? `<img src="${vehicle.tax_photo_url}" class="doc-img" alt="Tax Receipt" />` : '<div class="no-doc">No Tax Receipt Uploaded</div>'}
    </div>
    <div class="doc-card">
      <h4>PAN Card</h4>
      ${vehicle.pan_card_url ? `<img src="${vehicle.pan_card_url}" class="doc-img" alt="PAN Card" />` : '<div class="no-doc">No PAN Card Uploaded</div>'}
    </div>
    <div class="doc-card">
      <h4>DTS Certificate</h4>
      ${vehicle.dts_certificate_url ? `<img src="${vehicle.dts_certificate_url}" class="doc-img" alt="DTS Certificate" />` : '<div class="no-doc">No DTS Certificate Uploaded</div>'}
    </div>
    <div class="doc-card">
      <h4>Bank Passbook / Cheque</h4>
      ${vehicle.account_photo_url ? `<img src="${vehicle.account_photo_url}" class="doc-img" alt="Bank Account" />` : '<div class="no-doc">No Bank Account Document Uploaded</div>'}
    </div>
  </div>

  <div class="footer-sign">
    <div class="sign-box">Fleet / Transport Manager</div>
    <div class="sign-box">Authorized Admin Signature</div>
  </div>
</body>
</html>
    `;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = buildTruckProfileHtml();
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = `${vehicle.lorry_number} - Truck Verification Record`;
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const handleDownload = () => {
    const html = buildTruckProfileHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Truck_Profile_${vehicle.lorry_number.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const buildShareText = () => {
    const lines: string[] = [
      `🚛 KSP Transport — Truck Profile`,
      `Lorry No: ${vehicle.lorry_number}`,
    ];
    if (vehicle.vehicle_type) lines.push(`Type: ${vehicle.vehicle_type}`);
    if (vehicle.capacity_tons) lines.push(`Capacity: ${vehicle.capacity_tons} Tons`);
    if (vehicle.rc_number) lines.push(`RC No: ${vehicle.rc_number}`);
    if (vehicle.pan_number) lines.push(`PAN No: ${vehicle.pan_number}`);
    if (vehicle.dts_number) lines.push(`DTS No: ${vehicle.dts_number}`);
    lines.push(`Status: ${vehicle.status}`);
    lines.push(``);
    lines.push(`📋 Compliance Validities`);
    if (vehicle.fc_expiry_date) lines.push(`  FC Expiry: ${toIST(vehicle.fc_expiry_date)}`);
    if (vehicle.fc_number) lines.push(`  FC No: ${vehicle.fc_number}`);
    if (vehicle.insurance_expiry_date) lines.push(`  Insurance Expiry: ${toIST(vehicle.insurance_expiry_date)}`);
    if (vehicle.insurance_policy_number) lines.push(`  Insurance Policy No: ${vehicle.insurance_policy_number}`);
    if (vehicle.permit_expiry_date) lines.push(`  Permit Expiry: ${toIST(vehicle.permit_expiry_date)}`);
    if (vehicle.permit_number) lines.push(`  Permit No: ${vehicle.permit_number}`);
    if (vehicle.tax_expiry_date) lines.push(`  Road Tax Expiry: ${toIST(vehicle.tax_expiry_date)}`);
    if (vehicle.dts_expiry_date) lines.push(`  DTS Expiry: ${toIST(vehicle.dts_expiry_date)}`);
    lines.push(``);
    lines.push(`Generated by KSP Transport Admin Portal`);
    return lines.join('\n');
  };

  const handleShareWhatsApp = () => {
    const text = buildShareText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setShareMenuOpen(false);
  };

  const handleShareEmail = () => {
    const text = buildShareText();
    const subject = `Truck Profile — ${vehicle.lorry_number}`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.open(url, '_self');
    setShareMenuOpen(false);
  };

  const handleCopyClipboard = async () => {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
    setShareMenuOpen(false);
  };

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

  const DocCard = ({
    title, icon, iconColor, url, emptyText,
  }: {
    title: string;
    icon: React.ReactNode;
    iconColor: string;
    url?: string;
    emptyText: string;
  }) => (
    <div
      style={{
        background: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '14px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#374151', alignSelf: 'flex-start' }}>
        <span style={{ color: iconColor }}>{icon}</span>
        {title}
      </div>
      {url ? (
        <div
          style={{ cursor: 'zoom-in', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          onClick={() => setZoomImage({ url, title })}
          title="Click to view full size"
        >
          <img
            src={url}
            alt={title}
            style={{
              width: '100%',
              height: '130px',
              objectFit: 'contain',
              borderRadius: '8px',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          />
          <div style={{ marginTop: '6px', fontSize: '11px', color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Eye size={11} /> Click to zoom
          </div>
        </div>
      ) : (
        <div style={{ padding: '24px 10px', textAlign: 'center', color: '#cbd5e1' }}>
          <AlertCircle size={26} style={{ margin: '0 auto 6px', display: 'block' }} />
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
        <div
          style={{
            background: '#f8fafc',
            borderRadius: '22px',
            width: '100%',
            maxWidth: '920px',
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
              }}
              title="Close"
            >
              <X size={16} />
            </button>

            {/* ── Top row: avatar + lorry number + specs ── */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                {vehicle.rc_photo_url ? (
                  <img
                    src={vehicle.rc_photo_url}
                    alt={vehicle.lorry_number}
                    onClick={() => setZoomImage({ url: vehicle.rc_photo_url!, title: `${vehicle.lorry_number} — RC Document` })}
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid rgba(255,255,255,0.75)',
                      boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                      cursor: 'zoom-in',
                    }}
                    title="Click to zoom RC"
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
                      color: '#ffffff',
                      boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
                    }}
                  >
                    <Truck size={32} />
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: '3px' }}>
                  TRUCK & LORRY MASTER RECORD
                </div>
                <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 5px 0', color: '#ffffff', lineHeight: 1.15, letterSpacing: '-0.3px' }}>
                  {vehicle.lorry_number}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: vehicle.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2.5px 12px',
                      borderRadius: '20px',
                      letterSpacing: '0.4px',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }} />
                    {vehicle.status}
                  </span>
                  {vehicle.vehicle_type && (
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                      🚛 {vehicle.vehicle_type}
                    </span>
                  )}
                  {vehicle.capacity_tons && (
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>
                      • {vehicle.capacity_tons} Tons
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── 8-chip info grid in header ── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px',
                marginTop: '18px',
              }}
            >
              <InfoChip
                icon={<ShieldCheck size={12} />}
                label="Fitness (FC)"
                highlight={isFcExpired ? 'red' : isFcExpiringSoon ? 'yellow' : null}
                value={
                  <span>
                    {vehicle.fc_expiry_date ? toIST(vehicle.fc_expiry_date) : <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Not Specified</span>}
                    {fcDays !== null && (
                      <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '10.5px', fontWeight: 600, opacity: 0.9 }}>
                        {isFcExpired ? `(⚠ Expired)` : fcDays === 0 ? '(Today)' : `(${fcDays}d)`}
                      </span>
                    )}
                  </span>
                }
              />
              <InfoChip
                icon={<FileText size={12} />}
                label="Insurance"
                highlight={isInsExpired ? 'red' : isInsExpiringSoon ? 'yellow' : null}
                value={
                  <span>
                    {vehicle.insurance_expiry_date ? toIST(vehicle.insurance_expiry_date) : <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Not Specified</span>}
                    {insDays !== null && (
                      <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '10.5px', fontWeight: 600, opacity: 0.9 }}>
                        {isInsExpired ? `(⚠ Expired)` : insDays === 0 ? '(Today)' : `(${insDays}d)`}
                      </span>
                    )}
                  </span>
                }
              />
              <InfoChip
                icon={<Truck size={12} />}
                label="Permit"
                highlight={isPermitExpired ? 'red' : isPermitExpiringSoon ? 'yellow' : null}
                value={
                  <span>
                    {vehicle.permit_expiry_date ? toIST(vehicle.permit_expiry_date) : <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Not Specified</span>}
                    {permitDays !== null && (
                      <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '10.5px', fontWeight: 600, opacity: 0.9 }}>
                        {isPermitExpired ? `(⚠ Expired)` : permitDays === 0 ? '(Today)' : `(${permitDays}d)`}
                      </span>
                    )}
                  </span>
                }
              />
              <InfoChip
                icon={<Calendar size={12} />}
                label="Yearly Tax"
                highlight={isTaxExpired ? 'red' : isTaxExpiringSoon ? 'yellow' : null}
                value={
                  <span>
                    {vehicle.tax_expiry_date ? toIST(vehicle.tax_expiry_date) : <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Not Specified</span>}
                    {taxDays !== null && (
                      <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '10.5px', fontWeight: 600, opacity: 0.9 }}>
                        {isTaxExpired ? `(⚠ Expired)` : taxDays === 0 ? '(Today)' : `(${taxDays}d)`}
                      </span>
                    )}
                  </span>
                }
              />
              <InfoChip
                icon={<FileText size={12} />}
                label="DTS Certificate"
                highlight={isDtsExpired ? 'red' : isDtsExpiringSoon ? 'yellow' : null}
                value={
                  <span>
                    {vehicle.dts_expiry_date ? toIST(vehicle.dts_expiry_date) : <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Not Specified</span>}
                    {dtsDays !== null && (
                      <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '10.5px', fontWeight: 600, opacity: 0.9 }}>
                        {isDtsExpired ? `(⚠ Expired)` : dtsDays === 0 ? '(Today)' : `(${dtsDays}d)`}
                      </span>
                    )}
                  </span>
                }
              />
              <InfoChip
                icon={<CreditCard size={12} />}
                label="Bank Account"
                value={vehicle.bank_name ? `${vehicle.bank_name} ${vehicle.account_number ? `(${vehicle.account_number.slice(-4)})` : ''}` : vehicle.account_number || <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Not Specified</span>}
              />
              <InfoChip
                icon={<UserIcon size={12} />}
                label="PAN Card"
                value={vehicle.pan_number ? <span style={{ fontFamily: 'monospace' }}>{vehicle.pan_number}</span> : <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Not Specified</span>}
              />
              <InfoChip
                icon={<Truck size={12} />}
                label="Goodshed Exp."
                value={formatCurrency(vehicle.goodshed_loading_expense)}
              />
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              BODY
          ═══════════════════════════════════════════════════════════ */}
          <div style={{ padding: '22px 28px', flex: 1 }}>

            {/* 45-Day Expiry alerts banner */}
            {alertList.length > 0 && (
              <div
                style={{
                  background: alertList.some((a) => a.isExpired) ? '#fef2f2' : '#fffbeb',
                  border: `1.5px solid ${alertList.some((a) => a.isExpired) ? '#fecaca' : '#fde68a'}`,
                  borderRadius: '14px',
                  padding: '14px 18px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                }}
              >
                <AlertTriangle
                  size={22}
                  color={alertList.some((a) => a.isExpired) ? '#dc2626' : '#d97706'}
                  style={{ flexShrink: 0, marginTop: '2px' }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '13.5px',
                      color: alertList.some((a) => a.isExpired) ? '#991b1b' : '#92400e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>⚠️ 45-Day Compliance Expiry Notice — Action Required</span>
                    <span
                      style={{
                        fontSize: '11px',
                        background: alertList.some((a) => a.isExpired) ? '#fee2e2' : '#fef3c7',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 700,
                      }}
                    >
                      {alertList.length} Document{alertList.length > 1 ? 's' : ''} Expiring / Expired
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: alertList.some((a) => a.isExpired) ? '#b91c1c' : '#b45309',
                      marginTop: '4px',
                      marginBottom: '10px',
                    }}
                  >
                    Before dispatching trips for <strong>{vehicle.lorry_number}</strong>, please ensure renewal of the following compliance documents:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {alertList.map((a, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          background: a.isExpired ? '#fee2e2' : '#fef3c7',
                          color: a.isExpired ? '#991b1b' : '#92400e',
                          border: `1px solid ${a.isExpired ? '#fca5a5' : '#fde68a'}`,
                        }}
                      >
                        <span>{a.isExpired ? '❌' : '⏳'}</span>
                        <span>{a.name}:</span>
                        <span>
                          {a.isExpired
                            ? `EXPIRED (${toIST(a.date)})`
                            : a.days === 0
                            ? `Expires Today (${toIST(a.date)})`
                            : `Expires in ${a.days} day${a.days > 1 ? 's' : ''} (${toIST(a.date)})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bank & Tax Summary */}
            <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <CreditCard size={15} color="#2563eb" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Banking & Tax Details
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Account Holder</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{vehicle.account_holder_name || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Bank & IFSC</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{vehicle.bank_name || '—'} {vehicle.ifsc_code ? `(${vehicle.ifsc_code})` : ''}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Account Number</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{vehicle.account_number || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Goodshed Loading</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#2563eb' }}>{formatCurrency(vehicle.goodshed_loading_expense)}</div>
                </div>
              </div>
            </div>

            {/* Submitted Documents section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <FileText size={16} color="#2563eb" />
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                  Submitted Documents & Certificates (8 Scans)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                <DocCard
                  title="RC Photo"
                  icon={<Truck size={14} />}
                  iconColor="#3b82f6"
                  url={vehicle.rc_photo_url}
                  emptyText="No RC Photo Uploaded"
                />
                <DocCard
                  title="Fitness Cert (FC)"
                  icon={<ShieldCheck size={14} />}
                  iconColor="#10b981"
                  url={vehicle.fc_photo_url}
                  emptyText="No FC Document Uploaded"
                />
                <DocCard
                  title="Insurance Document"
                  icon={<FileText size={14} />}
                  iconColor="#6366f1"
                  url={vehicle.insurance_photo_url}
                  emptyText="No Insurance Uploaded"
                />
                <DocCard
                  title="Road Permit"
                  icon={<Truck size={14} />}
                  iconColor="#f59e0b"
                  url={vehicle.permit_photo_url}
                  emptyText="No Permit Uploaded"
                />
                <DocCard
                  title="Yearly Road Tax"
                  icon={<Calendar size={14} />}
                  iconColor="#ef4444"
                  url={vehicle.tax_photo_url}
                  emptyText="No Tax Receipt Uploaded"
                />
                <DocCard
                  title="PAN Card"
                  icon={<UserIcon size={14} />}
                  iconColor="#8b5cf6"
                  url={vehicle.pan_card_url}
                  emptyText="No PAN Card Uploaded"
                />
                <DocCard
                  title="DTS Certificate"
                  icon={<FileText size={14} />}
                  iconColor="#06b6d4"
                  url={vehicle.dts_certificate_url}
                  emptyText="No DTS Certificate Uploaded"
                />
                <DocCard
                  title="Bank Passbook / Cheque"
                  icon={<CreditCard size={14} />}
                  iconColor="#10b981"
                  url={vehicle.account_photo_url}
                  emptyText="No Bank Document Uploaded"
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
                  onClick={() => { onClose(); onEdit(vehicle); }}
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
                  <Edit2 size={14} color="#2563eb" /> Edit Truck Details
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
                  }}
                  title="Print Truck Verification Record"
                >
                  <Printer size={15} color="#475569" /> Print
                </button>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShareMenuOpen(!shareMenuOpen)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: shareCopied ? '#f0fdf4' : '#ffffff',
                      border: `1.5px solid ${shareCopied ? '#86efac' : '#cbd5e1'}`,
                      borderRadius: '10px',
                      padding: '9px 16px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: shareCopied ? '#16a34a' : '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    title="Share truck details"
                  >
                    {shareCopied
                      ? <><Check size={15} color="#16a34a" /> Copied!</>
                      : <><Share2 size={15} color="#6366f1" /> Share ▾</>
                    }
                  </button>

                  {shareMenuOpen && (
                    <>
                      {/* Invisible backdrop to close menu */}
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                        onClick={() => setShareMenuOpen(false)}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          right: 0,
                          marginBottom: '6px',
                          background: '#ffffff',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: '12px',
                          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                          padding: '6px',
                          minWidth: '200px',
                          zIndex: 9999,
                          animation: 'modalFadeIn 0.15s ease-out',
                        }}
                      >
                        <button
                          onClick={handleShareWhatsApp}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#1e293b',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdf4')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <span style={{ fontSize: '18px' }}>💬</span>
                          Share via WhatsApp
                        </button>
                        <button
                          onClick={handleShareEmail}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#1e293b',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <span style={{ fontSize: '18px' }}>📧</span>
                          Share via Email
                        </button>
                        <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 8px' }} />
                        <button
                          onClick={handleCopyClipboard}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#1e293b',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <Copy size={16} color="#64748b" />
                          Copy to Clipboard
                        </button>
                      </div>
                    </>
                  )}
                </div>
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
                  }}
                  title="Download Truck Verification Record"
                >
                  <Download size={15} /> Download Details
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for zooming */}
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

// ─── Main VehiclesPage Component ─────────────────────────────────────────────
export const VehiclesPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Profile Modal State
  const [profileVehicle, setProfileVehicle] = useState<Vehicle | null>(null);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'docs' | 'compliance' | 'bank'>('basic');
  const [ocrScanningField, setOcrScanningField] = useState<string | null>(null);
  const [ocrResults, setOcrResults] = useState<Record<string, { date?: string; number?: string; confidence?: number }>>({});

  const [formData, setFormData] = useState({
    lorry_number: '',
    vehicle_type: '',
    capacity_tons: '',
    goodshed_loading_expense: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    rc_number: '',
    rc_photo_url: '',
    fc_number: '',
    fc_expiry_date: '',
    fc_photo_url: '',
    insurance_policy_number: '',
    insurance_expiry_date: '',
    insurance_photo_url: '',
    permit_number: '',
    permit_expiry_date: '',
    permit_photo_url: '',
    tax_expiry_date: '',
    tax_photo_url: '',
    pan_number: '',
    pan_card_url: '',
    dts_number: '',
    dts_expiry_date: '',
    dts_certificate_url: '',
    account_number: '',
    bank_name: '',
    ifsc_code: '',
    account_holder_name: '',
    account_photo_url: '',
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File Input Refs
  const rcInputRef = useRef<HTMLInputElement>(null);
  const fcInputRef = useRef<HTMLInputElement>(null);
  const insInputRef = useRef<HTMLInputElement>(null);
  const permitInputRef = useRef<HTMLInputElement>(null);
  const taxInputRef = useRef<HTMLInputElement>(null);
  const panInputRef = useRef<HTMLInputElement>(null);
  const dtsInputRef = useRef<HTMLInputElement>(null);
  const accInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadVehicles();
  }, [page, search]);

  const loadVehicles = async () => {
    try {
      setIsLoading(true);
      const res = await vehicleService.getVehicles({
        page,
        limit: 10,
        search: search || undefined,
      });
      setVehicles(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load vehicles', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldName: keyof typeof formData,
    docType?: 'fc' | 'insurance' | 'permit' | 'dts' | 'pan' | 'rc' | 'tax' | 'bank',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await readAsBase64(file);
      setFormData((prev) => ({ ...prev, [fieldName]: b64 }));
      // Auto-trigger OCR for all documents
      if (docType) {
        runOcr(b64, fieldName, docType);
      }
    } catch (err) {
      console.error('File read error', err);
    }
  };

  const runOcr = async (
    imageData: string,
    photoField: keyof typeof formData,
    docType: 'fc' | 'insurance' | 'permit' | 'dts' | 'pan' | 'rc' | 'tax' | 'bank',
  ) => {
    setOcrScanningField(String(photoField));
    try {
      const { data } = await Tesseract.recognize(imageData, 'eng', {
        logger: () => {},
      });
      const text = data.text;
      const confidence = Math.round(data.confidence);

      const extractedDate = docType !== 'pan' && docType !== 'rc' && docType !== 'bank'
        ? parseIndianDate(text)
        : null;

      const extractedNumber = (docType !== 'tax' && docType !== 'bank')
        ? extractDocNumber(text, docType as any)
        : null;

      let extractedBankAcc: string | null = null;
      let extractedIfsc: string | null = null;
      if (docType === 'bank') {
        const accMatch = text.match(/\b\d{9,18}\b/);
        const ifscMatch = text.match(/[A-Z]{4}0[A-Z0-9]{6}/i);
        if (accMatch) extractedBankAcc = accMatch[0];
        if (ifscMatch) extractedIfsc = ifscMatch[0].toUpperCase();
      }

      // Auto-fill the form fields
      setFormData((prev) => {
        const updated = { ...prev };
        if (extractedDate) {
          if (docType === 'fc') updated.fc_expiry_date = extractedDate;
          else if (docType === 'insurance') updated.insurance_expiry_date = extractedDate;
          else if (docType === 'permit') updated.permit_expiry_date = extractedDate;
          else if (docType === 'dts') updated.dts_expiry_date = extractedDate;
          else if (docType === 'tax') updated.tax_expiry_date = extractedDate;
        }
        if (extractedNumber) {
          if (docType === 'fc') updated.fc_number = extractedNumber;
          else if (docType === 'insurance') updated.insurance_policy_number = extractedNumber;
          else if (docType === 'permit') updated.permit_number = extractedNumber;
          else if (docType === 'dts') updated.dts_number = extractedNumber;
          else if (docType === 'pan') updated.pan_number = extractedNumber;
          else if (docType === 'rc') updated.rc_number = extractedNumber;
        }
        if (extractedBankAcc) updated.account_number = extractedBankAcc;
        if (extractedIfsc) updated.ifsc_code = extractedIfsc;
        return updated;
      });

      setOcrResults((prev) => ({
        ...prev,
        [String(photoField)]: {
          date: extractedDate || undefined,
          number: (extractedNumber || extractedBankAcc || extractedIfsc) || undefined,
          confidence,
        },
      }));
    } catch (err) {
      console.error('OCR error', err);
    } finally {
      setOcrScanningField(null);
    }
  };

  const handleNextTab = () => {
    setFormError('');
    if (activeTab === 'basic') {
      if (!formData.lorry_number.trim()) {
        setFormError('Lorry / Truck Number is required before proceeding to upload documents.');
        return;
      }
      setActiveTab('docs');
    } else if (activeTab === 'docs') {
      setActiveTab('compliance');
    } else if (activeTab === 'compliance') {
      setActiveTab('bank');
    }
  };

  const handlePrevTab = () => {
    setFormError('');
    if (activeTab === 'docs') setActiveTab('basic');
    else if (activeTab === 'compliance') setActiveTab('docs');
    else if (activeTab === 'bank') setActiveTab('compliance');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab !== 'bank') {
      handleNextTab();
      return;
    }
    if (!formData.lorry_number.trim()) {
      setFormError('Lorry number is required.');
      setActiveTab('basic');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload: Partial<Vehicle> = {
        lorry_number: formData.lorry_number.trim().toUpperCase(),
        vehicle_type: formData.vehicle_type || undefined,
        capacity_tons: formData.capacity_tons ? parseFloat(formData.capacity_tons) : undefined,
        goodshed_loading_expense: formData.goodshed_loading_expense ? parseFloat(formData.goodshed_loading_expense) : 0,
        status: formData.status,
        rc_number: formData.rc_number || undefined,
        rc_photo_url: formData.rc_photo_url || undefined,
        fc_number: formData.fc_number || undefined,
        fc_expiry_date: formData.fc_expiry_date || undefined,
        fc_photo_url: formData.fc_photo_url || undefined,
        insurance_policy_number: formData.insurance_policy_number || undefined,
        insurance_expiry_date: formData.insurance_expiry_date || undefined,
        insurance_photo_url: formData.insurance_photo_url || undefined,
        permit_number: formData.permit_number || undefined,
        permit_expiry_date: formData.permit_expiry_date || undefined,
        permit_photo_url: formData.permit_photo_url || undefined,
        tax_expiry_date: formData.tax_expiry_date || undefined,
        tax_photo_url: formData.tax_photo_url || undefined,
        pan_number: formData.pan_number ? formData.pan_number.toUpperCase() : undefined,
        pan_card_url: formData.pan_card_url || undefined,
        dts_number: formData.dts_number || undefined,
        dts_expiry_date: formData.dts_expiry_date || undefined,
        dts_certificate_url: formData.dts_certificate_url || undefined,
        account_number: formData.account_number || undefined,
        bank_name: formData.bank_name || undefined,
        ifsc_code: formData.ifsc_code ? formData.ifsc_code.toUpperCase() : undefined,
        account_holder_name: formData.account_holder_name || undefined,
        account_photo_url: formData.account_photo_url || undefined,
      };

      if (selectedVehicle) {
        await vehicleService.updateVehicle(selectedVehicle.id, payload);
      } else {
        await vehicleService.createVehicle(payload);
      }
      setIsModalOpen(false);
      setSelectedVehicle(null);
      resetForm();
      loadVehicles();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save vehicle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    if (!confirm(`Are you sure you want to delete truck/lorry "${vehicle.lorry_number}"?`)) return;
    try {
      await vehicleService.deleteVehicle(vehicle.id);
      loadVehicles();
    } catch (err: any) {
      alert(err.message || 'Failed to delete vehicle.');
    }
  };

  const openCreateModal = () => {
    setSelectedVehicle(null);
    resetForm();
    setActiveTab('basic');
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      lorry_number: vehicle.lorry_number || '',
      vehicle_type: vehicle.vehicle_type || '',
      capacity_tons: vehicle.capacity_tons ? String(vehicle.capacity_tons) : '',
      goodshed_loading_expense: vehicle.goodshed_loading_expense !== undefined ? String(vehicle.goodshed_loading_expense) : '0',
      status: vehicle.status || 'ACTIVE',
      rc_number: vehicle.rc_number || '',
      rc_photo_url: vehicle.rc_photo_url || '',
      fc_number: vehicle.fc_number || '',
      fc_expiry_date: vehicle.fc_expiry_date ? vehicle.fc_expiry_date.slice(0, 10) : '',
      fc_photo_url: vehicle.fc_photo_url || '',
      insurance_policy_number: vehicle.insurance_policy_number || '',
      insurance_expiry_date: vehicle.insurance_expiry_date ? vehicle.insurance_expiry_date.slice(0, 10) : '',
      insurance_photo_url: vehicle.insurance_photo_url || '',
      permit_number: vehicle.permit_number || '',
      permit_expiry_date: vehicle.permit_expiry_date ? vehicle.permit_expiry_date.slice(0, 10) : '',
      permit_photo_url: vehicle.permit_photo_url || '',
      tax_expiry_date: vehicle.tax_expiry_date ? vehicle.tax_expiry_date.slice(0, 10) : '',
      tax_photo_url: vehicle.tax_photo_url || '',
      pan_number: vehicle.pan_number || '',
      pan_card_url: vehicle.pan_card_url || '',
      dts_number: vehicle.dts_number || '',
      dts_expiry_date: vehicle.dts_expiry_date ? vehicle.dts_expiry_date.slice(0, 10) : '',
      dts_certificate_url: vehicle.dts_certificate_url || '',
      account_number: vehicle.account_number || '',
      bank_name: vehicle.bank_name || '',
      ifsc_code: vehicle.ifsc_code || '',
      account_holder_name: vehicle.account_holder_name || '',
      account_photo_url: vehicle.account_photo_url || '',
    });
    setFormError('');
    setActiveTab('basic');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      lorry_number: '',
      vehicle_type: '',
      capacity_tons: '',
      goodshed_loading_expense: '',
      status: 'ACTIVE',
      rc_number: '',
      rc_photo_url: '',
      fc_number: '',
      fc_expiry_date: '',
      fc_photo_url: '',
      insurance_policy_number: '',
      insurance_expiry_date: '',
      insurance_photo_url: '',
      permit_number: '',
      permit_expiry_date: '',
      permit_photo_url: '',
      tax_expiry_date: '',
      tax_photo_url: '',
      pan_number: '',
      pan_card_url: '',
      dts_number: '',
      dts_expiry_date: '',
      dts_certificate_url: '',
      account_number: '',
      bank_name: '',
      ifsc_code: '',
      account_holder_name: '',
      account_photo_url: '',
    });
    setFormError('');
  };

  const columns: Column<Vehicle>[] = [
    {
      header: 'Lorry / Truck Number',
      accessor: 'lorry_number',
      render: (v) => (
        <button
          onClick={() => setProfileVehicle(v)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
            color: '#1d4ed8',
            fontWeight: 800,
            fontSize: '14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
          title="Click to view truck documents and details"
        >
          <Truck size={16} color="#2563eb" />
          <span>{v.lorry_number}</span>
        </button>
      ),
    },
    {
      header: 'Type & Capacity',
      accessor: 'vehicle_type',
      render: (v) => (
        <span style={{ fontWeight: 600 }}>
          {v.vehicle_type || '—'}
          {v.capacity_tons ? <span style={{ color: '#64748b', fontWeight: 400 }}> · {v.capacity_tons}T</span> : null}
        </span>
      ),
    },
    {
      header: 'FC Expiry',
      accessor: 'fc_expiry_date',
      render: (v) => {
        const days = getDaysDifference(v.fc_expiry_date);
        if (!v.fc_expiry_date) return <span style={{ color: '#94a3b8' }}>—</span>;
        const isExp = days !== null && days < 0;
        const isSoon = days !== null && days >= 0 && days <= 45;
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 700,
              background: isExp ? '#fee2e2' : isSoon ? '#fef3c7' : '#ecfdf5',
              color: isExp ? '#b91c1c' : isSoon ? '#b45309' : '#047857',
              border: `1px solid ${isExp ? '#fca5a5' : isSoon ? '#fde68a' : '#a7f3d0'}`,
            }}
          >
            {toIST(v.fc_expiry_date)} {isExp ? '⚠ Expired' : isSoon ? `(${days}d)` : '✓'}
          </span>
        );
      },
    },
    {
      header: 'Insurance Expiry',
      accessor: 'insurance_expiry_date',
      render: (v) => {
        const days = getDaysDifference(v.insurance_expiry_date);
        if (!v.insurance_expiry_date) return <span style={{ color: '#94a3b8' }}>—</span>;
        const isExp = days !== null && days < 0;
        const isSoon = days !== null && days >= 0 && days <= 45;
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 700,
              background: isExp ? '#fee2e2' : isSoon ? '#fef3c7' : '#ecfdf5',
              color: isExp ? '#b91c1c' : isSoon ? '#b45309' : '#047857',
              border: `1px solid ${isExp ? '#fca5a5' : isSoon ? '#fde68a' : '#a7f3d0'}`,
            }}
          >
            {toIST(v.insurance_expiry_date)} {isExp ? '⚠ Expired' : isSoon ? `(${days}d)` : '✓'}
          </span>
        );
      },
    },
    {
      header: 'Compliance Alert',
      render: (v) => {
        const docs = [
          { name: 'FC', d: getDaysDifference(v.fc_expiry_date) },
          { name: 'Ins', d: getDaysDifference(v.insurance_expiry_date) },
          { name: 'Permit', d: getDaysDifference(v.permit_expiry_date) },
          { name: 'Tax', d: getDaysDifference(v.tax_expiry_date) },
          { name: 'DTS', d: getDaysDifference(v.dts_expiry_date) },
        ].filter(x => x.d !== null);

        const expired = docs.filter(x => x.d! < 0);
        const soon = docs.filter(x => x.d! >= 0 && x.d! <= 45);

        if (expired.length > 0) {
          return (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
              }}
              title={expired.map(e => `${e.name} expired`).join(', ')}
            >
              ❌ {expired[0].name} Expired {expired.length > 1 ? `+${expired.length - 1}` : ''}
            </span>
          );
        }
        if (soon.length > 0) {
          return (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
              }}
              title={soon.map(s => `${s.name} in ${s.d}d`).join(', ')}
            >
              ⚠️ {soon[0].name} ({soon[0].d}d) {soon.length > 1 ? `+${soon.length - 1}` : ''}
            </span>
          );
        }
        if (docs.length > 0) {
          return (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
              }}
            >
              ✓ All Valid
            </span>
          );
        }
        return <span style={{ color: '#94a3b8', fontSize: '11px' }}>Pending Docs</span>;
      },
    },
    {
      header: 'Goodshed Loading (₹)',
      accessor: 'goodshed_loading_expense',
      render: (v) => (
        <span style={{ fontWeight: 700, color: '#1e40af', background: '#eff6ff', padding: '4px 8px', borderRadius: '6px' }}>
          {formatCurrency(v.goodshed_loading_expense)}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (v) => (
        <span
          style={{
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            background: v.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
            color: v.status === 'ACTIVE' ? '#15803d' : '#b91c1c',
          }}
        >
          {v.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (v) => (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', alignItems: 'center' }}>
          <button
            onClick={() => setProfileVehicle(v)}
            className="btn btn-outline btn-sm"
            title="View Truck Details & Documents"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb', whiteSpace: 'nowrap' }}
          >
            <Eye size={14} /> View
          </button>
          <button onClick={() => openEditModal(v)} className="btn btn-outline btn-sm" title="Edit Vehicle">
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDeleteVehicle(v)}
            className="btn btn-danger btn-sm"
            title="Delete Vehicle"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const UploadCard = ({
    title, subtitle, previewUrl, inputRef, fieldName,
  }: {
    title: string;
    subtitle: string;
    previewUrl?: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    fieldName: keyof typeof formData;
  }) => (
    <div
      style={{
        border: '1.5px solid #e2e8f0',
        borderRadius: '12px',
        padding: '14px',
        background: previewUrl ? '#f0fdf4' : '#ffffff',
        borderColor: previewUrl ? '#86efac' : '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        textAlign: 'center',
      }}
    >
      <input
        type="file"
        ref={inputRef}
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e, fieldName)}
      />
      <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#1e293b' }}>{title}</div>
      <div style={{ fontSize: '11px', color: '#64748b' }}>{subtitle}</div>

      {previewUrl ? (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <img
            src={previewUrl}
            alt={title}
            style={{ width: '100%', height: '90px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #bbf7d0' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', background: '#dbeafe', color: '#1d4ed8', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, [fieldName]: '' }))}
              style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            marginTop: '6px',
            border: '1.5px dashed #cbd5e1',
            borderRadius: '8px',
            background: '#f8fafc',
            padding: '16px 20px',
            width: '100%',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            color: '#64748b',
          }}
        >
          <Camera size={20} color="#94a3b8" />
          <span style={{ fontSize: '11.5px', fontWeight: 600 }}>Click to Upload</span>
        </button>
      )}
    </div>
  );

  // Smart OCR-enabled card for compliance documents
  const SmartDocCard = ({
    title,
    subtitle,
    iconColor,
    previewUrl,
    inputRef,
    photoField,
    docType,
    extractedDateField,
    extractedNumberField,
    extractedDateLabel,
    extractedNumberLabel,
  }: {
    title: string;
    subtitle: string;
    iconColor: string;
    previewUrl: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    photoField: keyof typeof formData;
    docType: 'fc' | 'insurance' | 'permit' | 'dts' | 'tax' | 'rc' | 'pan' | 'bank';
    extractedDateField?: keyof typeof formData;
    extractedNumberField?: keyof typeof formData;
    extractedDateLabel?: string;
    extractedNumberLabel?: string;
  }) => {
    const isScanning = ocrScanningField === String(photoField);
    const result = ocrResults[String(photoField)];
    const hasResult = !!result;

    return (
      <div
        style={{
          border: `1.5px solid ${previewUrl ? '#a7f3d0' : '#e2e8f0'}`,
          borderRadius: '14px',
          background: previewUrl ? '#f0fdf4' : '#fafbfc',
          overflow: 'hidden',
        }}
      >
        {/* Card header */}
        <div
          style={{
            background: previewUrl ? iconColor + '18' : '#f1f5f9',
            borderBottom: `1.5px solid ${previewUrl ? '#a7f3d0' : '#e2e8f0'}`,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>{title}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{subtitle}</div>
          </div>
          {previewUrl && (
            <CheckCircle size={16} color="#22c55e" />
          )}
        </div>

        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Hidden file input */}
          <input
            type="file"
            ref={inputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload(e, photoField, docType)}
          />

          {/* Image preview / upload zone */}
          {previewUrl ? (
            <div style={{ position: 'relative' }}>
              <img
                src={previewUrl}
                alt={title}
                style={{
                  width: '100%', height: '100px', objectFit: 'contain',
                  borderRadius: '8px', border: '1px solid #bbf7d0', background: '#fff',
                }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  style={{ flex: 1, fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: '#dbeafe', color: '#1d4ed8', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, [photoField]: '' }));
                    setOcrResults((prev) => { const n = {...prev}; delete n[String(photoField)]; return n; });
                  }}
                  style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => runOcr(previewUrl, photoField, docType as any)}
                  disabled={isScanning}
                  title="Re-scan document with OCR"
                  style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {isScanning ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
                  {isScanning ? 'Scanning...' : 'Re-scan'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{
                border: '2px dashed #cbd5e1', borderRadius: '10px',
                background: '#f8fafc', padding: '18px 12px',
                width: '100%', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              }}
            >
              <Camera size={22} color="#94a3b8" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Upload Document</span>
              <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>Auto-scans for date &amp; number</span>
            </button>
          )}

          {/* OCR scanning indicator */}
          {isScanning && (
            <div
              style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
                padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1d4ed8',
              }}
            >
              <Loader size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>Scanning document with OCR…</span>
            </div>
          )}

          {/* OCR result badge */}
          {hasResult && !isScanning && (
            <div
              style={{
                background: (result.date || result.number) ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${(result.date || result.number) ? '#86efac' : '#fde68a'}`,
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '11.5px',
              }}
            >
              <div style={{ fontWeight: 700, color: (result.date || result.number) ? '#15803d' : '#92400e', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {(result.date || result.number) ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                OCR Scan — {result.confidence}% confidence
              </div>
              {result.date && extractedDateField && (
                <div style={{ color: '#166534' }}>
                  📅 {extractedDateLabel || 'Expiry'}: <strong>{result.date}</strong>
                  <span style={{ color: '#6b7280', marginLeft: '6px' }}>(auto-filled)</span>
                </div>
              )}
              {result.number && extractedNumberField && (
                <div style={{ color: '#166534', marginTop: '2px' }}>
                  🔢 {extractedNumberLabel || 'Number'}: <strong style={{ fontFamily: 'monospace' }}>{result.number}</strong>
                  <span style={{ color: '#6b7280', marginLeft: '6px' }}>(auto-filled)</span>
                </div>
              )}
              {!result.date && !result.number && (
                <div style={{ color: '#92400e' }}>Could not extract details. Please fill manually in the Compliance tab.</div>
              )}
            </div>
          )}

          {/* Extracted field inputs (inline) */}
          {extractedDateField && (
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                {extractedDateLabel || 'Expiry Date'}
              </label>
              <input
                type="date"
                className="form-control"
                style={{ fontSize: '12px', padding: '5px 10px' }}
                value={(formData as any)[extractedDateField] || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, [extractedDateField]: e.target.value }))}
              />
            </div>
          )}

          {extractedNumberField && (
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                {extractedNumberLabel || 'Document Number'}
              </label>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '12px', padding: '5px 10px', fontFamily: 'monospace' }}
                value={(formData as any)[extractedNumberField] || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, [extractedNumberField]: e.target.value }))}
                placeholder="Enter or edit"
              />
            </div>
          )}
        </div>
      </div>
    );
  };


  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Truck / Lorry Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Maintain fleet trucks, registration numbers, loading expenses, compliance validities & documents
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add New Truck
        </button>
      </div>

      <div className="card">
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="form-control"
              placeholder="Search by truck / lorry number, type..."
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
          data={vehicles}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
        />
      </div>

      {/* ── Add / Edit Truck Modal ───────────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedVehicle ? `Edit Truck: ${selectedVehicle.lorry_number}` : 'Add New Truck & Compliance'}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
            {formError}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '18px', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              color: activeTab === 'basic' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'basic' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              marginBottom: '-2px',
            }}
          >
            1. Basic Specs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              color: activeTab === 'docs' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'docs' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              marginBottom: '-2px',
            }}
          >
            2. Upload Documents (Auto-OCR)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              color: activeTab === 'compliance' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'compliance' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              marginBottom: '-2px',
            }}
          >
            3. Compliance &amp; Validities
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              color: activeTab === 'bank' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'bank' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              marginBottom: '-2px',
            }}
          >
            4. Bank &amp; PAN (Final Step)
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* TAB 1: BASIC SPECS */}
          {activeTab === 'basic' && (
            <div>
              <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Lorry / Truck Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. TN 33 U 5619"
                    value={formData.lorry_number}
                    onChange={(e) => setFormData({ ...formData, lorry_number: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Vehicle Type / Endorsement</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 10 Wheeler Taurus, 12 Wheeler Lorry"
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-cols-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Capacity (Tons)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 25.5"
                    value={formData.capacity_tons}
                    onChange={(e) => setFormData({ ...formData, capacity_tons: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Goodshed Loading Exp. (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    className="form-control"
                    placeholder="e.g. 500 or 1280"
                    value={formData.goodshed_loading_expense}
                    onChange={(e) => setFormData({ ...formData, goodshed_loading_expense: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOCUMENT PHOTOS with Smart OCR */}
          {activeTab === 'docs' && (
            <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '4px' }}>

              {/* Info banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)',
                  border: '1px solid #bfdbfe',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <ScanLine size={22} color="#2563eb" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e3a8a' }}>Smart OCR Document Scanner</div>
                  <div style={{ fontSize: '11.5px', color: '#3b5bdb', marginTop: '2px' }}>
                    Upload a clear photo of each document — the system will automatically scan and extract the expiry date and document number for you.
                  </div>
                </div>
              </div>

              {/* Compliance docs with OCR (2 columns) */}
              <div style={{ fontWeight: 800, fontSize: '12px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                📋 Compliance Documents (Auto-Scanned)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                <SmartDocCard
                  title="Fitness Certificate (FC)"
                  subtitle="FC scan — auto-extracts expiry & number"
                  iconColor="#10b981"
                  previewUrl={formData.fc_photo_url}
                  inputRef={fcInputRef}
                  photoField="fc_photo_url"
                  docType="fc"
                  extractedDateField="fc_expiry_date"
                  extractedNumberField="fc_number"
                  extractedDateLabel="FC Expiry Date"
                  extractedNumberLabel="FC Certificate Number"
                />
                <SmartDocCard
                  title="Insurance Policy"
                  subtitle="Insurance document — extracts expiry & policy no"
                  iconColor="#6366f1"
                  previewUrl={formData.insurance_photo_url}
                  inputRef={insInputRef}
                  photoField="insurance_photo_url"
                  docType="insurance"
                  extractedDateField="insurance_expiry_date"
                  extractedNumberField="insurance_policy_number"
                  extractedDateLabel="Insurance Expiry Date"
                  extractedNumberLabel="Policy Number"
                />
                <SmartDocCard
                  title="Road Permit"
                  subtitle="National / State Permit — extracts expiry & permit no"
                  iconColor="#f59e0b"
                  previewUrl={formData.permit_photo_url}
                  inputRef={permitInputRef}
                  photoField="permit_photo_url"
                  docType="permit"
                  extractedDateField="permit_expiry_date"
                  extractedNumberField="permit_number"
                  extractedDateLabel="Permit Expiry Date"
                  extractedNumberLabel="Permit Number"
                />
                <SmartDocCard
                  title="Yearly Road Tax"
                  subtitle="Tax token / receipt — extracts tax expiry date"
                  iconColor="#ef4444"
                  previewUrl={formData.tax_photo_url}
                  inputRef={taxInputRef}
                  photoField="tax_photo_url"
                  docType="tax"
                  extractedDateField="tax_expiry_date"
                  extractedDateLabel="Tax Expiry Date"
                />
                <SmartDocCard
                  title="DTS Certificate"
                  subtitle="DTS / Pollution cert — extracts expiry & cert no"
                  iconColor="#8b5cf6"
                  previewUrl={formData.dts_certificate_url}
                  inputRef={dtsInputRef}
                  photoField="dts_certificate_url"
                  docType="dts"
                  extractedDateField="dts_expiry_date"
                  extractedNumberField="dts_number"
                  extractedDateLabel="DTS Expiry Date"
                  extractedNumberLabel="DTS Certificate Number"
                />
                <SmartDocCard
                  title="RC Photo"
                  subtitle="Registration Certificate — extracts RC number"
                  iconColor="#3b82f6"
                  previewUrl={formData.rc_photo_url}
                  inputRef={rcInputRef}
                  photoField="rc_photo_url"
                  docType="rc"
                  extractedNumberField="rc_number"
                  extractedNumberLabel="RC Number"
                />
              </div>

              {/* ID / Banking docs */}
              <div style={{ fontWeight: 800, fontSize: '12px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                🏦 ID &amp; Banking Documents
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <SmartDocCard
                  title="PAN Card"
                  subtitle="PAN card photo — extracts PAN number"
                  iconColor="#f59e0b"
                  previewUrl={formData.pan_card_url}
                  inputRef={panInputRef}
                  photoField="pan_card_url"
                  docType="pan"
                  extractedNumberField="pan_number"
                  extractedNumberLabel="PAN Number"
                />
                <SmartDocCard
                  title="Bank Document"
                  subtitle="Passbook / Cheque — extracts account no & IFSC"
                  iconColor="#0284c7"
                  previewUrl={formData.account_photo_url}
                  inputRef={accInputRef}
                  photoField="account_photo_url"
                  docType="bank"
                  extractedNumberField="account_number"
                  extractedNumberLabel="Account Number"
                />
              </div>
            </div>
          )}

          {/* TAB 3: COMPLIANCE & VALIDITIES */}
          {activeTab === 'compliance' && (
            <div>
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>ℹ️</span>
                <span>
                  <strong>Compliance numbers &amp; expiry dates</strong> have been auto-extracted from your uploaded documents in Step 2. Verify or adjust if needed.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Fitness Certificate (FC) Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="FC No"
                    value={formData.fc_number}
                    onChange={(e) => setFormData({ ...formData, fc_number: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#b91c1c' }}>FC Expiry Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.fc_expiry_date}
                    onChange={(e) => setFormData({ ...formData, fc_expiry_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Insurance Policy Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Policy No"
                    value={formData.insurance_policy_number}
                    onChange={(e) => setFormData({ ...formData, insurance_policy_number: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#b91c1c' }}>Insurance Expiry Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.insurance_expiry_date}
                    onChange={(e) => setFormData({ ...formData, insurance_expiry_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Permit Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Permit No"
                    value={formData.permit_number}
                    onChange={(e) => setFormData({ ...formData, permit_number: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#b91c1c' }}>Permit Expiry Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.permit_expiry_date}
                    onChange={(e) => setFormData({ ...formData, permit_expiry_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#b91c1c' }}>Yearly Road Tax Expiry Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.tax_expiry_date}
                    onChange={(e) => setFormData({ ...formData, tax_expiry_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">DTS / Hazardous Certificate Expiry</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.dts_expiry_date}
                    onChange={(e) => setFormData({ ...formData, dts_expiry_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BANK & PAN */}
          {activeTab === 'bank' && (
            <div>
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>ℹ️</span>
                <span>
                  <strong>Step 4 (Final Step):</strong> Verify bank account and PAN details before saving this truck to the fleet.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Bank Account Holder Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Name as in Bank Account"
                    value={formData.account_holder_name}
                    onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. State Bank of India, HDFC"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Bank Account Number"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. SBIN0001234"
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">PAN Card Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. ABCDE1234F"
                    value={formData.pan_number}
                    onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">DTS Certificate Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="DTS / Pollution / Safety Cert No"
                    value={formData.dts_number}
                    onChange={(e) => setFormData({ ...formData, dts_number: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <div>
              {activeTab !== 'basic' && (
                <button
                  type="button"
                  onClick={handlePrevTab}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  ← Back
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline">
                Cancel
              </button>

              {activeTab === 'basic' && (
                <button
                  type="button"
                  onClick={handleNextTab}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Next Step: Upload Documents →
                </button>
              )}

              {activeTab === 'docs' && (
                <button
                  type="button"
                  onClick={handleNextTab}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Next Step: Review Compliance →
                </button>
              )}

              {activeTab === 'compliance' && (
                <button
                  type="button"
                  onClick={handleNextTab}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Next Step: Bank &amp; PAN Details →
                </button>
              )}

              {activeTab === 'bank' && (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#16a34a', borderColor: '#16a34a' }}
                >
                  {isSubmitting ? 'Saving...' : selectedVehicle ? '✓ Update Truck' : '✓ Save Truck'}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Truck Profile View, Print & Download Modal ────────────────────── */}
      <TruckProfileModal
        vehicle={profileVehicle}
        onClose={() => setProfileVehicle(null)}
        onEdit={(v) => {
          setProfileVehicle(null);
          openEditModal(v);
        }}
      />
    </div>
  );
};
