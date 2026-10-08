import React, { useState, useEffect, useRef } from 'react';
import {
  Truck, Plus, Edit2, Search, Trash2, Eye, X, Camera,
  CheckCircle, AlertCircle, Image as ImageIcon, Download, ZoomIn,
  FileText, Shield, CreditCard, Building, Hash, Calendar,
  Loader2, Sparkles, AlertTriangle, Share2, Printer
} from 'lucide-react';
import { vehicleService } from '../services/adminService';
import { Vehicle } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { extractTextFromFileOrData } from '../utils/fileExtraction';
import {
  parseRcDocument,
  parseFcDocument,
  parseTaxDocument,
  parseTdsDocument,
  parseBankDocument,
  parsePanDocument,
  parseInsuranceDocument,
  parsePermitDocument,
  getNextMarch31st,
  formatVehicleNumber,
} from '../utils/docParsers';

import { formatDateDMY } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';

const readAsBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

// ─── Helper: format date as DD-MM-YYYY ───────────────────────────────────────
const fmtDate = (d?: string | null) => {
  if (!d) return null;
  return formatDateDMY(d);
};

const getDaysLeft = (d?: string | null): number | null => {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
};

const ExpiryBadge: React.FC<{ date?: string | null }> = ({ date }) => {
  if (!date) return null;
  const days = getDaysLeft(date);
  if (days === null) return null;
  const color = days < 0 ? '#b91c1c' : days <= 30 ? '#d97706' : '#15803d';
  const bg = days < 0 ? '#fef2f2' : days <= 30 ? '#fffbeb' : '#f0fdf4';
  const label = days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `${days}d left`;
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '2px 8px',
      borderRadius: '10px', background: bg, color, display: 'inline-flex',
      alignItems: 'center', gap: '4px',
    }}>
      <Calendar size={10} />{label}
    </span>
  );
};

// ─── Helpers to detect file type from base64 data URI ───────────────────────
const getFileType = (dataUri: string): 'image' | 'pdf' | 'word' | 'file' => {
  if (!dataUri) return 'file';
  if (dataUri.startsWith('data:image/')) return 'image';
  if (dataUri.includes('application/pdf')) return 'pdf';
  if (dataUri.includes('application/msword') || dataUri.includes('officedocument.wordprocessingml')) return 'word';
  return 'file';
};

const getFileName = (dataUri: string): string => {
  const type = getFileType(dataUri);
  if (type === 'pdf') return 'PDF Document';
  if (type === 'word') return 'Word Document';
  if (type === 'image') return 'Image';
  return 'File';
};

// ─── Reusable upload widget — accepts image / PDF / Word / any file ───────────
interface ImageUploadFieldProps {
  value: string;
  label: string;
  onUpload: () => void;
  onRemove: () => void;
  isExtracting?: boolean;
}

const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  value,
  label,
  onUpload,
  onRemove,
  isExtracting,
}) => {
  if (isExtracting) {
    return (
      <div style={{
        border: '2px dashed #3b82f6', borderRadius: '10px', padding: '22px 16px',
        textAlign: 'center', background: '#eff6ff', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '10px',
      }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%', background: '#dbeafe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Loader2 size={24} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '13px', color: '#1d4ed8' }}>
            Scanning Document &amp; Extracting Details...
          </div>
          <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '3px' }}>
            AI OCR is automatically reading text and filling fields
          </div>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <div onClick={onUpload}
        style={{
          border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '22px 16px',
          textAlign: 'center', background: '#f8fafc', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          transition: 'all 0.18s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = '#eff6ff'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
      >
        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Camera size={22} color="#4338ca" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{label}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Image · PDF · Word (.doc / .docx) · Auto OCR</div>
        </div>
      </div>
    );
  }

  const fileType = getFileType(value);

  const actions = (
    <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', background: '#fff', borderTop: '1px solid #e2e8f0', justifyContent: 'center' }}>
      <button type="button" onClick={onUpload} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Camera size={12} /> Change
      </button>
      <button type="button" onClick={onRemove} className="btn btn-danger btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <X size={12} /> Remove
      </button>
    </div>
  );

  if (fileType === 'image') {
    return (
      <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden', background: '#f8fafc' }}>
        <img src={value} alt="preview" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }} />
        {actions}
      </div>
    );
  }

  // PDF / Word / generic file — show an icon card
  const isPdf = fileType === 'pdf';
  const isWord = fileType === 'word';
  const iconBg = isPdf ? '#fef2f2' : isWord ? '#eff6ff' : '#f8fafc';
  const iconColor = isPdf ? '#dc2626' : isWord ? '#2563eb' : '#64748b';
  const iconLabel = isPdf ? 'PDF' : isWord ? 'DOCX' : 'FILE';
  const fileLabel = getFileName(value);

  return (
    <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', gap: '10px' }}>
        <div style={{
          width: '56px', height: '70px', borderRadius: '8px', background: iconBg,
          border: `2px solid ${iconColor}22`, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '4px', position: 'relative',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <FileText size={24} color={iconColor} />
          <span style={{ fontSize: '9px', fontWeight: 800, color: iconColor, letterSpacing: '0.5px' }}>{iconLabel}</span>
          <div style={{
            position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px',
            borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle size={12} color="#fff" />
          </div>
        </div>
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>{fileLabel} uploaded</span>
        {isPdf && (
          <a href={value} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: '11.5px', color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}
          >Preview PDF</a>
        )}
      </div>
      {actions}
    </div>
  );
};

interface DocImageProps {
  url: string;
  title: string;
  onZoom: (url: string, title: string) => void;
}
const DocImage: React.FC<DocImageProps> = ({ url, title, onZoom }) => {
  const isPdf = getFileType(url) === 'pdf';
  if (isPdf) {
    return (
      <div style={{
        height: '110px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
        background: '#fef2f2', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px'
      }}>
        <FileText size={28} color="#dc2626" />
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', textDecoration: 'underline' }}>
          Open PDF Document
        </a>
      </div>
    );
  }

  return (
    <div
      onClick={() => onZoom(url, title)}
      style={{
        position: 'relative', borderRadius: '8px', overflow: 'hidden',
        border: '1.5px solid #e2e8f0', cursor: 'zoom-in',
        background: '#0f172a', height: '120px',
      }}
      title="Click to view full size"
    >
      <img src={url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <div style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0, transition: 'opacity 0.2s',
      }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
      >
        <ZoomIn size={22} color="#fff" />
      </div>
    </div>
  );
};

interface DocCardProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  children: React.ReactNode;
}
const DocCard: React.FC<DocCardProps> = ({ icon, label, color, children }) => (
  <div style={{
    border: '1.5px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden',
    background: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  }}>
    <div style={{
      padding: '10px 16px', background: color, display: 'flex',
      alignItems: 'center', gap: '8px',
    }}>
      {icon}
      <span style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>{label}</span>
    </div>
    <div style={{ padding: '14px 16px' }}>{children}</div>
  </div>
);

const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed #f1f5f9' }}>
    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{label}</span>
    <span style={{ fontSize: '13px', color: value ? '#0f172a' : '#94a3b8', fontWeight: value ? 700 : 400 }}>
      {value || '—'}
    </span>
  </div>
);

interface VehicleDetailPanelProps {
  vehicle: Vehicle;
  onEdit: () => void;
  onClose: () => void;
  onZoom: (url: string, title: string) => void;
}

