/** Shared KSP Transport logo + print CSS for admin PDFs / print windows. */

export const KSP_LOGO_HTML = `<svg class="ksp-logo" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" aria-label="KSP Transport">
  <rect x="1.5" y="1.5" width="69" height="69" rx="3" fill="#0B1F3A"/>
  <rect x="1.5" y="1.5" width="69" height="69" rx="3" fill="none" stroke="#C9A227" stroke-width="2"/>
  <rect x="7" y="7" width="58" height="58" rx="1.2" fill="none" stroke="#C9A227" stroke-width="0.7"/>
  <text x="36" y="41" text-anchor="middle" fill="#C9A227" font-family="Georgia, 'Times New Roman', Times, serif" font-size="19" font-weight="700" letter-spacing="2.4">KSP</text>
  <line x1="18" y1="47.5" x2="54" y2="47.5" stroke="#C9A227" stroke-width="1.1"/>
  <line x1="24" y1="50.8" x2="48" y2="50.8" stroke="#C9A227" stroke-width="0.45"/>
</svg>`;

export const PRINT_BRAND_CSS = `
    .brand-lockup { display: flex; align-items: center; gap: 12px; text-align: left; }
    .ksp-logo { width: 52px; height: 52px; display: block; flex-shrink: 0; }
    .header-bar, .ksp-header {
      display: flex; justify-content: space-between; align-items: center; gap: 16px;
      padding-bottom: 10px; margin-bottom: 12px;
      border-bottom: 3px solid #0f172a;
    }
    .header-bar > div:first-child { min-width: 0; }
    .header-bar .brand-lockup { flex: 1; }
    .company-title, .v-title, .s-title, h1.title, h1.company-title {
      font-size: 18px !important; font-weight: 900 !important; color: #0f172a !important;
      letter-spacing: 0.6px; margin: 0 !important; text-transform: uppercase; line-height: 1.15;
    }
    .company-sub {
      font-size: 10.5px !important; font-weight: 700 !important; color: #b45309 !important;
      letter-spacing: 0.55px; text-transform: uppercase; margin: 3px 0 0 0 !important;
    }
    .report-subtitle {
      font-size: 11px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.4px; margin: 4px 0 0 0;
    }
    .company-meta, .ksp-meta, .meta-text { font-size: 10px; color: #64748b; margin-top: 2px; }
    .ksp-header-right, .doc-box { text-align: right; flex-shrink: 0; }
    .doc-title { font-size: 13px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.4px; }
    .ksp-accent { height: 4px; background: linear-gradient(90deg, #0f172a 0%, #f59e0b 50%, #0f172a 100%); margin: 0 0 12px; border-radius: 2px; }
    th { text-align: left; }
    th.num, td.num { text-align: right !important; font-variant-numeric: tabular-nums; }
    th.center, td.center { text-align: center !important; }
    .header .brand-lockup, .card .header .brand-lockup { justify-content: center; }
    .card .header, .voucher-card .header, .challan-card .header {
      display: block; text-align: center; border-bottom: 3px solid #0f172a;
    }
    .ksp-footer {
      margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; font-size: 9.5px; color: #94a3b8;
    }
`;

export function printBrandLockup(subtitle = 'Fleet Logistics &amp; Transport') {
  return `<div class="brand-lockup">
    ${KSP_LOGO_HTML}
    <div>
      <div class="company-title">KSP TRANSPORT</div>
      <div class="company-sub">${subtitle}</div>
    </div>
  </div>`;
}

export function printBrandAccent() {
  return `<div class="ksp-accent"></div>`;
}
