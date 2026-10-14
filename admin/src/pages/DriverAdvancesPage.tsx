import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
  FileSpreadsheet,
  Printer,
  Loader2,
  RefreshCw,
  HandCoins,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  ChevronDown,
  ChevronUp,
  Truck,
  CreditCard,
  X,
  Check,
  Users,
  Navigation,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  driverAdvanceService,
  driverService,
  vehicleService,
  userService,
  tripService,
} from '../services/adminService';
import { Driver, Vehicle, User, DriverAdvance, DriverAdvanceSummary, Trip } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { DateField } from '../components/Common/DateField';
import { formatIST, formatISTDate } from '../utils/dateUtils';

const formatCurrency = (val: number | string) => {
  const num = parseFloat(String(val)) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Smart IST date/time formatter.
 * If advance_date was recorded as midnight, fallback to created_at so accurate timestamp is displayed.
 */
const formatAdvanceDateTime = (dateStr?: string | Date | null, createdAtStr?: string | Date | null): string => {
  if (!dateStr && !createdAtStr) return '—';
  const clean = String(dateStr || '').trim();
  const isMidnight =
    !clean ||
    clean.endsWith('T18:30:00.000Z') ||
    clean.endsWith('T00:00:00.000Z') ||
    clean.includes(' 00:00:00') ||
    clean.includes('T00:00:00') ||
    /^\d{4}-\d{2}-\d{2}$/.test(clean);
  if (isMidnight && createdAtStr) {
    return formatIST(createdAtStr);
  }
  return formatIST(dateStr || createdAtStr);
};

const numberToWords = (num: number): string => {
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ',
    'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero Rupees Only';

  const inWords = (val: number): string => {
    let str = '';
    if (val >= 10000000) {
      str += inWords(Math.floor(val / 10000000)) + 'Crore ';
      val %= 10000000;
    }
    if (val >= 100000) {
      str += inWords(Math.floor(val / 100000)) + 'Lakh ';
      val %= 100000;
    }
    if (val >= 1000) {
      str += inWords(Math.floor(val / 1000)) + 'Thousand ';
      val %= 1000;
    }
    if (val >= 100) {
      str += inWords(Math.floor(val / 100)) + 'Hundred ';
      val %= 100;
    }
    if (val > 0) {
      if (val < 20) {
        str += a[val];
      } else {
        str += b[Math.floor(val / 10)] + (val % 10 ? ' ' + a[val % 10] : ' ');
      }
    }
    return str;
  };

  return `Rupees ${inWords(n).trim()} Only`;
};

export const DriverAdvancesPage: React.FC = () => {
  // Main active view: 'ledger' (per-driver summary) or 'transactions' (all advance records)
  const [activeView, setActiveView] = useState<'ledger' | 'transactions'>('ledger');

  // Lookups
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [managers, setManagers] = useState<User[]>([]);

  // Transactions State
  const [advances, setAdvances] = useState<DriverAdvance[]>([]);
  const [totalAdvancesCount, setTotalAdvancesCount] = useState(0);
  const [totalAdvancesAmount, setTotalAdvancesAmount] = useState(0);
  const [page, setPage] = useState(1);

  // Ledger Summary State
  const [driverSummaries, setDriverSummaries] = useState<DriverAdvanceSummary[]>([]);
  const [ledgerGrandTotals, setLedgerGrandTotals] = useState({
    total_advance_given: 0,
    total_trip_advance_used: 0,
    total_expenses_reported: 0,
    remaining_advance_balance: 0,
    balance_in_hand: 0,
    settlement_net_balance: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Expand state in Ledger view
  const [expandedDriverId, setExpandedDriverId] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<{
    [driverId: number]: {
      advances: DriverAdvance[];
      trips: Trip[];
      loading: boolean;
    };
  }>({});
  const [expandedTab, setExpandedTab] = useState<{ [driverId: number]: 'advances' | 'trips' }>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingDriverId, setPrintingDriverId] = useState<number | null>(null);
  const [downloadingDriverId, setDownloadingDriverId] = useState<number | null>(null);

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<DriverAdvance | null>(null);
  const [formData, setFormData] = useState({
    driver_id: '',
    manager_id: '',
    vehicle_id: '',
    amount: '',
    advance_date: new Date().toISOString().split('T')[0],
    payment_mode: 'CASH',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (activeView === 'ledger') {
      loadLedgerSummary();
    } else {
      loadAdvances();
    }
  }, [activeView, page, search, driverFilter, managerFilter, vehicleFilter, paymentModeFilter, fromDate, toDate]);

  // Window focus & background polling for instant live updates
  useEffect(() => {
    const onFocus = () => {
      if (activeView === 'ledger') loadLedgerSummary();
      else loadAdvances();
    };
    window.addEventListener('focus', onFocus);
    const timer = setInterval(() => {
      if (activeView === 'ledger') loadLedgerSummary();
    }, 15000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(timer);
    };
  }, [activeView, driverFilter, search]);

  const loadLookups = async () => {
    try {
      const [dRes, vRes, uRes] = await Promise.all([
        driverService.getDrivers({ limit: 500, status: 'ACTIVE' }),
        vehicleService.getVehicles({ limit: 500, status: 'ACTIVE' }),
        userService.getUsers({ limit: 200, status: 'ACTIVE' }),
      ]);
      setDrivers(dRes.data.items || (Array.isArray(dRes.data) ? dRes.data : []));
      setVehicles(vRes.data.items || (Array.isArray(vRes.data) ? vRes.data : []));
      setManagers(uRes.data.items || []);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  const loadAdvances = async () => {
    try {
      setIsLoading(true);
      const res = await driverAdvanceService.getDriverAdvances({
        page,
        limit: 10,
        search: search || undefined,
        driver_id: driverFilter || undefined,
        manager_id: managerFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        payment_mode: paymentModeFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setAdvances(res.data.items || []);
      setTotalAdvancesCount(res.data.total || 0);
      setTotalAdvancesAmount(res.data.totalAmount || 0);
    } catch (err) {
      console.error('Failed to load driver advances', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLedgerSummary = async () => {
    try {
      setIsLoading(true);
      const res = await driverAdvanceService.getDriverSummary({
        driver_id: driverFilter || undefined,
        search: search || undefined,
      });
      setDriverSummaries(res.data.drivers || []);
      setLedgerGrandTotals(
        res.data.grand_totals || {
          total_advance_given: 0,
          total_trip_advance_used: 0,
          total_expenses_reported: 0,
          remaining_advance_balance: 0,
          balance_in_hand: 0,
          settlement_net_balance: 0,
        }
      );
    } catch (err) {
      console.error('Failed to load driver ledger summary', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleExpandDriver = async (driverId: number) => {
    if (expandedDriverId === driverId) {
      setExpandedDriverId(null);
      return;
    }
    setExpandedDriverId(driverId);

    if (!expandedDetails[driverId]) {
      setExpandedDetails((prev) => ({
        ...prev,
        [driverId]: { advances: [], trips: [], loading: true },
      }));

      try {
        const [advRes, tripRes] = await Promise.all([
          driverAdvanceService.getDriverAdvances({ driver_id: String(driverId), limit: 100 }),
          tripService.getTrips({ driver_id: String(driverId), limit: 100 }),
        ]);

        setExpandedDetails((prev) => ({
          ...prev,
          [driverId]: {
            advances: advRes.data?.items || [],
            trips: tripRes.data?.items || [],
            loading: false,
          },
        }));
      } catch (err) {
        console.error('Failed to load driver expand details', err);
        setExpandedDetails((prev) => ({
          ...prev,
          [driverId]: { advances: [], trips: [], loading: false },
        }));
      }
    }
  };

  const handleOpenCreate = (prefillDriverId?: number) => {
    setEditingAdvance(null);
    setFormData({
      driver_id: prefillDriverId ? String(prefillDriverId) : '',
      manager_id: '',
      vehicle_id: '',
      amount: '',
      advance_date: new Date().toISOString().split('T')[0],
      payment_mode: 'CASH',
      notes: '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (adv: DriverAdvance) => {
    setEditingAdvance(adv);
    setFormData({
      driver_id: String(adv.driver_id),
      manager_id: String(adv.manager_id),
      vehicle_id: adv.vehicle_id ? String(adv.vehicle_id) : '',
      amount: String(adv.amount),
      advance_date: adv.advance_date ? adv.advance_date.slice(0, 10) : new Date().toISOString().split('T')[0],
      payment_mode: adv.payment_mode || 'CASH',
      notes: adv.notes || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.driver_id) {
      setFormError('Please select a driver.');
      return;
    }
    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid advance amount greater than 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');

      if (editingAdvance) {
        await driverAdvanceService.updateDriverAdvance(editingAdvance.id, {
          driver_id: parseInt(formData.driver_id),
          manager_id: formData.manager_id ? parseInt(formData.manager_id) : undefined,
          vehicle_id: formData.vehicle_id ? parseInt(formData.vehicle_id) : undefined,
          amount: numAmount,
          advance_date: formData.advance_date,
          payment_mode: formData.payment_mode,
          notes: formData.notes,
        });
      } else {
        await driverAdvanceService.createDriverAdvance({
          driver_id: parseInt(formData.driver_id),
          manager_id: formData.manager_id ? parseInt(formData.manager_id) : undefined,
          vehicle_id: formData.vehicle_id ? parseInt(formData.vehicle_id) : undefined,
          amount: numAmount,
          advance_date: formData.advance_date,
          payment_mode: formData.payment_mode,
          notes: formData.notes,
        });
      }

      setIsModalOpen(false);
      // Clear expand cache for this driver so fresh data loads
      if (formData.driver_id) {
        setExpandedDetails((prev) => {
          const updated = { ...prev };
          delete updated[parseInt(formData.driver_id)];
          return updated;
        });
      }

      if (activeView === 'ledger') {
        loadLedgerSummary();
      } else {
        loadAdvances();
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Failed to save driver advance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this driver advance record?')) return;
    try {
      await driverAdvanceService.deleteDriverAdvance(id);
      if (activeView === 'ledger') {
        loadLedgerSummary();
      } else {
        loadAdvances();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete record.');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setDriverFilter('');
    setManagerFilter('');
    setVehicleFilter('');
    setPaymentModeFilter('');
    setFromDate('');
    setToDate('');
    setStatusFilter('');
    setPage(1);
  };

  // Filtered summaries for the master ledger table
  const filteredSummaries = useMemo(() => {
    return driverSummaries.filter((d) => {
      if (statusFilter) {
        const bal = Math.max(0, parseFloat(String(d.balance_in_hand ?? 0)));
        const st = d.settlement_status || (bal > 0 ? 'CASH_IN_HAND' : 'SETTLED');
        if (statusFilter === 'CASH_IN_HAND') {
          if (bal <= 0 && st !== 'CASH_IN_HAND') return false;
        } else if (statusFilter === 'SETTLED') {
          if (st !== 'SETTLED') return false;
        } else if (statusFilter === 'PENDING') {
          if (st !== 'PENDING' && st !== 'VERIFIED') return false;
        }
      }
      if (vehicleFilter) {
        const selectedVeh = vehicles.find((v) => String(v.id) === String(vehicleFilter));
        if (selectedVeh && d.lorry_number !== selectedVeh.lorry_number) {
          return false;
        }
      }
      return true;
    });
  }, [driverSummaries, statusFilter, vehicleFilter, vehicles]);

  // Dynamic totals for the master ledger table based on filtered items
  const filteredTotals = useMemo(() => {
    return filteredSummaries.reduce(
      (acc, d) => ({
        total_advance_given: acc.total_advance_given + (parseFloat(String(d.total_advance_given)) || 0),
        advance_count: acc.advance_count + (parseInt(String(d.advance_count)) || 0),
        total_expenses_reported: acc.total_expenses_reported + (parseFloat(String(d.total_expenses_reported)) || 0),
        trip_count: acc.trip_count + (parseInt(String(d.trip_count)) || 0),
        balance_in_hand: acc.balance_in_hand + Math.max(0, parseFloat(String(d.balance_in_hand)) || 0),
      }),
      {
        total_advance_given: 0,
        advance_count: 0,
        total_expenses_reported: 0,
        trip_count: 0,
        balance_in_hand: 0,
      }
    );
  }, [filteredSummaries]);

  // Clean status badge component for the master ledger table
  const renderDriverStatusBadge = (d: DriverAdvanceSummary) => {
    const bal = Math.max(0, parseFloat(String(d.balance_in_hand ?? 0)));
    const status = d.settlement_status || (bal > 0 ? 'CASH_IN_HAND' : 'SETTLED');

    if (status === 'PENDING') {
      return (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: 700,
            background: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fcd34d',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          ⏳ Settlement Pending
        </span>
      );
    }

    if (status === 'VERIFIED') {
      return (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: 700,
            background: '#ede9fe',
            color: '#6d28d9',
            border: '1px solid #c4b5fd',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          🔍 Verified (Pending)
        </span>
      );
    }

    if (status === 'SETTLED') {
      return (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: 700,
            background: '#dcfce7',
            color: '#15803d',
            border: '1px solid #86efac',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          ✓ Settled
        </span>
      );
    }

    return (
      <span
        style={{
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '11px',
          fontWeight: 700,
          background: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap',
        }}
      >
        💵 Cash in Hand
      </span>
    );
  };


  const getOrFetchDriverDetails = async (driverId: number): Promise<{ advances: DriverAdvance[]; trips: Trip[] }> => {
    if (expandedDetails[driverId] && !expandedDetails[driverId].loading) {
      return {
        advances: expandedDetails[driverId].advances || [],
        trips: expandedDetails[driverId].trips || [],
      };
    }
    try {
      const [advRes, tripRes] = await Promise.all([
        driverAdvanceService.getDriverAdvances({ driver_id: String(driverId), limit: 200 }),
        tripService.getTrips({ driver_id: String(driverId), limit: 200 }),
      ]);
      const advs: DriverAdvance[] = advRes.data?.items || [];
      const trps: Trip[] = tripRes.data?.items || [];
      setExpandedDetails((prev) => ({
        ...prev,
        [driverId]: { advances: advs, trips: trps, loading: false },
      }));
      return { advances: advs, trips: trps };
    } catch (err) {
      console.error('Failed to fetch driver details', err);
      return { advances: [], trips: [] };
    }
  };

  // ── Single Driver Statement: Download Excel ────────────────────────
  const handleDownloadSingleDriverExcel = async (d: DriverAdvanceSummary) => {
    try {
      setDownloadingDriverId(d.driver_id);
      const { advances, trips } = await getOrFetchDriverDetails(d.driver_id);

      const totalAdv = parseFloat(String(d.total_advance_given || 0));
      const totalExp = parseFloat(String(d.total_expenses_reported || 0));
      const balInHand = Math.max(0, parseFloat(String(d.balance_in_hand ?? (totalAdv - totalExp))));

      const wb = XLSX.utils.book_new();

      // Sheet 2: Itemized Advances Disbursed
      const advRows: any[] = advances.map((a, i) => ({
        'S.No': i + 1,
        'Advance ID': `#ADV-${a.id}`,
        'Date & Time (IST)': formatAdvanceDateTime(a.advance_date, a.created_at),
        'Disbursed By (Manager)': a.manager_name,
        'Vehicle / Lorry': a.lorry_number || '—',
        'Payment Mode': a.payment_mode || 'CASH',
        'Amount (₹)': parseFloat(String(a.amount || 0)),
        'Notes / Remarks': a.notes || '—',
      }));
      advRows.push({});
      advRows.push({
        'S.No': 'TOTAL',
        'Advance ID': `${advances.length} Disbursements`,
        'Date & Time (IST)': '',
        'Disbursed By (Manager)': '',
        'Vehicle / Lorry': '',
        'Payment Mode': '',
        'Amount (₹)': advances.reduce((s, a) => s + (parseFloat(String(a.amount || 0)) || 0), 0),
        'Notes / Remarks': '',
      });
      const advWs = XLSX.utils.json_to_sheet(advRows);
      advWs['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 28 }];
      XLSX.utils.book_append_sheet(wb, advWs, 'Advances Given');

      // Sheet 3: Trips & Expenses
      const sortedTripsForExcel = [...trips].sort((a, b) => {
        const dateA = new Date(a.trip_date || 0).getTime();
        const dateB = new Date(b.trip_date || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return (a.id || 0) - (b.id || 0);
      });
      const directAdvExcel = (advances || [])
        .filter((adv) => !adv.trip_id)
        .reduce((sum, adv) => sum + (parseFloat(String(adv.amount)) || 0), 0);
      let rbExcel = directAdvExcel;
      const tripBalExcelMap = new Map<number, number>();
      sortedTripsForExcel.forEach((t) => {
        const a = parseFloat(String(t.advance_paid || 0));
        const e = parseFloat(String(t.total_expenses ?? 0)) || 0;
        rbExcel = Math.round((rbExcel + a - e) * 100) / 100;
        tripBalExcelMap.set(t.id, Math.max(0, rbExcel));
        if (rbExcel < 0) rbExcel = 0;
      });

      const tripRows: any[] = trips.map((t, i) => ({
        'S.No': i + 1,
        'Trip ID': `#TRIP-${t.id}`,
        'Trip Date': formatISTDate(t.trip_date),
        'Vehicle / Lorry': t.lorry_number || '—',
        'Party': t.party_name || '—',
        'Route': t.from_location && t.to_location ? `${t.from_location} → ${t.to_location}` : '—',
        'Goods Weight': t.goods_weight ? `${t.goods_weight} ${t.unit_abbreviation || 'MT'}` : '—',
        'Total Freight (₹)': parseFloat(String(t.total_freight || 0)),
        'Trip Advance Paid (₹)': parseFloat(String(t.advance_paid || 0)),
        'Trip Expenses Incurred (₹)': parseFloat(String(t.total_expenses || 0)),
        'Driver Balance (₹)': tripBalExcelMap.get(t.id) ?? 0,
        'Status': (t as any).settlement_status === 'SETTLED' ? 'Settled' : (t as any).settlement_status === 'PENDING' ? 'Settlement Pending' : (t as any).settlement_status === 'VERIFIED' ? 'Verified (Pending)' : ((tripBalExcelMap.get(t.id) ?? 0) > 0 ? 'Cash in Hand' : 'Settled'),
      }));
      tripRows.push({});
      tripRows.push({
        'S.No': 'TOTAL',
        'Trip ID': `${trips.length} Trips`,
        'Trip Date': '',
        'Vehicle / Lorry': '',
        'Party': '',
        'Route': '',
        'Goods Weight': '',
        'Total Freight (₹)': trips.reduce((s, t) => s + (parseFloat(String(t.total_freight || 0)) || 0), 0),
        'Trip Advance Paid (₹)': trips.reduce((s, t) => s + (parseFloat(String(t.advance_paid || 0)) || 0), 0),
        'Trip Expenses Incurred (₹)': trips.reduce((s, t) => s + (parseFloat(String(t.total_expenses || 0)) || 0), 0),
        'Driver Balance (₹)': sortedTripsForExcel.length > 0 ? (tripBalExcelMap.get(sortedTripsForExcel[sortedTripsForExcel.length - 1]?.id) ?? 0) : 0,
        'Status': '',
      });
      const tripWs = XLSX.utils.json_to_sheet(tripRows);
      tripWs['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, tripWs, 'Trips & Expenses');

      const safeDriver = d.driver_name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      XLSX.writeFile(wb, `KSP_Driver_Statement_${safeDriver}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      alert(err.message || 'Failed to download driver statement.');
    } finally {
      setDownloadingDriverId(null);
    }
  };

  // ── Single Driver Statement: Print / Save as PDF ───────────────────
  const handlePrintSingleDriverStatement = async (d: DriverAdvanceSummary) => {
    try {
      setPrintingDriverId(d.driver_id);
      const { advances, trips } = await getOrFetchDriverDetails(d.driver_id);

      const totalAdv = parseFloat(String(d.total_advance_given || 0));
      const totalExp = parseFloat(String(d.total_expenses_reported || 0));
      const balInHand = Math.max(0, parseFloat(String(d.balance_in_hand ?? (totalAdv - totalExp))));

      const totalAdvSum = advances.reduce((s, a) => s + (parseFloat(String(a.amount || 0)) || 0), 0);
      const totalExpSum = trips.reduce((s, t) => s + (parseFloat(String(t.total_expenses || 0)) || 0), 0);

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>KSP Driver Statement - ${d.driver_name}</title>
      <style>
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:24px;color:#1e293b;background:#fff;font-size:11.5px}
        @page{size:portrait;margin:10mm}
        .statement-box{border:2px solid #0f172a;border-radius:8px;padding:20px;max-width:850px;margin:0 auto}
        .s-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:14px}
        .s-title{font-size:22px;font-weight:800;color:#0f172a;margin:0 0 2px}
        .s-subtitle{font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;margin:0;letter-spacing:.5px}
        .tag-v{background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:6px;font-weight:800;font-size:13px;border:1px solid #bfdbfe;display:inline-block}
        .tag-t{margin-top:4px;font-weight:700;color:#4338ca;font-size:12px;text-align:right}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
        .card-b{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px}
        .lbl{font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:2px}
        .val{font-size:14px;font-weight:800;color:#0f172a}
        .sec-title{font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.5px;margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid #cbd5e1}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;margin-bottom:12px}
        th,td{padding:6px 8px;border:1px solid #cbd5e1}
        th{background:#0f172a;color:#fff;font-weight:700;text-align:left}
        .num{text-align:right}
        .center{text-align:center}
        .recon-box{background:#f8fafc;border:2px solid #0f172a;border-radius:6px;padding:12px 16px;margin-top:16px}
        .recon-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
        .recon-total{border-top:2px solid #0f172a;padding-top:6px;margin-top:4px;font-size:14px;font-weight:800}
        .sig-row{display:flex;justify-content:space-between;margin-top:40px;padding-top:10px}
        .sig-line{text-align:center;width:170px}
        .sig-box{border-top:1px solid #64748b;padding-top:4px;font-size:10.5px;font-weight:700;color:#475569}
        .pbar{display:flex;justify-content:flex-end;gap:10px;max-width:850px;margin:0 auto 14px auto}
        .btn-p{background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px}
        @media print{.pbar{display:none!important};body{padding:0}}
      </style></head><body>
      <div class="pbar">
        <button class="btn-p" onclick="window.print()">Print / Save as PDF</button>
        <button class="btn-p" style="background:#64748b" onclick="window.close()">Close</button>
      </div>
      <div class="statement-box">
        <div class="s-header">
          <div>
            <h1 class="s-title">KSP TRANSPORT &amp; LOGISTICS</h1>
            <div class="s-subtitle">Driver Advance &amp; Trip Expense Statement</div>
            <div style="font-size:11px;color:#64748b;margin-top:3px">KSP Service Management ERP</div>
          </div>
          <div style="text-align:right">
            <div class="tag-v">DRIVER #${d.driver_id}</div>
            <div class="tag-t">Generated: ${formatIST(new Date())}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card-b">
            <div class="lbl">Driver Profile</div>
            <div class="val">${d.driver_name}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px">Mobile: ${d.driver_mobile || '—'}</div>
            <div style="font-size:11px;color:#475569">License: ${d.driver_license || '—'}</div>
            <div class="lbl" style="margin-top:8px">Assigned Truck</div>
            <div style="font-weight:800;color:#0369a1;font-size:13px">🚛 ${d.lorry_number || 'No Vehicle Assigned'}</div>
          </div>
          <div class="card-b">
            <div class="lbl">Current / Active Trip Assignment</div>
            <div class="val" style="color:${d.is_active_trip ? '#c2410c' : '#475569'}">
              ${d.trip_id ? `TRIP #${d.trip_id} ${d.is_active_trip ? '(ACTIVE)' : '(LAST)'}` : 'No Active Trip'}
            </div>
            <div style="font-size:11px;color:#475569;margin-top:2px">Party: ${d.party_name || '—'}</div>
            <div style="font-size:11px;color:#475569">Route: ${d.from_location && d.to_location ? `${d.from_location} → ${d.to_location}` : '—'}</div>
            ${d.total_freight ? `<div style="font-size:11.5px;color:#1d4ed8;font-weight:800;margin-top:3px">Total Freight: ₹${parseFloat(String(d.total_freight)).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${d.goods_weight ? `(${d.goods_weight} ${d.unit_abbreviation || 'MT'})` : ''}</div>` : ''}
            <div class="lbl" style="margin-top:8px">Statement Date</div>
            <div style="font-weight:700;color:#1e293b;font-size:12px">${formatISTDate(new Date())}</div>
          </div>
        </div>

        <div class="sec-title">1. Itemized Advance Disbursements (Manager → Driver)</div>
        ${advances.length === 0 ? `
          <div style="padding:10px;text-align:center;color:#94a3b8;border:1px dashed #cbd5e1;border-radius:4px">No advance records found for this driver.</div>
        ` : `
          <table>
            <thead><tr>
              <th class="center" style="width:30px">#</th>
              <th>Date &amp; Time (IST)</th>
              <th>Disbursed By (Manager)</th>
              <th>Vehicle / Lorry</th>
              <th class="center">Mode</th>
              <th class="num" style="width:110px">Amount (₹)</th>
              <th>Notes / Remarks</th>
            </tr></thead>
            <tbody>
              ${advances.map((a, i) => `
                <tr>
                  <td class="center">${i + 1}</td>
                  <td>${formatAdvanceDateTime(a.advance_date, a.created_at)}</td>
                  <td><strong>${a.manager_name}</strong></td>
                  <td>${a.lorry_number || '—'}</td>
                  <td class="center">${a.payment_mode || 'CASH'}</td>
                  <td class="num" style="font-weight:700;color:#15803d">₹${(parseFloat(String(a.amount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>${a.notes || '—'}</td>
                </tr>
              `).join('')}
              <tr style="background:#f1f5f9;font-weight:800;border-top:2px solid #0f172a">
                <td colspan="5" class="num">TOTAL ADVANCE GIVEN TO ${d.driver_name}:</td>
                <td class="num" style="color:#15803d;font-size:12px">₹${totalAdvSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        `}

        <div class="sec-title" style="margin-top:16px">2. Trip History &amp; Driver Expenses Settled</div>
        ${trips.length === 0 ? `
          <div style="padding:10px;text-align:center;color:#94a3b8;border:1px dashed #cbd5e1;border-radius:4px">No trip records found for this driver.</div>
        ` : `
          <table>
            <thead><tr>
              <th class="center" style="width:30px">#</th>
              <th>Trip ID</th>
              <th>Trip Date</th>
              <th>Vehicle</th>
              <th>Party &amp; Route</th>
              <th class="num">Trip Adv. (₹)</th>
              <th class="num">Driver Exp. (₹)</th>
              <th class="num">Trip Bal. (₹)</th>
              <th class="center">Status</th>
            </tr></thead>
            <tbody>
              ${(() => {
                const sortedTripsForPrint = [...trips].sort((a, b) => {
                  const dateA = new Date(a.trip_date || 0).getTime();
                  const dateB = new Date(b.trip_date || 0).getTime();
                  if (dateA !== dateB) return dateA - dateB;
                  return (a.id || 0) - (b.id || 0);
                });
                const directAdvPrint = (advances || [])
                  .filter((adv) => !adv.trip_id)
                  .reduce((sum, adv) => sum + (parseFloat(String(adv.amount)) || 0), 0);
                let rbPrint = directAdvPrint;
                const tripBalPrintMap = new Map<number, number>();
                sortedTripsForPrint.forEach((t) => {
                  const a = parseFloat(String(t.advance_paid || 0));
                  const e = parseFloat(String(t.total_expenses ?? 0)) || 0;
                  rbPrint = Math.round((rbPrint + a - e) * 100) / 100;
                  tripBalPrintMap.set(t.id, Math.max(0, rbPrint));
                  if (rbPrint < 0) rbPrint = 0;
                });

                return trips.map((t, i) => {
                  const trBal = tripBalPrintMap.get(t.id) ?? 0;
                  return `
                  <tr>
                    <td class="center">${i + 1}</td>
                    <td><strong>TRIP-${t.id}</strong></td>
                    <td>${formatISTDate(t.trip_date)}</td>
                    <td>${t.lorry_number || '—'}</td>
                    <td>${t.party_name || '—'} ${t.to_location ? `(${t.to_location})` : ''}</td>
                    <td class="num">₹${(parseFloat(String(t.advance_paid || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td class="num" style="font-weight:700;color:#b45309">₹${(parseFloat(String(t.total_expenses || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td class="num" style="font-weight:700;color:${trBal > 0 ? '#1d4ed8' : '#16a34a'}">₹${trBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td class="center"><span style="font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:4px;background:${
                      (t as any).settlement_status === 'PENDING' ? '#fef3c7' : (t as any).settlement_status === 'VERIFIED' ? '#ede9fe' : (t as any).settlement_status === 'SETTLED' ? '#dcfce7' : trBal > 0 ? '#eff6ff' : '#dcfce7'
                    };color:${
                      (t as any).settlement_status === 'PENDING' ? '#b45309' : (t as any).settlement_status === 'VERIFIED' ? '#6d28d9' : (t as any).settlement_status === 'SETTLED' ? '#166534' : trBal > 0 ? '#1d4ed8' : '#166534'
                    }">${
                      (t as any).settlement_status === 'PENDING' ? '⏳ Pending' : (t as any).settlement_status === 'VERIFIED' ? '🔍 Verified' : (t as any).settlement_status === 'SETTLED' ? '✓ Settled' : trBal > 0 ? 'Cash in Hand' : 'Settled'
                    }</span></td>
                  </tr>
                `;}).join('') + `
                <tr style="background:#f1f5f9;font-weight:800;border-top:2px solid #0f172a">
                  <td colspan="6" class="num">TOTAL TRIP EXPENSES INCURRED:</td>
                  <td class="num" style="color:#b45309;font-size:12px">₹${totalExpSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="num" style="color:#1d4ed8;font-size:12px;font-weight:800">₹${(sortedTripsForPrint.length > 0 ? (tripBalPrintMap.get(sortedTripsForPrint[sortedTripsForPrint.length - 1]?.id) ?? 0) : 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
                `;
              })()}
            </tbody>
          </table>
        `}

        <div class="recon-box">
          <div style="font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Balance in Hand Reconciliation</div>
          <div class="recon-row">
            <span>Total Advances Received by Driver</span>
            <span style="font-weight:700;color:#15803d">₹${totalAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="recon-row">
            <span>Less: Total Actual Trip Expenses Accounted</span>
            <span style="font-weight:700;color:#b45309">(-) ₹${totalExp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="recon-row recon-total">
            <span style="color:${balInHand >= 0 ? '#1d4ed8' : '#b91c1c'}">
              ${balInHand >= 0 ? 'NET CASH BALANCE CURRENTLY HELD IN HAND' : 'NET DEFICIT RECOVERABLE FROM DRIVER'}
            </span>
            <span style="color:${balInHand >= 0 ? '#1d4ed8' : '#b91c1c'}">₹${balInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:4px">
            Amount in Words: <em>${numberToWords(balInHand)}</em>
          </div>
        </div>

        <div class="sig-row">
          <div class="sig-line">
            <div style="height:32px"></div>
            <div class="sig-box">Driver (${d.driver_name})</div>
          </div>
          <div class="sig-line">
            <div style="height:32px"></div>
            <div class="sig-box">Disbursing Manager</div>
          </div>
          <div class="sig-line">
            <div style="height:32px"></div>
            <div class="sig-box">Authorized Signatory / Accounts</div>
          </div>
        </div>
      </div>
      </body></html>`;

      const win = window.open('', '_blank', 'width=900,height=880');
      if (!win) { alert('Allow popups to print statement.'); return; }
      win.document.open(); win.document.write(html); win.document.close();
    } catch (err: any) {
      alert(err.message || 'Failed to print driver statement.');
    } finally {
      setPrintingDriverId(null);
    }
  };

  // ── Single Advance Disbursement Voucher: Download Excel ───────────
  const handleDownloadSingleAdvanceExcel = (a: DriverAdvance) => {
    try {
      const advAmount = parseFloat(String(a.amount || 0));
      const balInHand = parseFloat(String(a.driver_balance_in_hand ?? 0));

      const rows = [
        { Detail: 'VOUCHER / RECORD ID', Value: `#ADV-${a.id}` },
        { Detail: 'DISBURSEMENT DATE & TIME (IST)', Value: formatAdvanceDateTime(a.advance_date, a.created_at) },
        { Detail: 'DRIVER NAME', Value: a.driver_name },
        { Detail: 'DRIVER MOBILE', Value: a.driver_mobile || '—' },
        { Detail: 'DRIVER LICENSE', Value: a.driver_license || '—' },
        { Detail: 'ASSIGNED LORRY NUMBER', Value: a.lorry_number || 'Direct Advance' },
        { Detail: 'TRIP ID', Value: a.trip_id ? `TRIP #${a.trip_id}` : 'Direct Advance (No Trip)' },
        { Detail: 'PARTY NAME', Value: a.party_name || '—' },
        { Detail: 'ROUTE / DESTINATION', Value: a.from_location && a.to_location ? `${a.from_location} → ${a.to_location}` : '—' },
        { Detail: 'DISBURSING MANAGER', Value: a.manager_name },
        { Detail: 'PAYMENT MODE', Value: a.payment_mode || 'CASH' },
        { Detail: 'ADVANCE AMOUNT DISBURSED (₹)', Value: advAmount },
        { Detail: 'AMOUNT IN WORDS', Value: numberToWords(advAmount) },
        { Detail: 'DRIVER CURRENT BALANCE IN HAND (₹)', Value: balInHand },
        { Detail: 'NOTES / REMARKS', Value: a.notes || '—' },
        { Detail: 'RECORD CREATED AT', Value: formatIST(a.created_at) },
      ];

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 38 }, { wch: 45 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Advance_Voucher_${a.id}`);

      const safeDriver = (a.driver_name || 'Driver').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      XLSX.writeFile(wb, `KSP_Advance_Voucher_${a.id}_${safeDriver}.xlsx`);
    } catch (err: any) {
      alert(err.message || 'Failed to download advance voucher.');
    }
  };

  // ── Single Advance Disbursement Voucher: Print / PDF ──────────────
  const handlePrintSingleAdvance = (a: DriverAdvance) => {
    try {
      const advAmount = parseFloat(String(a.amount || 0));
      const balInHand = parseFloat(String(a.driver_balance_in_hand ?? 0));

      const singleHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>KSP Driver Advance Voucher #${a.id} - ${a.driver_name}</title>
      <style>
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:24px;color:#1e293b;background:#fff;font-size:12px}
        @page{size:portrait;margin:12mm}
        .voucher-box{border:2px solid #0f172a;border-radius:8px;padding:22px;max-width:800px;margin:0 auto}
        .v-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px}
        .v-title{font-size:22px;font-weight:800;color:#0f172a;margin:0 0 2px}
        .v-subtitle{font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;margin:0;letter-spacing:.5px}
        .tag-v{background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:6px;font-weight:800;font-size:13px;border:1px solid #bfdbfe;display:inline-block}
        .tag-t{margin-top:4px;font-weight:700;color:#4338ca;font-size:12px;text-align:right}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
        .card-b{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px}
        .lbl{font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:2px}
        .val{font-size:15px;font-weight:800;color:#0f172a}
        .big-card{background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:16px 20px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
        .big-amt{font-size:26px;font-weight:900;color:#15803d}
        .words{font-size:11.5px;color:#166534;font-style:italic;margin-top:4px}
        .sig-row{display:flex;justify-content:space-between;margin-top:45px;padding-top:10px}
        .sig-line{text-align:center;width:170px}
        .sig-box{border-top:1px solid #64748b;padding-top:4px;font-size:11px;font-weight:700;color:#475569}
        .pbar{display:flex;justify-content:flex-end;gap:10px;max-width:800px;margin:0 auto 16px auto}
        .btn-p{background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px}
        @media print{.pbar{display:none!important};body{padding:0}}
      </style></head><body>
      <div class="pbar">
        <button class="btn-p" onclick="window.print()">Print / Save as PDF</button>
        <button class="btn-p" style="background:#64748b" onclick="window.close()">Close</button>
      </div>
      <div class="voucher-box">
        <div class="v-header">
          <div>
            <h1 class="v-title">KSP TRANSPORT &amp; LOGISTICS</h1>
            <div class="v-subtitle">Driver Advance Disbursement Voucher</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px">KSP Service Management ERP</div>
          </div>
          <div style="text-align:right">
            <div class="tag-v">VOUCHER #${a.id}</div>
            <div class="tag-t">${a.trip_id ? `TRIP #${a.trip_id}` : 'DIRECT DISBURSEMENT'}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card-b">
            <div class="lbl">Driver Details</div>
            <div class="val">${a.driver_name}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px">Mobile: ${a.driver_mobile || '—'}</div>
            <div style="font-size:11px;color:#475569">License: ${a.driver_license || '—'}</div>
            <div class="lbl" style="margin-top:8px">Vehicle / Lorry Number</div>
            <div style="font-weight:800;color:#0369a1;font-size:13px">🚛 ${a.lorry_number || 'Direct Advance (No Vehicle)'}</div>
          </div>
          <div class="card-b">
            <div class="lbl">Disbursement Date &amp; Time (IST)</div>
            <div class="val" style="font-size:14px">${formatAdvanceDateTime(a.advance_date, a.created_at)}</div>
            <div style="font-size:11px;color:#64748b">Created: ${formatIST(a.created_at)}</div>
            <div class="lbl" style="margin-top:8px">Disbursing Manager</div>
            <div style="font-weight:700;color:#1e293b;font-size:13px">${a.manager_name}</div>
            <div style="font-size:11px;color:#475569">Payment Mode: <strong>${a.payment_mode || 'CASH'}</strong></div>
          </div>
        </div>

        <div class="big-card">
          <div>
            <div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.5px">Advance Amount Disbursed</div>
            <div class="big-amt">₹${advAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div class="words">${numberToWords(advAmount)}</div>
          </div>
          <div style="text-align:right;background:#ffffff;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px">
            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase">Driver Balance in Hand</div>
            <div style="font-size:16px;font-weight:800;color:${balInHand >= 0 ? '#1d4ed8' : '#b91c1c'};margin-top:2px">
              ₹${balInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        ${a.trip_id ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase">Associated Trip Information</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <span style="font-weight:800;color:#4338ca">TRIP #${a.trip_id}</span>
            <span style="font-weight:600;color:#0f172a">${a.party_name || '—'}</span>
            <span style="color:#64748b;font-size:11.5px">${a.from_location && a.to_location ? `${a.from_location} → ${a.to_location}` : '—'}</span>
          </div>
        </div>
        ` : ''}

        ${a.notes ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:6px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase">Notes / Purpose:</div>
          <div style="font-size:11.5px;color:#334155;margin-top:2px">${a.notes}</div>
        </div>
        ` : ''}

        <div class="sig-row">
          <div class="sig-line">
            <div style="height:32px"></div>
            <div class="sig-box">Driver (${a.driver_name})</div>
          </div>
          <div class="sig-line">
            <div style="height:32px"></div>
            <div class="sig-box">Manager (${a.manager_name})</div>
          </div>
          <div class="sig-line">
            <div style="height:32px"></div>
            <div class="sig-box">Authorized Signatory</div>
          </div>
        </div>
      </div>
      </body></html>`;

      const win = window.open('', '_blank', 'width=850,height=850');
      if (!win) { alert('Allow popups to print voucher.'); return; }
      win.document.open(); win.document.write(singleHtml); win.document.close();
    } catch (err: any) {
      alert(err.message || 'Failed to print advance voucher.');
    }
  };

  // ── Excel Export ──────────────────────────────────────────────────
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      if (activeView === 'ledger') {
        const rows: any[] = driverSummaries.map((d, i) => ({
          'S.No': i + 1,
          'Driver Name': d.driver_name,
          'Mobile': d.driver_mobile || '—',
          'License': d.driver_license || '—',
          'Assigned Lorry': d.lorry_number || '—',
          'Trip # (Current)': d.trip_id ? `TRIP-${d.trip_id}` : '—',
          'Trip Date': d.trip_date ? new Date(d.trip_date).toLocaleDateString('en-IN') : '—',
          'Trip Status': d.trip_status || '—',
          'Party': d.party_name || '—',
          'Route': d.from_location && d.to_location ? `${d.from_location} → ${d.to_location}` : '—',
          'Goods Weight': d.goods_weight ? `${d.goods_weight} ${d.unit_abbreviation || 'MT'}` : '—',
          'Trip Total Freight (₹)': d.total_freight ? parseFloat(String(d.total_freight)) : 0,
          'Total Advances Given (₹)': parseFloat(String(d.total_advance_given)) || 0,
          'Advance Count': d.advance_count,
          'Trip Expenses Reported (₹)': parseFloat(String(d.total_expenses_reported)) || 0,
          'Trip Count': d.trip_count,
          'Balance in Hand (₹)': Math.max(0, parseFloat(String(d.balance_in_hand)) || 0),
          'Status': Math.max(0, parseFloat(String(d.balance_in_hand)) || 0) > 0 ? 'Cash in Hand' : 'Settled',
        }));

        rows.push({});
        rows.push({
          'S.No': 'TOTAL',
          'Driver Name': `${driverSummaries.length} Drivers`,
          'Mobile': '',
          'License': '',
          'Assigned Lorry': '',
          'Trip # (Current)': '',
          'Trip Date': '',
          'Trip Status': '',
          'Party': '',
          'Route': '',
          'Total Advances Given (₹)': ledgerGrandTotals.total_advance_given,
          'Advance Count': '',
          'Trip Expenses Reported (₹)': ledgerGrandTotals.total_expenses_reported,
          'Trip Count': '',
          'Balance in Hand (₹)': ledgerGrandTotals.balance_in_hand,
          'Status': '',
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 18 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Driver Advance Ledger');

        const sumRows = [
          { Field: 'Report', Value: 'Driver Advance Ledger & Live Balances' },
          { Field: 'Total Drivers', Value: driverSummaries.length },
          { Field: 'Total Advances Disbursed (₹)', Value: ledgerGrandTotals.total_advance_given },
          { Field: 'Total Trip Expenses Reported (₹)', Value: ledgerGrandTotals.total_expenses_reported },
          { Field: 'Net Balance in Hand (₹)', Value: ledgerGrandTotals.balance_in_hand },
          { Field: 'Export Time', Value: new Date().toLocaleString('en-IN') },
        ];
        const sumWs = XLSX.utils.json_to_sheet(sumRows);
        sumWs['!cols'] = [{ wch: 32 }, { wch: 36 }];
        XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');

        XLSX.writeFile(wb, `KSP_Driver_Advance_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else {
        const res = await driverAdvanceService.getDriverAdvances({
          page: 1,
          limit: 5000,
          search: search || undefined,
          driver_id: driverFilter || undefined,
          manager_id: managerFilter || undefined,
          vehicle_id: vehicleFilter || undefined,
          payment_mode: paymentModeFilter || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        });
        const items = res.data.items || [];
        const totalSum = items.reduce((s, a) => s + (parseFloat(String(a.amount)) || 0), 0);

        const rows: any[] = items.map((a, i) => ({
          'S.No': i + 1,
          'Date': formatISTDate(a.advance_date),
          'Driver Name': a.driver_name,
          'Driver Mobile': a.driver_mobile || '—',
          'Manager Name': a.manager_name,
          'Assigned Lorry': a.lorry_number || '—',
          'Trip #': a.trip_id ? `TRIP-${a.trip_id}` : '—',
          'Party': a.party_name || '—',
          'Route': a.from_location && a.to_location ? `${a.from_location} → ${a.to_location}` : '—',
          'Trip Status': a.trip_status || '—',
          'Type': a.source_type === 'TRIP_TRUCK_ADVANCE' ? 'Trip Advance' : 'Direct Advance',
          'Payment Mode': a.payment_mode || 'CASH',
          'Amount (₹)': parseFloat(String(a.amount)) || 0,
          'Balance in Hand (₹)': parseFloat(String(a.driver_balance_in_hand ?? 0)) || 0,
          'Notes': a.notes || '',
          'Created At': formatIST(a.created_at),
        }));

        rows.push({});
        rows.push({
          'S.No': 'TOTAL',
          'Date': `${items.length} Advances`,
          'Driver Name': '',
          'Driver Mobile': '',
          'Manager Name': '',
          'Assigned Lorry': '',
          'Trip #': '',
          'Party': '',
          'Route': '',
          'Trip Status': '',
          'Type': '',
          'Payment Mode': '',
          'Amount (₹)': totalSum,
          'Balance in Hand (₹)': '',
          'Notes': '',
          'Created At': '',
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 26 }, { wch: 14 }, { wch: 15 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Driver Advances');

        const sumRows = [
          { Field: 'Report', Value: 'Driver Advance Transactions' },
          { Field: 'Total Records', Value: items.length },
          { Field: 'Total Disbursed (₹)', Value: totalSum },
          { Field: 'Export Time', Value: new Date().toLocaleString('en-IN') },
        ];
        const sumWs = XLSX.utils.json_to_sheet(sumRows);
        sumWs['!cols'] = [{ wch: 30 }, { wch: 36 }];
        XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');

        XLSX.writeFile(wb, `KSP_Driver_Advance_Transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
      }
    } catch (err) {
      alert('Failed to export Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setIsExportingCSV(true);
      if (activeView === 'ledger') {
        const items = driverSummaries;
        if (items.length === 0) {
          alert('No driver ledger records to export.');
          return;
        }

        const headers = [
          'S.No',
          'Driver Name',
          'Mobile',
          'License',
          'Lorry Number',
          'Trip ID',
          'Party Name',
          'From Location',
          'To Location',
          'Total Advance Given (INR)',
          'Advance Count',
          'Trip Expenses Reported (INR)',
          'Trip Count',
          'Balance in Hand (INR)',
          'Settlement Status',
        ];

        const rows = items.map((d, idx) => {
          const bal = Math.max(0, parseFloat(String(d.balance_in_hand ?? 0)));
          return [
            idx + 1,
            `"${(d.driver_name || '').replace(/"/g, '""')}"`,
            `"${d.driver_mobile || ''}"`,
            `"${d.driver_license || ''}"`,
            `"${d.lorry_number || ''}"`,
            d.trip_id ? `TRIP-${d.trip_id}` : '',
            `"${(d.party_name || '').replace(/"/g, '""')}"`,
            `"${(d.from_location || '').replace(/"/g, '""')}"`,
            `"${(d.to_location || '').replace(/"/g, '""')}"`,
            parseFloat(String(d.total_advance_given || 0)) || 0,
            d.advance_count || 0,
            parseFloat(String(d.total_expenses_reported || 0)) || 0,
            d.trip_count || 0,
            bal,
            `"${d.settlement_status || (bal > 0 ? 'CASH_IN_HAND' : 'SETTLED')}"`,
          ];
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `KSP_Driver_Advance_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const res = await driverAdvanceService.getDriverAdvances({
          search: search || undefined,
          driver_id: driverFilter || undefined,
          manager_id: managerFilter || undefined,
          vehicle_id: vehicleFilter || undefined,
          payment_mode: paymentModeFilter || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          limit: 10000,
        });

        const items: DriverAdvance[] = res.data?.items || [];
        if (items.length === 0) {
          alert('No driver advance transactions to export.');
          return;
        }

        const headers = [
          'S.No',
          'Date',
          'Driver Name',
          'Mobile',
          'Manager Name',
          'Lorry Number',
          'Trip ID',
          'Payment Mode',
          'Advance Amount (INR)',
          'Notes',
        ];

        const rows = items.map((a, idx) => [
          idx + 1,
          `"${formatISTDate(a.advance_date)}"`,
          `"${(a.driver_name || '').replace(/"/g, '""')}"`,
          `"${a.driver_mobile || ''}"`,
          `"${(a.manager_name || '').replace(/"/g, '""')}"`,
          `"${a.lorry_number || ''}"`,
          a.trip_id ? `TRIP-${a.trip_id}` : '',
          `"${a.payment_mode || 'CASH'}"`,
          parseFloat(String(a.amount || 0)) || 0,
          `"${(a.notes || '').replace(/"/g, '""')}"`,
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `KSP_Driver_Advance_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      alert('Failed to export CSV.');
    } finally {
      setIsExportingCSV(false);
    }
  };

  // ── Print Report ──────────────────────────────────────────────────
  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      if (activeView === 'ledger') {
        const items = driverSummaries;
        if (items.length === 0) {
          alert('No driver ledger records to print.');
          return;
        }

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>KSP Driver Advance Ledger</title>
        <style>
          *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:20px;color:#1e293b;background:#fff;font-size:11px}
          @page{size:landscape;margin:10mm}
          .header-bar{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #0f172a;margin-bottom:14px}
          .company-title{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 4px}
          .report-subtitle{font-size:13px;font-weight:700;color:#2563eb;margin:0;text-transform:uppercase;letter-spacing:.5px}
          .meta-text{font-size:11px;color:#64748b;margin:0}
          .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
          .kpi-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;text-align:center}
          .kpi-label{font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:4px}
          .kpi-value{font-size:15px;font-weight:800;color:#0f172a}
          .kpi-green{background:#f0fdf4;border-color:#bbf7d0}.kpi-green .kpi-value{color:#15803d}
          .kpi-amber{background:#fffbeb;border-color:#fde68a}.kpi-amber .kpi-value{color:#b45309}
          .kpi-blue{background:#eff6ff;border-color:#bfdbfe}.kpi-blue .kpi-value{color:#1d4ed8}
          table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}
          th{background:#0f172a;color:#fff;font-weight:700;text-align:left;padding:7px 8px;font-size:10.5px}
          td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
          tr:nth-child(even) td{background:#fbfcfe}
          .footer-row td{background:#f1f5f9!important;font-weight:800;border-top:2px solid #0f172a;color:#0f172a}
          .num{text-align:right}
          .center{text-align:center}
          .chip{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700}
          .chip-pos{background:#dcfce7;color:#166534}
          .chip-neg{background:#fee2e2;color:#991b1b}
          .print-bar{display:flex;justify-content:flex-end;gap:10px;margin-bottom:16px}
          .pbtn{background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px}
          @media print{.print-bar{display:none!important};body{padding:0}}
        </style></head><body>
        <div class="print-bar">
          <button class="pbtn" onclick="window.print()">Print / Save as PDF</button>
          <button class="pbtn" style="background:#64748b" onclick="window.close()">Close</button>
        </div>
        <div class="header-bar">
          <div>
            <h1 class="company-title">KSP TRANSPORT &amp; LOGISTICS</h1>
            <div class="report-subtitle">Driver Advance Master Ledger &amp; Live Balances</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800;font-size:13px;color:#0f172a">Total Drivers: ${items.length}</div>
            <p class="meta-text" style="margin-top:4px">Generated on: ${new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th class="center" style="width:35px">#</th>
              <th>Driver Name</th>
              <th>Mobile</th>
              <th>License</th>
              <th class="num">Total Advance Given (₹)</th>
              <th class="center">Adv. Count</th>
              <th class="num">Trip Advances Used (₹)</th>
              <th class="center">Trips</th>
              <th class="num">Current Balance (₹)</th>
              <th class="center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((d, idx) => {
              const bal = parseFloat(String(d.remaining_advance_balance)) || 0;
              return `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td><strong>${d.driver_name}</strong></td>
                  <td>${d.driver_mobile || '—'}</td>
                  <td>${d.driver_license || '—'}</td>
                  <td class="num" style="color:#15803d;font-weight:700">₹${(parseFloat(String(d.total_advance_given)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="center">${d.advance_count}</td>
                  <td class="num" style="color:#b45309;font-weight:700">₹${(parseFloat(String(d.total_trip_advance_used)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="center">${d.trip_count}</td>
                  <td class="num" style="font-weight:800;color:${bal >= 0 ? '#1d4ed8' : '#b91c1c'}">₹${bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="center"><span class="chip ${bal >= 0 ? 'chip-pos' : 'chip-neg'}">${bal >= 0 ? 'In Hand' : 'Deficit'}</span></td>
                </tr>
              `;
            }).join('')}
            <tr class="footer-row">
              <td class="center">TOTAL</td>
              <td colspan="3"><strong>${items.length} Drivers</strong></td>
              <td class="num"><strong>₹${ledgerGrandTotals.total_advance_given.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
              <td></td>
              <td class="num"><strong>₹${ledgerGrandTotals.total_trip_advance_used.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
              <td></td>
              <td class="num"><strong>₹${ledgerGrandTotals.remaining_advance_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
        </body></html>`;

        const win = window.open('', '_blank', 'width=1100,height=850');
        if (!win) {
          alert('Allow popups to print.');
          return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
      } else {
        const res = await driverAdvanceService.getDriverAdvances({
          page: 1,
          limit: 5000,
          search: search || undefined,
          driver_id: driverFilter || undefined,
          manager_id: managerFilter || undefined,
          vehicle_id: vehicleFilter || undefined,
          payment_mode: paymentModeFilter || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        });
        const items = res.data.items || [];
        if (items.length === 0) {
          alert('No advance records to print.');
          return;
        }
        const totalSum = items.reduce((s, a) => s + (parseFloat(String(a.amount)) || 0), 0);

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>KSP Driver Advances Log</title>
        <style>
          *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:20px;color:#1e293b;background:#fff;font-size:11px}
          @page{size:landscape;margin:10mm}
          .header-bar{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #0f172a;margin-bottom:14px}
          .company-title{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 4px}
          .report-subtitle{font-size:13px;font-weight:700;color:#2563eb;margin:0;text-transform:uppercase;letter-spacing:.5px}
          .meta-text{font-size:11px;color:#64748b;margin:0}
          table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}
          th{background:#0f172a;color:#fff;font-weight:700;text-align:left;padding:7px 8px;font-size:10.5px}
          td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
          tr:nth-child(even) td{background:#fbfcfe}
          .footer-row td{background:#f1f5f9!important;font-weight:800;border-top:2px solid #0f172a;color:#0f172a}
          .num{text-align:right}
          .center{text-align:center}
          .print-bar{display:flex;justify-content:flex-end;gap:10px;margin-bottom:16px}
          .pbtn{background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px}
          @media print{.print-bar{display:none!important};body{padding:0}}
        </style></head><body>
        <div class="print-bar">
          <button class="pbtn" onclick="window.print()">Print / Save as PDF</button>
          <button class="pbtn" style="background:#64748b" onclick="window.close()">Close</button>
        </div>
        <div class="header-bar">
          <div>
            <h1 class="company-title">KSP TRANSPORT &amp; LOGISTICS</h1>
            <div class="report-subtitle">Driver Advance Disbursements Log (Manager → Driver)</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800;font-size:13px;color:#0f172a">Total Records: ${items.length}</div>
            <p class="meta-text" style="margin-top:4px">Generated on: ${new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th class="center" style="width:35px">#</th>
              <th>Date</th>
              <th>Driver Name</th>
              <th>Mobile</th>
              <th>Manager (Disbursed By)</th>
              <th>Lorry No</th>
              <th>Mode</th>
              <th class="num">Amount (₹)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((a, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                <td>${formatISTDate(a.advance_date)}</td>
                <td><strong>${a.driver_name}</strong></td>
                <td>${a.driver_mobile || '—'}</td>
                <td>${a.manager_name}</td>
                <td>${a.lorry_number || '—'}</td>
                <td>${a.payment_mode || 'CASH'}</td>
                <td class="num" style="font-weight:700;color:#15803d">₹${(parseFloat(String(a.amount)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td>${a.notes || '—'}</td>
              </tr>
            `).join('')}
            <tr class="footer-row">
              <td class="center">TOTAL</td>
              <td colspan="6"><strong>${items.length} Advance Disbursements</strong></td>
              <td class="num"><strong>₹${totalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
        </body></html>`;

        const win = window.open('', '_blank', 'width=1100,height=850');
        if (!win) {
          alert('Allow popups to print.');
          return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    } catch (err) {
      alert('Failed to generate print.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Columns for All Transactions Table
  const transactionColumns: Column<DriverAdvance>[] = [
    {
      header: 'Date',
      accessor: 'advance_date',
      render: (a) => <span style={{ fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>{formatISTDate(a.advance_date)}</span>,
    },
    {
      header: 'Driver',
      accessor: 'driver_name',
      render: (a) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{a.driver_name}</div>
          {a.driver_mobile && <div style={{ fontSize: '11px', color: '#64748b' }}>{a.driver_mobile}</div>}
        </div>
      ),
    },
    {
      header: 'Lorry / Trip',
      render: (a) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {a.lorry_number ? (
            <span style={{ fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', fontSize: '12px' }}>
              🚛 {a.lorry_number}
            </span>
          ) : <span style={{ color: '#94a3b8', fontSize: '12px' }}>No Lorry</span>}
          {a.trip_id && (
            <span style={{ fontSize: '11px', color: '#7c3aed', background: '#ede9fe', padding: '1px 6px', borderRadius: '4px', display: 'inline-block' }}>
              TRIP-{a.trip_id}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Party & Route',
      render: (a) => (
        <div>
          {a.party_name ? (
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '12px' }}>{a.party_name}</div>
          ) : null}
          {a.from_location && a.to_location ? (
            <div style={{ fontSize: '11px', color: '#64748b' }}>{a.from_location} → {a.to_location}</div>
          ) : null}
          {a.total_freight != null && parseFloat(String(a.total_freight)) > 0 ? (
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', marginTop: '2px' }}>
              Freight: {formatCurrency(a.total_freight)} {a.goods_weight ? `(${a.goods_weight} ${a.unit_abbreviation || 'MT'})` : ''}
            </div>
          ) : null}
          {!a.party_name && !a.from_location && <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>}
        </div>
      ),
    },
    {
      header: 'Type',
      render: (a) => (
        <span style={{
          fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
          background: a.source_type === 'TRIP_TRUCK_ADVANCE' ? '#fef3c7' : '#dcfce7',
          color: a.source_type === 'TRIP_TRUCK_ADVANCE' ? '#92400e' : '#166534'
        }}>
          {a.source_type === 'TRIP_TRUCK_ADVANCE' ? 'Trip Adv.' : 'Direct'}
        </span>
      ),
    },
    {
      header: 'Mode',
      render: (a) => (
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#f1f5f9', color: '#475569' }}>
          {a.payment_mode || 'CASH'}
        </span>
      ),
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (a) => <span style={{ fontWeight: 800, color: '#15803d', fontSize: '13.5px', whiteSpace: 'nowrap' }}>{formatCurrency(a.amount)}</span>,
    },
    {
      header: 'Balance in Hand',
      render: (a) => {
        const bal = Math.max(0, parseFloat(String(a.driver_balance_in_hand ?? 0)));
        return (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, color: bal >= 0 ? '#1d4ed8' : '#b91c1c', fontSize: '13px', whiteSpace: 'nowrap' }}>
              {formatCurrency(bal)}
            </div>
            <div style={{
              fontSize: '10px', fontWeight: 700, marginTop: '2px',
              color: bal > 0 ? '#166534' : bal < 0 ? '#991b1b' : '#475569'
            }}>
              {bal > 0 ? '✓ In Hand' : bal < 0 ? '⚠ Deficit' : '✓ Settled'}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Notes',
      render: (a) => (a.notes ? <span style={{ color: '#64748b', fontSize: '12px' }}>{a.notes}</span> : <span style={{ color: '#cbd5e1' }}>—</span>),
    },
    {
      header: 'Actions',
      render: (a) => (
        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={() => handlePrintSingleAdvance(a)}
            className="btn btn-outline btn-sm"
            style={{ color: '#2563eb', borderColor: '#bfdbfe' }}
            title="Print Voucher"
          >
            <Printer size={13} />
          </button>
          <button
            onClick={() => handleDownloadSingleAdvanceExcel(a)}
            className="btn btn-outline btn-sm"
            style={{ color: '#059669', borderColor: '#a7f3d0' }}
            title="Download Voucher (Excel)"
          >
            <Download size={13} />
          </button>
          <button onClick={() => handleOpenEdit(a)} className="btn btn-outline btn-sm" style={{ color: '#4f46e5', borderColor: '#c7d2fe' }} title="Edit">
            <Edit2 size={13} />
          </button>
          <button onClick={() => handleDelete(a.id)} className="btn btn-outline btn-sm" style={{ color: '#dc2626', borderColor: '#fca5a5' }} title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div
        className="card-header"
        style={{
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={24} color="var(--accent)" />
              Driver Advances Master
            </h2>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '3px 10px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              {activeView === 'ledger' ? `${driverSummaries.length} Drivers` : `${totalAdvancesCount} Advance Records`}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>
            Track advances given to drivers by managers, automatic deduction on completed trips, and live driver balances
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Link
            to="/manager-advances"
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#3b82f6',
              color: '#1d4ed8',
              background: '#eff6ff',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '12.5px',
              height: '36px',
              padding: '0 12px',
            }}
          >
            <Users size={14} /> Manager Advances
          </Link>
          <Link
            to="/owner-advances"
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#10b981',
              color: '#059669',
              background: '#ecfdf5',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '12.5px',
              height: '36px',
              padding: '0 12px',
            }}
          >
            <HandCoins size={14} /> Owner Advances
          </Link>
          <button
            onClick={() => handleOpenCreate()}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', fontSize: '12.5px' }}
          >
            <Plus size={16} /> Give Advance to Driver
          </button>
        </div>
      </div>

      {/* Main View Tabs (Ledger & Live Balances vs All Transactions Log) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
          <button
            onClick={() => { setActiveView('ledger'); setPage(1); }}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeView === 'ledger' ? '#fff' : 'transparent',
              color: activeView === 'ledger' ? '#0f172a' : '#64748b',
              boxShadow: activeView === 'ledger' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <UserCheck size={15} /> Driver Advance Ledger &amp; Live Balances
          </button>
          <button
            onClick={() => { setActiveView('transactions'); setPage(1); }}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeView === 'transactions' ? '#fff' : 'transparent',
              color: activeView === 'transactions' ? '#0f172a' : '#64748b',
              boxShadow: activeView === 'transactions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <HandCoins size={15} /> All Advance Disbursements Log
          </button>
        </div>

        <button
          onClick={() => (activeView === 'ledger' ? loadLedgerSummary() : loadAdvances())}
          className="btn btn-outline"
          style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: '14px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ position: 'relative', width: '210px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-control"
                placeholder="Search driver, mobile..."
                style={{ paddingLeft: '32px', height: '36px', fontSize: '12.5px' }}
              />
            </div>

            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="form-control"
              style={{ height: '36px', width: '160px', fontSize: '12.5px' }}
            >
              <option value="">All Drivers</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.mobile_number ? `(${d.mobile_number})` : ''}
                </option>
              ))}
            </select>

            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="form-control"
              style={{ height: '36px', width: '150px', fontSize: '12.5px' }}
            >
              <option value="">All Lorries</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.lorry_number}
                </option>
              ))}
            </select>

            {activeView === 'ledger' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-control"
                style={{ height: '36px', width: '175px', fontSize: '12.5px' }}
              >
                <option value="">All Status</option>
                <option value="SETTLED">✓ Settled Only</option>
                <option value="PENDING">⏳ Settlement Pending Only</option>
                <option value="CASH_IN_HAND">💵 Cash in Hand Only</option>
              </select>
            )}

            {activeView === 'transactions' && (
              <>
                <select
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                  className="form-control"
                  style={{ height: '36px', width: '150px', fontSize: '12.5px' }}
                >
                  <option value="">All Managers</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>

                <select
                  value={paymentModeFilter}
                  onChange={(e) => setPaymentModeFilter(e.target.value)}
                  className="form-control"
                  style={{ height: '36px', width: '130px', fontSize: '12.5px' }}
                >
                  <option value="">All Modes</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>

                <DateField
                  style={{ width: '130px', height: '36px', fontSize: '12px' }}
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  placeholder="From Date"
                />
                <DateField
                  style={{ width: '130px', height: '36px', fontSize: '12px' }}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  placeholder="To Date"
                />
              </>
            )}

            <button onClick={resetFilters} className="btn btn-outline" style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px' }}>
              <RefreshCw size={13} /> Reset
            </button>

            {/* Quick Print & Download buttons right in toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="btn btn-outline"
              title="Print Ledger Report"
              style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff', fontWeight: 600 }}
            >
              {isPrinting ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              Print
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="btn btn-outline"
              title="Download Excel Workbook"
              style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5', fontWeight: 600, padding: '0 12px' }}
            >
              {isExportingExcel ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
              Excel
            </button>
            <button
              onClick={handleExportCSV}
              disabled={isExportingCSV}
              className="btn btn-outline"
              title="Download CSV"
              style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', padding: '0 10px' }}
            >
              {isExportingCSV ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: DRIVER ADVANCE LEDGER (Everything works under driver) */}
      {activeView === 'ledger' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '8px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
              <Loader2 size={32} className="animate-spin" style={{ marginBottom: '12px' }} />
              <div>Loading driver advance balances...</div>
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
              <UserCheck size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, fontSize: '15px', color: '#475569' }}>
                {driverSummaries.length === 0 ? 'No driver advances recorded yet.' : 'No drivers match the selected filters.'}
              </div>
              <div style={{ fontSize: '13px', marginTop: '6px', color: '#64748b' }}>
                {driverSummaries.length === 0 ? 'Only drivers who have received an advance from a manager are displayed in this ledger.' : 'Try clearing filters or search term.'}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#fff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '38px', fontWeight: 700, fontSize: '11.5px' }}>#</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'left', fontSize: '11.5px' }}>Driver</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'left', fontSize: '11.5px' }}>Lorry &amp; Current Trip</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', fontSize: '11.5px' }}>Total Advance</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', width: '60px', fontSize: '11.5px' }}>Adv.</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', fontSize: '11.5px' }}>Trip Expenses</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', width: '55px', fontSize: '11.5px' }}>Trips</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', background: '#1e3a5f', fontSize: '11.5px' }}>💰 Balance in Hand</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', width: '135px', fontSize: '11.5px' }}>Status</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', width: '125px', fontSize: '11.5px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map((d, idx) => {
                    const bal = Math.max(0, parseFloat(String(d.balance_in_hand ?? 0)));
                    const isExpanded = expandedDriverId === d.driver_id;
                    const details = expandedDetails[d.driver_id];
                    const activeSubTab = expandedTab[d.driver_id] || 'advances';

                    const tripsList = details?.trips || [];
                    const settledTripsCount = details?.trips
                      ? tripsList.filter((t: Trip) => (t as any).settlement_status === 'SETTLED').length
                      : (d.settlement_status === 'SETTLED' ? d.trip_count : 0);
                    const pendingTripsCount = details?.trips
                      ? tripsList.filter((t: Trip) => (t as any).settlement_status === 'PENDING' || (t as any).settlement_status === 'VERIFIED' || (!(t as any).settlement_status && t.status !== 'CANCELLED')).length
                      : (d.settlement_status === 'PENDING' ? d.trip_count : 0);
                    const isPendingSettlement = d.settlement_status === 'PENDING' || pendingTripsCount > 0;

                    return (
                      <React.Fragment key={d.row_key || `${d.driver_id}-${idx}`}>
                        <tr
                          style={{
                            background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            borderBottom: '1px solid #f1f5f9',
                          }}
                          onClick={() => handleToggleExpandDriver(d.driver_id)}
                        >
                          <td style={{ padding: '7px 8px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: '11.5px' }}>{idx + 1}</td>
                          <td style={{ padding: '7px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: '#2563eb',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                  fontWeight: 800,
                                  fontSize: '12px',
                                  flexShrink: 0,
                                }}
                              >
                                {d.driver_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px' }}>{d.driver_name}</div>
                                <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                                  {d.driver_mobile || 'No mobile'} {d.driver_license ? `• ${d.driver_license}` : ''}
                                </div>
                              </div>
                              {isExpanded ? <ChevronUp size={13} color="#94a3b8" /> : <ChevronDown size={13} color="#94a3b8" />}
                            </div>
                          </td>
                          {/* Lorry & Current Trip Column (Clean 2-line layout) */}
                          <td style={{ padding: '7px 10px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                {d.lorry_number ? (
                                  <span style={{ fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', border: '1px solid #dbeafe' }}>
                                    🚛 {d.lorry_number}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>No Truck</span>
                                )}
                                {d.trip_id && (
                                  <span style={{
                                    fontSize: '10.5px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px',
                                    background: d.is_active_trip ? '#fef3c7' : '#f1f5f9',
                                    color: d.is_active_trip ? '#92400e' : '#475569',
                                    border: `1px solid ${d.is_active_trip ? '#fde68a' : '#e2e8f0'}`,
                                  }}>
                                    {d.is_active_trip ? '🔴 TRIP-' : 'TRIP-'}{d.trip_id}
                                  </span>
                                )}
                                {d.goods_weight && (
                                  <span style={{ fontSize: '10px', color: '#047857', fontWeight: 700, background: '#ecfdf5', padding: '1px 4px', borderRadius: '3px' }}>
                                    {d.goods_weight} {d.unit_abbreviation || 'MT'}
                                  </span>
                                )}
                              </div>
                              {(d.party_name || (d.from_location && d.to_location)) && (
                                <div style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }} title={`${d.party_name || ''} ${d.from_location ? `• ${d.from_location} → ${d.to_location}` : ''}`}>
                                  <strong style={{ color: '#334155' }}>{d.party_name || ''}</strong>
                                  {d.from_location && d.to_location ? ` • ${d.from_location} → ${d.to_location}` : ''}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#15803d', fontSize: '12px' }}>
                            {formatCurrency(d.total_advance_given)}
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'center', color: '#64748b', fontSize: '11.5px' }}>{d.advance_count}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#b45309', fontSize: '12px' }}>
                            <div>{formatCurrency(d.total_expenses_reported)}</div>
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'center', color: '#64748b', fontSize: '11.5px' }}>{d.trip_count}</td>
                          {/* Balance in Hand */}
                          <td
                            style={{
                              padding: '7px 10px',
                              textAlign: 'right',
                              fontWeight: 800,
                              fontSize: '12.5px',
                              color: bal > 0 ? '#1d4ed8' : '#16a34a',
                              background: bal > 0 ? '#f0f9ff' : '#f0fdf4',
                              borderLeft: `2px solid ${bal > 0 ? '#3b82f6' : '#22c55e'}`,
                            }}
                          >
                            <div>{formatCurrency(bal)}</div>
                            <div style={{ fontSize: '9.5px', fontWeight: 600, color: bal > 0 ? '#1d4ed8' : (d.settlement_status === 'PENDING' ? '#b45309' : '#16a34a'), marginTop: '1px' }}>
                              {bal > 0 ? 'Cash in Hand' : (d.settlement_status === 'PENDING' ? 'Settlement Pending' : 'Fully Settled')}
                            </div>
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                            {renderDriverStatusBadge(d)}
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                title="Print Driver Statement"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintSingleDriverStatement(d);
                                }}
                                disabled={printingDriverId === d.driver_id}
                                className="btn btn-outline btn-sm"
                                style={{ color: '#2563eb', borderColor: '#bfdbfe', padding: '3px 6px', height: '26px' }}
                              >
                                {printingDriverId === d.driver_id ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                              </button>
                              <button
                                type="button"
                                title="Download Driver Statement (Excel)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadSingleDriverExcel(d);
                                }}
                                disabled={downloadingDriverId === d.driver_id}
                                className="btn btn-outline btn-sm"
                                style={{ color: '#059669', borderColor: '#a7f3d0', padding: '3px 6px', height: '26px' }}
                              >
                                {downloadingDriverId === d.driver_id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCreate(d.driver_id);
                                }}
                                className="btn btn-outline btn-sm"
                                style={{ color: '#16a34a', borderColor: '#bbf7d0', fontWeight: 600, padding: '3px 7px', height: '26px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Plus size={11} /> Advance
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Drilldown for this Driver */}
                         {isExpanded && (
                           <tr>
                             <td colSpan={10} style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                               {/* Driver Balance Summary Strip (Single Neat Row) */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    marginBottom: '14px',
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  {/* Assigned Truck & Trip */}
                                  <div style={{ flex: '1 1 240px', padding: '10px 16px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>
                                      Truck &amp; Trip Details
                                    </div>
                                    <div style={{ fontWeight: 800, color: '#0369a1', fontSize: '13px' }}>
                                      {d.lorry_number ? `Truck: ${d.lorry_number}` : 'No Truck Assigned'}
                                    </div>
                                    {d.trip_id ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                        <span style={{
                                          fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                                          background: d.is_active_trip ? '#fef3c7' : '#f1f5f9',
                                          color: d.is_active_trip ? '#c2410c' : '#64748b'
                                        }}>
                                          TRIP-{d.trip_id}{d.is_active_trip ? ' (Active)' : ''}
                                        </span>
                                        {d.total_freight != null && parseFloat(String(d.total_freight)) > 0 && (
                                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8' }}>
                                            Freight: {formatCurrency(d.total_freight)}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>No trips</div>
                                    )}
                                    {d.party_name && (
                                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '1px' }}>
                                        {d.party_name}{d.from_location && d.to_location ? ` · ${d.from_location} → ${d.to_location}` : ''}
                                      </div>
                                    )}
                                  </div>

                                  {/* Total Advance */}
                                  <div style={{ flex: '1 1 160px', padding: '10px 16px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                                      Total Advance
                                    </div>
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#15803d' }}>
                                      {formatCurrency(d.total_advance_given)}
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                                      {d.advance_count} disbursements
                                    </div>
                                  </div>

                                  {/* Trip Expenses */}
                                  <div style={{ flex: '1 1 160px', padding: '10px 16px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                                      Trip Expenses
                                    </div>
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#b45309' }}>
                                      {formatCurrency(d.total_expenses_reported)}
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                                      {d.trip_count === 0
                                        ? '0 trips'
                                        : pendingTripsCount > 0 && settledTripsCount === 0
                                        ? `${pendingTripsCount} ${pendingTripsCount === 1 ? 'trip pending settlement' : 'trips pending settlement'}`
                                        : pendingTripsCount > 0 && settledTripsCount > 0
                                        ? `${settledTripsCount} settled, ${pendingTripsCount} pending`
                                        : `${settledTripsCount} ${settledTripsCount === 1 ? 'trip settled' : 'trips settled'}`}
                                    </div>
                                  </div>

                                  {/* Balance in Hand */}
                                  <div
                                    style={{
                                      flex: '1 1 160px',
                                      padding: '10px 16px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'center',
                                      background: bal > 0 ? '#f0f9ff' : isPendingSettlement ? '#fffbeb' : '#f0fdf4',
                                    }}
                                  >
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                                      Balance in Hand
                                    </div>
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: bal > 0 ? '#1d4ed8' : isPendingSettlement ? '#b45309' : '#16a34a' }}>
                                      {formatCurrency(bal)}
                                    </div>
                                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: bal > 0 ? '#15803d' : isPendingSettlement ? '#b45309' : '#15803d' }}>
                                      {bal > 0 ? '✓ Cash with Driver' : isPendingSettlement ? '⏳ Settlement Pending' : '✓ Fully Settled'}
                                    </div>
                                  </div>
                                </div>

                                {/* Drilldown Sub-Tabs */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  borderBottom: '1px solid #e2e8f0',
                                  paddingBottom: '8px',
                                  marginBottom: '12px',
                                }}
                              >
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedTab((prev) => ({ ...prev, [d.driver_id]: 'advances' }));
                                    }}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      border: activeSubTab === 'advances' ? '1px solid #16a34a' : '1px solid #e2e8f0',
                                      background: activeSubTab === 'advances' ? '#dcfce7' : '#ffffff',
                                      color: activeSubTab === 'advances' ? '#166534' : '#64748b',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <HandCoins size={14} /> Advances Received by {d.driver_name} ({details?.advances?.length || 0})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedTab((prev) => ({ ...prev, [d.driver_id]: 'trips' }));
                                    }}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      border: activeSubTab === 'trips' ? '1px solid #d97706' : '1px solid #e2e8f0',
                                      background: activeSubTab === 'trips' ? '#fef3c7' : '#ffffff',
                                      color: activeSubTab === 'trips' ? '#92400e' : '#64748b',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <Navigation size={14} /> Trips & Settlements ({details?.trips?.length || 0})
                                  </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintSingleDriverStatement(d);
                                    }}
                                    disabled={printingDriverId === d.driver_id}
                                    className="btn btn-sm btn-outline"
                                    style={{ borderColor: '#3b82f6', color: '#1d4ed8', background: '#eff6ff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    {printingDriverId === d.driver_id ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                                    Print Statement
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadSingleDriverExcel(d);
                                    }}
                                    disabled={downloadingDriverId === d.driver_id}
                                    className="btn btn-sm btn-outline"
                                    style={{ borderColor: '#10b981', color: '#047857', background: '#ecfdf5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    {downloadingDriverId === d.driver_id ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                                    Download Excel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenCreate(d.driver_id);
                                    }}
                                    className="btn btn-sm btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Plus size={13} /> Give Advance to {d.driver_name}
                                  </button>
                                </div>
                              </div>

                              {/* Sub-Table Content */}
                              {details?.loading ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                  <Loader2 size={20} className="animate-spin" style={{ marginBottom: '6px' }} />
                                  <div style={{ fontSize: '12px' }}>Loading driver records...</div>
                                </div>
                              ) : activeSubTab === 'advances' ? (
                                <div>
                                  {!details?.advances || details.advances.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                                      No direct advances recorded for this driver yet.
                                    </div>
                                  ) : (
                                    <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                          <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '35px' }}>#</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', width: '100px' }}>Date</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Disbursed By (Manager)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Vehicle / Lorry</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '90px' }}>Mode</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Amount (₹)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Notes</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '80px' }}>Action</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {details.advances.map((a: DriverAdvance, i: number) => (
                                            <tr key={a.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                              <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}>{i + 1}</td>
                                              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#334155' }}>{formatISTDate(a.advance_date)}</td>
                                              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{a.manager_name}</td>
                                              <td style={{ padding: '8px 12px', color: '#2563eb' }}>{a.lorry_number || '—'}</td>
                                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, background: '#f1f5f9', color: '#475569' }}>
                                                  {a.payment_mode || 'CASH'}
                                                </span>
                                              </td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                                                {formatCurrency(a.amount)}
                                              </td>
                                              <td style={{ padding: '8px 12px', color: '#64748b' }}>{a.notes || '—'}</td>
                                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', gap: '4px' }}>
                                                  <button
                                                    type="button"
                                                    title="Print Advance Voucher"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handlePrintSingleAdvance(a);
                                                    }}
                                                    className="btn btn-outline btn-sm"
                                                    style={{ color: '#2563eb', borderColor: '#bfdbfe', padding: '3px 6px' }}
                                                  >
                                                    <Printer size={11} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    title="Download Voucher (Excel)"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleDownloadSingleAdvanceExcel(a);
                                                    }}
                                                    className="btn btn-outline btn-sm"
                                                    style={{ color: '#059669', borderColor: '#a7f3d0', padding: '3px 6px' }}
                                                  >
                                                    <Download size={11} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                          <tfoot>
                                            <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                                              <td colSpan={6} style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>Total Advance Given:</td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#15803d', fontWeight: 800 }}>
                                                {formatCurrency(details.advances.reduce((acc, x) => acc + (parseFloat(String(x.amount)) || 0), 0))}
                                              </td>
                                              <td colSpan={2}></td>
                                            </tr>
                                          </tfoot>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  {!details?.trips || details.trips.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                                      No trips recorded for this driver yet.
                                    </div>
                                  ) : (
                                    <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                          <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '35px' }}>#</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', width: '90px' }}>Trip ID</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', width: '100px' }}>Trip Date</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Lorry Number</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Party & Route</th>
                                             <th style={{ padding: '8px 12px', textAlign: 'right', width: '90px' }}>Weight</th>
                                             <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Total Freight (₹)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', width: '110px' }}>Advance Paid (₹)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Trip Expenses (₹)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Driver Balance (₹)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '90px' }}>Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                           {(() => {
                                             // Compute running cumulative balance per driver across trips (oldest first)
                                             const sortedTrips = [...details.trips].sort((a: Trip, b: Trip) => {
                                                const dateA = new Date(a.trip_date || 0).getTime();
                                                const dateB = new Date(b.trip_date || 0).getTime();
                                                if (dateA !== dateB) return dateA - dateB;
                                                return (a.id || 0) - (b.id || 0);
                                              });
                                             const directAdvancesTotal = (details.advances || [])
                                               .filter((adv: DriverAdvance) => !adv.trip_id)
                                               .reduce((sum: number, adv: DriverAdvance) => sum + (parseFloat(String(adv.amount)) || 0), 0);

                                             let runningBal = directAdvancesTotal;
                                             const balanceById = new Map<number, number>();
                                             sortedTrips.forEach((t: Trip) => {
                                               const adv = parseFloat(String(t.advance_paid || 0));
                                               const exp = parseFloat(String(t.total_expenses ?? 0)) || 0;
                                               runningBal = Math.round((runningBal + adv - exp) * 100) / 100;
                                               balanceById.set(t.id, Math.max(0, runningBal));
                                               if (runningBal < 0) {
                                                 runningBal = 0;
                                               }
                                             });
                                             return details.trips.map((t: Trip, i: number) => {
                                               const tripRunningBal = balanceById.get(t.id) ?? 0;
                                               return (
                                                 <tr key={t.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                   <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}>{i + 1}</td>
                                                   <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>TRIP-{t.id}</td>
                                                   <td style={{ padding: '8px 12px', color: '#475569' }}>{formatISTDate(t.trip_date)}</td>
                                                   <td style={{ padding: '8px 12px', fontWeight: 700, color: '#2563eb' }}>{t.lorry_number}</td>
                                                   <td style={{ padding: '8px 12px', color: '#334155' }}>
                                                     {t.party_name} ({t.from_location} → {t.to_location})
                                                   </td>
                                                   <td style={{ padding: '8px 12px', textAlign: 'right', color: '#047857', fontWeight: 700 }}>
                                                       {t.goods_weight ? `${t.goods_weight} ${t.unit_abbreviation || 'MT'}` : '—'}
                                                   </td>
                                                   <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8' }}>
                                                     {formatCurrency(t.total_freight)}
                                                   </td>
                                                   <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>
                                                     {formatCurrency(t.advance_paid)}
                                                   </td>
                                                   <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: t.total_expenses ? '#dc2626' : '#94a3b8' }}>
                                                     {t.total_expenses ? formatCurrency(t.total_expenses) : '—'}
                                                   </td>
                                                   <td style={{
                                                     padding: '8px 12px', textAlign: 'right', fontWeight: 800,
                                                     color: tripRunningBal > 0 ? '#1d4ed8' : '#16a34a',
                                                   }}>
                                                     {formatCurrency(tripRunningBal)}
                                                   </td>
                                                   <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                      {(() => {
                                                        const sStatus = (t as any).settlement_status;
                                                        if (sStatus === 'SETTLED') {
                                                          return (
                                                            <span
                                                              style={{
                                                                fontSize: '10.5px',
                                                                fontWeight: 700,
                                                                padding: '2px 8px',
                                                                borderRadius: '10px',
                                                                background: '#dcfce7',
                                                                color: '#15803d',
                                                                border: '1px solid #86efac',
                                                                whiteSpace: 'nowrap',
                                                                display: 'inline-block',
                                                              }}
                                                            >
                                                              ✓ Settled
                                                            </span>
                                                          );
                                                        }
                                                        if (sStatus === 'VERIFIED') {
                                                          return (
                                                            <span
                                                              style={{
                                                                fontSize: '10.5px',
                                                                fontWeight: 700,
                                                                padding: '2px 8px',
                                                                borderRadius: '10px',
                                                                background: '#ede9fe',
                                                                color: '#6d28d9',
                                                                border: '1px solid #c4b5fd',
                                                                whiteSpace: 'nowrap',
                                                                display: 'inline-block',
                                                              }}
                                                            >
                                                              🔍 Verified (Pending)
                                                            </span>
                                                          );
                                                        }
                                                        if (sStatus === 'PENDING' || (!sStatus && t.status !== 'CANCELLED')) {
                                                          return (
                                                            <span
                                                              style={{
                                                                fontSize: '10.5px',
                                                                fontWeight: 700,
                                                                padding: '2px 8px',
                                                                borderRadius: '10px',
                                                                background: '#fef3c7',
                                                                color: '#b45309',
                                                                border: '1px solid #fcd34d',
                                                                whiteSpace: 'nowrap',
                                                                display: 'inline-block',
                                                              }}
                                                            >
                                                              ⏳ Settlement Pending
                                                            </span>
                                                          );
                                                        }
                                                        if (t.status === 'CANCELLED') {
                                                          return (
                                                            <span
                                                              style={{
                                                                fontSize: '10.5px',
                                                                fontWeight: 700,
                                                                padding: '2px 8px',
                                                                borderRadius: '10px',
                                                                background: '#f1f5f9',
                                                                color: '#64748b',
                                                                border: '1px solid #cbd5e1',
                                                                whiteSpace: 'nowrap',
                                                                display: 'inline-block',
                                                              }}
                                                            >
                                                              ✕ Cancelled
                                                            </span>
                                                          );
                                                        }
                                                        return (
                                                          <span
                                                            style={{
                                                              fontSize: '10.5px',
                                                              fontWeight: 700,
                                                              padding: '2px 8px',
                                                              borderRadius: '10px',
                                                              background: tripRunningBal > 0 ? '#eff6ff' : '#dcfce7',
                                                              color: tripRunningBal > 0 ? '#1d4ed8' : '#166534',
                                                              border: `1px solid ${tripRunningBal > 0 ? '#bfdbfe' : '#bbf7d0'}`,
                                                              whiteSpace: 'nowrap',
                                                              display: 'inline-block',
                                                            }}
                                                          >
                                                            {tripRunningBal > 0 ? '💵 Cash in Hand' : '✓ Settled'}
                                                          </span>
                                                        );
                                                      })()}
                                                    </td>
                                                 </tr>
                                               );
                                             });
                                           })()}
                                         </tbody>
                                         <tfoot>
                                           <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                                              <td colSpan={5} style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>Totals:</td>
                                              <td></td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1d4ed8', fontWeight: 800 }}>
                                                {formatCurrency(details.trips.reduce((acc, x) => acc + (parseFloat(String(x.total_freight)) || 0), 0))}
                                              </td>
                                             <td style={{ padding: '8px 12px', textAlign: 'right', color: '#b45309' }}>
                                               {formatCurrency(details.trips.reduce((acc, x) => acc + (parseFloat(String(x.advance_paid)) || 0), 0))}
                                             </td>
                                             <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626' }}>
                                               {formatCurrency(details.trips.reduce((acc, x) => acc + (parseFloat(String(x.total_expenses ?? 0)) || 0), 0))}
                                             </td>
                                             <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1d4ed8', fontWeight: 800 }}>
                                               {(() => {
                                                 const sorted = [...details.trips].sort((a: Trip, b: Trip) => {
                                                   const dateA = new Date(a.trip_date || 0).getTime();
                                                   const dateB = new Date(b.trip_date || 0).getTime();
                                                   if (dateA !== dateB) return dateA - dateB;
                                                   return (a.id || 0) - (b.id || 0);
                                                 });
                                                 const directAdv = (details.advances || [])
                                                   .filter((adv: DriverAdvance) => !adv.trip_id)
                                                   .reduce((sum: number, adv: DriverAdvance) => sum + (parseFloat(String(adv.amount)) || 0), 0);
                                                 let rb = directAdv;
                                                 sorted.forEach((t: Trip) => {
                                                   const a = parseFloat(String(t.advance_paid || 0));
                                                   const e = parseFloat(String(t.total_expenses ?? 0)) || 0;
                                                   rb = Math.round((rb + a - e) * 100) / 100;
                                                   if (rb < 0) rb = 0;
                                                 });
                                                 return formatCurrency(rb);
                                                })()}
                                              </td>
                                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                {(() => {
                                                  const hasPending = details.trips.some(
                                                    (t: Trip) => (t as any).settlement_status === 'PENDING' || (!(t as any).settlement_status && t.status !== 'CANCELLED')
                                                  );
                                                  const hasVerified = details.trips.some(
                                                    (t: Trip) => (t as any).settlement_status === 'VERIFIED'
                                                  );
                                                  const allSettled = details.trips.length > 0 && details.trips.every(
                                                    (t: Trip) => (t as any).settlement_status === 'SETTLED'
                                                  );

                                                  if (hasPending) {
                                                    return (
                                                      <span
                                                        style={{
                                                          fontSize: '10.5px',
                                                          fontWeight: 700,
                                                          padding: '2px 8px',
                                                          borderRadius: '10px',
                                                          background: '#fef3c7',
                                                          color: '#b45309',
                                                          border: '1px solid #fcd34d',
                                                          display: 'inline-block',
                                                          whiteSpace: 'nowrap',
                                                        }}
                                                      >
                                                        ⏳ Settlement Pending
                                                      </span>
                                                    );
                                                  }
                                                  if (hasVerified) {
                                                    return (
                                                      <span
                                                        style={{
                                                          fontSize: '10.5px',
                                                          fontWeight: 700,
                                                          padding: '2px 8px',
                                                          borderRadius: '10px',
                                                          background: '#ede9fe',
                                                          color: '#6d28d9',
                                                          border: '1px solid #c4b5fd',
                                                          display: 'inline-block',
                                                          whiteSpace: 'nowrap',
                                                        }}
                                                      >
                                                        🔍 Verified (Pending)
                                                      </span>
                                                    );
                                                  }
                                                  if (allSettled) {
                                                    return (
                                                      <span
                                                        style={{
                                                          fontSize: '10.5px',
                                                          fontWeight: 700,
                                                          padding: '2px 8px',
                                                          borderRadius: '10px',
                                                          background: '#dcfce7',
                                                          color: '#15803d',
                                                          border: '1px solid #86efac',
                                                          display: 'inline-block',
                                                          whiteSpace: 'nowrap',
                                                        }}
                                                      >
                                                        ✓ Settled
                                                      </span>
                                                    );
                                                  }
                                                  return (
                                                    <span
                                                      style={{
                                                        fontSize: '10.5px',
                                                        fontWeight: 700,
                                                        padding: '2px 8px',
                                                        borderRadius: '10px',
                                                        background: '#dcfce7',
                                                        color: '#15803d',
                                                        border: '1px solid #86efac',
                                                        display: 'inline-block',
                                                        whiteSpace: 'nowrap',
                                                      }}
                                                    >
                                                      ✓ Settled
                                                    </span>
                                                  );
                                                })()}
                                              </td>
                                           </tr>
                                         </tfoot>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: 700 }}>
                    <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 800, fontSize: '11px' }}>TOTAL</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: '11.5px' }}>{filteredSummaries.length} Drivers</td>
                    <td style={{ padding: '8px 10px', color: '#64748b', fontSize: '11px' }}>—</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#15803d', fontSize: '12px' }}>
                      {formatCurrency(filteredTotals.total_advance_given)}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', color: '#64748b', fontSize: '11.5px' }}>
                      {filteredTotals.advance_count}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#b45309', fontSize: '12px' }}>
                      {formatCurrency(filteredTotals.total_expenses_reported)}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', color: '#64748b', fontSize: '11.5px' }}>
                      {filteredTotals.trip_count}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: '13px',
                        color: '#1d4ed8',
                        background: '#f0f9ff',
                      }}
                    >
                      {formatCurrency(Math.max(0, filteredTotals.balance_in_hand))}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#1d4ed8' }}>
                        💰 Net in Hand
                      </span>
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', color: '#94a3b8' }}>—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: ALL ADVANCE DISBURSEMENTS LOG */
        <div className="card">
          <DataTable
            columns={transactionColumns}
            data={advances}
            isLoading={isLoading}
            total={totalAdvancesCount}
            page={page}
            limit={10}
            onPageChange={setPage}
            footer={
              advances.length > 0 ? (
                <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid var(--border-medium, #cbd5e1)' }}>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>TOTAL</td>
                  <td style={{ fontWeight: 700 }}>Page: {advances.length} Disbursements</td>
                  <td colSpan={4}></td>
                  <td style={{ fontWeight: 800, color: '#15803d' }}>
                    {formatCurrency(advances.reduce((acc, a) => acc + (parseFloat(String(a.amount)) || 0), 0))}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              ) : undefined
            }
          />
        </div>
      )}

      {/* Give / Edit Advance Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAdvance ? 'Edit Driver Advance' : 'Give Advance to Driver'}
        maxWidth="540px"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
              {formError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              <UserCheck size={14} style={{ marginRight: '5px' }} /> Driver *
            </label>
            <select
              className="form-control"
              value={formData.driver_id}
              onChange={(e) => setFormData((p) => ({ ...p, driver_id: e.target.value }))}
            >
              <option value="">— Select Driver —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.mobile_number ? `(${d.mobile_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              Manager (Disbursed By)
            </label>
            <select
              className="form-control"
              value={formData.manager_id}
              onChange={(e) => setFormData((p) => ({ ...p, manager_id: e.target.value }))}
            >
              <option value="">— Current Logged-in Manager —</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              <Truck size={14} style={{ marginRight: '5px' }} /> Vehicle / Lorry (Optional)
            </label>
            <select
              className="form-control"
              value={formData.vehicle_id}
              onChange={(e) => setFormData((p) => ({ ...p, vehicle_id: e.target.value }))}
            >
              <option value="">— None / Not Linked to Lorry —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.lorry_number} {v.vehicle_type ? `(${v.vehicle_type})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>
                Advance Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 5000"
                value={formData.amount}
                onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>
                Payment Mode
              </label>
              <select
                className="form-control"
                value={formData.payment_mode}
                onChange={(e) => setFormData((p) => ({ ...p, payment_mode: e.target.value }))}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / GPay</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              Advance Date
            </label>
            <DateField
              value={formData.advance_date}
              onChange={(e) => setFormData((p) => ({ ...p, advance_date: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              Notes / Reason
            </label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g., Highway expense pre-payment, food/toll advance..."
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn btn-outline"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {editingAdvance ? 'Update Advance' : 'Give Advance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