const VehicleDetailPanel: React.FC<VehicleDetailPanelProps> = ({ vehicle: v, onEdit, onClose, onZoom }) => {
  const num = v.lorry_number;
  const tdsNumber = v.tds_number || v.dts_number;
  const tdsExpiry = v.tds_expiry_date || v.dts_expiry_date;
  const tdsCertUrl = v.tds_certificate_url || v.dts_certificate_url;
  const rcRegDate = v.rc_reg_date || v.rc_expiry_date;

  const fmtForPrint = (d?: string | null) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const buildRecord = async () => {
    // ── helpers ──────────────────────────────────────────────────
    const today = new Date(); today.setHours(0,0,0,0);
    const daysLeft = (d?: string|null) => {
      if (!d) return null;
      const diff = Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000);
      return diff;
    };
    const fmtD = (d?: string|null) => {
      if (!d) return null;
      return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    };
    const statusLabel = (d?: string|null) => {
      const left = daysLeft(d);
      if (left === null) return '';
      if (left < 0) return ` <span style="color:#dc2626;font-weight:700">(EXPIRED)</span>`;
      if (left === 0) return ` <span style="color:#dc2626;font-weight:700">(Expires Today)</span>`;
      return ` <span style="color:#16a34a">(${left}d left)</span>`;
    };
    const complianceDocs: {label:string, date?:string|null}[] = [
      { label:'Fitness Certificate (FC)', date: v.fc_expiry_date },
      { label:'Insurance', date: v.insurance_expiry_date },
      { label:'Road Permit', date: v.permit_expiry_date },
      { label:'TDS Certificate', date: tdsExpiry },
      { label:'Road Tax', date: v.tax_expiry_date },
    ];
    const alerts = complianceDocs.filter(d => {
      const left = daysLeft(d.date);
      return left !== null && left <= 30;
    });

    // ── image helpers ─────────────────────────────────────────────
    const toBase64 = (url: string): Promise<string|null> =>
      new Promise(resolve => {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            c.getContext('2d')!.drawImage(img,0,0);
            resolve(c.toDataURL('image/jpeg', 0.85));
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });

    const isPdf = (url?: string|null) => url && (url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('application/pdf'));

    // Pre-load all images
    const [
      rcFront, rcBack, fcImg, insImg, permitImg,
      tdsPg1, tdsPg2, taxImg, panImg, bankImg, truckImg
    ] = await Promise.all([
      v.rc_photo_url      ? toBase64(v.rc_photo_url)      : Promise.resolve(null),
      v.rc_photo_back_url ? toBase64(v.rc_photo_back_url) : Promise.resolve(null),
      v.fc_photo_url      ? toBase64(v.fc_photo_url)      : Promise.resolve(null),
      v.insurance_photo_url ? toBase64(v.insurance_photo_url) : Promise.resolve(null),
      v.permit_photo_url  ? toBase64(v.permit_photo_url)  : Promise.resolve(null),
      tdsCertUrl          ? toBase64(tdsCertUrl)           : Promise.resolve(null),
      v.tds_certificate_url_2 ? toBase64(v.tds_certificate_url_2) : Promise.resolve(null),
      v.tax_photo_url     ? toBase64(v.tax_photo_url)     : Promise.resolve(null),
      v.pan_card_url      ? toBase64(v.pan_card_url)      : Promise.resolve(null),
      v.account_photo_url ? toBase64(v.account_photo_url) : Promise.resolve(null),
      v.truck_image_url   ? toBase64(v.truck_image_url)   : Promise.resolve(null),
    ]);

    const makeImgBox = (b64: string|null, label: string, emptyLabel: string, isDocPdf: boolean) => {
      const headerStyle = `font-size:10.5px;font-weight:800;letter-spacing:1px;color:#1d4ed8;text-transform:uppercase;padding:10px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc;border-radius:6px 6px 0 0`;
      const wrapStyle = `border:1.5px solid #e2e8f0;border-radius:6px;overflow:hidden;width:100%`;
      if (!b64 && !isDocPdf) return `<div style="${wrapStyle}"><div style="${headerStyle}">${label}</div><div style="padding:22px;text-align:center;font-size:11px;color:#94a3b8;font-style:italic">${emptyLabel}</div></div>`;
      if (isDocPdf) return `<div style="${wrapStyle}"><div style="${headerStyle}">${label}</div><div style="padding:18px;text-align:center"><div style="display:inline-block;border:1.5px dashed #94a3b8;border-radius:6px;padding:10px 20px;font-size:11.5px;font-weight:600;color:#475569">📄 PDF Document</div></div></div>`;
      if (!b64) return `<div style="${wrapStyle}"><div style="${headerStyle}">${label}</div><div style="padding:22px;text-align:center;font-size:11px;color:#94a3b8;font-style:italic">${emptyLabel}</div></div>`;
      return `<div style="${wrapStyle}"><div style="${headerStyle}">${label}</div><div style="padding:10px;text-align:center"><img src="${b64}" style="max-width:100%;max-height:300px;object-fit:contain;border-radius:4px;display:block;margin:0 auto"/></div></div>`;
    };

    const cell = (lbl: string, val: string) =>
      `<td style="padding:8px 10px;font-size:10.5px;font-weight:700;color:#1e40af;text-transform:uppercase;white-space:nowrap;border:1px solid #e2e8f0;width:18%">${lbl}</td><td style="padding:8px 10px;font-size:11px;font-weight:700;color:#0f172a;border:1px solid #e2e8f0;width:32%">${val}</td>`;

    const cellFull = (lbl: string, val: string) =>
      `<td style="padding:8px 10px;font-size:10.5px;font-weight:700;color:#1e40af;text-transform:uppercase;white-space:nowrap;border:1px solid #e2e8f0;width:18%">${lbl}</td><td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:700;border:1px solid #e2e8f0;color:#0f172a">${val}</td>`;

    const complianceHtml = alerts.length ? `
      <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:6px;padding:10px 14px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:800;color:#dc2626;margin-bottom:6px">⚠️ 30-DAY COMPLIANCE EXPIRY NOTICE — ACTION REQUIRED BEFORE DISPATCH:</div>
        ${alerts.map(a => {
          const left = daysLeft(a.date);
          const expired = left !== null && left < 0;
          return `<div style="font-size:11px;font-weight:700;color:#dc2626;margin-left:10px">• ${a.label}: ${expired ? `EXPIRED (${fmtD(a.date)})` : `Expires ${fmtD(a.date)} (${left}d left)`}</div>`;
        }).join('')}
      </div>` : '';

    const bodyContent = `
      <!-- HEADER -->
      <div class="pdf-block" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <h2>KSP TRANSPORT SERVICES</h2>
          <div class="subtitle">Official Fleet Truck Master &amp; Verification Record</div>
        </div>
        <div style="text-align:right;border:1.5px solid #1d4ed8;border-radius:6px;padding:8px 16px;min-width:160px">
          <div style="font-size:11px;font-weight:800;color:#1d4ed8">STATUS: ${v.status}</div>
          <div style="font-size:9.5px;color:#64748b;margin-top:2px">Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>
          ${truckImg ? `<img src="${truckImg}" style="height:38px;margin-top:6px;border-radius:4px;object-fit:cover"/>` : ''}
        </div>
      </div>
      <div class="pdf-block" style="border-top:2px solid #1d4ed8;margin-bottom:16px"></div>

      ${complianceHtml ? `<div class="pdf-block">${complianceHtml}</div>` : ''}

      <!-- SECTION 1 -->
      <div class="pdf-block">
        <div class="section-title">1. Vehicle Specifications</div>
        <table style="margin-bottom:4px">
          <tr>${cell('Lorry / Truck No', num)}${cell('Vehicle Type', v.vehicle_type || '\u2014')}</tr>
          <tr>${cell('RC / Reg No', v.rc_number || '\u2014')}${cell('RC Registration Date', fmtD(rcRegDate) || '\u2014')}</tr>
          <tr>${cellFull('Status', `<span style="color:${v.status === 'ACTIVE' ? '#16a34a' : '#dc2626'};font-weight:800">${v.status}</span>`)}</tr>
        </table>
      </div>

      <!-- SECTION 2 -->
      <div class="pdf-block">
        <div class="section-title">2. Validity &amp; Compliance Dates</div>
        <table style="margin-bottom:4px">
          <tr>
            ${cell('Fitness Cert (FC)', v.fc_expiry_date ? `${fmtD(v.fc_expiry_date)}${statusLabel(v.fc_expiry_date)}` : '\u2014')}
            <td style="padding:8px 10px;font-size:10.5px;font-weight:700;color:#1e40af;text-transform:uppercase;white-space:nowrap;border:1px solid #e2e8f0;width:18%">Insurance Policy</td>
            <td style="padding:6px 10px;font-size:11px;border:1px solid #e2e8f0;width:32%">
              ${v.insurance_policy_number ? `<div style="font-weight:700;color:#0f172a;margin-bottom:2px">No: ${v.insurance_policy_number}</div>` : ''}
              ${v.insurance_expiry_date ? `<div style="font-weight:700;color:#0f172a">${fmtD(v.insurance_expiry_date)}${statusLabel(v.insurance_expiry_date)}</div>` : '<span style="color:#94a3b8">\u2014</span>'}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 10px;font-size:10.5px;font-weight:700;color:#1e40af;text-transform:uppercase;white-space:nowrap;border:1px solid #e2e8f0;width:18%">Road Permit</td>
            <td style="padding:6px 10px;font-size:11px;border:1px solid #e2e8f0;width:32%">
              ${v.permit_number ? `<div style="font-weight:700;color:#0f172a;margin-bottom:2px">No: ${v.permit_number}</div>` : ''}
              ${v.permit_expiry_date ? `<div style="font-weight:700;color:#0f172a">${fmtD(v.permit_expiry_date)}${statusLabel(v.permit_expiry_date)}</div>` : '<span style="color:#94a3b8">\u2014</span>'}
            </td>
            ${cell('Yearly Road Tax', v.tax_photo_url ? '<span style="color:#16a34a;font-weight:800">\u2714 Yes</span>' : '<span style="color:#dc2626;font-weight:700">\u2717 No</span>')}
          </tr>
          <tr>
            ${cellFull('TDS Certificate', tdsCertUrl ? '<span style="color:#16a34a;font-weight:800">\u2714 Yes</span>' : '<span style="color:#dc2626;font-weight:700">\u2717 No</span>')}
          </tr>
        </table>
      </div>

      <!-- SECTION 3 -->
      <div class="pdf-block">
        <div class="section-title">3. Bank Account &amp; PAN Card Details</div>
        <table style="margin-bottom:4px">
          <tr>${cell('PAN Number', v.pan_number || '—')}${cell('Account Holder', v.account_holder_name || '—')}</tr>
          <tr>${cell('Account Number', v.account_number || '—')}${cell('Bank Name', v.bank_name || '—')}</tr>
          <tr>${cell('IFSC Code', v.ifsc_code || '—')}${cell('', '')}</tr>
        </table>
      </div>

      <!-- SECTION 4 -->
      <div class="pdf-block section-title">4. Submitted Document Verification Scans</div>

      ${[  
        { b64: rcFront,   label: 'Registration Certificate (RC Front)',  empty: 'No RC Front Uploaded',        pdf: isPdf(v.rc_photo_url) },
        { b64: rcBack,    label: 'Registration Certificate (RC Back)',   empty: 'No RC Back Uploaded',         pdf: isPdf(v.rc_photo_back_url) },
        { b64: fcImg,     label: 'Fitness Certificate (FC)',             empty: 'No FC Certificate Uploaded',  pdf: isPdf(v.fc_photo_url) },
        { b64: insImg,    label: 'Insurance Document',                  empty: 'No Insurance Uploaded',       pdf: isPdf(v.insurance_photo_url) },
        { b64: permitImg, label: 'Road Permit',                         empty: 'No Permit Uploaded',          pdf: isPdf(v.permit_photo_url) },
        { b64: taxImg,    label: 'Road Tax Receipt (Yearly Tax)',        empty: 'No Tax Receipt Uploaded',     pdf: isPdf(v.tax_photo_url) },
        { b64: panImg,    label: 'PAN Card',                            empty: 'No PAN Card Uploaded',        pdf: isPdf(v.pan_card_url) },
        { b64: bankImg,   label: 'Bank Passbook / Cheque',              empty: 'No Bank Document Uploaded',   pdf: isPdf(v.account_photo_url) },
        { b64: tdsPg1,    label: 'TDS Certificate — Page 1',            empty: 'No TDS Certificate Uploaded', pdf: isPdf(tdsCertUrl) },
        ...(v.tds_certificate_url_2 ? [{ b64: tdsPg2, label: 'TDS Certificate — Page 2', empty: 'No TDS Page 2 Uploaded', pdf: isPdf(v.tds_certificate_url_2) }] : []),
      ].map(d => `<div class="pdf-block doc-card">${makeImgBox(d.b64, d.label, d.empty, !!d.pdf)}</div>`).join('')}

      <!-- FOOTER -->
      <div class="pdf-block" style="margin-top:30px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e2e8f0;padding-top:16px">
        <div>
          <div class="sig-line"></div>
          <div style="font-size:10px;color:#1d4ed8;font-weight:600;margin-top:4px">Fleet / Transport Manager</div>
        </div>
        <div style="text-align:right">
          <div class="sig-line"></div>
          <div style="font-size:10px;color:#1d4ed8;font-weight:600;margin-top:4px">Authorized Admin Signature</div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html><html><head>
      <title>KSP Transport — ${num}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;padding:28px 32px;font-size:11px}
        h2{font-size:16px;font-weight:900;color:#1d4ed8;margin-bottom:2px;letter-spacing:0.5px}
        .subtitle{font-size:10.5px;color:#64748b;margin-bottom:0}
        .section-title{font-size:12px;font-weight:800;color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:4px;margin:18px 0 10px;text-transform:uppercase;letter-spacing:0.5px}
        table{border-collapse:collapse;width:100%}
        td{vertical-align:top}
        .doc-card{page-break-inside:avoid;break-inside:avoid;margin-bottom:14px}
        .sig-line{border-top:1px solid #0f172a;display:inline-block;width:200px;margin-top:4px}
        @media print{body{padding:16px 20px}@page{margin:12mm}}
      </style>
    </head><body>
      ${bodyContent}
    </body></html>`;

    return { bodyContent, html };
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const { html } = await buildRecord();
      const win = window.open('', '_blank', 'width=900,height=1100');
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    } catch (e) {
      console.error('Print error:', e);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { bodyContent } = await buildRecord();
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Off-screen container at exact A4 width
      const RENDER_WIDTH = 794; // ~210mm @ 96dpi
      const container = document.createElement('div');
      container.style.cssText = `
        position:fixed;left:-9999px;top:0;
        width:${RENDER_WIDTH}px;background:#fff;
        padding:24px 28px;box-sizing:border-box;z-index:-9999;
      `;
      container.innerHTML = `
        <style>
          *{box-sizing:border-box;margin:0;padding:0}
          body,div,table{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;font-size:11px}
          h2{font-size:16px;font-weight:900;color:#1d4ed8;margin-bottom:2px}
          .subtitle{font-size:10.5px;color:#64748b}
          .section-title{font-size:12px;font-weight:800;color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:4px;margin:16px 0 10px;text-transform:uppercase;letter-spacing:.5px}
          table{border-collapse:collapse;width:100%;margin-bottom:4px}
          td{vertical-align:top}
          .doc-card{margin-bottom:14px}
          .sig-line{border-top:1px solid #0f172a;display:inline-block;width:200px;margin-top:4px}
        </style>
        ${bodyContent}
      `;
      document.body.appendChild(container);
      await new Promise(r => setTimeout(r, 200));

      // Collect each pdf-block's position relative to container top
      const containerTop = container.getBoundingClientRect().top;
      const blocks = Array.from(container.querySelectorAll<HTMLElement>('.pdf-block'));

      // Render the ENTIRE container as one high-res canvas (scale=2 for retina)
      const fullCanvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: RENDER_WIDTH,
        backgroundColor: '#ffffff',
      });

      const scaleX = fullCanvas.width / container.offsetWidth;

      // Map each block to canvas-pixel rows
      const blockRanges = blocks.map(b => {
        const r = b.getBoundingClientRect();
        return {
          top:    Math.max(0, Math.round((r.top    - containerTop) * scaleX)),
          bottom: Math.min(fullCanvas.height, Math.round((r.bottom - containerTop) * scaleX)),
        };
      });

      document.body.removeChild(container);

      // A4 page in canvas pixels
      const PAGE_H_PX  = Math.round(fullCanvas.width * (297 / 210));
      const MARGIN_PX  = Math.round(fullCanvas.width * (10  / 210)); // 10mm top margin on subsequent pages

      // Build page slices — break ONLY between blocks, never through one
      const slices: Array<{ y: number; h: number; first: boolean }> = [];
      let curY    = 0;
      const totalH = fullCanvas.height;

      while (curY < totalH) {
        const isFirst  = slices.length === 0;
        const pageRoom = isFirst ? PAGE_H_PX : (PAGE_H_PX - MARGIN_PX);
        const rawEnd   = curY + pageRoom;

        if (rawEnd >= totalH) {
          slices.push({ y: curY, h: totalH - curY, first: isFirst });
          break;
        }

        // Walk blocks to find the best split point: the bottom of the last block
        // that fits entirely before rawEnd. Never split through a block.
        let splitAt = rawEnd; // fallback: hard cut (no block straddles here)

        for (let i = 0; i < blockRanges.length; i++) {
          const { top, bottom } = blockRanges[i];
          if (top < rawEnd && bottom > rawEnd) {
            // This block would be cut — move split to just before it (if meaningful)
            splitAt = top > curY + 30 ? top : rawEnd;
            break;
          }
          // Keep track of the last block that fits fully — use it as a potential split point
          if (bottom <= rawEnd) {
            splitAt = bottom;
          }
        }

        if (splitAt <= curY) splitAt = rawEnd; // safety

        slices.push({ y: curY, h: splitAt - curY, first: isFirst });
        curY = splitAt;
      }

      // Build PDF from slices
      const pdf = new jsPDF('p', 'mm', 'a4');
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = fullCanvas.width;

      for (let i = 0; i < slices.length; i++) {
        const { y, h, first } = slices[i];
        if (h <= 0) continue;

        tmpCanvas.height = h;
        const ctx = tmpCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tmpCanvas.width, h);
        ctx.drawImage(fullCanvas, 0, y, fullCanvas.width, h, 0, 0, fullCanvas.width, h);

        const imgData  = tmpCanvas.toDataURL('image/jpeg', 0.97);
        const imgHmm   = (h / fullCanvas.width) * 210;
        const yOffsetMm = first ? 0 : 10;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, yOffsetMm, 210, imgHmm, undefined, 'FAST');
      }

      const filename = `Vehicle_${num.replace(/[^a-zA-Z0-9]/g, '_')}_Master_Record.pdf`;
      pdf.save(filename);

      try {
        const history = JSON.parse(localStorage.getItem('downloaded_vehicles') || '[]');
        history.unshift({ lorry_number: num, downloaded_at: new Date().toISOString(), filename });
        localStorage.setItem('downloaded_vehicles', JSON.stringify(history.slice(0, 50)));
      } catch { /* ignore */ }

    } catch (err) {
      console.error('PDF download error:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };


  const handleShare = async () => {
    const text = [
      `🚛 Vehicle: ${num}`,
      v.vehicle_type ? `Type: ${v.vehicle_type}` : '',
      v.capacity_tons ? `Capacity: ${v.capacity_tons} Tons` : '',
      `Status: ${v.status}`,
      '',
      `RC No: ${v.rc_number || '—'}`,
      `FC Expiry: ${fmtForPrint(v.fc_expiry_date)}`,
      `Insurance Expiry: ${fmtForPrint(v.insurance_expiry_date)}`,
      `Permit Expiry: ${fmtForPrint(v.permit_expiry_date)}`,
      `TDS Expiry: ${fmtForPrint(tdsExpiry) || '31 Mar (Yearly)'}`,
      `Road Tax Expiry: ${fmtForPrint(v.tax_expiry_date) || '31 Mar (Yearly)'}`,
      '',
      `PAN: ${v.pan_number || '—'}  |  A/c: ${v.account_number || '—'}  |  IFSC: ${v.ifsc_code || '—'}`,
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      try { await navigator.share({ title: `Vehicle — ${num}`, text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    alert('Vehicle details copied to clipboard!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
        borderRadius: '16px', padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(37,99,235,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {v.truck_image_url ? (
            <div onClick={() => onZoom(v.truck_image_url!, `${num} — Truck Photo`)}
              style={{
                width: '72px', height: '56px', borderRadius: '10px', overflow: 'hidden',
                border: '2px solid rgba(255,255,255,0.4)', cursor: 'zoom-in',
              }}>
              <img src={v.truck_image_url} alt={num} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <div style={{
              width: '72px', height: '56px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.4)',
            }}>
              <Truck size={28} color="rgba(255,255,255,0.7)" />
            </div>
          )}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Lorry / Truck Number
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', letterSpacing: '1px', lineHeight: 1.2 }}>
              {num}
            </div>
            {v.vehicle_type && (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>{v.vehicle_type}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span style={{
            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
            background: v.status === 'ACTIVE' ? 'rgba(220,252,231,0.95)' : 'rgba(254,226,226,0.95)',
            color: v.status === 'ACTIVE' ? '#15803d' : '#b91c1c',
            display: 'inline-flex', alignItems: 'center', gap: '5px',
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: v.status === 'ACTIVE' ? '#16a34a' : '#dc2626' }} />
            {v.status}
          </span>
          {v.capacity_tons && (
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              Capacity: {v.capacity_tons} Tons
            </span>
          )}
        </div>
      </div>

      {/* ── Document Sections ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* RC — Registration Certificate (Date of Regn, No Expiry) */}
        <DocCard icon={<FileText size={15} color="#1d4ed8" />} label="RC — Registration Certificate" color="#eff6ff">
          <InfoRow label="RC Number" value={v.rc_number} />
          <InfoRow label="Date of Registration" value={fmtDate(rcRegDate)} />
          {(v.rc_photo_url || v.rc_photo_back_url) && (
            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: v.rc_photo_url && v.rc_photo_back_url ? '1fr 1fr' : '1fr', gap: '8px' }}>
              {v.rc_photo_url && <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>RC FRONT</div><DocImage url={v.rc_photo_url} title={`${num} — RC Front`} onZoom={onZoom} /></div>}
              {v.rc_photo_back_url && <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>RC BACK</div><DocImage url={v.rc_photo_back_url} title={`${num} — RC Back`} onZoom={onZoom} /></div>}
            </div>
          )}
        </DocCard>

        {/* FC — Fitness Certificate */}
        <DocCard icon={<Shield size={15} color="#7c3aed" />} label="FC — Fitness Certificate" color="#f5f3ff">

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>FC Expiry</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: v.fc_expiry_date ? '#0f172a' : '#94a3b8', fontWeight: 700 }}>
                {fmtDate(v.fc_expiry_date) || '—'}
              </span>
              <ExpiryBadge date={v.fc_expiry_date} />
            </div>
          </div>
          {v.fc_photo_url && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>FC CERTIFICATE</div>
              <DocImage url={v.fc_photo_url} title={`${num} — FC Certificate`} onZoom={onZoom} />
            </div>
          )}
        </DocCard>

        {/* Insurance */}
        <DocCard icon={<Shield size={15} color="#059669" />} label="Insurance" color="#ecfdf5">
          <InfoRow label="Policy Number" value={v.insurance_policy_number} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Expiry</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: v.insurance_expiry_date ? '#0f172a' : '#94a3b8', fontWeight: 700 }}>
                {fmtDate(v.insurance_expiry_date) || '—'}
              </span>
              <ExpiryBadge date={v.insurance_expiry_date} />
            </div>
          </div>
          {v.insurance_photo_url && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>INSURANCE DOCUMENT</div>
              <DocImage url={v.insurance_photo_url} title={`${num} — Insurance`} onZoom={onZoom} />
            </div>
          )}
        </DocCard>

        {/* Permit */}
        <DocCard icon={<FileText size={15} color="#d97706" />} label="Permit" color="#fffbeb">
          <InfoRow label="Permit Number" value={v.permit_number} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Expiry</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: v.permit_expiry_date ? '#0f172a' : '#94a3b8', fontWeight: 700 }}>
                {fmtDate(v.permit_expiry_date) || '—'}
              </span>
              <ExpiryBadge date={v.permit_expiry_date} />
            </div>
          </div>
          {v.permit_photo_url && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>PERMIT DOCUMENT</div>
              <DocImage url={v.permit_photo_url} title={`${num} — Permit`} onZoom={onZoom} />
            </div>
          )}
        </DocCard>

        {/* TDS (formerly DTS) — Expires March 31st */}
        <DocCard icon={<Hash size={15} color="#0891b2" />} label="TDS Certificate (Yearly: 31st March)" color="#ecfeff">

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>TDS Expiry</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: tdsExpiry ? '#0f172a' : '#94a3b8', fontWeight: 700 }}>
                {fmtDate(tdsExpiry) || '31 Mar (Yearly)'}
              </span>
              <ExpiryBadge date={tdsExpiry} />
            </div>
          </div>
          {tdsCertUrl && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>TDS CERTIFICATE — PAGE 1</div>
              <DocImage url={tdsCertUrl} title={`${num} — TDS Page 1`} onZoom={onZoom} />
            </div>
          )}
          {v.tds_certificate_url_2 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>TDS CERTIFICATE — PAGE 2</div>
              <DocImage url={v.tds_certificate_url_2} title={`${num} — TDS Page 2`} onZoom={onZoom} />
            </div>
          )}
        </DocCard>

        {/* Road Tax — Expires March 31st */}
        <DocCard icon={<FileText size={15} color="#be185d" />} label="Road Tax (Yearly: 31st March)" color="#fdf2f8">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Tax Expiry</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: v.tax_expiry_date ? '#0f172a' : '#94a3b8', fontWeight: 700 }}>
                {fmtDate(v.tax_expiry_date) || '31 Mar (Yearly)'}
              </span>
              <ExpiryBadge date={v.tax_expiry_date} />
            </div>
          </div>
          {v.tax_photo_url && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>TAX RECEIPT</div>
              <DocImage url={v.tax_photo_url} title={`${num} — Tax`} onZoom={onZoom} />
            </div>
          )}
        </DocCard>
      </div>

      {/* ── PAN & Bank Details ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* PAN */}
        <DocCard icon={<CreditCard size={15} color="#7c3aed" />} label="PAN Card" color="#f5f3ff">
          <InfoRow label="PAN Number" value={v.pan_number} />
          <InfoRow label="Cardholder Name" value={v.account_holder_name} />
          {v.pan_card_url && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>PAN CARD</div>
              <DocImage url={v.pan_card_url} title={`${num} — PAN Card`} onZoom={onZoom} />
            </div>
          )}
        </DocCard>

        {/* Bank */}
        <DocCard icon={<Building size={15} color="#0f766e" />} label="Bank Account Details" color="#f0fdfa">
          <InfoRow label="Account Holder" value={v.account_holder_name} />
          <InfoRow label="Account Number" value={v.account_number} />
          <InfoRow label="Bank Name" value={v.bank_name} />
          <InfoRow label="IFSC Code" value={v.ifsc_code} />
          {v.account_photo_url && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>BANK PASSBOOK / CHEQUE</div>
              <DocImage url={v.account_photo_url} title={`${num} — Bank Proof`} onZoom={onZoom} />
            </div>
          )}
        </DocCard>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: '14px', borderTop: '1px solid #e2e8f0',
      }}>
        {/* Action buttons: Share / Print / Download */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleShare}
            title="Share vehicle details"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
              border: '1.5px solid #cbd5e1', background: '#f8fafc', color: '#475569',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e2e8f0'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; }}
          >
            <Share2 size={13} /> Share
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            title="Print vehicle details"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
              border: '1.5px solid #cbd5e1', background: isPrinting ? '#f1f5f9' : '#f8fafc',
              color: isPrinting ? '#94a3b8' : '#475569',
              cursor: isPrinting ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!isPrinting) (e.currentTarget as HTMLButtonElement).style.background = '#e2e8f0'; }}
            onMouseLeave={e => { if (!isPrinting) (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; }}
          >
            {isPrinting ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} Print
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            title="Download vehicle details as PDF to local storage"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
              border: '1.5px solid #cbd5e1', background: isDownloading ? '#f1f5f9' : '#f8fafc',
              color: isDownloading ? '#94a3b8' : '#475569',
              cursor: isDownloading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!isDownloading) (e.currentTarget as HTMLButtonElement).style.background = '#e2e8f0'; }}
            onMouseLeave={e => { if (!isDownloading) (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; }}
          >
            {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download PDF
          </button>
        </div>
        {/* Edit / Close */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={onEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Edit2 size={14} /> Edit Vehicle
          </button>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export const VehiclesPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allVehiclesList, setAllVehiclesList] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Expiring compliance count (for top alert banner)
  const [expiringCount, setExpiringCount] = useState<number>(0);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [viewVehicle, setViewVehicle] = useState<Vehicle | null>(null);
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Vehicle | null>(null);

  // Auto-extraction state
  const [extractingField, setExtractingField] = useState<string | null>(null);
  const [autoFillNotice, setAutoFillNotice] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Form state — all vehicle document fields
  const emptyForm = () => ({
    lorry_number: '',
    vehicle_type: '',
    capacity_tons: '',
    goodshed_loading_expense: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    // Truck photo
    truck_image_url: '',
    // RC (Registration) - Date of Regn
    rc_number: '',
    rc_reg_date: '',
    rc_expiry_date: '',
    rc_photo_url: '',
    rc_photo_back_url: '',
    // FC (Fitness)
    fc_number: '',
    fc_expiry_date: '',
    fc_photo_url: '',
    // Insurance
    insurance_policy_number: '',
    insurance_expiry_date: '',
    insurance_photo_url: '',
    // Permit
    permit_number: '',
    permit_expiry_date: '',
    permit_photo_url: '',
    // TDS (renamed from DTS) - yearly March 31st
    tds_number: '',
    tds_expiry_date: getNextMarch31st(),
    tds_certificate_url: '',
    tds_certificate_url_2: '',
    dts_number: '',
    dts_expiry_date: getNextMarch31st(),
    dts_certificate_url: '',
    // Road Tax - yearly March 31st
    tax_expiry_date: getNextMarch31st(),
    tax_photo_url: '',
    // PAN
    pan_number: '',
    pan_card_url: '',
    // Bank
    account_holder_name: '',
    account_number: '',
    bank_name: '',
    ifsc_code: '',
    account_photo_url: '',
  });

  const [formData, setFormData] = useState(emptyForm());
  const [formTab, setFormTab] = useState(0);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadField, setActiveUploadField] = useState<string>('');

  const loadAllVehiclesLookup = async () => {
    try {
      const res = await vehicleService.getVehicles({ limit: 1000 });
      if (res.data?.items) {
        setAllVehiclesList(res.data.items);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    loadAllVehiclesLookup();
  }, []);

  useEffect(() => {
    loadVehicles();
    checkExpiringFleet();
  }, [page, search, statusFilter]);

  const checkExpiringFleet = async () => {
    try {
      const res = await vehicleService.getExpiringVehicles(30);
      if (res.data) {
        setExpiringCount(res.data.length);
      }
    } catch { /* silent */ }
  };

  const loadVehicles = async () => {
    try {
      setIsLoading(true);
      const res = await vehicleService.getVehicles({
        page,
        limit: 10,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setVehicles(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load vehicles', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedVehicle(null);
    setFormData(emptyForm());
    setFormTab(0);
    setFormError('');
    setAutoFillNotice(null);
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      lorry_number: vehicle.lorry_number,
      vehicle_type: vehicle.vehicle_type || '',
      capacity_tons: vehicle.capacity_tons?.toString() || '',
      goodshed_loading_expense: vehicle.goodshed_loading_expense?.toString() || '',
      status: vehicle.status,
      truck_image_url: vehicle.truck_image_url || '',
      rc_number: vehicle.rc_number || '',
      rc_reg_date: vehicle.rc_reg_date ? vehicle.rc_reg_date.split('T')[0] : (vehicle.rc_expiry_date ? vehicle.rc_expiry_date.split('T')[0] : ''),
      rc_expiry_date: vehicle.rc_expiry_date ? vehicle.rc_expiry_date.split('T')[0] : '',
      rc_photo_url: vehicle.rc_photo_url || '',
      rc_photo_back_url: vehicle.rc_photo_back_url || '',
      fc_number: vehicle.fc_number || '',
      fc_expiry_date: vehicle.fc_expiry_date ? vehicle.fc_expiry_date.split('T')[0] : '',
      fc_photo_url: vehicle.fc_photo_url || '',
      insurance_policy_number: vehicle.insurance_policy_number || '',
      insurance_expiry_date: vehicle.insurance_expiry_date ? vehicle.insurance_expiry_date.split('T')[0] : '',
      insurance_photo_url: vehicle.insurance_photo_url || '',
      permit_number: vehicle.permit_number || '',
      permit_expiry_date: vehicle.permit_expiry_date ? vehicle.permit_expiry_date.split('T')[0] : '',
      permit_photo_url: vehicle.permit_photo_url || '',
      tds_number: vehicle.tds_number || vehicle.dts_number || '',
      tds_expiry_date: vehicle.tds_expiry_date ? vehicle.tds_expiry_date.split('T')[0] : (vehicle.dts_expiry_date ? vehicle.dts_expiry_date.split('T')[0] : getNextMarch31st()),
      tds_certificate_url: vehicle.tds_certificate_url || vehicle.dts_certificate_url || '',
      tds_certificate_url_2: vehicle.tds_certificate_url_2 || '',
      dts_number: vehicle.tds_number || vehicle.dts_number || '',
      dts_expiry_date: vehicle.tds_expiry_date ? vehicle.tds_expiry_date.split('T')[0] : (vehicle.dts_expiry_date ? vehicle.dts_expiry_date.split('T')[0] : getNextMarch31st()),
      dts_certificate_url: vehicle.tds_certificate_url || vehicle.dts_certificate_url || '',
      tax_expiry_date: vehicle.tax_expiry_date ? vehicle.tax_expiry_date.split('T')[0] : getNextMarch31st(),
      tax_photo_url: vehicle.tax_photo_url || '',
      pan_number: vehicle.pan_number || '',
      pan_card_url: vehicle.pan_card_url || '',
      account_holder_name: vehicle.account_holder_name || '',
      account_number: vehicle.account_number || '',
      bank_name: vehicle.bank_name || '',
      ifsc_code: vehicle.ifsc_code || '',
      account_photo_url: vehicle.account_photo_url || '',
    });
    setFormTab(0);
    setFormError('');
    setAutoFillNotice(null);
    setIsModalOpen(true);
  };

  const handleNextTab = () => {
    if (formTab === 0 && !formData.lorry_number?.trim()) {
      setFormError('Please enter Truck / Lorry Number.');
      return;
    }
    setFormError('');
    setFormTab((t) => Math.min(4, t + 1));
  };

  const handlePrevTab = () => {
    setFormError('');
    setFormTab((t) => Math.max(0, t - 1));
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept images, PDFs, Word documents
    const allowed = [
      'image/', 'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml',
    ];
    const isAllowed = allowed.some(t => file.type.startsWith(t)) ||
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.doc') ||
      file.name.toLowerCase().endsWith('.docx');

    if (!isAllowed) {
      setFormError('Please select an image, PDF, or Word document (.doc / .docx).');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setFormError('File size must be under 25 MB.');
      return;
    }

    try {
      setFormError('');
      const b64 = await readAsBase64(file);
      setFormData((prev: any) => ({ ...prev, [field]: b64 }));

      // Trigger automatic extraction via OCR
      setExtractingField(field);
      setAutoFillNotice({
        message: '🔍 Scanning document & auto-extracting details with OCR...',
        type: 'info',
      });

      const extractedText = await extractTextFromFileOrData(file);

      if (extractedText && extractedText.trim().length > 0) {
        if (field === 'rc_photo_url' || field === 'rc_photo_back_url') {
          const parsed = parseRcDocument(extractedText);
          setFormData((prev: any) => {
            const nextRegDate = (field === 'rc_photo_url' && parsed.rc_reg_date)
              ? parsed.rc_reg_date
              : (prev.rc_reg_date || parsed.rc_reg_date);
            return {
              ...prev,
              rc_number: parsed.rc_number || prev.rc_number,
              rc_reg_date: nextRegDate,
              rc_expiry_date: nextRegDate || prev.rc_expiry_date,
              lorry_number: (!prev.lorry_number && parsed.rc_number) ? parsed.rc_number : prev.lorry_number,
            };
          });
          const details = [
            parsed.rc_number ? `RC No: ${parsed.rc_number}` : null,
            parsed.rc_reg_date ? `Date of Regn: ${formatDateDMY(parsed.rc_reg_date)}` : null,
          ].filter(Boolean).join(', ');
          setAutoFillNotice({
            message: details ? `✨ Auto-Extracted RC Details: ${details}` : '✨ RC Document uploaded. Please review fields.',
            type: 'success',
          });
        } else if (field === 'fc_photo_url') {
          const parsed = parseFcDocument(extractedText);
          setFormData((prev: any) => ({
            ...prev,
            fc_number: parsed.fc_number || prev.fc_number,
            fc_expiry_date: parsed.fc_expiry_date || prev.fc_expiry_date,
            lorry_number: (!prev.lorry_number && parsed.fc_number) ? parsed.fc_number : prev.lorry_number,
          }));
          const details = [
            parsed.fc_number ? `Regn / FC No: ${parsed.fc_number}` : null,
            parsed.fc_expiry_date ? `Valid Upto: ${parsed.fc_expiry_date}` : null,
          ].filter(Boolean).join(', ');
          setAutoFillNotice({
            message: details ? `✨ Auto-Extracted FC Details: ${details}` : '✨ FC Document uploaded.',
            type: 'success',
          });
        } else if (field === 'tax_photo_url') {
          const parsed = parseTaxDocument(extractedText);
          setFormData((prev: any) => ({
            ...prev,
            tax_expiry_date: parsed.tax_expiry_date,
            lorry_number: (!prev.lorry_number && parsed.vehicle_number) ? parsed.vehicle_number : prev.lorry_number,
          }));
          setAutoFillNotice({
            message: `✨ Road Tax Expiry Auto-Set to March 31st (${parsed.tax_expiry_date})`,
            type: 'success',
          });
        } else if (field === 'dts_certificate_url' || field === 'tds_certificate_url') {
          const parsed = parseTdsDocument(extractedText);
          setFormData((prev: any) => ({
            ...prev,
            tds_expiry_date: parsed.tds_expiry_date,
            dts_expiry_date: parsed.tds_expiry_date,
            tds_number: parsed.tds_number || prev.tds_number || prev.dts_number,
            dts_number: parsed.tds_number || prev.tds_number || prev.dts_number,
          }));
          setAutoFillNotice({
            message: `✨ TDS Expiry Auto-Set to March 31st (${parsed.tds_expiry_date})${parsed.tds_number ? ` · Cert: ${parsed.tds_number}` : ''}`,
            type: 'success',
          });
        } else if (field === 'account_photo_url') {
          const parsed = parseBankDocument(extractedText);
          setFormData((prev: any) => ({
            ...prev,
            account_number: parsed.account_number || prev.account_number,
            bank_name: parsed.bank_name || prev.bank_name,
            ifsc_code: parsed.ifsc_code || prev.ifsc_code,
            account_holder_name: parsed.account_holder_name || prev.account_holder_name,
          }));
          const details = [
            parsed.bank_name ? `Bank: ${parsed.bank_name}` : null,
            parsed.account_number ? `A/C: ${parsed.account_number}` : null,
            parsed.ifsc_code ? `IFSC: ${parsed.ifsc_code}` : null,
          ].filter(Boolean).join(' · ');
          setAutoFillNotice({
            message: details ? `✨ Auto-Extracted Bank Details: ${details}` : '✨ Bank Document uploaded.',
            type: 'success',
          });
        } else if (field === 'pan_card_url') {
          const parsed = parsePanDocument(extractedText);
          setFormData((prev: any) => ({
            ...prev,
            pan_number: parsed.pan_number || prev.pan_number,
            account_holder_name: parsed.account_holder_name || prev.account_holder_name,
          }));
          const details = [
            parsed.pan_number ? `PAN: ${parsed.pan_number}` : null,
            parsed.account_holder_name ? `Name: ${parsed.account_holder_name}` : null,
          ].filter(Boolean).join(' · ');
          setAutoFillNotice({
            message: details ? `✨ Auto-Extracted PAN Details: ${details}` : '✨ PAN Card uploaded.',
            type: 'success',
          });
        } else if (field === 'insurance_photo_url') {
          const parsed = parseInsuranceDocument(extractedText);
          setFormData((prev: any) => ({
            ...prev,
            insurance_policy_number: parsed.policy_number || prev.insurance_policy_number,
            insurance_expiry_date: parsed.expiry_date || prev.insurance_expiry_date,
          }));
          const details = [
            parsed.insurer_name ? `Insurer: ${parsed.insurer_name}` : null,
            parsed.policy_number ? `Policy: ${parsed.policy_number}` : null,
            parsed.expiry_date ? `Valid Upto: ${formatDateDMY(parsed.expiry_date)}` : null,
          ].filter(Boolean).join(' · ');
          setAutoFillNotice({
            message: details ? `✨ Auto-Extracted Insurance Details: ${details}` : '✨ Insurance document uploaded.',
            type: 'success',
          });
        } else if (field === 'permit_photo_url') {
          const parsed = parsePermitDocument(extractedText);
          setFormData((prev: any) => ({
            ...prev,
            permit_number: parsed.permit_number || prev.permit_number,
            permit_expiry_date: parsed.expiry_date || prev.permit_expiry_date,
          }));
          const details = [
            parsed.permit_number ? `Permit No: ${parsed.permit_number}` : null,
            parsed.expiry_date ? `Valid Till: ${formatDateDMY(parsed.expiry_date)}` : null,
          ].filter(Boolean).join(' · ');
          setAutoFillNotice({
            message: details ? `✨ Auto-Extracted Permit Details: ${details}` : '✨ Permit document uploaded.',
            type: 'success',
          });
        } else if (field === 'truck_image_url') {
          const vNumMatch = extractedText.match(/(?:[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{4})/i);
          if (vNumMatch) {
            const formatted = formatVehicleNumber(vNumMatch[0]);
            setFormData((prev: any) => ({
              ...prev,
              lorry_number: !prev.lorry_number ? formatted : prev.lorry_number,
            }));
            setAutoFillNotice({ message: `✨ Detected Truck Number: ${formatted}`, type: 'success' });
          } else {
            setAutoFillNotice({ message: '✨ Truck photo uploaded.', type: 'info' });
          }
        }
      } else {
        // Fallback default rules
        if (field === 'tax_photo_url') {
          setFormData((prev: any) => ({ ...prev, tax_expiry_date: getNextMarch31st() }));
          setAutoFillNotice({ message: `✨ Road Tax Expiry Auto-Set to March 31st (${getNextMarch31st()})`, type: 'success' });
        } else if (field === 'dts_certificate_url' || field === 'tds_certificate_url') {
          setFormData((prev: any) => ({ ...prev, tds_expiry_date: getNextMarch31st(), dts_expiry_date: getNextMarch31st() }));
          setAutoFillNotice({ message: `✨ TDS Expiry Auto-Set to March 31st (${getNextMarch31st()})`, type: 'success' });
        } else {
          setAutoFillNotice({ message: '✨ Document uploaded successfully.', type: 'info' });
        }
      }
    } catch (err: any) {
      console.error('OCR Extraction error:', err);
      setAutoFillNotice({ message: 'Document uploaded (manual review encouraged).', type: 'info' });
    } finally {
      setExtractingField(null);
      e.target.value = '';
    }
  };

  const triggerUpload = (field: string) => {
    setActiveUploadField(field);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lorry_number.trim()) { setFormError('Truck / Lorry number is required.'); return; }
    try {
      setIsSubmitting(true);
      setFormError('');
      const payload: any = {
        lorry_number: formData.lorry_number.trim().toUpperCase(),
        vehicle_type: formData.vehicle_type || null,
        capacity_tons: formData.capacity_tons ? parseFloat(formData.capacity_tons) : null,
        goodshed_loading_expense: formData.goodshed_loading_expense ? parseFloat(formData.goodshed_loading_expense) : 0,
        status: formData.status,
        truck_image_url: formData.truck_image_url || null,
        rc_number: formData.rc_number || null,
        rc_reg_date: formData.rc_reg_date || formData.rc_expiry_date || null,
        rc_expiry_date: formData.rc_reg_date || formData.rc_expiry_date || null,
        rc_photo_url: formData.rc_photo_url || null,
        rc_photo_back_url: formData.rc_photo_back_url || null,
        fc_number: formData.fc_number || null,
        fc_expiry_date: formData.fc_expiry_date || null,
        fc_photo_url: formData.fc_photo_url || null,
        insurance_policy_number: formData.insurance_policy_number || null,
        insurance_expiry_date: formData.insurance_expiry_date || null,
        insurance_photo_url: formData.insurance_photo_url || null,
        permit_number: formData.permit_number || null,
        permit_expiry_date: formData.permit_expiry_date || null,
        permit_photo_url: formData.permit_photo_url || null,
        tds_number: formData.tds_number || formData.dts_number || null,
        tds_expiry_date: formData.tds_expiry_date || formData.dts_expiry_date || null,
        tds_certificate_url: formData.tds_certificate_url || formData.dts_certificate_url || null,
        tds_certificate_url_2: formData.tds_certificate_url_2 || null,
        dts_number: formData.tds_number || formData.dts_number || null,
        dts_expiry_date: formData.tds_expiry_date || formData.dts_expiry_date || null,
        dts_certificate_url: formData.tds_certificate_url || formData.dts_certificate_url || null,
        tax_expiry_date: formData.tax_expiry_date || null,
        tax_photo_url: formData.tax_photo_url || null,
        pan_number: formData.pan_number || null,
        pan_card_url: formData.pan_card_url || null,
        account_holder_name: formData.account_holder_name || null,
        account_number: formData.account_number || null,
        bank_name: formData.bank_name || null,
        ifsc_code: formData.ifsc_code || null,
        account_photo_url: formData.account_photo_url || null,
      };

      if (selectedVehicle) {
        await vehicleService.updateVehicle(selectedVehicle.id, payload);
      } else {
        await vehicleService.createVehicle(payload);
      }
      setIsModalOpen(false);
      setSelectedVehicle(null);
      loadVehicles();
      loadAllVehiclesLookup();
      checkExpiringFleet();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save truck. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    try {
      await vehicleService.deleteVehicle(vehicle.id);
      setDeleteConfirm(null);
      if (viewVehicle?.id === vehicle.id) {
        setViewVehicle(null);
      }
      loadVehicles();
      loadAllVehiclesLookup();
      checkExpiringFleet();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete vehicle.');
    }
  };

  const handleToggleStatus = async (vehicle: Vehicle) => {
    const newStatus = vehicle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await vehicleService.updateStatus(vehicle.id, newStatus);
      loadVehicles();
      if (viewVehicle?.id === vehicle.id) {
        setViewVehicle({ ...viewVehicle, status: newStatus });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const columns: Column<Vehicle>[] = [
    {
      header: 'Truck Image',
      render: (v) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {v.truck_image_url ? (
            <div
              style={{
                position: 'relative',
                width: '76px',
                height: '52px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1.5px solid #e2e8f0',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                backgroundColor: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => setZoomImage({ url: v.truck_image_url!, title: `${v.lorry_number} — Truck Photo` })}
              title="Click to view full image"
            >
              <img
                src={v.truck_image_url}
                alt={v.lorry_number}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <ZoomIn size={18} color="#ffffff" />
              </div>
            </div>
          ) : (
            <div
              style={{
                width: '76px',
                height: '52px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1.5px dashed #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                gap: '2px',
              }}
              title="No image uploaded"
            >
              <Truck size={20} color="#94a3b8" />
              <span style={{ fontSize: '9.5px', fontWeight: 600 }}>No Image</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Truck / Lorry Number',
      accessor: 'lorry_number',
      render: (v) => (
        <button
          onClick={() => setViewVehicle(v)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
            color: '#1d4ed8',
            fontWeight: 800,
            fontSize: '15px',
            letterSpacing: '0.3px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
          title="Click to view all truck documents & compliance details"
        >
          <Truck size={17} color="#2563eb" />
          <span>{v.lorry_number}</span>
        </button>
      ),
    },
    {
      header: 'Road Tax Expiry',
      render: (v) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
            {fmtDate(v.tax_expiry_date) || '31 Mar (Yearly)'}
          </span>
          <ExpiryBadge date={v.tax_expiry_date} />
        </div>
      ),
    },
    {
      header: 'TDS Expiry',
      render: (v) => {
        const d = v.tds_expiry_date || v.dts_expiry_date;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
              {fmtDate(d) || '31 Mar (Yearly)'}
            </span>
            <ExpiryBadge date={d} />
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (v) => (
        <button
          onClick={() => handleToggleStatus(v)}
          style={{
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '11.5px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: v.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
            color: v.status === 'ACTIVE' ? '#15803d' : '#b91c1c',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
          title="Click to toggle status"
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: v.status === 'ACTIVE' ? '#16a34a' : '#dc2626',
            }}
          />
          {v.status}
        </button>
      ),
    },
    {
      header: 'Actions',
      render: (v) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setViewVehicle(v)}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb' }}
            title="View Truck Details, RC, FC, Road Tax, TDS & Bank Info"
          >
            <Eye size={14} /> View
          </button>
          <button
            onClick={() => openEditModal(v)}
            className="btn btn-outline btn-sm"
            title="Edit Truck & Upload Documents"
          >
            <Edit2 size={14} /> Edit
          </button>
          <button
            onClick={() => setDeleteConfirm(v)}
            className="btn btn-danger btn-sm"
            title="Delete Truck"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={26} color="#2563eb" />
            Truck / Fleet Master
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
            Manage fleet trucks, compliance documents (RC, FC, Road Tax, TDS), with automatic OCR field extraction
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={18} /> Add New Truck
        </button>
      </div>

      {/* ── Fleet Compliance Alert Banner (Road Tax & TDS March 31st Notification) ── */}
      {expiringCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1.5px solid #fde68a', borderRadius: '12px', padding: '12px 18px',
          marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(217,119,6,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px', background: '#f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <AlertTriangle size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#92400e' }}>
                Fleet Expiry Alert: {expiringCount} vehicle{expiringCount > 1 ? 's' : ''} have upcoming document renewals
              </div>
              <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                Road Tax and TDS expire on <strong>March 31st</strong> every year &bull; Notifications active 1 month prior
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Table Card ──────────────────────────────────────────────────── */}
      <div className="card">
        <div className="search-filter-bar" style={{ marginBottom: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: '220px', maxWidth: '380px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px', fontWeight: 600 }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Vehicle Numbers {allVehiclesList.length > 0 ? `(${allVehiclesList.length})` : ''}</option>
              {Array.from(new Map(allVehiclesList.map((v) => [v.lorry_number, v])).values())
                .sort((a, b) => a.lorry_number.localeCompare(b.lorry_number))
                .map((v) => (
                  <option key={v.id} value={v.lorry_number}>
                    {v.lorry_number}
                  </option>
                ))}
            </select>
          </div>

          <select
            className="form-control form-select"
            style={{ width: '160px', height: '38px' }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {(search || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPage(1);
              }}
              className="btn btn-outline"
              style={{ height: '38px', padding: '0 14px', fontSize: '13px' }}
              title="Reset vehicle filters"
            >
              Reset
            </button>
          )}
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
        onClose={() => { setIsModalOpen(false); setSelectedVehicle(null); }}
        title={selectedVehicle ? `Edit Truck: ${selectedVehicle.lorry_number}` : 'Add New Truck'}
        maxWidth="780px"
      >
        {/* Shared hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          onChange={(e) => handleDocUpload(e, activeUploadField)}
        />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

          {/* Auto-fill feedback banner */}
          {autoFillNotice && (
            <div style={{
              background: autoFillNotice.type === 'success' ? '#f0fdf4' : '#eff6ff',
              border: `1.5px solid ${autoFillNotice.type === 'success' ? '#86efac' : '#bfdbfe'}`,
              color: autoFillNotice.type === 'success' ? '#166534' : '#1e40af',
              padding: '10px 14px', borderRadius: '10px', fontSize: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '16px', gap: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} />
                <span style={{ fontWeight: 700 }}>{autoFillNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoFillNotice(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Error banner */}
          {formError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertCircle size={16} /><span>{formError}</span>
            </div>
          )}

          {/* Tab Nav */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '0', overflowX: 'auto' }}>
            {['🚛 Basic Info', '📄 RC', '🛡️ FC / Insurance / Permit', '🔖 TDS / Road Tax', '💳 PAN / Bank'].map((t, i) => (
              <button key={i} type="button" onClick={() => setFormTab(i)}
                style={{
                  padding: '8px 14px', fontSize: '12.5px', fontWeight: 700, border: 'none', cursor: 'pointer',
                  borderBottom: formTab === i ? '2.5px solid #2563eb' : '2.5px solid transparent',
                  background: 'transparent', color: formTab === i ? '#1d4ed8' : '#64748b',
                  borderRadius: '4px 4px 0 0', whiteSpace: 'nowrap',
                }}>{t}</button>
            ))}
          </div>

          {/* ── Tab 0: Basic Info ─────────────────────────────── */}
          {formTab === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>Truck / Lorry Number <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" className="form-control"
                    placeholder="e.g. TN 33 AE 1357"
                    value={formData.lorry_number}
                    onChange={e => setFormData((p: any) => ({ ...p, lorry_number: e.target.value.toUpperCase() }))}
                    style={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px', fontSize: '16px' }}
                    autoFocus required />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>Vehicle Type</label>
                  <input type="text" className="form-control" placeholder="e.g. Lorry, Trailer"
                    value={formData.vehicle_type}
                    onChange={e => setFormData((p: any) => ({ ...p, vehicle_type: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>Capacity (Tons)</label>
                  <input type="number" className="form-control" placeholder="e.g. 12"
                    value={formData.capacity_tons}
                    onChange={e => setFormData((p: any) => ({ ...p, capacity_tons: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>Goodshed Loading Expense (₹)</label>
                  <input type="number" className="form-control" placeholder="e.g. 500"
                    value={formData.goodshed_loading_expense}
                    onChange={e => setFormData((p: any) => ({ ...p, goodshed_loading_expense: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>Status</label>
                  <select className="form-control" value={formData.status}
                    onChange={e => setFormData((p: any) => ({ ...p, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Truck Photo */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>🚛 Truck Photo</label>
                <ImageUploadField
                  value={formData.truck_image_url}
                  label="Click to upload Truck Photo"
                  isExtracting={extractingField === 'truck_image_url'}
                  onUpload={() => triggerUpload('truck_image_url')}
                  onRemove={() => setFormData((p: any) => ({ ...p, truck_image_url: '' }))}
                />
              </div>
            </div>
          )}

          {/* ── Tab 1: RC (Auto-Extracts RC No & Date of Regn) ─────── */}
          {formTab === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', fontSize: '12.5px', color: '#1e40af' }}>
                ✨ <strong>Smart Auto-Extraction:</strong> Uploading the RC document automatically extracts the <strong>RC Number</strong> and <strong>Date of Registration</strong>. Note: RC documents do not expire; only registration date applies.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>RC Number (Regn No)</label>
                  <input type="text" className="form-control" placeholder="e.g. TN 33 AE 1357"
                    value={formData.rc_number}
                    onChange={e => setFormData((p: any) => ({ ...p, rc_number: e.target.value.toUpperCase() }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>Date of Registration (Date of Regn)</label>
                  <DateField
                    value={formData.rc_reg_date}
                    onChange={e => setFormData((p: any) => ({ ...p, rc_reg_date: e.target.value, rc_expiry_date: e.target.value }))}
                  />
                  {formData.rc_reg_date ? (
                    <div style={{ marginTop: '5px', fontSize: '12px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>✓ Regn Date:</span>
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', fontFamily: 'monospace', fontSize: '12.5px' }}>
                        {formatDateDMY(formData.rc_reg_date)} (DD-MM-YYYY)
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Date of registration as stated on the RC (Format: DD-MM-YYYY, No expiry date)</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>📄 RC Front Photo / PDF / Word</label>
                  <ImageUploadField
                    value={formData.rc_photo_url}
                    label="Upload RC Front (Auto-extracts RC No & Regn Date)"
                    isExtracting={extractingField === 'rc_photo_url'}
                    onUpload={() => triggerUpload('rc_photo_url')}
                    onRemove={() => setFormData((p: any) => ({ ...p, rc_photo_url: '' }))}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>📄 RC Back Photo / PDF / Word</label>
                  <ImageUploadField
                    value={formData.rc_photo_back_url}
                    label="Upload RC Back"
                    isExtracting={extractingField === 'rc_photo_back_url'}
                    onUpload={() => triggerUpload('rc_photo_back_url')}
                    onRemove={() => setFormData((p: any) => ({ ...p, rc_photo_back_url: '' }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 2: FC / Insurance / Permit ─────────────────── */}
          {formTab === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* FC */}
              <div style={{ padding: '14px', background: '#f5f3ff', borderRadius: '12px', border: '1.5px solid #ede9fe' }}>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#6d28d9', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} /> FC — Fitness Certificate
                </div>
                <div style={{ fontSize: '12px', color: '#5b21b6', marginBottom: '10px' }}>
                  ✨ Uploading FC automatically extracts the <strong>Expiry Date</strong>.
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>FC Expiry Date</label>
                    <DateField
                      value={formData.fc_expiry_date}
                      onChange={e => setFormData((p: any) => ({ ...p, fc_expiry_date: e.target.value }))}
                    />
                    {formData.fc_expiry_date && (
                      <div style={{ marginTop: '4px', fontSize: '11.5px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>✓ Valid Upto:</span>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '5px', border: '1px solid #bbf7d0', fontFamily: 'monospace' }}>
                          {formatDateDMY(formData.fc_expiry_date)} (DD-MM-YYYY)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', marginBottom: '6px' }}>FC Certificate Photo / PDF / Word</label>
                <ImageUploadField
                  value={formData.fc_photo_url}
                  label="Upload FC Certificate (Auto-extracts Regn No & Expiry)"
                  isExtracting={extractingField === 'fc_photo_url'}
                  onUpload={() => triggerUpload('fc_photo_url')}
                  onRemove={() => setFormData((p: any) => ({ ...p, fc_photo_url: '' }))}
                />
              </div>

              {/* Insurance */}
              <div style={{ padding: '14px', background: '#ecfdf5', borderRadius: '12px', border: '1.5px solid #bbf7d0' }}>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#065f46', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} /> Insurance
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>Policy Number</label>
                    <input type="text" className="form-control" placeholder="Policy Number"
                      value={formData.insurance_policy_number} onChange={e => setFormData((p: any) => ({ ...p, insurance_policy_number: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>Insurance Expiry Date</label>
                    <DateField
                      value={formData.insurance_expiry_date}
                      onChange={e => setFormData((p: any) => ({ ...p, insurance_expiry_date: e.target.value }))}
                    />
                    {formData.insurance_expiry_date && (
                      <div style={{ marginTop: '4px', fontSize: '11.5px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>✓ Expiry:</span>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '5px', border: '1px solid #bbf7d0', fontFamily: 'monospace' }}>
                          {formatDateDMY(formData.insurance_expiry_date)} (DD-MM-YYYY)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', marginBottom: '6px' }}>Insurance Document Photo / PDF / Word</label>
                <ImageUploadField
                  value={formData.insurance_photo_url}
                  label="Upload Insurance Document"
                  isExtracting={extractingField === 'insurance_photo_url'}
                  onUpload={() => triggerUpload('insurance_photo_url')}
                  onRemove={() => setFormData((p: any) => ({ ...p, insurance_photo_url: '' }))}
                />
              </div>

              {/* Permit */}
              <div style={{ padding: '14px', background: '#fffbeb', borderRadius: '12px', border: '1.5px solid #fde68a' }}>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#92400e', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> Permit
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>Permit Number</label>
                    <input type="text" className="form-control" placeholder="Permit Number"
                      value={formData.permit_number} onChange={e => setFormData((p: any) => ({ ...p, permit_number: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>Permit Expiry Date</label>
                    <DateField
                      value={formData.permit_expiry_date}
                      onChange={e => setFormData((p: any) => ({ ...p, permit_expiry_date: e.target.value }))}
                    />
                    {formData.permit_expiry_date && (
                      <div style={{ marginTop: '4px', fontSize: '11.5px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>✓ Expiry:</span>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '5px', border: '1px solid #bbf7d0', fontFamily: 'monospace' }}>
                          {formatDateDMY(formData.permit_expiry_date)} (DD-MM-YYYY)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', marginBottom: '6px' }}>Permit Document Photo / PDF / Word</label>
                <ImageUploadField
                  value={formData.permit_photo_url}
                  label="Upload Permit Document"
                  isExtracting={extractingField === 'permit_photo_url'}
                  onUpload={() => triggerUpload('permit_photo_url')}
                  onRemove={() => setFormData((p: any) => ({ ...p, permit_photo_url: '' }))}
                />
              </div>
            </div>
          )}

          {/* ── Tab 3: TDS / Road Tax (Expires March 31st yearly) ── */}
          {formTab === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Road Tax */}
              <div style={{ padding: '16px', background: '#fdf2f8', borderRadius: '14px', border: '1.5px solid #f9a8d4' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#9d174d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={15} /> Yearly Road Tax (Expires March 31st)
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData((p: any) => ({ ...p, tax_expiry_date: getNextMarch31st() }))}
                    style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px',
                      background: '#fce7f3', border: '1px solid #f472b6', color: '#be185d', cursor: 'pointer',
                    }}
                  >
                    Set to March 31st ({getNextMarch31st()})
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#831843', marginBottom: '12px', background: '#fbcfe8', padding: '6px 10px', borderRadius: '6px' }}>
                  📌 <strong>Rule:</strong> Road Tax expires on <strong>March 31st</strong> every year for all vehicles. Automated notification triggers 1 month prior (March 1st).
                </div>
                <div className="form-group" style={{ margin: '0 0 12px' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>Tax Expiry Date</label>
                  <DateField
                    value={formData.tax_expiry_date}
                    onChange={e => setFormData((p: any) => ({ ...p, tax_expiry_date: e.target.value }))}
                  />
                  {formData.tax_expiry_date && (
                    <div style={{ marginTop: '4px', fontSize: '11.5px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>✓ Tax Expiry:</span>
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '5px', border: '1px solid #bbf7d0', fontFamily: 'monospace' }}>
                        {formatDateDMY(formData.tax_expiry_date)} (DD-MM-YYYY)
                      </span>
                    </div>
                  )}
                </div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', marginBottom: '6px' }}>Road Tax Receipt (Image / PDF / Word)</label>
                <ImageUploadField
                  value={formData.tax_photo_url}
                  label="Upload Tax Receipt (Auto-sets March 31st Expiry)"
                  isExtracting={extractingField === 'tax_photo_url'}
                  onUpload={() => triggerUpload('tax_photo_url')}
                  onRemove={() => setFormData((p: any) => ({ ...p, tax_photo_url: '' }))}
                />
              </div>

              {/* TDS (formerly DTS) */}
              <div style={{ padding: '16px', background: '#ecfeff', borderRadius: '14px', border: '1.5px solid #a5f3fc' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#0e7490', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Hash size={15} /> TDS Certificate (Expires March 31st)
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData((p: any) => ({ ...p, tds_expiry_date: getNextMarch31st(), dts_expiry_date: getNextMarch31st() }))}
                    style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px',
                      background: '#cffafe', border: '1px solid #22d3ee', color: '#0891b2', cursor: 'pointer',
                    }}
                  >
                    Set to March 31st ({getNextMarch31st()})
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#164e63', marginBottom: '12px', background: '#cffafe', padding: '6px 10px', borderRadius: '6px' }}>
                  📌 <strong>Rule:</strong> TDS Certificate expires on <strong>March 31st</strong> every financial year. Automated notification triggers 1 month prior (March 1st).
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>TDS Expiry Date</label>
                    <DateField
                      value={formData.tds_expiry_date || formData.dts_expiry_date}
                      onChange={e => setFormData((p: any) => ({ ...p, tds_expiry_date: e.target.value, dts_expiry_date: e.target.value }))}
                    />
                    {(formData.tds_expiry_date || formData.dts_expiry_date) && (
                      <div style={{ marginTop: '4px', fontSize: '11.5px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>✓ TDS Expiry:</span>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '5px', border: '1px solid #bbf7d0', fontFamily: 'monospace' }}>
                          {formatDateDMY(formData.tds_expiry_date || formData.dts_expiry_date)} (DD-MM-YYYY)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', marginBottom: '6px' }}>TDS Certificate — Page 1 (Photo / PDF / Word)</label>
                <ImageUploadField
                  value={formData.tds_certificate_url || formData.dts_certificate_url}
                  label="Upload TDS Certificate Page 1 (Auto-extracts Number & March 31st Expiry)"
                  isExtracting={extractingField === 'tds_certificate_url' || extractingField === 'dts_certificate_url'}
                  onUpload={() => triggerUpload('tds_certificate_url')}
                  onRemove={() => setFormData((p: any) => ({ ...p, tds_certificate_url: '', dts_certificate_url: '' }))}
                />
                <div style={{ marginTop: '12px' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', marginBottom: '6px' }}>TDS Certificate — Page 2 (Photo / PDF / Word)</label>
                  <ImageUploadField
                    value={formData.tds_certificate_url_2}
                    label="Upload TDS Certificate Page 2"
                    isExtracting={extractingField === 'tds_certificate_url_2'}
                    onUpload={() => triggerUpload('tds_certificate_url_2')}
                    onRemove={() => setFormData((p: any) => ({ ...p, tds_certificate_url_2: '' }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 4: PAN / Bank ─────────────────────────────── */}
          {formTab === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* PAN */}
              <div style={{ padding: '14px', background: '#f5f3ff', borderRadius: '12px', border: '1.5px solid #ede9fe' }}>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#6d28d9', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} /> PAN Card
                </div>
                <div style={{ fontSize: '12px', color: '#5b21b6', marginBottom: '10px' }}>
                  ✨ Uploading PAN Card automatically extracts the <strong>PAN Number</strong> and <strong>Name</strong>.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>PAN Number</label>
                    <input type="text" className="form-control" placeholder="e.g. ABCDE1234F"
                      value={formData.pan_number}
                      onChange={e => setFormData((p: any) => ({ ...p, pan_number: e.target.value.toUpperCase() }))}
                      style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>Name on PAN</label>
                    <input type="text" className="form-control" placeholder="Cardholder Name"
                      value={formData.account_holder_name}
                      onChange={e => setFormData((p: any) => ({ ...p, account_holder_name: e.target.value }))} />
                  </div>
                </div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', marginBottom: '6px' }}>PAN Card Photo / PDF / Word</label>
                <ImageUploadField
                  value={formData.pan_card_url}
                  label="Upload PAN Card (Auto-extracts PAN & Name)"
                  isExtracting={extractingField === 'pan_card_url'}
                  onUpload={() => triggerUpload('pan_card_url')}
                  onRemove={() => setFormData((p: any) => ({ ...p, pan_card_url: '' }))}
                />
              </div>

              {/* Bank */}
              <div style={{ padding: '14px', background: '#f0fdfa', borderRadius: '12px', border: '1.5px solid #99f6e4' }}>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#134e4a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building size={14} /> Bank Account Details
                </div>
                <div style={{ fontSize: '12px', color: '#0f766e', marginBottom: '10px' }}>
                  ✨ Uploading Passbook or Cheque automatically extracts <strong>Account Number</strong>, <strong>Bank Name</strong>, and <strong>IFSC Code</strong>.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>Account Holder Name</label>
                    <input type="text" className="form-control" placeholder="Name"
                      value={formData.account_holder_name} onChange={e => setFormData((p: any) => ({ ...p, account_holder_name: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>Account Number</label>
                    <input type="text" className="form-control" placeholder="Account Number"
                      value={formData.account_number} onChange={e => setFormData((p: any) => ({ ...p, account_number: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>Bank Name</label>
                    <input type="text" className="form-control" placeholder="e.g. State Bank of India"
                      value={formData.bank_name} onChange={e => setFormData((p: any) => ({ ...p, bank_name: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px' }}>IFSC Code</label>
                    <input type="text" className="form-control" placeholder="e.g. SBIN0001234"
                      value={formData.ifsc_code}
                      onChange={e => setFormData((p: any) => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))}
                      style={{ textTransform: 'uppercase', letterSpacing: '1px' }} />
                  </div>
                </div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12.5px', marginBottom: '6px' }}>Bank Passbook / Cancelled Cheque (Image / PDF / Word)</label>
                <ImageUploadField
                  value={formData.account_photo_url}
                  label="Upload Passbook / Cheque (Auto-extracts Acc No, Bank & IFSC)"
                  isExtracting={extractingField === 'account_photo_url'}
                  onUpload={() => triggerUpload('account_photo_url')}
                  onRemove={() => setFormData((p: any) => ({ ...p, account_photo_url: '' }))}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', paddingTop: '20px', marginTop: '20px', borderTop: '1px solid #e2e8f0' }}>
            <div>
              {formTab > 0 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handlePrevTab}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  ← Previous
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { setIsModalOpen(false); setSelectedVehicle(null); setFormError(''); }}
              >
                Cancel
              </button>

              {formTab < 4 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNextTab}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  Next →
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckCircle size={15} />
                  {isSubmitting ? 'Saving...' : selectedVehicle ? 'Update Truck' : 'Save Truck'}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── View Vehicle Detail Modal ─────────────────────────────────────── */}
      {viewVehicle && (
        <Modal
          isOpen={!!viewVehicle}
          onClose={() => setViewVehicle(null)}
          title={`Vehicle Details — ${viewVehicle.lorry_number}`}
          maxWidth="860px"
        >
          <VehicleDetailPanel
            vehicle={viewVehicle}
            onEdit={() => { const v = viewVehicle; setViewVehicle(null); openEditModal(v); }}
            onClose={() => setViewVehicle(null)}
            onZoom={(url, title) => setZoomImage({ url, title })}
          />
        </Modal>
      )}

      {/* ── Zoom Image Lightbox ─────────────────────────────────────────── */}
      {zoomImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setZoomImage(null)}
        >
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '20px',
              display: 'flex',
              gap: '10px',
            }}
          >
            <a
              href={zoomImage.url}
              download={`${zoomImage.title}.jpg`}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'rgba(255,255,255,0.18)',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              <Download size={16} /> Download
            </a>
            <button
              onClick={() => setZoomImage(null)}
              style={{
                background: 'rgba(255,255,255,0.18)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          </div>

          <div
            style={{
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 700,
              marginBottom: '14px',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            {zoomImage.title}
          </div>

          <img
            src={zoomImage.url}
            alt={zoomImage.title}
            style={{
              maxWidth: '92vw',
              maxHeight: '82vh',
              objectFit: 'contain',
              borderRadius: '10px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      {deleteConfirm && (
        <Modal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Truck"
          maxWidth="440px"
        >
          <div>
            <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to delete truck{' '}
              <strong style={{ color: '#0f172a' }}>{deleteConfirm.lorry_number}</strong>? This action
              cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDeleteVehicle(deleteConfirm)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Trash2 size={15} /> Delete Truck
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default VehiclesPage;
