import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Edit2, Trash2, Printer, Download, Loader2 } from 'lucide-react';
import { ownerService } from '../services/adminService';
import { Owner } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { formatDateDMY } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

export const OwnersPage: React.FC = () => {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [allOwnersList, setAllOwnersList] = useState<Owner[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [formData, setFormData] = useState({ name: '', mobile_number: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const LIMIT = 10;

  const loadAllOwnersLookup = async () => {
    try {
      const res = await ownerService.getOwners({ limit: 1000 });
      if (res?.success && res.data?.items) {
        setAllOwnersList(res.data.items);
      }
    } catch (err) {
      console.error('Failed to load owners lookup:', err);
    }
  };

  useEffect(() => {
    loadAllOwnersLookup();
  }, []);

  useEffect(() => {
    loadOwners();
  }, [page, search]);

  const loadOwners = async () => {
    try {
      setIsLoading(true);
      const res = await ownerService.getOwners({ page, limit: LIMIT, search: search || undefined });
      if (res.success) {
        setOwners(res.data.items);
        setTotal(res.data.total);
      }
    } catch (err) {
      console.error('Failed to load owners:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintOwners = async () => {
    try {
      setIsPrinting(true);
      const res = await ownerService.getOwners({ limit: 10000, search: search || undefined });
      const items: Owner[] = res?.data?.items || [];
      if (items.length === 0) {
        alert('No owner records found to print.');
        setIsPrinting(false);
        return;
      }

      const totalCount = items.length;
      const generatedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KSP Transport - Owner Master Directory</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; font-size: 12px; }
    @page { size: portrait; margin: 12mm; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #0f172a; margin-bottom: 14px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .report-subtitle { font-size: 13px; font-weight: 700; color: #2563eb; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-text { font-size: 11px; color: #64748b; margin: 0; }
    .summary-cards { display: flex; gap: 12px; margin-bottom: 14px; }
    .card-box { padding: 8px 14px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11.5px; }
    .card-box strong { font-size: 14px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 6px; }
    th { background: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 8px 10px; font-size: 11px; }
    th.center, td.center { text-align: center; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #fbfcfe; }
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
      <div class="report-subtitle">Owner Master Directory</div>
      <p class="meta-text">Registered vehicle & asset owners directory</p>
    </div>
    <div style="text-align: right;">
      <p class="meta-text"><strong>Generated On:</strong> ${generatedAt}</p>
      <p class="meta-text"><strong>Total Owners:</strong> ${totalCount}</p>
      ${search ? `<p class="meta-text"><strong>Filter:</strong> ${search}</p>` : ''}
    </div>
  </div>

  <div class="summary-cards">
    <div class="card-box">Total Registered Owners: <strong>${totalCount}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50px;" class="center">S.No</th>
        <th>Owner Name</th>
        <th>Mobile / Phone Number</th>
        <th>Registration Date</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((o, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td><strong style="color: #0f172a;">${o.name || '—'}</strong></td>
          <td>${o.mobile_number || '—'}</td>
          <td>${o.created_at ? formatDateDMY(o.created_at) : '—'}</td>
        </tr>
      `).join('')}
      <tr class="footer-row">
        <td class="center" colspan="2">TOTAL OWNERS</td>
        <td colspan="2"><strong>${totalCount} Owners Registered</strong></td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
    <span>KSP Service Management ERP · Owner Master</span>
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
      console.error('Failed to print owners', err);
      alert(err.message || 'Failed to print owners.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await ownerService.getOwners({ limit: 10000, search: search || undefined });
      const items: Owner[] = res?.data?.items || [];
      if (items.length === 0) {
        alert('No owner records found to export.');
        setIsExporting(false);
        return;
      }

      const excelRows: any[] = items.map((o, idx) => ({
        'S.No': idx + 1,
        'Owner Name': o.name || '—',
        'Mobile Number': o.mobile_number || '—',
        'Registration Date': o.created_at ? formatDateDMY(o.created_at) : '—',
      }));

      // Blank separator
      excelRows.push({
        'S.No': '',
        'Owner Name': '',
        'Mobile Number': '',
        'Registration Date': '',
      });

      // Total row
      excelRows.push({
        'S.No': '',
        'Owner Name': 'TOTAL OWNERS',
        'Mobile Number': `Count: ${items.length}`,
        'Registration Date': `Total: ${items.length}`,
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      worksheet['!cols'] = [
        { wch: 8 },  // S.No
        { wch: 28 }, // Owner Name
        { wch: 20 }, // Mobile Number
        { wch: 20 }, // Registration Date
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Owners');
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `KSP_Owners_List_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Failed to export owners', err);
      alert(err.message || 'Failed to export owners.');
    } finally {
      setIsExporting(false);
    }
  };

  const openCreateModal = () => {
    setSelectedOwner(null);
    setFormData({ name: '', mobile_number: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (owner: Owner) => {
    setSelectedOwner(owner);
    setFormData({ name: owner.name, mobile_number: owner.mobile_number || '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', mobile_number: '' });
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Owner name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = { name: formData.name.trim(), mobile_number: formData.mobile_number.trim() || undefined };

      if (selectedOwner) {
        await ownerService.updateOwner(selectedOwner.id, payload);
      } else {
        await ownerService.createOwner(payload);
      }

      setIsModalOpen(false);
      resetForm();
      setPage(1);
      loadOwners();
      loadAllOwnersLookup();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Failed to save owner. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (owner: Owner) => {
    if (!window.confirm(`Delete owner "${owner.name}"? This action cannot be undone.`)) return;
    try {
      await ownerService.deleteOwner(owner.id);
      loadOwners();
      loadAllOwnersLookup();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete owner.');
    }
  };

  const columns: Column<Owner>[] = [
    { header: 'Owner Name', accessor: 'name', render: (o) => <strong>{o.name}</strong> },
    { header: 'Mobile Number', accessor: (o) => o.mobile_number || '—' },
    {
      header: 'Created Date',
      accessor: (o) => (o.created_at ? formatDateDMY(o.created_at) : '—'),
    },
    {
      header: 'Actions',
      render: (o) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openEditModal(o)} className="btn btn-outline btn-sm" title="Edit Owner">
            <Edit2 size={14} />
          </button>
          <button onClick={() => handleDelete(o)} className="btn btn-danger btn-sm" title="Delete Owner">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Owner Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Manage vehicle and asset owners for KSP Transport
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add New Owner
        </button>
      </div>

      {/* Table Card */}
      <div className="card">
        <div className="search-filter-bar" style={{ marginBottom: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
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
              <option value="">All Owners {allOwnersList.length > 0 ? `(${allOwnersList.length})` : ''}</option>
              {Array.from(new Map(allOwnersList.map((o) => [o.name, o])).values())
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}{o.mobile_number ? ` (${o.mobile_number})` : ''}
                  </option>
                ))}
            </select>
          </div>

          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="btn btn-outline"
              style={{ height: '38px', padding: '0 14px', fontSize: '13px' }}
              title="Reset owner filter"
            >
              Reset
            </button>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handlePrintOwners}
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
              title="Print Owner Master Directory"
            >
              {isPrinting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              {isPrinting ? 'Preparing...' : 'Print'}
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
              title="Download Owner Master as Excel"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isExporting ? 'Exporting...' : 'Download'}
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={owners}
          isLoading={isLoading}
          page={page}
          limit={LIMIT}
          total={total}
          onPageChange={setPage}
          emptyMessage="No owners found. Add your first owner using the button above."
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title={selectedOwner ? 'Edit Owner' : 'Add New Owner'}
        maxWidth="500px"
      >
        <form onSubmit={handleSubmit}>
          {formError && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              {formError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Owner Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. K.S. PALANISAMY"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 9876543210"
              value={formData.mobile_number}
              onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setIsModalOpen(false); resetForm(); }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : selectedOwner ? 'Update Owner' : 'Add Owner'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
