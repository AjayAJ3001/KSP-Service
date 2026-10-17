import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Plus,
  Edit2,
  Search,
  Trash2,
  X,
  Phone,
  User,
  Compass,
  CheckCircle,
  Printer,
  Download,
  Loader2,
} from 'lucide-react';
import { partyService, routeService } from '../services/adminService';
import { Party, Route } from '../types';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';
import * as XLSX from 'xlsx';

export const PartiesPage: React.FC = () => {
  // Parties state
  const [parties, setParties] = useState<Party[]>([]);
  const [totalParties, setTotalParties] = useState(0);
  const [partiesPage, setPartiesPage] = useState(1);
  const [partySearch, setPartySearch] = useState('');
  const [partyStatusFilter, setPartyStatusFilter] = useState('');
  const [isPartiesLoading, setIsPartiesLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Selected party
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  // Units/Routes for selected party
  const [routes, setRoutes] = useState<Route[]>([]);
  const [totalRoutes, setTotalRoutes] = useState(0);
  const [routesPage, setRoutesPage] = useState(1);
  const [routeSearch, setRouteSearch] = useState('');
  const [routeStatusFilter, setRouteStatusFilter] = useState('');
  const [isRoutesLoading, setIsRoutesLoading] = useState(false);
  const [isPrintingUnits, setIsPrintingUnits] = useState(false);
  const [isExportingUnits, setIsExportingUnits] = useState(false);

  // Party Modal
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyFormData, setPartyFormData] = useState({
    name: '',
    contact_person: '',
    mobile_number: '',
    address: '',
  });
  const [partyFormError, setPartyFormError] = useState('');
  const [isPartySubmitting, setIsPartySubmitting] = useState(false);

  // Route/Unit Modal
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeFormData, setRouteFormData] = useState({
    party_id: 0,
    from_location: 'Erode',
    to_location: '',
    distance_km: '',
    rate_per_unit: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [routeFormError, setRouteFormError] = useState('');
  const [isRouteSubmitting, setIsRouteSubmitting] = useState(false);

  // Load parties
  useEffect(() => {
    loadParties();
  }, [partiesPage, partySearch, partyStatusFilter]);

  // Load units when selected party or filters change
  useEffect(() => {
    loadRoutes();
  }, [selectedParty, routesPage, routeSearch, routeStatusFilter]);

  const loadParties = async () => {
    try {
      setIsPartiesLoading(true);
      const res = await partyService.getParties({
        page: partiesPage,
        limit: 15,
        search: partySearch || undefined,
        status: partyStatusFilter || undefined,
      });
      const items = res.data.items || [];
      setParties(items);
      setTotalParties(res.data.total || 0);

      // Auto-select first party on initial load
      if (items.length > 0) {
        setSelectedParty((current) => {
          if (!current) return items[0];
          const found = items.find((p) => p.id === current.id);
          return found || current;
        });
      }
    } catch (err) {
      console.error('Failed to load parties', err);
    } finally {
      setIsPartiesLoading(false);
    }
  };

  const handlePrintParties = async () => {
    try {
      setIsPrinting(true);
      const res = await partyService.getParties({ limit: 10000, search: partySearch || undefined, status: partyStatusFilter || undefined });
      const items: Party[] = res?.data?.items || [];
      if (items.length === 0) {
        alert('No party records found to print.');
        setIsPrinting(false);
        return;
      }

      const totalCount = items.length;
      const totalUnits = items.reduce((sum, p) => sum + (Number(p.routes_count) || 0), 0);
      const generatedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KSP Transport - Parties & Customers Directory</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; font-size: 12px; }
    @page { size: landscape; margin: 10mm; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #0f172a; margin-bottom: 14px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .report-subtitle { font-size: 13px; font-weight: 700; color: #2563eb; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-text { font-size: 11px; color: #64748b; margin: 0; }
    .summary-cards { display: flex; gap: 12px; margin-bottom: 14px; }
    .card-box { padding: 8px 14px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11.5px; }
    .card-box strong { font-size: 14px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
    th { background: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 7px 8px; font-size: 11px; }
    th.center, td.center { text-align: center; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #fbfcfe; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-align: center; }
    .badge-unit { background: #dbeafe; color: #1d4ed8; }
    .footer-row td { background: #f1f5f9 !important; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; color: #0f172a; }
    .print-btn-bar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 14px; }
    .print-btn { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
    @media print {
      .print-btn-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">Print Report / Save as PDF</button>
    <button class="print-btn" style="background:#64748b" onclick="window.close()">Close</button>
  </div>

  <div class="header-bar">
    <div>
      <h1 class="company-title">KSP TRANSPORT</h1>
      <div class="report-subtitle">Parties & Customers Master Directory</div>
      <p class="meta-text">Client accounts, contact information, and delivery units</p>
    </div>
    <div style="text-align: right;">
      <p class="meta-text"><strong>Generated On:</strong> ${generatedAt}</p>
      <p class="meta-text"><strong>Total Parties:</strong> ${totalCount}</p>
      <p class="meta-text"><strong>Total Delivery Units:</strong> ${totalUnits}</p>
      ${partySearch ? `<p class="meta-text"><strong>Filter:</strong> ${partySearch}</p>` : ''}
    </div>
  </div>

  <div class="summary-cards">
    <div class="card-box">Total Parties: <strong>${totalCount}</strong></div>
    <div class="card-box">Total Destination Units: <strong style="color:#2563eb">${totalUnits}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 45px;" class="center">S.No</th>
        <th>Party / Company Name</th>
        <th>Contact Person</th>
        <th>Mobile / Phone Number</th>
        <th>Address / City</th>
        <th class="center">Delivery Units</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((p, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td><strong style="color: #0f172a; font-size: 12px;">${p.name}</strong></td>
          <td>${p.contact_person || '—'}</td>
          <td>${p.mobile_number || '—'}</td>
          <td>${p.address || '—'}</td>
          <td class="center">
            <span class="badge badge-unit">${Number(p.routes_count) || 0} Units</span>
          </td>
        </tr>
      `).join('')}
      <tr class="footer-row">
        <td class="center" colspan="2">TOTAL DIRECTORY</td>
        <td colspan="3"><strong>${totalCount} Parties Listed</strong></td>
        <td class="center"><strong>${totalUnits} Units Total</strong></td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
    <span>KSP Service Management ERP · Parties Master</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>
      `;

      const printWin = window.open('', '_blank', 'width=1100,height=850');
      if (!printWin) {
        alert('Please allow pop-ups for this website to print.');
        setIsPrinting(false);
        return;
      }
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 500);
    } catch (err: any) {
      console.error('Failed to print parties', err);
      alert(err.message || 'Failed to print parties.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await partyService.getParties({ limit: 10000, search: partySearch || undefined, status: partyStatusFilter || undefined });
      const items: Party[] = res?.data?.items || [];
      if (items.length === 0) {
        alert('No party records found to export.');
        setIsExporting(false);
        return;
      }

      const excelRows: any[] = items.map((p, idx) => ({
        'S.No': idx + 1,
        'Party Name': p.name,
        'Contact Person': p.contact_person || '—',
        'Mobile Number': p.mobile_number || '—',
        'Address': p.address || '—',
        'Delivery Units Count': Number(p.routes_count) || 0,
      }));

      // Blank separator
      excelRows.push({
        'S.No': '',
        'Party Name': '',
        'Contact Person': '',
        'Mobile Number': '',
        'Address': '',
        'Delivery Units Count': '',
      });

      // Total row
      excelRows.push({
        'S.No': '',
        'Party Name': 'TOTAL PARTIES',
        'Contact Person': `Count: ${items.length}`,
        'Mobile Number': '',
        'Address': 'Total Units:',
        'Delivery Units Count': items.reduce((sum, p) => sum + (Number(p.routes_count) || 0), 0),
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      worksheet['!cols'] = [
        { wch: 8 },  // S.No
        { wch: 28 }, // Party Name
        { wch: 20 }, // Contact Person
        { wch: 18 }, // Mobile Number
        { wch: 30 }, // Address
        { wch: 22 }, // Delivery Units Count
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Parties');
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `KSP_Parties_List_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Failed to export parties', err);
      alert(err.message || 'Failed to export parties.');
    } finally {
      setIsExporting(false);
    }
  };

  const loadRoutes = async () => {
    try {
      setIsRoutesLoading(true);
      const res = await routeService.getRoutes({
        page: routesPage,
        limit: 15,
        search: routeSearch || undefined,
        party_id: selectedParty ? selectedParty.id : undefined,
        status: routeStatusFilter || undefined,
      });
      setRoutes(res.data.items || []);
      setTotalRoutes(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load routes', err);
    } finally {
      setIsRoutesLoading(false);
    }
  };

  const handlePrintUnits = async () => {
    try {
      setIsPrintingUnits(true);
      const res = await routeService.getRoutes({
        limit: 10000,
        search: routeSearch || undefined,
        party_id: selectedParty ? selectedParty.id : undefined,
        status: routeStatusFilter || undefined,
      });
      const items: Route[] = res?.data?.items || [];
      if (items.length === 0) {
        alert('No delivery units found to print.');
        setIsPrintingUnits(false);
        return;
      }

      const totalCount = items.length;
      const activeCount = items.filter(r => r.status === 'ACTIVE').length;
      const partyTitle = selectedParty ? selectedParty.name : 'All Parties';
      const generatedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KSP Transport - Delivery Units & Freight Rates</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; font-size: 12px; }
    @page { size: landscape; margin: 10mm; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #0f172a; margin-bottom: 14px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .report-subtitle { font-size: 13px; font-weight: 700; color: #2563eb; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-text { font-size: 11px; color: #64748b; margin: 0; }
    .summary-cards { display: flex; gap: 12px; margin-bottom: 14px; }
    .card-box { padding: 8px 14px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11.5px; }
    .card-box strong { font-size: 14px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
    th { background: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 7px 8px; font-size: 11px; }
    th.center, td.center { text-align: center; }
    th.right, td.right { text-align: right; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #fbfcfe; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-align: center; }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-inactive { background: #fee2e2; color: #991b1b; }
    .footer-row td { background: #f1f5f9 !important; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; color: #0f172a; }
    .print-btn-bar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 14px; }
    .print-btn { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
    @media print {
      .print-btn-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">Print Report / Save as PDF</button>
    <button class="print-btn" style="background:#64748b" onclick="window.close()">Close</button>
  </div>

  <div class="header-bar">
    <div>
      <h1 class="company-title">KSP TRANSPORT</h1>
      <div class="report-subtitle">Delivery Units & Freight Rate Directory (${partyTitle})</div>
      <p class="meta-text">Destination delivery units, standard routes, distances, and freight charges</p>
    </div>
    <div style="text-align: right;">
      <p class="meta-text"><strong>Generated On:</strong> ${generatedAt}</p>
      <p class="meta-text"><strong>Total Units:</strong> ${totalCount}</p>
      ${selectedParty ? `<p class="meta-text"><strong>Party:</strong> ${selectedParty.name}</p>` : ''}
      ${routeSearch ? `<p class="meta-text"><strong>Filter:</strong> ${routeSearch}</p>` : ''}
    </div>
  </div>

  <div class="summary-cards">
    <div class="card-box">Total Delivery Units: <strong>${totalCount}</strong></div>
    <div class="card-box">Active: <strong style="color:#16a34a">${activeCount}</strong></div>
    <div class="card-box">Inactive: <strong style="color:#dc2626">${totalCount - activeCount}</strong></div>
    ${selectedParty ? `<div class="card-box">Party: <strong style="color:#2563eb">${selectedParty.name}</strong></div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 45px;" class="center">S.No</th>
        <th>Delivery Unit / Destination</th>
        <th>Applicable Party</th>
        <th>Origin</th>
        <th class="right">Freight Rate (₹)</th>
        <th class="right">Distance (KM)</th>
        <th class="center">Status</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((r, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td><strong style="color: #0f172a; font-size: 12px;">${r.to_location}</strong></td>
          <td>${r.party_name || (selectedParty ? selectedParty.name : '—')}</td>
          <td>${r.from_location || 'Erode'}</td>
          <td class="right" style="font-weight: 700; color: #1e40af;">₹${Number(r.rate_per_unit || 0).toLocaleString('en-IN')}</td>
          <td class="right">${r.distance_km ? `${r.distance_km} KM` : '—'}</td>
          <td class="center">
            <span class="badge ${r.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">
              ${r.status || 'ACTIVE'}
            </span>
          </td>
        </tr>
      `).join('')}
      <tr class="footer-row">
        <td class="center" colspan="2">TOTAL DIRECTORY</td>
        <td colspan="4"><strong>${totalCount} Units Listed (${activeCount} Active, ${totalCount - activeCount} Inactive)</strong></td>
        <td class="center"><strong>${totalCount} Units</strong></td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
    <span>KSP Service Management ERP · Delivery Units Master</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>
      `;

      const printWin = window.open('', '_blank', 'width=1100,height=850');
      if (!printWin) {
        alert('Please allow pop-ups for this website to print.');
        setIsPrintingUnits(false);
        return;
      }
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 500);
    } catch (err: any) {
      console.error('Failed to print delivery units', err);
      alert(err.message || 'Failed to print delivery units.');
    } finally {
      setIsPrintingUnits(false);
    }
  };

  const handleExportUnitsExcel = async () => {
    try {
      setIsExportingUnits(true);
      const res = await routeService.getRoutes({
        limit: 10000,
        search: routeSearch || undefined,
        party_id: selectedParty ? selectedParty.id : undefined,
        status: routeStatusFilter || undefined,
      });
      const items: Route[] = res?.data?.items || [];
      if (items.length === 0) {
        alert('No delivery units found to export.');
        setIsExportingUnits(false);
        return;
      }

      const excelRows: any[] = items.map((r, idx) => ({
        'S.No': idx + 1,
        'Delivery Unit / Destination': r.to_location,
        'Applicable Party': r.party_name || (selectedParty ? selectedParty.name : '—'),
        'Origin': r.from_location || 'Erode',
        'Freight Rate (₹)': Number(r.rate_per_unit || 0),
        'Distance (KM)': r.distance_km || '—',
        'Status': r.status || 'ACTIVE',
      }));

      // Blank separator
      excelRows.push({
        'S.No': '',
        'Delivery Unit / Destination': '',
        'Applicable Party': '',
        'Origin': '',
        'Freight Rate (₹)': '',
        'Distance (KM)': '',
        'Status': '',
      });

      // Total row
      excelRows.push({
        'S.No': '',
        'Delivery Unit / Destination': 'TOTAL UNITS',
        'Applicable Party': `Count: ${items.length}`,
        'Origin': '',
        'Freight Rate (₹)': '',
        'Distance (KM)': '',
        'Status': `${items.filter(r => r.status === 'ACTIVE').length} Active`,
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      worksheet['!cols'] = [
        { wch: 8 },  // S.No
        { wch: 28 }, // Delivery Unit
        { wch: 25 }, // Party
        { wch: 15 }, // Origin
        { wch: 18 }, // Freight Rate
        { wch: 15 }, // Distance
        { wch: 12 }, // Status
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DeliveryUnits');
      const partyTag = selectedParty ? selectedParty.name.replace(/[^a-zA-Z0-9]/g, '_') : 'All';
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `KSP_Units_${partyTag}_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Failed to export delivery units', err);
      alert(err.message || 'Failed to export delivery units.');
    } finally {
      setIsExportingUnits(false);
    }
  };

  // --- Party CRUD Handlers ---
  const openCreatePartyModal = () => {
    setEditingParty(null);
    setPartyFormData({ name: '', contact_person: '', mobile_number: '', address: '' });
    setPartyFormError('');
    setIsPartyModalOpen(true);
  };

  const openEditPartyModal = (party: Party, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingParty(party);
    setPartyFormData({
      name: party.name,
      contact_person: party.contact_person || '',
      mobile_number: party.mobile_number || '',
      address: party.address || '',
    });
    setPartyFormError('');
    setIsPartyModalOpen(true);
  };

  const handlePartySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyFormData.name.trim()) {
      setPartyFormError('Party name is required.');
      return;
    }

    try {
      setIsPartySubmitting(true);
      setPartyFormError('');
      if (editingParty) {
        await partyService.updateParty(editingParty.id, partyFormData);
      } else {
        const res = await partyService.createParty(partyFormData);
        if (res.data) {
          setSelectedParty(res.data);
        }
      }
      setIsPartyModalOpen(false);
      setEditingParty(null);
      loadParties();
    } catch (err: any) {
      setPartyFormError(err.message || 'Failed to save party.');
    } finally {
      setIsPartySubmitting(false);
    }
  };

  const handleDeleteParty = async (party: Party, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete party "${party.name}"?`)) return;
    try {
      await partyService.deleteParty(party.id);
      if (selectedParty?.id === party.id) {
        setSelectedParty(null);
      }
      loadParties();
    } catch (err: any) {
      alert(err.message || 'Failed to delete party.');
    }
  };

  // --- Route/Unit CRUD Handlers ---
  const openCreateRouteModal = () => {
    setEditingRoute(null);
    setRouteFormData({
      party_id: selectedParty ? selectedParty.id : 0,
      from_location: 'Erode',
      to_location: '',
      distance_km: '',
      rate_per_unit: '',
      status: 'ACTIVE',
    });
    setRouteFormError('');
    setIsRouteModalOpen(true);
  };

  const openEditRouteModal = (route: Route) => {
    setEditingRoute(route);
    setRouteFormData({
      party_id: route.party_id || (selectedParty ? selectedParty.id : 0),
      from_location: route.from_location || 'Erode',
      to_location: route.to_location,
      distance_km: route.distance_km ? String(route.distance_km) : '',
      rate_per_unit: route.rate_per_unit ? String(route.rate_per_unit) : '',
      status: route.status,
    });
    setRouteFormError('');
    setIsRouteModalOpen(true);
  };

  const handleRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeFormData.to_location.trim()) {
      setRouteFormError('Party Unit / Destination name is required.');
      return;
    }

    try {
      setIsRouteSubmitting(true);
      setRouteFormError('');
      const payload: any = {
        from_location: (routeFormData.from_location || 'Erode').trim(),
        to_location: routeFormData.to_location.trim(),
        distance_km: routeFormData.distance_km ? parseFloat(routeFormData.distance_km) : undefined,
        rate_per_unit: routeFormData.rate_per_unit ? parseFloat(routeFormData.rate_per_unit) : undefined,
        party_id: routeFormData.party_id || (selectedParty ? selectedParty.id : undefined),
        status: routeFormData.status,
      };

      if (editingRoute) {
        await routeService.updateRoute(editingRoute.id, payload);
      } else {
        await routeService.createRoute(payload);
      }

      setIsRouteModalOpen(false);
      setEditingRoute(null);
      loadRoutes();
      loadParties(); // Refresh route/unit count badges
    } catch (err: any) {
      setRouteFormError(err.message || 'Failed to save unit.');
    } finally {
      setIsRouteSubmitting(false);
    }
  };

  const handleDeleteRoute = async (route: Route) => {
    if (!confirm(`Are you sure you want to delete unit/destination "${route.to_location}"?`)) return;
    try {
      await routeService.deleteRoute(route.id);
      loadRoutes();
      loadParties(); // Refresh route/unit count badges
    } catch (err: any) {
      alert(err.message || 'Failed to delete unit.');
    }
  };

  return (
    <div>
      {/* Standard KSP Portal Page Header */}
      <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Parties and Units Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '2px' }}>
            Maintain customer accounts and manage their destination delivery units & freight rates
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handlePrintParties}
            disabled={isPrinting}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#3b82f6',
              color: '#1d4ed8',
              background: '#eff6ff',
              fontWeight: 600,
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
            }}
            title="Print Parties Master Directory"
          >
            {isPrinting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {isPrinting ? 'Preparing...' : 'Print Parties'}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#10b981',
              color: '#059669',
              background: '#ecfdf5',
              fontWeight: 600,
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
            }}
            title="Download Parties Directory as Excel"
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {isExporting ? 'Exporting...' : 'Download Parties'}
          </button>

          <button
            type="button"
            onClick={handlePrintUnits}
            disabled={isPrintingUnits}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#6366f1',
              color: '#4338ca',
              background: '#eef2ff',
              fontWeight: 600,
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
            }}
            title={selectedParty ? `Print delivery units for ${selectedParty.name}` : 'Print all delivery units'}
          >
            {isPrintingUnits ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {isPrintingUnits ? 'Preparing...' : selectedParty ? `Print Units (${selectedParty.name.length > 15 ? selectedParty.name.slice(0, 15) + '...' : selectedParty.name})` : 'Print Units'}
          </button>

          <button
            type="button"
            onClick={handleExportUnitsExcel}
            disabled={isExportingUnits}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#059669',
              color: '#065f46',
              background: '#f0fdf4',
              fontWeight: 600,
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
            }}
            title={selectedParty ? `Download delivery units for ${selectedParty.name} as Excel` : 'Download all delivery units as Excel'}
          >
            {isExportingUnits ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {isExportingUnits ? 'Exporting...' : selectedParty ? `Download Units (${selectedParty.name.length > 15 ? selectedParty.name.slice(0, 15) + '...' : selectedParty.name})` : 'Download Units'}
          </button>

          <button onClick={openCreatePartyModal} className="btn btn-primary" style={{ height: '38px' }}>
            <Plus size={18} /> Add New Party
          </button>
        </div>
      </div>

      {/* Main Two-Column Master-Detail Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '310px minmax(0, 1fr)',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: Parties Master List */}
        <div
          className="card"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: 0,
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={16} color="var(--primary-800)" />
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--primary-900)' }}>
                Parties ({totalParties})
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedParty(null);
                setRoutesPage(1);
              }}
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: !selectedParty ? '#1d4ed8' : '#64748b',
                background: !selectedParty ? '#dbeafe' : '#f1f5f9',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              View All Units
            </button>
          </div>

          {/* Search Bar */}
          <div className="search-input-wrapper" style={{ width: '100%' }}>
            <Search size={15} />
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '12.5px', padding: '7px 10px 7px 32px' }}
              placeholder="Search by name, phone..."
              value={partySearch}
              onChange={(e) => {
                setPartySearch(e.target.value);
                setPartiesPage(1);
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            className="form-control form-select"
            style={{ fontSize: '12px', padding: '6px 10px', height: '32px' }}
            value={partyStatusFilter}
            onChange={(e) => {
              setPartyStatusFilter(e.target.value);
              setPartiesPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          {/* Parties Scroll List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: 'calc(100vh - 300px)',
              minHeight: '400px',
              overflowY: 'auto',
              paddingRight: '2px',
            }}
          >
            {isPartiesLoading ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Loading parties...
              </div>
            ) : parties.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No parties found.
              </div>
            ) : (
              parties.map((party) => {
                const isSelected = selectedParty?.id === party.id;
                const routesCount = Number(party.routes_count) || 0;

                return (
                  <div
                    key={party.id}
                    onClick={() => {
                      setSelectedParty(party);
                      setRoutesPage(1);
                      setRouteSearch('');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      borderLeft: isSelected ? '4px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Top Row: Name + Count Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '13px',
                          color: isSelected ? '#1e40af' : '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                        title={party.name}
                      >
                        {party.name}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '10px',
                          background: routesCount > 0 ? '#dbeafe' : '#f1f5f9',
                          color: routesCount > 0 ? '#1d4ed8' : '#64748b',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {routesCount} {routesCount === 1 ? 'Unit' : 'Units'}
                      </span>
                    </div>

                    {/* Contact Info (if available) */}
                    {(party.contact_person || party.mobile_number) && (
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: '#64748b',
                          marginTop: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {party.contact_person && <span>{party.contact_person}</span>}
                        {party.contact_person && party.mobile_number && <span> · </span>}
                        {party.mobile_number && <span>{party.mobile_number}</span>}
                      </div>
                    )}

                    {/* Bottom Row: Selected status indicator & Action buttons */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: isSelected ? '1px dashed #bfdbfe' : '1px solid #f1f5f9',
                      }}
                    >
                      <div>
                        {isSelected ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#2563eb',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle size={12} /> Active
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {party.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={(e) => openEditPartyModal(party, e)}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '2px 6px', height: '24px', fontSize: '11px' }}
                          title="Edit Party Details"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteParty(party, e)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '2px 6px', height: '24px', fontSize: '11px' }}
                          title="Delete Party"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Party Pagination */}
          {totalParties > 15 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '1px solid #e2e8f0',
                fontSize: '11.5px',
              }}
            >
              <button
                className="btn btn-outline btn-sm"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                disabled={partiesPage <= 1}
                onClick={() => setPartiesPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span style={{ color: '#64748b' }}>
                {partiesPage} / {Math.ceil(totalParties / 15)}
              </span>
              <button
                className="btn btn-outline btn-sm"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                disabled={partiesPage >= Math.ceil(totalParties / 15)}
                onClick={() => setPartiesPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Specific Party's Delivery Units */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            marginBottom: 0,
            minHeight: '520px',
          }}
        >
          {/* Header Banner */}
          {selectedParty ? (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 2px 8px rgba(30, 64, 175, 0.15)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} color="#93c5fd" />
                  <h3
                    style={{
                      fontSize: '16.5px',
                      fontWeight: 800,
                      margin: 0,
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {selectedParty.name}
                  </h3>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#bfdbfe',
                    marginTop: '3px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  {selectedParty.contact_person && <span>Contact: {selectedParty.contact_person}</span>}
                  {selectedParty.mobile_number && <span>Phone: {selectedParty.mobile_number}</span>}
                  {selectedParty.address && <span>{selectedParty.address}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handlePrintUnits}
                  disabled={isPrintingUnits}
                  className="btn"
                  style={{
                    background: '#ffffff',
                    color: '#1d4ed8',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  title={`Print delivery units for ${selectedParty.name}`}
                >
                  {isPrintingUnits ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                  Print Units
                </button>

                <button
                  type="button"
                  onClick={handleExportUnitsExcel}
                  disabled={isExportingUnits}
                  className="btn"
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  title={`Download delivery units for ${selectedParty.name} as Excel`}
                >
                  {isExportingUnits ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Download Units
                </button>

                <button
                  onClick={openCreateRouteModal}
                  className="btn"
                  style={{
                    background: '#ffffff',
                    color: '#1e40af',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  <Plus size={14} /> Add Delivery Unit
                </button>
                <button
                  onClick={() => setSelectedParty(null)}
                  className="btn"
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    fontSize: '12px',
                    padding: '6px 10px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    whiteSpace: 'nowrap',
                  }}
                  title="View units across all parties"
                >
                  <X size={14} /> View All
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                  All Delivery Units ({totalRoutes})
                </span>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Showing delivery units across all parties. Select a party on the left to filter.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handlePrintUnits}
                  disabled={isPrintingUnits}
                  className="btn btn-outline"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: '#3b82f6',
                    color: '#1d4ed8',
                    background: '#eff6ff',
                    fontWeight: 600,
                    height: '34px',
                    padding: '0 12px',
                    fontSize: '12.5px',
                  }}
                  title="Print all delivery units"
                >
                  {isPrintingUnits ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                  Print Units
                </button>
                <button
                  type="button"
                  onClick={handleExportUnitsExcel}
                  disabled={isExportingUnits}
                  className="btn btn-outline"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: '#10b981',
                    color: '#059669',
                    background: '#ecfdf5',
                    fontWeight: 600,
                    height: '34px',
                    padding: '0 12px',
                    fontSize: '12.5px',
                  }}
                  title="Download all delivery units as Excel"
                >
                  {isExportingUnits ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Download Units
                </button>
                <button
                  onClick={openCreateRouteModal}
                  className="btn btn-primary btn-sm"
                  style={{ height: '34px' }}
                >
                  <Plus size={14} /> Add Delivery Unit
                </button>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-input-wrapper" style={{ flex: '1 1 200px', minWidth: '160px' }}>
              <Search size={15} />
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '13px', padding: '7px 12px 7px 34px' }}
                placeholder={
                  selectedParty
                    ? `Search units for ${selectedParty.name}...`
                    : 'Search delivery unit / destination...'
                }
                value={routeSearch}
                onChange={(e) => {
                  setRouteSearch(e.target.value);
                  setRoutesPage(1);
                }}
              />
            </div>

            <select
              className="form-control form-select"
              style={{ width: '130px', fontSize: '12px', height: '34px', flexShrink: 0 }}
              value={routeStatusFilter}
              onChange={(e) => {
                setRouteStatusFilter(e.target.value);
                setRoutesPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>

            <button
              type="button"
              onClick={handlePrintUnits}
              disabled={isPrintingUnits}
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#3b82f6',
                color: '#1d4ed8',
                background: '#eff6ff',
                fontWeight: 600,
                height: '34px',
                padding: '0 12px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title={selectedParty ? `Print delivery units for ${selectedParty.name}` : 'Print Delivery Units'}
            >
              {isPrintingUnits ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              {isPrintingUnits ? 'Preparing...' : 'Print Units'}
            </button>

            <button
              type="button"
              onClick={handleExportUnitsExcel}
              disabled={isExportingUnits}
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#10b981',
                color: '#059669',
                background: '#ecfdf5',
                fontWeight: 600,
                height: '34px',
                padding: '0 12px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title={selectedParty ? `Download delivery units for ${selectedParty.name} as Excel` : 'Download Delivery Units as Excel'}
            >
              {isExportingUnits ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {isExportingUnits ? 'Exporting...' : 'Download Units'}
            </button>
          </div>

          {/* Units Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Party Unit / Destination</th>
                  {!selectedParty && <th>Applicable Party</th>}
                  <th>Origin</th>
                  <th>Freight Rate</th>
                  <th>Distance</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isRoutesLoading ? (
                  <tr>
                    <td
                      colSpan={selectedParty ? 6 : 7}
                      style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}
                    >
                      Loading units...
                    </td>
                  </tr>
                ) : routes.length === 0 ? (
                  <tr>
                    <td colSpan={selectedParty ? 6 : 7} style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Compass size={36} color="#94a3b8" />
                        <div style={{ fontWeight: 600, color: '#475569', fontSize: '14.5px' }}>
                          {selectedParty
                            ? `No delivery units found for "${selectedParty.name}"`
                            : 'No delivery units found.'}
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '12.5px', margin: 0 }}>
                          {selectedParty
                            ? 'Add delivery destination units (e.g. SIPCOT, PALANI, KUNDADAM) for this party.'
                            : 'Click "+ Add Delivery Unit" to create a new delivery unit.'}
                        </p>
                        <button
                          onClick={openCreateRouteModal}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: '6px' }}
                        >
                          <Plus size={14} /> Add First Unit
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  routes.map((route) => (
                    <tr key={route.id}>
                      {/* Destination Unit */}
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '13px',
                            color: '#1e40af',
                            background: '#eff6ff',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <MapPin size={12} /> {route.to_location}
                        </span>
                      </td>

                      {/* Applicable Party (shown only when View All mode is active) */}
                      {!selectedParty && (
                        <td>
                          {route.party_name ? (
                            <strong style={{ color: 'var(--primary-900)' }}>{route.party_name}</strong>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Common / All Parties</span>
                          )}
                        </td>
                      )}

                      {/* Origin */}
                      <td>
                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: '12.5px' }}>
                          {route.from_location || 'Erode'}
                        </span>
                      </td>

                      {/* Freight Rate */}
                      <td>
                        {route.rate_per_unit ? (
                          <strong style={{ color: '#d97706', fontSize: '13px', fontWeight: 800 }}>
                            ₹{parseFloat(String(route.rate_per_unit)).toLocaleString('en-IN')}/Ton
                          </strong>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Distance */}
                      <td>
                        <span style={{ fontSize: '12.5px', color: '#475569' }}>
                          {route.distance_km ? `${route.distance_km} KM` : '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusBadge status={route.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '5px' }}>
                          <button
                            onClick={() => openEditRouteModal(route)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '3px 6px', height: '26px' }}
                            title="Edit Unit"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteRoute(route)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 6px', height: '26px' }}
                            title="Delete Unit"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Route Pagination */}
          {totalRoutes > 15 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                fontSize: '12.5px',
              }}
            >
              <button
                className="btn btn-outline btn-sm"
                disabled={routesPage <= 1}
                onClick={() => setRoutesPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ color: '#64748b' }}>
                Page {routesPage} of {Math.ceil(totalRoutes / 15)} ({totalRoutes} total units)
              </span>
              <button
                className="btn btn-outline btn-sm"
                disabled={routesPage >= Math.ceil(totalRoutes / 15)}
                onClick={() => setRoutesPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Add / Edit Party */}
      <Modal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        title={editingParty ? `Edit Party: ${editingParty.name}` : 'Add New Party'}
      >
        {partyFormError && (
          <div
            style={{
              color: '#b91c1c',
              background: '#fef2f2',
              padding: '10px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            {partyFormError}
          </div>
        )}
        <form onSubmit={handlePartySubmit}>
          <div className="form-group">
            <label className="form-label">Party / Customer Company Name *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. KRISHI NUTRITION COMPANY"
              value={partyFormData.name}
              onChange={(e) => setPartyFormData({ ...partyFormData, name: e.target.value })}
            />
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Arun Kumar"
                value={partyFormData.contact_person}
                onChange={(e) => setPartyFormData({ ...partyFormData, contact_person: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="10-digit mobile"
                value={partyFormData.mobile_number}
                onChange={(e) => setPartyFormData({ ...partyFormData, mobile_number: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Office / Billing Address</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Enter full address"
              value={partyFormData.address}
              onChange={(e) => setPartyFormData({ ...partyFormData, address: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => setIsPartyModalOpen(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isPartySubmitting}>
              {isPartySubmitting ? 'Saving...' : 'Save Party'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Add / Edit Delivery Unit */}
      <Modal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        title={
          editingRoute
            ? `Edit Delivery Unit`
            : `Add Delivery Unit for ${selectedParty?.name || 'Party'}`
        }
      >
        {routeFormError && (
          <div
            style={{
              color: '#b91c1c',
              background: '#fef2f2',
              padding: '10px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            {routeFormError}
          </div>
        )}
        <form onSubmit={handleRouteSubmit}>
          <div className="form-group">
            <label className="form-label">Applicable Party *</label>
            <select
              className="form-control form-select"
              required
              value={routeFormData.party_id || ''}
              onChange={(e) =>
                setRouteFormData({ ...routeFormData, party_id: parseInt(e.target.value) || 0 })
              }
            >
              <option value="">Select Party</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">From (Origin)</label>
              <input
                type="text"
                className="form-control"
                disabled
                value="Erode"
                style={{ background: '#f1f5f9', cursor: 'not-allowed', fontWeight: 600 }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                Fixed origin for dispatches
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">To (Party Unit Name / Destination) *</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="e.g. SIPCOT, PALANI, KUNDADAM"
                value={routeFormData.to_location}
                onChange={(e) => setRouteFormData({ ...routeFormData, to_location: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Freight Rate (₹ / Ton)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                placeholder="e.g. 450"
                value={routeFormData.rate_per_unit}
                onChange={(e) => setRouteFormData({ ...routeFormData, rate_per_unit: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Distance (KM) (Optional)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="form-control"
                placeholder="e.g. 85"
                value={routeFormData.distance_km}
                onChange={(e) => setRouteFormData({ ...routeFormData, distance_km: e.target.value })}
              />
            </div>
          </div>

          {editingRoute && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control form-select"
                value={routeFormData.status}
                onChange={(e) =>
                  setRouteFormData({ ...routeFormData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })
                }
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => setIsRouteModalOpen(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isRouteSubmitting}>
              {isRouteSubmitting ? 'Saving...' : 'Save Unit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PartiesPage;
