import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
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
  Briefcase,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  driverAdvanceService,
  driverService,
  vehicleService,
  ownerService,
  userService,
  tripService,
} from '../services/adminService';
import { Driver, Vehicle, Owner, User, DriverAdvance, DriverAdvanceSummary, Trip } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { DateField } from '../components/Common/DateField';
import { formatIST, formatISTDate } from '../utils/dateUtils';
import { PRINT_BRAND_CSS, printBrandLockup } from '../utils/printBrand';

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

export const DriverAdvancesPage: React.FC<{ embedded?: boolean; initialView?: 'ledger' | 'transactions' }> = ({
  embedded = false,
  initialView = 'transactions',
}) => {
  // Main active view: 'ledger' (per-driver summary) or 'transactions' (all advance records)
  const [activeView, setActiveView] = useState<'ledger' | 'transactions'>(embedded ? 'transactions' : initialView);

  useEffect(() => {
    if (embedded) setActiveView('transactions');
  }, [embedded]);

  // Lookups
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
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
  const debouncedSearch = useDebouncedValue(search, 400);
  const [driverFilter, setDriverFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOwnerFilter, setModalOwnerFilter] = useState('');

  // Filtered vehicles list based on selected ownerFilter
  const filteredVehicles = useMemo(() => {
    if (!ownerFilter) return vehicles;
    return vehicles.filter((v) => String(v.owner_id) === String(ownerFilter));
  }, [vehicles, ownerFilter]);

  // Expand state in Ledger view
  const [expandedDriverId, setExpandedDriverId] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<{
    [driverId: number]: {
      advances: DriverAdvance[];
      trips: Trip[];
      loading: boolean;
    };
  }>({});
  const [expandedTripExpenses, setExpandedTripExpenses] = useState<{ [tripId: number]: boolean }>({});
  const toggleTripExpenses = (tripId: number) => {
    setExpandedTripExpenses((prev) => ({ ...prev, [tripId]: !prev[tripId] }));
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingDriverId, setPrintingDriverId] = useState<number | null>(null);
  const [downloadingDriverId, setDownloadingDriverId] = useState<number | null>(null);
  const [downloadingPdfTripId, setDownloadingPdfTripId] = useState<number | null>(null);
  const [downloadingExcelTripId, setDownloadingExcelTripId] = useState<number | null>(null);

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<DriverAdvance | null>(null);
  const [formData, setFormData] = useState({
    driver_id: '',
    manager_id: '',
    vehicle_id: '',
    trip_id: '',
    amount: '',
    advance_date: new Date().toISOString().split('T')[0],
    payment_mode: 'CASH',
    notes: '',
  });
  const [modalDriverTrips, setModalDriverTrips] = useState<Trip[]>([]);
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
  }, [activeView, page, debouncedSearch, driverFilter, ownerFilter, managerFilter, vehicleFilter, paymentModeFilter, fromDate, toDate]);

  useEffect(() => {
    const onFocus = () => {
      if (activeView === 'ledger') loadLedgerSummary();
      else loadAdvances();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [activeView, driverFilter, ownerFilter, fromDate, toDate]);

  const loadLookups = async () => {
    try {
      const [dRes, vRes, oRes, uRes] = await Promise.all([
        driverService.getDrivers({ limit: 500, status: 'ACTIVE' }),
        vehicleService.getVehicles({ limit: 500, status: 'ACTIVE' }),
        ownerService.getOwners({ limit: 500, status: 'ACTIVE' }),
        userService.getUsers({ limit: 200, status: 'ACTIVE' }),
      ]);
      setDrivers(dRes.data.items || (Array.isArray(dRes.data) ? dRes.data : []));
      setVehicles(vRes.data.items || (Array.isArray(vRes.data) ? vRes.data : []));
      setOwners(oRes.data.items || (Array.isArray(oRes.data) ? oRes.data : []));
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
        limit: 100,
        search: debouncedSearch || undefined,
        driver_id: driverFilter || undefined,
        owner_id: ownerFilter || undefined,
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
        owner_id: ownerFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        search: debouncedSearch || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
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

  const loadDriverTripsForModal = async (driverId: string) => {
    if (!driverId) { setModalDriverTrips([]); return; }
    try {
      const res = await tripService.getTrips({ driver_id: driverId, limit: 100 });
      const items: Trip[] = res.data?.items || [];
      setModalDriverTrips(items.filter((t: Trip) => !['CANCELLED', 'DRAFT'].includes(t.status)));
    } catch {
      setModalDriverTrips([]);
    }
  };

  const handleOpenCreate = (prefillDriverId?: number) => {
    setEditingAdvance(null);
    const dId = prefillDriverId ? String(prefillDriverId) : '';
    setFormData({
      driver_id: dId,
      manager_id: '',
      vehicle_id: '',
      trip_id: '',
      amount: '',
      advance_date: new Date().toISOString().split('T')[0],
      payment_mode: 'CASH',
      notes: '',
    });
    if (dId) loadDriverTripsForModal(dId);
    else setModalDriverTrips([]);
    setModalOwnerFilter(ownerFilter || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (adv: DriverAdvance) => {
    setEditingAdvance(adv);
    const dId = String(adv.driver_id);
    setFormData({
      driver_id: dId,
      manager_id: String(adv.manager_id),
      vehicle_id: adv.vehicle_id ? String(adv.vehicle_id) : '',
      trip_id: adv.trip_id ? String(adv.trip_id) : '',
      amount: String(adv.amount),
      advance_date: adv.advance_date ? adv.advance_date.slice(0, 10) : new Date().toISOString().split('T')[0],
      payment_mode: adv.payment_mode || 'CASH',
      notes: adv.notes || '',
    });
    loadDriverTripsForModal(dId);
    const ev = vehicles.find((v) => String(v.id) === String(adv.vehicle_id));
    setModalOwnerFilter(ev?.owner_id ? String(ev.owner_id) : (ownerFilter || ''));
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
          trip_id: formData.trip_id ? parseInt(formData.trip_id) : undefined,
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
          trip_id: formData.trip_id ? parseInt(formData.trip_id) : undefined,
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
      if (ownerFilter) {
        if (d.owner_id) {
          if (String(d.owner_id) !== String(ownerFilter)) return false;
        } else if (d.lorry_number) {
          const veh = vehicles.find((v) => v.lorry_number === d.lorry_number);
          if (veh && String(veh.owner_id) !== String(ownerFilter)) return false;
        }
      }
      return true;
    });
  }, [driverSummaries, statusFilter, vehicleFilter, ownerFilter, vehicles]);

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
    const needToPay = Math.max(0, parseFloat(String((d as any).need_to_pay ?? 0)));
    // Even if settlement_status === 'SETTLED', if there's still cash in hand
    // (e.g. a new advance was given after the last settlement), show CASH_IN_HAND.
    // Similarly if need_to_pay > 0, that takes priority.
    let status = d.settlement_status || (bal > 0 ? 'CASH_IN_HAND' : 'SETTLED');
    if (status === 'SETTLED' && bal > 0) status = 'CASH_IN_HAND';
    if (needToPay > 0 && status === 'SETTLED') status = 'PENDING';

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

  // ── Tab-Aware: Download Advances Only Excel ────────────────────────
  const handleDownloadDriverAdvancesExcel = async (d: DriverAdvanceSummary) => {
    try {
      setDownloadingDriverId(d.driver_id);
      const { advances } = await getOrFetchDriverDetails(d.driver_id);
      const wb = XLSX.utils.book_new();
      const advRows: any[] = advances.map((a, i) => ({
        'S.No': i + 1,
        'Advance ID': `#ADV-${a.id}`,
        'Date & Time (IST)': formatAdvanceDateTime(a.advance_date, a.created_at),
        'Driver Name': d.driver_name,
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
        'Date & Time (IST)': '', 'Driver Name': '', 'Disbursed By (Manager)': '',
        'Vehicle / Lorry': '', 'Payment Mode': '',
        'Amount (₹)': advances.reduce((s, a) => s + (parseFloat(String(a.amount || 0)) || 0), 0),
        'Notes / Remarks': '',
      });
      const ws = XLSX.utils.json_to_sheet(advRows);
      ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 28 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Advances Received');
      const safeDriver = d.driver_name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      XLSX.writeFile(wb, `KSP_Advances_${safeDriver}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      alert(err.message || 'Failed to download advances Excel.');
    } finally {
      setDownloadingDriverId(null);
    }
  };

  // ── Tab-Aware: Download Trips Only Excel ───────────────────────────
  const handleDownloadDriverTripsExcel = async (d: DriverAdvanceSummary) => {
    try {
      setDownloadingDriverId(d.driver_id);
      const { advances, trips } = await getOrFetchDriverDetails(d.driver_id);
      const sortedTrips = [...trips].sort((a, b) => {
        const dateA = new Date(a.trip_date || 0).getTime();
        const dateB = new Date(b.trip_date || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return (a.id || 0) - (b.id || 0);
      });
      const directAdv = (advances || []).filter(a => !a.trip_id).reduce((s, a) => s + (parseFloat(String(a.amount)) || 0), 0);
      let rb = directAdv;
      const balMap = new Map<number, number>();
      const balBeforeMap = new Map<number, number>();
      const needToPayMap = new Map<number, number>();
      sortedTrips.forEach(t => {
        const adv = parseFloat(String(t.advance_paid || 0));
        const exp = parseFloat(String(t.total_expenses ?? 0)) || 0;
        const balBefore = Math.max(0, rb);
        balBeforeMap.set(t.id, balBefore);
        const rawAfter = Math.round((rb + adv - exp) * 100) / 100;
        balMap.set(t.id, Math.max(0, rawAfter));
        needToPayMap.set(t.id, rawAfter < 0 ? Math.abs(rawAfter) : 0);
        rb = Math.max(0, rawAfter);
      });
      const tripRows: any[] = trips.map((t, i) => {
        const balBefore = balBeforeMap.get(t.id) ?? 0;
        const balAfter = balMap.get(t.id) ?? 0;
        const needToPay = needToPayMap.get(t.id) ?? 0;
        const adv = parseFloat(String(t.advance_paid || 0));
        const exp = parseFloat(String(t.total_expenses || 0));
        const taken = balBefore > 0 ? Math.min(balBefore, Math.max(0, exp - adv)) : 0;
        const isSettled = (t as any).settlement_status === 'SETTLED';
        return {
          'S.No': i + 1,
          'Trip ID': `TRIP-${t.id}`,
          'Trip Date': formatISTDate(t.trip_date),
          'Driver Name': d.driver_name,
          'Vehicle / Lorry': t.lorry_number || '—',
          'Party': t.party_name || '—',
          'Route': t.from_location && t.to_location ? `${t.from_location} → ${t.to_location}` : '—',
          'Goods Weight': t.goods_weight ? `${t.goods_weight} ${t.unit_abbreviation || 'MT'}` : '—',
          'Total Freight (₹)': parseFloat(String(t.total_freight || 0)),
          'Prior In Hand (₹)': balBefore,
          'Advance Paid (₹)': adv,
          'Trip Expenses (₹)': exp,
          'Already in Hand Taken (₹)': taken,
          'Driver Balance (₹)': needToPay > 0 ? (isSettled ? `Paid: ₹${needToPay.toFixed(2)}` : `Need to Pay: ₹${needToPay.toFixed(2)}`) : `In Hand: ₹${balAfter.toFixed(2)}`,
          'Status': isSettled ? 'Settled' : (t as any).settlement_status === 'PENDING' ? 'Settlement Pending' : (t as any).settlement_status === 'VERIFIED' ? 'Verified (Pending)' : (balAfter > 0 ? 'Cash in Hand' : 'Settled'),
        };
      });
      tripRows.push({});
      tripRows.push({
        'S.No': 'TOTAL', 'Trip ID': `${trips.length} Trips`, 'Trip Date': '', 'Driver Name': '',
        'Vehicle / Lorry': '', 'Party': '', 'Route': '', 'Goods Weight': '',
        'Total Freight (₹)': trips.reduce((s, t) => s + (parseFloat(String(t.total_freight || 0)) || 0), 0),
        'Advance Paid (₹)': trips.reduce((s, t) => s + (parseFloat(String(t.advance_paid || 0)) || 0), 0),
        'Trip Expenses (₹)': trips.reduce((s, t) => s + (parseFloat(String(t.total_expenses || 0)) || 0), 0),
        'Driver Balance (₹)': sortedTrips.length > 0 ? (balMap.get(sortedTrips[sortedTrips.length - 1]?.id) ?? 0) : 0,
        'Status': '',
      });
      const ws = XLSX.utils.json_to_sheet(tripRows);
      ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Trips & Settlements');
      const safeDriver = d.driver_name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      XLSX.writeFile(wb, `KSP_Trips_${safeDriver}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      alert(err.message || 'Failed to download trips Excel.');
    } finally {
      setDownloadingDriverId(null);
    }
  };

  // ── Single Driver Statement: Print / Save as PDF ───────────────────
  const handlePrintSingleDriverStatement = async (d: DriverAdvanceSummary) => {
    try {
      setPrintingDriverId(d.driver_id);
      const res = await driverAdvanceService.getDriverStatement(d.driver_id);
      const data = res.data;

      const totalAdv    = parseFloat(String(data.summary?.total_advance_given ?? d.total_advance_given ?? 0));
      const totalExp    = parseFloat(String(data.summary?.total_expenses ?? d.total_expenses_reported ?? 0));
      const mgrAdv      = parseFloat(String(data.summary?.manager_advance_total ?? 0));
      const ownAdv      = parseFloat(String(data.summary?.owner_advance_total ?? 0));
      const tripAdv     = parseFloat(String(data.summary?.trip_advance_total ?? 0));
      const withoutTrip = parseFloat(String(data.summary?.without_trip_advance_total ?? 0));
      const settledPaid = parseFloat(String(data.summary?.total_settled_cash_paid ?? 0));
      const netBal      = totalAdv + settledPaid - totalExp;
      const balInHand   = netBal > 0 ? netBal : 0;
      const needToPay   = netBal < 0 ? Math.abs(netBal) : 0;

      const fmtINR = (v: number) => `₹${Math.round(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>KSP Driver Statement - ${data.driver.name}</title>
      <style>
    ${PRINT_BRAND_CSS}
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:22px;color:#0f172a;background:#fff;font-size:11px}
        @page{size:A4 portrait;margin:8mm}
        .statement-box{border:2px solid #0f172a;border-radius:8px;padding:18px;max-width:900px;margin:0 auto}
        .s-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:14px}
        .s-title{font-size:22px;font-weight:900;color:#0f172a;margin:0 0 2px}
        .s-subtitle{font-size:11.5px;font-weight:700;color:#2563eb;text-transform:uppercase;margin:0;letter-spacing:.5px}
        .tag-v{background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:6px;font-weight:800;font-size:12.5px;border:1px solid #bfdbfe;display:inline-block}
        .tag-t{margin-top:4px;font-weight:700;color:#4338ca;font-size:11px;text-align:right}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
        .card-b{background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px}
        .lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:2px}
        .val{font-size:13px;font-weight:800;color:#0f172a}
        /* Advance summary cards */
        .adv-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
        .adv-card{padding:8px 10px;border-radius:6px;border:1px solid}
        .adv-card .clbl{font-size:9px;font-weight:700;text-transform:uppercase;margin-bottom:2px}
        .adv-card .camt{font-size:14px;font-weight:900}
        .adv-card .csub{font-size:9px;color:#64748b;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:10px;margin-top:6px;margin-bottom:14px}
        th{background:#0f172a;color:#fff;font-weight:700;text-align:left;padding:6px 7px;font-size:9.5px}
        td{padding:5px 7px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
        tr:nth-child(even) td{background:#fbfcfe}
        .num{text-align:right}
        .center{text-align:center}
        .badge{display:inline-block;padding:2px 5px;border-radius:4px;font-size:8.5px;font-weight:800;text-transform:uppercase}
        .badge-mgr{background:#dbeafe;color:#1e40af}
        .badge-own{background:#f3e8ff;color:#6b21a8}
        .badge-drv{background:#fef3c7;color:#92400e}
        .badge-trip{background:#e0f2fe;color:#0369a1}
        .badge-notrip{background:#fef3c7;color:#b45309}
        .recon-box{background:#f8fafc;border:2px solid #0f172a;border-radius:6px;padding:12px 14px;margin-top:12px}
        .recon-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px}
        .recon-divider{border-top:1px solid #cbd5e1;margin:5px 0}
        .recon-total{border-top:2px solid #0f172a;padding-top:6px;margin-top:4px;font-size:13px;font-weight:800}
        .sig-row{display:flex;justify-content:space-between;margin-top:30px;padding-top:10px}
        .sig-line{text-align:center;width:170px}
        .sig-box{border-top:1px solid #64748b;padding-top:4px;font-size:10px;font-weight:700;color:#475569}
        .pbar{display:flex;justify-content:flex-end;gap:10px;max-width:900px;margin:0 auto 12px auto}
        .btn-p{background:#2563eb;color:#fff;border:none;padding:7px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:11.5px}
        @media print{.pbar{display:none!important};body{padding:0}}
      </style></head><body>
      <div class="pbar">
        <button class="btn-p" onclick="window.print()">Print / Save as PDF</button>
        <button class="btn-p" style="background:#64748b" onclick="window.close()">Close</button>
      </div>
      <div class="statement-box">
        <div class="s-header">
          <div>
            ${printBrandLockup()}
            <div class="s-subtitle">Driver Advance &amp; Trip Expense Statement (Carry-Forward Reconciliation)</div>
            <div style="font-size:10.5px;color:#64748b;margin-top:2px">KSP Service Fleet Accounts</div>
          </div>
          <div style="text-align:right">
            <div class="tag-v">DRIVER #${data.driver.id}</div>
            <div class="tag-t">Generated: ${formatIST(new Date())}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card-b">
            <div class="lbl">Driver Profile</div>
            <div class="val">${data.driver.name}</div>
            <div style="font-size:10.5px;color:#475569;margin-top:2px">Mobile: ${data.driver.mobile_number || '—'} | License: ${data.driver.license_number || '—'}</div>
            <div class="lbl" style="margin-top:6px">Assigned Truck</div>
            <div style="font-weight:800;color:#0369a1;font-size:12px">🚛 ${d.lorry_number || 'No Vehicle Assigned'}</div>
            ${d.owner_name ? `<div style="font-size:10.5px;color:#6b21a8;font-weight:700;margin-top:2px">👤 Owner: ${d.owner_name}</div>` : ''}
          </div>
          <div class="card-b">
            <div class="lbl">Current Account Status</div>
            <div class="val" style="color:${balInHand > 0 ? '#15803d' : needToPay > 0 ? '#dc2626' : '#16a34a'}">
              ${balInHand > 0 ? fmtINR(balInHand) + ' (Cash in Hand)' : needToPay > 0 ? fmtINR(needToPay) + ' (Office Owes Driver)' : '₹0.00 (All Settled)'}
            </div>
            <div class="lbl" style="margin-top:6px">Active / Most Recent Trip</div>
            <div style="font-weight:700;color:#1e293b;font-size:11.5px">${d.trip_id ? `TRIP #${d.trip_id} ${d.is_active_trip ? '(ACTIVE)' : ''}` : 'No Active Trip'}</div>
            <div style="font-size:10px;color:#64748b">${d.from_location && d.to_location ? `${d.from_location} → ${d.to_location}` : '—'}</div>
          </div>
        </div>

        <!-- Advance Breakdown Cards (Who Given & For What) -->
        <div class="adv-cards">
          <div class="adv-card" style="background:#eff6ff;border-color:#bfdbfe">
            <div class="clbl" style="color:#1d4ed8">Manager Advances</div>
            <div class="camt" style="color:#1d4ed8">${fmtINR(mgrAdv)}</div>
            <div class="csub">Disbursed by Manager</div>
          </div>
          <div class="adv-card" style="background:#faf5ff;border-color:#c4b5fd">
            <div class="clbl" style="color:#7c3aed">Owner Advances</div>
            <div class="camt" style="color:#7c3aed">${fmtINR(ownAdv)}</div>
            <div class="csub">Disbursed by Truck Owner</div>
          </div>
          <div class="adv-card" style="background:#f0fdf4;border-color:#86efac">
            <div class="clbl" style="color:#15803d">Advances Without Trip</div>
            <div class="camt" style="color:#15803d">${fmtINR(withoutTrip)}</div>
            <div class="csub">Direct / Personal Disbursements</div>
          </div>
          <div class="adv-card" style="background:#fef3c7;border-color:#fcd34d">
            <div class="clbl" style="color:#b45309">Total Trip Expenses</div>
            <div class="camt" style="color:#b45309">${fmtINR(totalExp)}</div>
            <div class="csub">Across all trips</div>
          </div>
        </div>

        <!-- Section 1: Itemized Advance Disbursements -->
        <h3 style="font-size:11.5px;margin:10px 0 4px;color:#0f172a;text-transform:uppercase;letter-spacing:0.3px">1. Itemized Advance Disbursements (To Whom, Given By &amp; Amount)</h3>
        <table>
          <thead>
            <tr>
              <th class="center" style="width:26px">#</th>
              <th>Date</th>
              <th>Given By (Manager / Owner)</th>
              <th>For What (Purpose / Trip)</th>
              <th>Vehicle / Lorry</th>
              <th class="num">Amount Given (₹)</th>
              <th class="num">Balance in Hand (₹)</th>
              <th>Notes / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${(data.advances || []).length === 0 ? `
              <tr><td colspan="8" class="center" style="color:#94a3b8;padding:12px">No advances recorded for this driver.</td></tr>
            ` : (data.advances || []).map((adv: any, idx: number) => {
              const isOwner = adv.given_by_role === 'OWNER' || adv.source_type === 'OWNER_ADVANCE';
              const giverLabel = isOwner ? `Owner: ${adv.given_by_name || adv.given_by || 'Owner'}` : `Manager: ${adv.manager_name || adv.given_by_name || 'Manager'}`;
              const isWithoutTrip = !adv.trip_id && adv.source_type !== 'TRIP_ADVANCE';
              const forWhatLabel = adv.trip_id ? `TRIP #${adv.trip_id} ADVANCE` : `WITHOUT TRIP (DIRECT ADVANCE)`;
              const amt = parseFloat(String(adv.amount || 0)) || 0;
              const bal = Math.max(0, parseFloat(String(adv.driver_balance_in_hand ?? adv.balance_in_hand ?? 0)) || 0);

              return `<tr>
                <td class="center">${idx + 1}</td>
                <td>${formatISTDate(adv.advance_date || adv.created_at)}</td>
                <td><span class="badge ${isOwner ? 'badge-own' : 'badge-mgr'}">${giverLabel}</span></td>
                <td>
                  <span class="badge ${isWithoutTrip ? 'badge-notrip' : 'badge-trip'}">${forWhatLabel}</span>
                  ${adv.party_name ? `<div style="font-size:8.5px;color:#475569;margin-top:2px">${adv.party_name}</div>` : ''}
                </td>
                <td><strong>${adv.lorry_number || '—'}</strong></td>
                <td class="num" style="font-weight:800;color:#15803d">₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td class="num" style="font-weight:800;color:${bal > 0 ? '#047857' : '#64748b'}">₹${bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="color:#64748b">${adv.notes || '—'}</td>
              </tr>`;
            }).join('')}
            <tr style="background:#f1f5f9;font-weight:800;border-top:2px solid #0f172a">
              <td colspan="5" class="num">TOTAL ADVANCES RECEIVED:</td>
              <td class="num" style="color:#15803d;font-size:11px">${fmtINR(totalAdv)}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <!-- Section 2: Chronological Activity Ledger & Running Balance -->
        <h3 style="font-size:11.5px;margin:12px 0 4px;color:#0f172a;text-transform:uppercase;letter-spacing:0.3px">2. Chronological Balance Reconciliation (Trip-to-Trip Reductions &amp; Carry-Forward)</h3>
        <table>
          <thead>
            <tr>
              <th class="center" style="width:26px">#</th>
              <th>Date</th>
              <th>Activity Type</th>
              <th>Who Given / Source</th>
              <th>For What (Purpose / Route)</th>
              <th class="num">Amount (₹)</th>
              <th>Deficit / Surplus Carry-Forward Adjustment</th>
              <th class="num">Running Net Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${(data.chronological_timeline || data.timeline || []).map((item: any, idx: number) => {
              const typeColor = item.type === 'ADVANCE' ? '#15803d' : item.type === 'EXPENSE' ? '#b45309' : '#2563eb';
              const amtColor = item.effect === '+' ? '#15803d' : item.effect === '-' ? '#dc2626' : '#64748b';
              const rBal = parseFloat(String(item.running_balance ?? 0));
              const rBalColor = rBal > 0 ? '#15803d' : rBal < 0 ? '#dc2626' : '#64748b';
              const rBalText = rBal > 0 ? `₹${rBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} In Hand` : rBal < 0 ? `₹${Math.abs(rBal).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Due to Driver` : '₹0.00 Settled';

              return `<tr>
                <td class="center">${idx + 1}</td>
                <td>${formatISTDate(item.date)}</td>
                <td><strong style="color:${typeColor}">${item.type}</strong></td>
                <td><strong>${item.given_by || item.manager_name || '—'}</strong></td>
                <td>${item.given_for || item.subtitle || item.title || '—'}</td>
                <td class="num" style="font-weight:700;color:${amtColor}">${item.effect} ₹${(parseFloat(String(item.amount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="font-size:9.5px;color:${item.carry_forward_note && item.carry_forward_note.includes('Reduces') ? '#2563eb' : item.carry_forward_note && item.carry_forward_note.includes('exceeded') ? '#dc2626' : '#475569'}">
                  ${item.carry_forward_note || '—'}
                </td>
                <td class="num" style="font-weight:800;color:${rBalColor}">${rBalText}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <!-- Section 3: Final Account Reconciliation Box -->
        <div class="recon-box">
          <div style="font-size:11.5px;font-weight:800;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Final Account Reconciliation</div>
          ${mgrAdv > 0 ? `<div class="recon-row"><span>Advances Disbursed by Manager</span><span style="color:#1d4ed8;font-weight:700">${fmtINR(mgrAdv)}</span></div>` : ''}
          ${ownAdv > 0 ? `<div class="recon-row"><span>Advances Disbursed by Owner</span><span style="color:#7c3aed;font-weight:700">${fmtINR(ownAdv)}</span></div>` : ''}
          ${withoutTrip > 0 ? `<div class="recon-row"><span>· of which given Without Trip (Direct / Personal)</span><span style="color:#b45309;font-weight:600">${fmtINR(withoutTrip)}</span></div>` : ''}
          ${settledPaid > 0 ? `<div class="recon-row"><span>Direct Settlement Cash Paid to Driver</span><span style="color:#16a34a;font-weight:700">(+) ${fmtINR(settledPaid)}</span></div>` : ''}
          <div class="recon-divider"></div>
          <div class="recon-row"><span style="font-weight:700">Total Advances &amp; Payments Received</span><span style="font-weight:800;color:#15803d">${fmtINR(totalAdv + settledPaid)}</span></div>
          <div class="recon-row"><span>Less: Total Actual Trip Expenses Accounted</span><span style="font-weight:700;color:#b45309">(-) ${fmtINR(totalExp)}</span></div>
          <div class="recon-divider"></div>
          ${balInHand > 0 ? `
          <div class="recon-row recon-total" style="color:#15803d">
            <span>NET CASH BALANCE IN DRIVER'S HAND (SURPLUS):</span>
            <span style="font-size:15px;font-weight:900;color:#15803d">${fmtINR(balInHand)}</span>
          </div>` : needToPay > 0 ? `
          <div class="recon-row recon-total" style="color:#dc2626">
            <span>NET BALANCE PAYABLE TO DRIVER (OFFICE OWES DRIVER):</span>
            <span style="font-size:15px;font-weight:900;color:#dc2626">${fmtINR(needToPay)}</span>
          </div>` : `
          <div class="recon-row recon-total" style="color:#16a34a">
            <span>ALL ACCOUNTS RECONCILED — NIL BALANCE:</span>
            <span style="font-size:15px;font-weight:900;color:#16a34a">₹0.00</span>
          </div>`}
        </div>

        <div class="sig-row">
          <div class="sig-line">
            <div style="height:28px"></div>
            <div class="sig-box">Driver (${data.driver.name})</div>
          </div>
          <div class="sig-line">
            <div style="height:28px"></div>
            <div class="sig-box">Disbursing Manager</div>
          </div>
          <div class="sig-line">
            <div style="height:28px"></div>
            <div class="sig-box">Authorized Signatory / Accounts</div>
          </div>
        </div>
      </div>
      </body></html>`;

      const win = window.open('', '_blank', 'width=950,height=880');
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
      const balInHand = Math.max(0, parseFloat(String(a.driver_balance_in_hand ?? 0)));

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
      const balInHand = Math.max(0, parseFloat(String(a.driver_balance_in_hand ?? 0)));

      const singleHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>KSP Driver Advance Voucher #${a.id} - ${a.driver_name}</title>
      <style>
    ${PRINT_BRAND_CSS}
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
            ${printBrandLockup()}
            <div class="v-subtitle">Driver Advance Disbursement Voucher</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px">KSP Service Management ERP</div>
          </div>
          <div style="text-align:right">
            <div class="tag-v">VOUCHER #${a.id}</div>
            <div class="tag-t">${a.trip_id ? `TRIP #${a.trip_id} ADVANCE` : 'WITHOUT TRIP (DIRECT ADVANCE)'}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card-b">
            <div class="lbl">Driver Details</div>
            <div class="val">${a.driver_name}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px">Mobile: ${a.driver_mobile || '—'} | License: ${a.driver_license || '—'}</div>
            <div class="lbl" style="margin-top:8px">Vehicle / Lorry Number</div>
            <div style="font-weight:800;color:#0369a1;font-size:13px">🚛 ${a.lorry_number || 'Direct Advance (No Vehicle)'}</div>
            ${a.owner_name ? `<div style="font-size:11.5px;color:#6b21a8;font-weight:700;margin-top:3px">👤 Truck Owner: ${a.owner_name}</div>` : ''}
          </div>
          <div class="card-b">
            <div class="lbl">Disbursement Date &amp; Time (IST)</div>
            <div class="val" style="font-size:13px">${formatAdvanceDateTime(a.advance_date, a.created_at)}</div>
            <div class="lbl" style="margin-top:8px">Disbursed By (Who Given)</div>
            <div style="font-weight:800;color:#1e293b;font-size:13px">
              ${a.given_by || (a.source_type === 'OWNER_DIRECT_ADVANCE' || a.given_by_role === 'OWNER' ? `👤 Owner: ${a.given_by_name || 'Owner'}` : `👤 Manager: ${a.manager_name || 'Manager'}`)}
            </div>
            <div style="font-size:11px;color:#475569;margin-top:2px">Payment Mode: <strong>${a.payment_mode || 'CASH'}</strong></div>
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

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase">Advance Purpose (For What Given)</div>
          <div style="margin-top:4px">
            ${a.trip_id ? `
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-weight:800;color:#4338ca">TRIP #${a.trip_id} ADVANCE</span>
                <span style="font-weight:600;color:#0f172a">${a.party_name || '—'}</span>
                <span style="color:#64748b;font-size:11.5px">${a.from_location && a.to_location ? `${a.from_location} → ${a.to_location}` : '—'}</span>
              </div>
            ` : `
              <div style="font-weight:700;color:#b45309">WITHOUT TRIP · DIRECT ADVANCE</div>
              <div style="font-size:11.5px;color:#334155;margin-top:2px">${a.notes || 'Direct driver advance disbursed between trips'}</div>
            `}
          </div>
        </div>

        ${a.notes && a.trip_id ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:6px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase">Notes / Remarks:</div>
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
            <div class="sig-box">${a.source_type === 'OWNER_DIRECT_ADVANCE' || a.given_by_role === 'OWNER' ? 'Disbursing Owner' : `Disbursing Manager (${a.manager_name || 'Manager'})`}</div>
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

  // ── Single Trip Excel Download (from Trips & Settlements sub-tab) ─
  const handleDownloadSingleTripExcel = (t: Trip, driverName: string) => {
    try {
      setDownloadingExcelTripId(t.id);
      const freight = parseFloat(String(t.total_freight)) || 0;
      const advance = parseFloat(String(t.advance_paid)) || 0;
      const expenses = parseFloat(String(t.total_expenses ?? 0)) || 0;
      const prevInHand = parseFloat(String(t.previous_driver_balance || 0));
      const priorDeficitDeduction = parseFloat(String((t as any).prior_deficit_deduction || 0));
      const effectiveAdvance = Math.max(0, advance - priorDeficitDeduction);
      const paidAmt = parseFloat(String((t as any).settlement_paid_amount || (t as any).paid_amount || 0));
      const isSettled = (t as any).settlement_status === 'SETTLED';

      let needToPay = 0;
      let balInHand = 0;
      if ((t as any).settlement_id) {
        if (isSettled) {
          needToPay = 0;
          balInHand = 0;
        } else {
          const netBal = parseFloat(String((t as any).net_balance_to_driver ?? (t as any).settlement_net_balance ?? 0));
          if (netBal > 0) { needToPay = netBal; balInHand = 0; }
          else { needToPay = 0; balInHand = Math.abs(netBal); }
        }
      } else {
        if (expenses > effectiveAdvance) {
          needToPay = expenses - effectiveAdvance;
          balInHand = 0;
        } else {
          needToPay = 0;
          balInHand = effectiveAdvance - expenses;
        }
      }

      const rows: any[] = [
        { Detail: 'TRIP ID',                    Value: `TRIP-${t.id}` },
        { Detail: 'TRIP DATE',                  Value: formatISTDate(t.trip_date) },
        { Detail: 'DRIVER NAME',                Value: driverName },
        { Detail: 'LORRY NUMBER',               Value: t.lorry_number || '—' },
        { Detail: 'PARTY NAME',                 Value: t.party_name || '—' },
        { Detail: 'ROUTE (FROM)',               Value: t.from_location || '—' },
        { Detail: 'ROUTE (TO)',                 Value: t.to_location || '—' },
        { Detail: 'GOODS WEIGHT',               Value: t.goods_weight ? `${t.goods_weight} ${t.unit_abbreviation || 'MT'}` : '—' },
        { Detail: 'FREIGHT RATE (₹)',           Value: parseFloat(String(t.freight_rate || 0)) },
        { Detail: 'TOTAL FREIGHT (₹)',          Value: freight },
        { Detail: 'TRIP ADVANCE PAID (₹)',      Value: advance },
        ...(priorDeficitDeduction > 0 ? [
          { Detail: 'LESS: PRIOR DEFICIT DEDUCTION (₹)', Value: priorDeficitDeduction },
          { Detail: 'EFFECTIVE ADVANCE FOR TRIP (₹)',    Value: effectiveAdvance },
        ] : []),
        { Detail: 'TRIP EXPENSES (₹)',          Value: expenses },
        ...(paidAmt > 0 ? [
          { Detail: 'LESS: ADJUSTED FROM NEXT TRIP ADVANCE (₹)', Value: paidAmt },
        ] : []),
        { Detail: needToPay > 0 ? (isSettled ? 'PAID TO DRIVER (₹)' : 'BALANCE NEED TO PAY (₹)') : 'BALANCE IN DRIVER HAND (₹)', Value: needToPay > 0 ? needToPay : balInHand },
        { Detail: 'SETTLEMENT STATUS',          Value: (t as any).settlement_status || t.status || '—' },
      ];
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 36 }, { wch: 40 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Trip_${t.id}`);
      const safeDriver = driverName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      XLSX.writeFile(wb, `KSP_Trip_${t.id}_${safeDriver}.xlsx`);
    } catch (err: any) {
      alert(err.message || 'Failed to download trip Excel.');
    } finally {
      setDownloadingExcelTripId(null);
    }
  };

  // ── Single Trip PDF Download (from Trips & Settlements sub-tab) ───
  const handleDownloadSingleTripPdf = async (t: Trip, driverName: string) => {
    try {
      setDownloadingPdfTripId(t.id);
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const freight = parseFloat(String(t.total_freight)) || 0;
      const advance = parseFloat(String(t.advance_paid)) || 0;
      const expenses = parseFloat(String(t.total_expenses ?? 0)) || 0;
      const priorDeficitDeduction = parseFloat(String((t as any).prior_deficit_deduction || 0));
      const effectiveAdvance = Math.max(0, advance - priorDeficitDeduction);
      const paidAmt = parseFloat(String((t as any).settlement_paid_amount || (t as any).paid_amount || 0));
      const sStatus: string = (t as any).settlement_status || t.status || 'PENDING';
      const isSettledTrip = sStatus === 'SETTLED';

      let needToPay = 0;
      let balInHand = 0;
      if ((t as any).settlement_id) {
        if (isSettledTrip) {
          needToPay = 0;
          balInHand = 0;
        } else {
          const netBal = parseFloat(String((t as any).net_balance_to_driver ?? (t as any).settlement_net_balance ?? 0));
          if (netBal > 0) {
            needToPay = netBal;
            balInHand = 0;
          } else {
            needToPay = 0;
            balInHand = Math.abs(netBal);
          }
        }
      } else {
        if (expenses > effectiveAdvance) {
          needToPay = expenses - effectiveAdvance;
          balInHand = 0;
        } else {
          needToPay = 0;
          balInHand = effectiveAdvance - expenses;
        }
      }

      const freightRate = parseFloat(String(t.freight_rate || 0));
      const settlementStatus = sStatus;
      const tripDateStr = formatISTDate(t.trip_date);
      const todayStr = formatISTDate(new Date().toISOString());

      let statusStyle = 'background:#fef3c7;color:#b45309;border:1px solid #fcd34d;';
      let statusText = 'SETTLEMENT PENDING';
      if (settlementStatus === 'SETTLED') {
        statusStyle = 'background:#dcfce7;color:#15803d;border:1px solid #86efac;';
        statusText = 'SETTLED';
      } else if (settlementStatus === 'VERIFIED') {
        statusStyle = 'background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;';
        statusText = 'VERIFIED (PENDING)';
      } else if (settlementStatus === 'CANCELLED' || t.status === 'CANCELLED') {
        statusStyle = 'background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;';
        statusText = 'CANCELLED';
      }

      const voucherHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#fff;width:730px;margin:0 auto;box-sizing:border-box;">
          <div style="border:2px solid #1e3a8a;border-radius:8px;padding:20px 22px;background:#fff;box-sizing:border-box;">

            <!-- Top bar -->
            <table style="width:100%;border-bottom:2.5px solid #1e3a8a;padding-bottom:12px;margin-bottom:14px;border-collapse:collapse;">
              <tr>
                <td style="width:58%;vertical-align:top;">
                  <div style="font-size:22px;font-weight:900;color:#1e3a8a;">K.S.P. TRANSPORT</div>
                  <div style="font-size:10.5px;font-weight:700;color:#b45309;text-transform:uppercase;margin-top:3px;">Professional Heavy Freight &amp; Logistics Services</div>
                  <div style="font-size:10px;color:#475569;margin-top:4px;line-height:1.45;">
                    Head Office: Namakkal / Salem Highway, Tamil Nadu<br/>
                    Registered Transport Carrier &bull; Phone: +91 98765 43210
                  </div>
                </td>
                <td style="width:42%;vertical-align:top;text-align:right;">
                  <div style="font-size:15px;font-weight:900;color:#1e3a8a;text-transform:uppercase;">DRIVER TRIP SETTLEMENT</div>
                  <div style="font-size:10px;color:#64748b;margin-top:3px;font-weight:600;">Trip Advance &amp; Expense Summary Record</div>
                </td>
              </tr>
            </table>

            <!-- Reference table -->
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border:1.5px solid #1e3a8a;font-size:11px;">
              <tbody>
                <tr>
                  <td style="width:18%;background:#eff6ff;font-weight:700;color:#1e3a8a;padding:7px 10px;border:1px solid #bfdbfe;">TRIP ID</td>
                  <td style="width:32%;font-weight:900;color:#0f172a;padding:7px 10px;border:1px solid #bfdbfe;font-size:13px;">TRIP-${t.id}</td>
                  <td style="width:18%;background:#eff6ff;font-weight:700;color:#1e3a8a;padding:7px 10px;border:1px solid #bfdbfe;">TRIP DATE</td>
                  <td style="width:32%;font-weight:900;color:#1d4ed8;padding:7px 10px;border:1px solid #bfdbfe;font-size:13px;">${tripDateStr}</td>
                </tr>
                <tr>
                  <td style="background:#f8fafc;font-weight:700;color:#475569;padding:7px 10px;border:1px solid #cbd5e1;">DRIVER NAME</td>
                  <td style="font-weight:800;color:#0f172a;padding:7px 10px;border:1px solid #cbd5e1;">${driverName}</td>
                  <td style="background:#f8fafc;font-weight:700;color:#475569;padding:7px 10px;border:1px solid #cbd5e1;">SETTLEMENT STATUS</td>
                  <td style="padding:7px 10px;border:1px solid #cbd5e1;">
                    <span style="display:inline-block;font-size:10.5px;font-weight:800;padding:2px 10px;border-radius:3px;text-transform:uppercase;${statusStyle}">${statusText}</span>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8fafc;font-weight:700;color:#475569;padding:6px 10px;border:1px solid #cbd5e1;">ISSUE DATE</td>
                  <td style="font-weight:600;color:#334155;padding:6px 10px;border:1px solid #cbd5e1;">${todayStr}</td>
                  <td style="background:#f8fafc;font-weight:700;color:#475569;padding:6px 10px;border:1px solid #cbd5e1;">LORRY NUMBER</td>
                  <td style="padding:6px 10px;border:1px solid #cbd5e1;">
                    <span style="background:#f1f5f9;border:1px solid #94a3b8;padding:2px 6px;border-radius:3px;font-family:monospace;font-weight:800;font-size:11px;">${t.lorry_number || '—'}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Trip Details -->
            <div style="font-size:11.5px;font-weight:800;color:#1e3a8a;text-transform:uppercase;margin-bottom:6px;">1. Trip &amp; Party Details</div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border:1px solid #cbd5e1;font-size:10.5px;">
              <tbody>
                <tr>
                  <td style="width:20%;background:#f8fafc;font-weight:700;color:#475569;padding:6px 9px;border:1px solid #cbd5e1;">PARTY NAME</td>
                  <td style="width:30%;font-weight:800;color:#0f172a;padding:6px 9px;border:1px solid #cbd5e1;">${t.party_name || '—'}</td>
                  <td style="width:20%;background:#f8fafc;font-weight:700;color:#475569;padding:6px 9px;border:1px solid #cbd5e1;">ROUTE</td>
                  <td style="width:30%;font-weight:600;color:#0f172a;padding:6px 9px;border:1px solid #cbd5e1;">${t.from_location || '—'} ➔ ${t.to_location || '—'}</td>
                </tr>
                <tr>
                  <td style="background:#f8fafc;font-weight:700;color:#475569;padding:6px 9px;border:1px solid #cbd5e1;">GOODS / WEIGHT</td>
                  <td style="font-weight:600;color:#0f172a;padding:6px 9px;border:1px solid #cbd5e1;">${t.goods_weight ? `${t.goods_weight} ${t.unit_abbreviation || 'MT'}` : '—'}</td>
                  <td style="background:#f8fafc;font-weight:700;color:#475569;padding:6px 9px;border:1px solid #cbd5e1;">FREIGHT RATE</td>
                  <td style="font-weight:600;color:#0f172a;padding:6px 9px;border:1px solid #cbd5e1;">₹${freightRate.toFixed(2)} / unit</td>
                </tr>
              </tbody>
            </table>

            <!-- Financial Summary -->
            <div style="font-size:11.5px;font-weight:800;color:#1e3a8a;text-transform:uppercase;margin-bottom:6px;">2. Financial Summary</div>
            <table style="width:100%;border-collapse:separate;border-spacing:10px 0;margin-bottom:14px;margin-left:-10px;">
              <tr>
                <td style="width:25%;border:1px solid #cbd5e1;border-top:3px solid #1e3a8a;border-radius:4px;padding:8px 12px;background:#f8fafc;vertical-align:top;">
                  <div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Total Freight</div>
                  <div style="font-size:16px;font-weight:900;color:#1e3a8a;margin-top:2px;">₹${freight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <div style="font-size:9px;color:#64748b;margin-top:2px;">Gross trip freight</div>
                </td>
                <td style="width:25%;border:1px solid #fde68a;border-top:3px solid #d97706;border-radius:4px;padding:8px 12px;background:#fffbeb;vertical-align:top;">
                  <div style="font-size:9.5px;font-weight:700;color:#b45309;text-transform:uppercase;">Advance Paid</div>
                  <div style="font-size:16px;font-weight:900;color:#d97706;margin-top:2px;">₹${advance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  ${priorDeficitDeduction > 0 ? `
                    <div style="font-size:9px;color:#dc2626;font-weight:700;margin-top:2px;">Prior Deficit: (-) ₹${priorDeficitDeduction.toLocaleString('en-IN')}</div>
                    <div style="font-size:9px;color:#0f172a;font-weight:800;">Effective: ₹${effectiveAdvance.toLocaleString('en-IN')}</div>
                  ` : `
                    <div style="font-size:9px;color:#b45309;margin-top:2px;">Given for trip</div>
                  `}
                </td>
                <td style="width:25%;border:1px solid #fecaca;border-top:3px solid #dc2626;border-radius:4px;padding:8px 12px;background:#fef2f2;vertical-align:top;">
                  <div style="font-size:9.5px;font-weight:700;color:#b91c1c;text-transform:uppercase;">Trip Expenses</div>
                  <div style="font-size:16px;font-weight:900;color:#dc2626;margin-top:2px;">₹${expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  ${paidAmt > 0 ? `
                    <div style="font-size:9px;color:#16a34a;font-weight:700;margin-top:2px;">Next Adv Adj: (-) ₹${paidAmt.toLocaleString('en-IN')}</div>
                  ` : `
                    <div style="font-size:9px;color:#b91c1c;margin-top:2px;">Loading, toll, misc.</div>
                  `}
                </td>
                <td style="width:25%;border:1px solid ${needToPay > 0 ? '#fca5a5' : balInHand > 0 ? '#bfdbfe' : '#bbf7d0'};border-top:3px solid ${needToPay > 0 ? '#dc2626' : balInHand > 0 ? '#1d4ed8' : '#16a34a'};border-radius:4px;padding:8px 12px;background:${needToPay > 0 ? '#fef2f2' : balInHand > 0 ? '#eff6ff' : '#f0fdf4'};vertical-align:top;">
                  <div style="font-size:9.5px;font-weight:700;color:${needToPay > 0 ? '#dc2626' : balInHand > 0 ? '#1d4ed8' : '#15803d'};text-transform:uppercase;">Driver Balance</div>
                  <div style="font-size:16px;font-weight:900;color:${needToPay > 0 ? '#dc2626' : balInHand > 0 ? '#1d4ed8' : '#15803d'};margin-top:2px;">
                    ₹${(needToPay > 0 ? needToPay : balInHand).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div style="font-size:9px;font-weight:700;color:${needToPay > 0 ? '#dc2626' : balInHand > 0 ? '#1d4ed8' : '#15803d'};margin-top:2px;">
                    ${needToPay > 0 ? (isSettledTrip ? 'Paid to Driver' : 'Balance Need to Pay') : (balInHand > 0 ? 'Remaining Cash in Hand' : 'Fully Settled')}
                  </div>
                </td>
              </tr>
            </table>

            ${priorDeficitDeduction > 0 ? `
            <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:4px;padding:8px 12px;margin-bottom:14px;font-size:11px;color:#92400e;line-height:1.45;">
              <strong>⚠ Advance Adjustment Notice:</strong> Trip advance of ₹${advance.toLocaleString('en-IN')} was reduced by <strong>₹${priorDeficitDeduction.toLocaleString('en-IN')}</strong> to settle prior trip dues owed to driver. Effective cash advance available for this trip was ₹${effectiveAdvance.toLocaleString('en-IN')}. Full trip expenses of ₹${expenses.toLocaleString('en-IN')} are payable to driver for this trip.
            </div>
            ` : ''}

            ${paidAmt > 0 ? `
            <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:4px;padding:8px 12px;margin-bottom:14px;font-size:11px;color:#166534;line-height:1.45;">
              <strong>✔ Next Trip Advance Adjustment:</strong> <strong>₹${paidAmt.toLocaleString('en-IN')}</strong> was adjusted from next trip advance towards this trip's pending dues. Remaining balance payable to driver: <strong>₹${needToPay.toLocaleString('en-IN')}</strong>.
            </div>
            ` : ''}

            <!-- 3. Particular Trip Expenses Breakdown -->
            <div style="font-size:11.5px;font-weight:800;color:#1e3a8a;text-transform:uppercase;margin-bottom:6px;">3. Itemized Particular Trip Expenses</div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border:1px solid #cbd5e1;font-size:10px;">
              <thead>
                <tr style="background:#f1f5f9;color:#475569;border-bottom:1.5px solid #cbd5e1;">
                  <th style="padding:5px 8px;text-align:center;width:25px;border:1px solid #cbd5e1;">#</th>
                  <th style="padding:5px 8px;text-align:left;width:130px;border:1px solid #cbd5e1;">Category</th>
                  <th style="padding:5px 8px;text-align:left;border:1px solid #cbd5e1;">Description / Purpose</th>
                  <th style="padding:5px 8px;text-align:right;width:100px;border:1px solid #cbd5e1;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${(t.expense_items && t.expense_items.length > 0) ? t.expense_items.map((exp: any, idx: number) => `
                  <tr>
                    <td style="padding:4px 8px;text-align:center;border:1px solid #cbd5e1;">${idx + 1}</td>
                    <td style="padding:4px 8px;font-weight:700;color:#0f172a;border:1px solid #cbd5e1;">${exp.expense_type}</td>
                    <td style="padding:4px 8px;color:#334155;border:1px solid #cbd5e1;">${exp.description || '—'}</td>
                    <td style="padding:4px 8px;text-align:right;font-weight:700;color:#dc2626;border:1px solid #cbd5e1;">₹${(parseFloat(String(exp.amount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="4" style="padding:8px;text-align:center;color:#94a3b8;border:1px solid #cbd5e1;font-style:italic;">No itemized breakdown recorded. Total: ₹${expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `}
                <tr style="background:#f8fafc;font-weight:800;border-top:1.5px solid #0f172a;">
                  <td colspan="3" style="padding:5px 8px;text-align:right;border:1px solid #cbd5e1;">TOTAL EXPENSES:</td>
                  <td style="padding:5px 8px;text-align:right;color:#dc2626;font-size:11px;border:1px solid #cbd5e1;">₹${expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <!-- Signatures -->
            <table style="width:100%;margin-top:22px;border-top:1px dashed #cbd5e1;padding-top:18px;">
              <tr>
                <td style="width:50%;vertical-align:top;">
                  <div style="font-size:10.5px;font-weight:700;color:#334155;margin-bottom:40px;">Driver Signature:</div>
                  <div style="border-top:1px solid #64748b;width:180px;padding-top:3px;font-size:9.5px;color:#64748b;">Driver: ${driverName}</div>
                </td>
                <td style="width:50%;vertical-align:top;text-align:right;">
                  <div style="font-size:10.5px;font-weight:700;color:#334155;margin-bottom:40px;">For K.S.P. TRANSPORT:</div>
                  <div style="border-top:1px solid #64748b;width:180px;margin-left:auto;padding-top:3px;font-size:9.5px;color:#64748b;text-align:center;">Authorized Signatory</div>
                </td>
              </tr>
            </table>

            <!-- Footer -->
            <div style="margin-top:16px;padding-top:6px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;">
              <span>Generated by KSP Service Management ERP &bull; Official Document</span>
              <span>Printed on ${new Date().toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      `;

      const RENDER_WIDTH = 794;
      const container = document.createElement('div');
      container.style.cssText = `position:fixed;left:-9999px;top:0;width:${RENDER_WIDTH}px;background:#fff;padding:24px 28px;box-sizing:border-box;z-index:-9999;`;
      container.innerHTML = voucherHtml;
      document.body.appendChild(container);

      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise(r => setTimeout(r, 150));

      const canvas = await html2canvas(container, {
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
        logging: false, windowWidth: RENDER_WIDTH,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;

      if (imgH <= pageH - margin * 2) {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH);
      } else {
        let heightLeft = imgH;
        let position = margin;
        const maxPageH = pageH - margin * 2;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, imgW, imgH);
        heightLeft -= maxPageH;
        while (heightLeft > 0) {
          position = heightLeft - imgH + margin;
          pdf.addPage();
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, imgW, imgH);
          heightLeft -= maxPageH;
        }
      }

      const safeDriver = driverName.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`KSP_Trip_${t.id}_${safeDriver}.pdf`);
      if (container.parentNode) container.parentNode.removeChild(container);
    } catch (err: any) {
      console.error('Failed to generate trip PDF', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdfTripId(null);
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
          'Truck Owner': d.owner_name || '—',
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
          'Truck Owner': '',
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
        ws['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 18 }];
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
          owner_id: ownerFilter || undefined,
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
          'Truck Owner': a.owner_name || '—',
          'Trip #': a.trip_id ? `TRIP-${a.trip_id}` : '—',
          'Party': a.party_name || '—',
          'Route': a.from_location && a.to_location ? `${a.from_location} → ${a.to_location}` : '—',
          'Trip Status': a.trip_status || '—',
          'Type': a.source_type === 'TRIP_TRUCK_ADVANCE' ? 'Trip Advance' : 'Direct Advance',
          'Payment Mode': a.payment_mode || 'CASH',
          'Amount (₹)': parseFloat(String(a.amount)) || 0,
          'Balance in Hand (₹)': Math.max(0, parseFloat(String(a.driver_balance_in_hand ?? 0)) || 0),
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
          'Truck Owner': '',
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
        ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 22 }, { wch: 26 }, { wch: 14 }, { wch: 15 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 20 }];
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
    ${PRINT_BRAND_CSS}
          *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:20px;color:#1e293b;background:#fff;font-size:11px}
          @page{size:landscape;margin:10mm}
          .header-bar{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #0f172a;margin-bottom:14px}
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
            ${printBrandLockup()}
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
              <th>Assigned Truck</th>
              <th>Truck Owner</th>
              <th class="num">Total Advance Given (₹)</th>
              <th class="center">Adv. Count</th>
              <th class="num">Trip Expenses (₹)</th>
              <th class="center">Trips</th>
              <th class="num">Current Balance (₹)</th>
              <th class="center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((d, idx) => {
              const bal = parseFloat(String(d.balance_in_hand ?? d.remaining_advance_balance)) || 0;
              const needToPay = parseFloat(String(d.need_to_pay || 0));
              const mgr = parseFloat(String(d.manager_advance_given || 0));
              const own = parseFloat(String(d.owner_advance_given || 0));
              const wTrip = parseFloat(String(d.without_trip_advance_given || 0));

              return `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td><strong>${d.driver_name}</strong></td>
                  <td>${d.driver_mobile || '—'}</td>
                  <td>${d.driver_license || '—'}</td>
                  <td><strong>${d.lorry_number || '—'}</strong></td>
                  <td>${d.owner_name || '—'}</td>
                  <td class="num">
                    <div style="color:#15803d;font-weight:700">₹${(parseFloat(String(d.total_advance_given)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div style="font-size:9px;color:#64748b;margin-top:2px">
                      ${mgr > 0 ? `<span>Mgr: ₹${Math.round(mgr).toLocaleString('en-IN')}</span> ` : ''}
                      ${own > 0 ? `<span>Own: ₹${Math.round(own).toLocaleString('en-IN')}</span> ` : ''}
                      ${wTrip > 0 ? `· <span style="color:#2563eb">No-Trip: ₹${Math.round(wTrip).toLocaleString('en-IN')}</span>` : ''}
                    </div>
                  </td>
                  <td class="center">${d.advance_count}</td>
                  <td class="num" style="color:#b45309;font-weight:700">₹${(parseFloat(String(d.total_expenses_reported || d.total_trip_advance_used)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="center">${d.trip_count}</td>
                  <td class="num" style="font-weight:800;color:${needToPay > 0 ? '#b91c1c' : bal > 0 ? '#15803d' : '#64748b'}">
                    ${needToPay > 0 ? `Pay: ₹${needToPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : bal > 0 ? `In Hand: ₹${bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                  </td>
                  <td class="center"><span class="chip ${needToPay > 0 ? 'chip-neg' : bal > 0 ? 'chip-pos' : ''}">${needToPay > 0 ? 'Pay to Driver' : bal > 0 ? 'Cash in Hand' : 'Settled'}</span></td>
                </tr>
              `;
            }).join('')}
            <tr class="footer-row">
              <td class="center">TOTAL</td>
              <td colspan="5"><strong>${items.length} Drivers</strong></td>
              <td class="num"><strong>₹${ledgerGrandTotals.total_advance_given.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
              <td></td>
              <td class="num"><strong>₹${(ledgerGrandTotals.total_expenses_reported || ledgerGrandTotals.total_trip_advance_used).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
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
        const [advRes, sumRes] = await Promise.all([
          driverAdvanceService.getDriverAdvances({
            page: 1,
            limit: 5000,
            search: search || undefined,
            driver_id: driverFilter || undefined,
            manager_id: managerFilter || undefined,
            vehicle_id: vehicleFilter || undefined,
            owner_id: ownerFilter || undefined,
            payment_mode: paymentModeFilter || undefined,
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
          }),
          driverAdvanceService.getDriverSummary({
            driver_id: driverFilter || undefined,
            owner_id: ownerFilter || undefined,
            vehicle_id: vehicleFilter || undefined,
            search: search || undefined,
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
          }),
        ]);
        const items = advRes.data.items || [];
        if (items.length === 0) {
          alert('No advance records to print.');
          return;
        }
        const summaries = (sumRes.data?.drivers || []) as DriverAdvanceSummary[];
        const summaryById = new Map(summaries.map((d) => [Number(d.driver_id), d]));
        type GiverAmt = { trip: number; noTrip: number };
        type DriverPrintRow = {
          driver_id: number;
          driver_name: string;
          managers: Map<string, GiverAmt>;
          owners: Map<string, GiverAmt>;
          tripIds: Set<number>;
          tripAmt: number;
          noTripAmt: number;
          totalAmt: number;
        };
        const byDriver = new Map<number, DriverPrintRow>();
        for (const a of items) {
          const id = Number(a.driver_id);
          if (!byDriver.has(id)) {
            byDriver.set(id, {
              driver_id: id,
              driver_name: a.driver_name,
              managers: new Map(),
              owners: new Map(),
              tripIds: new Set(),
              tripAmt: 0,
              noTripAmt: 0,
              totalAmt: 0,
            });
          }
          const row = byDriver.get(id)!;
          const amt = parseFloat(String(a.amount)) || 0;
          const isOwner = a.source_type === 'OWNER_DIRECT_ADVANCE' || a.given_by_role === 'OWNER';
          const name = isOwner
            ? (a.owner_name || a.given_by_name || 'Owner')
            : (a.manager_name || a.given_by_name || 'Manager');
          const bucket = isOwner ? row.owners : row.managers;
          const g = bucket.get(name) || { trip: 0, noTrip: 0 };
          if (a.trip_id) {
            g.trip += amt;
            row.tripAmt += amt;
            row.tripIds.add(Number(a.trip_id));
          } else {
            g.noTrip += amt;
            row.noTripAmt += amt;
          }
          bucket.set(name, g);
          row.totalAmt += amt;
        }
        const driverRows = [...byDriver.values()].sort((a, b) => a.driver_name.localeCompare(b.driver_name));
        const fmtAmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const giverBlock = (role: string, map: Map<string, GiverAmt>, cls: string) =>
          [...map.entries()].map(([name, g]) => `
            <div style="margin:3px 0">
              <span class="badge ${cls}">${role}: ${name}</span>
              ${g.trip > 0.5 ? `<div class="sub">For trip: ${fmtAmt(g.trip)}</div>` : ''}
              ${g.noTrip > 0.5 ? `<div class="sub">Without trip: ${fmtAmt(g.noTrip)}</div>` : ''}
            </div>`).join('');
        const totalSum = driverRows.reduce((s, r) => s + r.totalAmt, 0);
        const totalExp = driverRows.reduce((s, r) => {
          const d = summaryById.get(r.driver_id);
          return s + (parseFloat(String(d?.total_expenses_reported || 0)) || 0);
        }, 0);

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>KSP Driver Advances Log</title>
        <style>
    ${PRINT_BRAND_CSS}
          *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:20px;color:#1e293b;background:#fff;font-size:11px}
          @page{size:landscape;margin:8mm}
          .header-bar{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #0f172a;margin-bottom:14px}
          .company-title{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 4px}
          .report-subtitle{font-size:13px;font-weight:700;color:#2563eb;margin:0;text-transform:uppercase;letter-spacing:.5px}
          .meta-text{font-size:11px;color:#64748b;margin:0}
          table{width:100%;border-collapse:collapse;font-size:10.5px;margin-top:10px}
          th{background:#0f172a;color:#fff;font-weight:700;text-align:left;padding:7px 8px;font-size:10px}
          td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
          tr:nth-child(even) td{background:#fbfcfe}
          .footer-row td{background:#f1f5f9!important;font-weight:800;border-top:2px solid #0f172a;color:#0f172a}
          .num{text-align:right}
          .center{text-align:center}
          .badge{display:inline-block;padding:2px 5px;border-radius:4px;font-size:8.5px;font-weight:800;text-transform:uppercase}
          .badge-mgr{background:#dbeafe;color:#1e40af}
          .badge-own{background:#f3e8ff;color:#6b21a8}
          .badge-trip{background:#e0f2fe;color:#0369a1}
          .badge-notrip{background:#fef3c7;color:#b45309}
          .sub{font-size:9.5px;font-weight:700;color:#334155;margin-top:2px}
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
            ${printBrandLockup()}
            <div class="report-subtitle">Driver Advance Summary (Trips, From Whom, Expenses &amp; Balance)</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800;font-size:13px;color:#0f172a">Total Drivers: ${driverRows.length}</div>
            <p class="meta-text" style="margin-top:4px">Generated on: ${new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th class="center" style="width:30px">#</th>
              <th>Driver</th>
              <th class="center">Trips</th>
              <th>Advance from whom</th>
              <th class="num">Trip Advance (₹)</th>
              <th class="num">Without Trip (₹)</th>
              <th class="num">Total Advance (₹)</th>
              <th class="num">Expenses (₹)</th>
              <th class="num">Balance in Hand (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${driverRows.map((r, idx) => {
              const d = summaryById.get(r.driver_id);
              const trips = d?.trip_count || r.tripIds.size;
              const exp = parseFloat(String(d?.total_expenses_reported || 0)) || 0;
              const need = parseFloat(String(d?.need_to_pay || 0)) || 0;
              const bal = Math.max(0, parseFloat(String(d?.balance_in_hand ?? 0)) || 0);
              return `
              <tr>
                <td class="center">${idx + 1}</td>
                <td><strong>${r.driver_name}</strong></td>
                <td class="center">${trips}</td>
                <td>
                  ${giverBlock('Manager', r.managers, 'badge-mgr') || ''}
                  ${giverBlock('Owner', r.owners, 'badge-own') || ''}
                  ${!r.managers.size && !r.owners.size ? '—' : ''}
                </td>
                <td class="num" style="font-weight:800;color:#0369a1">${fmtAmt(r.tripAmt)}</td>
                <td class="num" style="font-weight:800;color:#b45309">${fmtAmt(r.noTripAmt)}</td>
                <td class="num" style="font-weight:800;color:#15803d">${fmtAmt(r.totalAmt)}</td>
                <td class="num" style="font-weight:800;color:#b45309">${fmtAmt(exp)}</td>
                <td class="num" style="font-weight:800;color:${need > 0 ? '#dc2626' : bal > 0 ? '#047857' : '#64748b'}">${need > 0 ? 'Pay ' + fmtAmt(need) : fmtAmt(bal)}</td>
              </tr>`;
            }).join('')}
            <tr class="footer-row">
              <td class="center">TOTAL</td>
              <td colspan="3"><strong>${driverRows.length} Drivers</strong></td>
              <td class="num">${fmtAmt(driverRows.reduce((s, r) => s + r.tripAmt, 0))}</td>
              <td class="num">${fmtAmt(driverRows.reduce((s, r) => s + r.noTripAmt, 0))}</td>
              <td class="num">${fmtAmt(totalSum)}</td>
              <td class="num">${fmtAmt(totalExp)}</td>
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
          {a.owner_name && (
            <span style={{ fontWeight: 600, color: '#4338ca', background: '#e0e7ff', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', fontSize: '10.5px', border: '1px solid #c7d2fe' }}>
              🏢 {a.owner_name}
            </span>
          )}
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
          display: embedded ? 'none' : 'flex',
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

        </div>
      </div>

      {/* Main View Tabs (Ledger & Live Balances vs All Transactions Log) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: embedded ? 'none' : 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
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
        {/* Row 1: Search + Dropdown Filters */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
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
            value={ownerFilter}
            onChange={(e) => {
              const val = e.target.value;
              setOwnerFilter(val);
              setPage(1);
              if (val && vehicleFilter) {
                const cur = vehicles.find((v) => String(v.id) === String(vehicleFilter));
                if (cur && String(cur.owner_id) !== String(val)) {
                  setVehicleFilter('');
                }
              }
            }}
            className="form-control"
            style={{ height: '36px', width: '160px', fontSize: '12.5px' }}
          >
            <option value="">All Truck Owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} {o.mobile_number ? `(${o.mobile_number})` : ''}
              </option>
            ))}
          </select>

          <select
            value={vehicleFilter}
            onChange={(e) => {
              const val = e.target.value;
              setVehicleFilter(val);
              setPage(1);
              if (val && !ownerFilter) {
                const cur = vehicles.find((v) => String(v.id) === String(val));
                if (cur && cur.owner_id) {
                  setOwnerFilter(String(cur.owner_id));
                }
              }
            }}
            className="form-control"
            style={{ height: '36px', width: '150px', fontSize: '12.5px' }}
          >
            <option value="">{ownerFilter ? 'All Lorries of Owner' : 'All Lorries'}</option>
            {filteredVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.lorry_number} {v.owner_name ? `• ${v.owner_name}` : ''}
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
            </>
          )}
        </div>

        {/* Row 2: From Date, To Date, Clear Filters, Print, Excel, CSV */}
        <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>From Date</label>
            <DateField
              style={{ width: '140px', height: '36px', fontSize: '12px' }}
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              placeholder="From Date"
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>To Date</label>
            <DateField
              style={{ width: '140px', height: '36px', fontSize: '12px' }}
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              placeholder="To Date"
            />
          </div>

          <button onClick={resetFilters} className="btn btn-outline" style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px' }}>
            <RefreshCw size={13} /> Clear Filters
          </button>

          {activeView === 'transactions' && (
            <button
              onClick={() => handleOpenCreate()}
              className="btn btn-primary"
              style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', fontWeight: 800, background: '#059669', border: 'none' }}
            >
              <Plus size={14} /> Give Advance
            </button>
          )}

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
                    const needToPay = parseFloat(String(d.need_to_pay ?? 0));
                    const prevInHand = parseFloat(String(d.previous_balance_in_hand ?? 0));
                    const isExpanded = expandedDriverId === d.driver_id;
                    const details = expandedDetails[d.driver_id];

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
                                {d.owner_name && (
                                  <span style={{ fontWeight: 600, color: '#4338ca', background: '#e0e7ff', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', border: '1px solid #c7d2fe' }} title={d.owner_mobile ? `Owner: ${d.owner_name} (${d.owner_mobile})` : `Owner: ${d.owner_name}`}>
                                    🏢 {d.owner_name}
                                  </span>
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
                              fontSize: '12px',
                              color: needToPay > 0 && d.settlement_status !== 'SETTLED' ? '#dc2626' : (bal > 0 ? '#1d4ed8' : '#16a34a'),
                              background: needToPay > 0 && d.settlement_status !== 'SETTLED' ? '#fef2f2' : (bal > 0 ? '#f0f9ff' : '#f0fdf4'),
                              borderLeft: `2px solid ${needToPay > 0 && d.settlement_status !== 'SETTLED' ? '#ef4444' : (bal > 0 ? '#3b82f6' : '#22c55e')}`,
                            }}
                          >
                            {needToPay > 0 && d.settlement_status !== 'SETTLED' ? (
                              <>
                                {prevInHand > 0 && (
                                  <div style={{ fontSize: '9.5px', color: '#475569', fontWeight: 600 }}>
                                    Taken: {formatCurrency(prevInHand)}
                                  </div>
                                )}
                                <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '12.5px' }}>
                                  {formatCurrency(needToPay)}
                                </div>
                                <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#b91c1c', marginTop: '1px' }}>
                                  Balance Need to Pay
                                </div>
                              </>
                            ) : bal > 0 ? (
                              <>
                                <div>{formatCurrency(bal)}</div>
                                <div style={{ fontSize: '9.5px', fontWeight: 600, color: '#1d4ed8', marginTop: '1px' }}>
                                  Cash in Hand
                                </div>
                              </>
                            ) : (
                              <>
                                <div>₹0.00</div>
                                <div style={{ fontSize: '9.5px', fontWeight: 600, color: '#16a34a', marginTop: '1px' }}>
                                  Fully Settled
                                </div>
                              </>
                            )}
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
                                    {d.owner_name && (
                                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#4338ca', marginTop: '1px' }}>
                                        🏢 Owner: {d.owner_name}
                                      </div>
                                    )}
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

                              {/* Top Bar with All Actions */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  borderBottom: '2px solid #e2e8f0',
                                  paddingBottom: '10px',
                                  marginBottom: '16px',
                                  flexWrap: 'wrap',
                                  gap: '10px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Truck size={17} color="#2563eb" />
                                    <span>Truck Advances, Driver Advances &amp; Trip Settlements: {d.driver_name}</span>
                                  </div>
                                  <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                    {details?.advances?.length || 0} Advances • {details?.trips?.length || 0} Trips
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintSingleDriverStatement(d);
                                    }}
                                    disabled={printingDriverId === d.driver_id}
                                    className="btn btn-sm btn-outline"
                                    style={{ borderColor: '#2563eb', color: '#1d4ed8', background: '#eff6ff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}
                                    title="Print complete statement with truck advances, driver advances & trips with itemized expenses"
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
                                    title="Download Excel ledger"
                                  >
                                    {downloadingDriverId === d.driver_id ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                                    Download Excel
                                  </button>

                                </div>
                              </div>

                              {/* Drilldown Content (Both shown on SAME PAGE, NO separate tabs) */}
                              {details?.loading ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                  <Loader2 size={22} className="animate-spin" style={{ marginBottom: '8px' }} />
                                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Loading advances and trip records...</div>
                                </div>
                              ) : (
                                <div>
                                  {/* TRIPS, TRUCK ADVANCES & PARTICULAR EXPENSES */}
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px dashed #cbd5e1', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Navigation size={16} color="#b45309" />
                                        <span style={{ fontWeight: 800, fontSize: '12.5px', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                          Trips, Truck Advances &amp; Particular Expenses ({details?.trips?.length || 0})
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {details?.trips && details.trips.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const allTripIds = details.trips.map((t: Trip) => t.id);
                                              const allOpen = allTripIds.every((id: number) => expandedTripExpenses[id]);
                                              const newMap: Record<number, boolean> = {};
                                              allTripIds.forEach((id: number) => { newMap[id] = !allOpen; });
                                              setExpandedTripExpenses(newMap);
                                            }}
                                            className="btn btn-sm btn-outline"
                                            style={{ fontSize: '11px', padding: '3px 8px', borderColor: '#cbd5e1', color: '#475569', background: '#fff', fontWeight: 600 }}
                                          >
                                            {details.trips.every((t: Trip) => expandedTripExpenses[t.id]) ? '▲ Collapse All Particular Expenses' : '▼ Expand All Particular Expenses'}
                                          </button>
                                        )}
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                                          Truck assignment, trip advance, itemized expenses and settlement
                                        </span>
                                      </div>
                                    </div>

                                    {!details?.trips || details.trips.length === 0 ? (
                                      <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                                        No trips recorded for this driver yet.
                                      </div>
                                    ) : (
                                      <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                          <thead>
                                            <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1.5px solid #e2e8f0' }}>
                                              <th style={{ padding: '8px 12px', textAlign: 'center', width: '35px' }}>#</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'left', width: '90px' }}>Trip ID</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'left', width: '100px' }}>Trip Date</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Lorry Number</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Party &amp; Route</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'right', width: '90px' }}>Weight</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Total Freight (₹)</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px' }}>Truck / Trip Advance (₹)</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'right', width: '135px' }}>Trip Expenses (₹)</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px' }}>Driver Balance (₹)</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'center', width: '90px' }}>Status</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'center', width: '100px' }}>Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(() => {
                                              const sortedTrips = [...details.trips].sort((a: Trip, b: Trip) => {
                                                const dateA = new Date(a.trip_date || 0).getTime();
                                                const dateB = new Date(b.trip_date || 0).getTime();
                                                if (dateA !== dateB) return dateA - dateB;
                                                return (a.id || 0) - (b.id || 0);
                                              });
                                              const directAdvancesTotal = (details.advances || [])
                                                .filter((adv: DriverAdvance) => !adv.trip_id)
                                                .reduce((sum: number, adv: DriverAdvance) => sum + (parseFloat(String(adv.amount)) || 0), 0);

                                              const balanceById = new Map<number, number>();
                                              const netToPayById = new Map<number, number>();
                                              sortedTrips.forEach((t: Trip) => {
                                                const adv = parseFloat(String(t.advance_paid || 0));
                                                const exp = parseFloat(String(t.total_expenses ?? 0)) || 0;
                                                const priorDeduction = parseFloat(String((t as any).prior_deficit_deduction || 0));
                                                const sStatus = (t as any).settlement_status;

                                                let tripNeedToPay = 0;
                                                let tripBalInHand = 0;

                                                if ((t as any).settlement_id) {
                                                  if (sStatus === 'SETTLED') {
                                                    tripNeedToPay = 0;
                                                    tripBalInHand = 0;
                                                  } else {
                                                    const netBal = parseFloat(String((t as any).net_balance_to_driver ?? (t as any).settlement_net_balance ?? 0));
                                                    if (netBal > 0) {
                                                      tripNeedToPay = netBal;
                                                      tripBalInHand = 0;
                                                    } else {
                                                      tripNeedToPay = 0;
                                                      tripBalInHand = Math.abs(netBal);
                                                    }
                                                  }
                                                } else {
                                                  const effectiveAdv = Math.max(0, adv - priorDeduction);
                                                  if (exp > effectiveAdv) {
                                                    tripNeedToPay = exp - effectiveAdv;
                                                    tripBalInHand = 0;
                                                  } else {
                                                    tripNeedToPay = 0;
                                                    tripBalInHand = effectiveAdv - exp;
                                                  }
                                                }

                                                balanceById.set(t.id, tripBalInHand);
                                                netToPayById.set(t.id, tripNeedToPay);
                                              });

                                              return details.trips.map((t: Trip, i: number) => {
                                                const tripRunningBal = balanceById.get(t.id) ?? 0;
                                                const tripNetToPay = netToPayById.get(t.id) ?? 0;
                                                const sStatus = (t as any).settlement_status;
                                                const isSettled = sStatus === 'SETTLED';
                                                const adv = parseFloat(String(t.advance_paid || 0));
                                                const priorDeduction = parseFloat(String((t as any).prior_deficit_deduction || 0));
                                                const paidAmt = parseFloat(String((t as any).settlement_paid_amount || 0));
                                                const settlementPayMode = (t as any).settlement_payment_mode;
                                                const additionalAdv = parseFloat(String((t as any).additional_advance_paid || 0));
                                                const initialAdv = parseFloat(String((t as any).initial_trip_advance || t.advance_paid || 0));
                                                const isExpExpanded = !!expandedTripExpenses[t.id];
                                                const truckAdvTotal = (t.truck_advances || []).reduce((acc: number, x: any) => acc + (parseFloat(String(x.amount)) || 0), 0);

                                                return (
                                                  <React.Fragment key={t.id || i}>
                                                    <tr style={{ borderBottom: isExpExpanded ? 'none' : '1px solid #f1f5f9', background: isExpExpanded ? '#f8fafc' : undefined }}>
                                                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}>{i + 1}</td>
                                                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>TRIP-{t.id}</td>
                                                      <td style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{formatISTDate(t.trip_date)}</td>
                                                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#2563eb' }}>
                                                        <div>{t.lorry_number}</div>
                                                        {(t as any).owner_name && (
                                                          <div style={{ fontSize: '10px', fontWeight: 600, color: '#4338ca', marginTop: '2px' }}>
                                                            🏢 {(t as any).owner_name}
                                                          </div>
                                                        )}
                                                      </td>
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
                                                        <div>{formatCurrency(t.advance_paid)}</div>
                                                        {additionalAdv > 0 ? (
                                                          <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 700, background: '#f5f3ff', padding: '1px 5px', borderRadius: '3px', marginTop: '2px', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                            Mgr: {formatCurrency(initialAdv)} + Own: {formatCurrency(additionalAdv)}
                                                          </div>
                                                        ) : truckAdvTotal > 0 ? (
                                                          <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: 700, background: '#e0f2fe', padding: '1px 5px', borderRadius: '3px', marginTop: '2px', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                            🚛 Truck Adv: {formatCurrency(truckAdvTotal)}
                                                          </div>
                                                        ) : null}
                                                        {priorDeduction > 0 && (
                                                          <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, background: '#fef2f2', padding: '1px 5px', borderRadius: '3px', marginTop: '2px', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                            ↩ Prior Deficit: {formatCurrency(priorDeduction)}
                                                          </div>
                                                        )}
                                                        {paidAmt > 0 && settlementPayMode !== 'ADJUSTED_ADVANCE' && (
                                                          <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '1px 5px', borderRadius: '3px', marginTop: '2px', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                            ✓ Settled: {formatCurrency(paidAmt)}
                                                          </div>
                                                        )}
                                                      </td>
                                                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 700, color: t.total_expenses ? '#dc2626' : '#94a3b8' }}>
                                                          {t.total_expenses ? formatCurrency(t.total_expenses) : '—'}
                                                        </div>
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTripExpenses(t.id);
                                                          }}
                                                          style={{
                                                            marginTop: '3px',
                                                            padding: '2px 7px',
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            border: isExpExpanded ? '1px solid #dc2626' : '1px solid #cbd5e1',
                                                            background: isExpExpanded ? '#fef2f2' : '#ffffff',
                                                            color: isExpExpanded ? '#b91c1c' : '#475569',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px',
                                                            whiteSpace: 'nowrap',
                                                          }}
                                                          title="Click to view particular expenses breakdown"
                                                        >
                                                          {isExpExpanded ? 'Hide ▲' : `Expenses (${t.expense_items?.length || 0}) ▼`}
                                                        </button>
                                                      </td>
                                                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                        {tripNetToPay > 0 ? (
                                                          <div style={{ whiteSpace: 'nowrap' }}>
                                                            <strong style={{ color: isSettled ? '#15803d' : '#dc2626', fontSize: '12px' }}>
                                                              {isSettled ? 'Paid: ' : 'Balance: '}{formatCurrency(tripNetToPay)} {isSettled ? '(Settled)' : 'Need to Pay'}
                                                            </strong>
                                                          </div>
                                                        ) : (
                                                          <div style={{ whiteSpace: 'nowrap' }}>
                                                            <span style={{ color: '#1d4ed8', fontWeight: 800, fontSize: '12px' }}>
                                                              Balance: {formatCurrency(tripRunningBal)} in Hand
                                                            </span>
                                                          </div>
                                                        )}
                                                      </td>
                                                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                        {(() => {
                                                          if (sStatus === 'SETTLED') {
                                                            return <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', whiteSpace: 'nowrap', display: 'inline-block' }}>✓ Settled</span>;
                                                          }
                                                          if (sStatus === 'VERIFIED') {
                                                            return <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', whiteSpace: 'nowrap', display: 'inline-block' }}>🔍 Verified</span>;
                                                          }
                                                          if (sStatus === 'PENDING' || (!sStatus && t.status !== 'CANCELLED')) {
                                                            return <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', whiteSpace: 'nowrap', display: 'inline-block' }}>⏳ Pending</span>;
                                                          }
                                                          if (t.status === 'CANCELLED') {
                                                            return <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', whiteSpace: 'nowrap', display: 'inline-block' }}>✕ Cancelled</span>;
                                                          }
                                                          return <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: tripRunningBal > 0 ? '#eff6ff' : '#dcfce7', color: tripRunningBal > 0 ? '#1d4ed8' : '#166534', border: `1px solid ${tripRunningBal > 0 ? '#bfdbfe' : '#bbf7d0'}`, whiteSpace: 'nowrap', display: 'inline-block' }}>{tripRunningBal > 0 ? '💵 In Hand' : '✓ Settled'}</span>;
                                                        })()}
                                                      </td>
                                                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                                                          <button
                                                            type="button"
                                                            title={isExpExpanded ? 'Hide Particular Expenses' : 'View Particular Expenses'}
                                                            onClick={(e) => { e.stopPropagation(); toggleTripExpenses(t.id); }}
                                                            style={{ color: isExpExpanded ? '#b91c1c' : '#b45309', borderColor: isExpExpanded ? '#fca5a5' : '#fde68a', background: isExpExpanded ? '#fef2f2' : '#fffbeb', padding: '3px 6px', cursor: 'pointer', borderRadius: '4px', border: '1px solid', lineHeight: 1, fontSize: '11px', fontWeight: 700 }}
                                                          >
                                                            👁️
                                                          </button>
                                                          <button
                                                            type="button"
                                                            title="Download Trip PDF"
                                                            disabled={downloadingPdfTripId === t.id}
                                                            onClick={(e) => { e.stopPropagation(); handleDownloadSingleTripPdf(t, d.driver_name); }}
                                                            style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', padding: '3px 6px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #fca5a5', lineHeight: 1 }}
                                                          >
                                                            {downloadingPdfTripId === t.id ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                                                          </button>
                                                          <button
                                                            type="button"
                                                            title="Download Trip Excel"
                                                            disabled={downloadingExcelTripId === t.id}
                                                            onClick={(e) => { e.stopPropagation(); handleDownloadSingleTripExcel(t, d.driver_name); }}
                                                            style={{ color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5', padding: '3px 6px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #a7f3d0', lineHeight: 1 }}
                                                          >
                                                            {downloadingExcelTripId === t.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                                          </button>
                                                        </div>
                                                      </td>
                                                    </tr>

                                                    {/* PARTICULAR EXPENSES SUB-ROW */}
                                                    {isExpExpanded && (
                                                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                                        <td colSpan={12} style={{ padding: '8px 18px 14px 18px' }}>
                                                          <div style={{ background: '#ffffff', borderRadius: '6px', border: '1.5px solid #cbd5e1', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px' }}>
                                                              <div style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span>📋 Particular Expenses for TRIP #{t.id} ({t.lorry_number})</span>
                                                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Route: {t.from_location} → {t.to_location}</span>
                                                                <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: 700 }}>Party: {t.party_name || '—'}</span>
                                                              </div>
                                                              <div style={{ fontSize: '12px', fontWeight: 800, color: '#dc2626' }}>
                                                                Total Expenses: {formatCurrency(t.total_expenses || 0)}
                                                              </div>
                                                            </div>

                                                            {!t.expense_items || t.expense_items.length === 0 ? (
                                                              <div style={{ padding: '8px', color: '#94a3b8', fontSize: '11.5px', fontStyle: 'italic', textAlign: 'center' }}>
                                                                No itemized expense records found for this trip. Total expense amount reported: {formatCurrency(t.total_expenses || 0)}
                                                              </div>
                                                            ) : (
                                                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                                                <thead>
                                                                  <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                                                                    <th style={{ padding: '5px 8px', textAlign: 'center', width: '30px' }}>#</th>
                                                                    <th style={{ padding: '5px 8px', textAlign: 'left', width: '160px' }}>Category</th>
                                                                    <th style={{ padding: '5px 8px', textAlign: 'left' }}>Description / Particulars</th>
                                                                    <th style={{ padding: '5px 8px', textAlign: 'right', width: '120px' }}>Amount (₹)</th>
                                                                    <th style={{ padding: '5px 8px', textAlign: 'center', width: '120px' }}>Date</th>
                                                                  </tr>
                                                                </thead>
                                                                <tbody>
                                                                  {t.expense_items.map((exp: any, eIdx: number) => (
                                                                    <tr key={exp.id || eIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                      <td style={{ padding: '5px 8px', textAlign: 'center', color: '#94a3b8' }}>{eIdx + 1}</td>
                                                                      <td style={{ padding: '5px 8px', fontWeight: 700, color: '#0f172a' }}>
                                                                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                                                                          {exp.expense_type}
                                                                        </span>
                                                                      </td>
                                                                      <td style={{ padding: '5px 8px', color: '#334155' }}>{exp.description || '—'}</td>
                                                                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                                                                        {formatCurrency(exp.amount)}
                                                                      </td>
                                                                      <td style={{ padding: '5px 8px', textAlign: 'center', color: '#64748b' }}>
                                                                        {exp.created_at ? formatISTDate(exp.created_at) : '—'}
                                                                      </td>
                                                                    </tr>
                                                                  ))}
                                                                </tbody>
                                                                <tfoot>
                                                                  <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '1.5px solid #cbd5e1' }}>
                                                                    <td colSpan={3} style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>Total Particular Expenses for TRIP #{t.id}:</td>
                                                                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#dc2626', fontSize: '12px' }}>
                                                                      {formatCurrency(t.expense_items.reduce((sum: number, x: any) => sum + (parseFloat(String(x.amount)) || 0), 0))}
                                                                    </td>
                                                                    <td></td>
                                                                  </tr>
                                                                </tfoot>
                                                              </table>
                                                            )}
                                                          </div>
                                                        </td>
                                                      </tr>
                                                    )}
                                                  </React.Fragment>
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
                                                                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>
                                                {(() => {
                                                  let totalNetToPay = 0;
                                                  let totalBalInHand = 0;
                                                  details.trips.forEach((t: Trip) => {
                                                    const adv = parseFloat(String(t.advance_paid || 0));
                                                    const exp = parseFloat(String(t.total_expenses ?? 0)) || 0;
                                                    const priorDeduction = parseFloat(String((t as any).prior_deficit_deduction || 0));
                                                    const sStatus = (t as any).settlement_status;
                                                    if ((t as any).settlement_id) {
                                                      if (sStatus === 'SETTLED') {
                                                        // settled = 0
                                                      } else {
                                                        const netBal = parseFloat(String((t as any).net_balance_to_driver ?? (t as any).settlement_net_balance ?? 0));
                                                        if (netBal > 0) totalNetToPay += netBal;
                                                        else totalBalInHand += Math.abs(netBal);
                                                      }
                                                    } else {
                                                      const effectiveAdv = Math.max(0, adv - priorDeduction);
                                                      if (exp > effectiveAdv) totalNetToPay += (exp - effectiveAdv);
                                                      else totalBalInHand += (effectiveAdv - exp);
                                                    }
                                                  });
                                                  if (totalNetToPay > 0) {
                                                    return <span style={{ color: '#dc2626' }}>Pay: {formatCurrency(totalNetToPay)}</span>;
                                                  }
                                                  if (totalBalInHand > 0) {
                                                    return <span style={{ color: '#1d4ed8' }}>In Hand: {formatCurrency(totalBalInHand)}</span>;
                                                  }
                                                  return <span style={{ color: '#16a34a' }}>✓ Settled</span>;
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
                                                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                        ⏳ Settlement Pending
                                                      </span>
                                                    );
                                                  }
                                                  if (hasVerified) {
                                                    return (
                                                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                        🔍 Verified
                                                      </span>
                                                    );
                                                  }
                                                  if (allSettled) {
                                                    return (
                                                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                        ✓ Settled
                                                      </span>
                                                    );
                                                  }
                                                  return (
                                                    <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                      ✓ Settled
                                                    </span>
                                                  );
                                                })()}
                                              </td>
                                              <td style={{ padding: '8px 12px', textAlign: 'center' }}></td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                    )}
                                  </div>
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
        /* VIEW 2: Mobile-style advance cards */
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '1px solid #a7f3d0',
              borderRadius: '12px',
              padding: '14px 18px',
              marginBottom: '14px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#047857', letterSpacing: '0.04em' }}>TOTAL DRIVER ADVANCES GIVEN</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#065f46' }}>{formatCurrency(totalAdvancesAmount)}</div>
            </div>
            <div style={{ textAlign: 'right', color: '#047857', fontWeight: 700, fontSize: '13px' }}>{totalAdvancesCount} Entries</div>
          </div>

          {isLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={28} className="animate-spin" style={{ marginBottom: 8 }} />
              <div>Loading Driver Advances...</div>
            </div>
          ) : advances.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
              <Wallet size={40} style={{ marginBottom: 8 }} />
              <div>No driver advances found</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', width: '100%' }}>
              {advances.map((adv) => {
                const inHand = Math.max(0, parseFloat(String(adv.driver_balance_in_hand ?? 0)));
                const tripStatus = adv.trip_status || '';
                const tripStatusStyle =
                  tripStatus === 'SETTLED' ? { background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' } :
                  tripStatus === 'PARTIALLY_PAID' ? { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' } :
                  tripStatus === 'PAYMENT_PENDING' ? { background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309' } :
                  tripStatus === 'CANCELLED' ? { background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' } :
                  { background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569' };
                return (
                  <div
                    key={adv.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '14px',
                      boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      {adv.source_type === 'TRIP_TRUCK_ADVANCE' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, background: '#e0f2fe', color: '#0284c7', border: '1px solid #7dd3fc', borderRadius: 999, padding: '3px 8px' }}>
                          <Truck size={10} /> VIA TRUCK ADVANCE
                        </span>
                      ) : adv.source_type === 'OWNER_DIRECT_ADVANCE' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 999, padding: '3px 8px' }}>
                          <Briefcase size={10} /> DIRECT OWNER ADVANCE
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 999, padding: '3px 8px' }}>
                          <UserCheck size={10} /> DIRECT DRIVER ADVANCE
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 800, background: inHand > 0 ? '#ecfdf5' : '#f8fafc', color: inHand > 0 ? '#047857' : '#64748b', border: `1px solid ${inHand > 0 ? '#a7f3d0' : '#e2e8f0'}`, borderRadius: 999, padding: '3px 8px' }}>
                        In Hand: {formatCurrency(inHand)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UserCheck size={16} color="#059669" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{adv.driver_name}</div>
                          {adv.driver_mobile ? <div style={{ fontSize: 12, color: '#64748b' }}>{adv.driver_mobile}</div> : null}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, color: '#15803d', fontSize: 18 }}>{formatCurrency(adv.amount)}</div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', background: '#f1f5f9', borderRadius: 6, padding: '2px 6px' }}>{adv.payment_mode || 'CASH'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#475569', marginBottom: 8, flexWrap: 'wrap' }}>
                      <div><span style={{ color: '#94a3b8' }}>Manager: </span><strong>{adv.manager_name || '—'}</strong></div>
                      {adv.lorry_number ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Truck size={12} /> {adv.lorry_number}
                        </div>
                      ) : null}
                    </div>

                    {adv.owner_name ? (
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', borderRadius: 8, padding: '6px 8px', marginBottom: 8 }}>
                        Owner: {adv.owner_name}
                      </div>
                    ) : null}

                    {(adv.trip_id || adv.party_name || adv.from_location || adv.source_type === 'TRIP_TRUCK_ADVANCE') ? (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 12, color: '#1d4ed8' }}>
                            <Navigation size={12} /> {adv.trip_id ? `TRIP #${adv.trip_id}` : 'TRIP DETAILS'}
                          </div>
                          {tripStatus ? (
                            <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '2px 8px', ...tripStatusStyle }}>{tripStatus}</span>
                          ) : null}
                        </div>
                        {adv.party_name ? <div style={{ fontSize: 12, marginBottom: 2 }}>Party: <strong>{adv.party_name}</strong></div> : null}
                        {(adv.from_location || adv.to_location) ? (
                          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                            {adv.from_location || '—'} → {adv.to_location || '—'}
                          </div>
                        ) : null}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                          {adv.goods_weight ? (
                            <div>
                              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>Weight</div>
                              <div style={{ fontSize: 12, fontWeight: 800 }}>{adv.goods_weight} {adv.unit_abbreviation || adv.unit_name || 'MT'}</div>
                            </div>
                          ) : null}
                          {adv.total_freight ? (
                            <div>
                              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>Freight</div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8' }}>{formatCurrency(adv.total_freight)}</div>
                            </div>
                          ) : null}
                          {adv.trip_advance_paid ? (
                            <div>
                              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>Trip Adv</div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#d97706' }}>{formatCurrency(adv.trip_advance_paid)}</div>
                            </div>
                          ) : null}
                          {adv.trip_driver_expenses ? (
                            <div>
                              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>Expenses</div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626' }}>{formatCurrency(adv.trip_driver_expenses)}</div>
                            </div>
                          ) : null}
                        </div>
                        {adv.trip_date ? <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Trip Date: {formatISTDate(adv.trip_date)}</div> : null}
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                        <Calendar size={12} /> {adv.advance_date ? formatISTDate(adv.advance_date) : '—'}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleOpenEdit(adv)} className="btn btn-outline btn-sm" style={{ color: '#4f46e5', borderColor: '#c7d2fe' }} title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(adv.id)} className="btn btn-outline btn-sm" style={{ color: '#dc2626', borderColor: '#fca5a5' }} title="Delete">
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                    {adv.notes ? (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '6px 8px' }}>
                        Note: {adv.notes}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {totalAdvancesCount > 100 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
              <span style={{ fontSize: 13, fontWeight: 700, alignSelf: 'center' }}>Page {page}</span>
              <button className="btn btn-outline btn-sm" disabled={page * 100 >= totalAdvancesCount} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
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
              onChange={(e) => {
                const dId = e.target.value;
                setFormData((p) => ({ ...p, driver_id: dId, trip_id: '' }));
                loadDriverTripsForModal(dId);
              }}
            >
              <option value="">— Select Driver —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.mobile_number ? `(${d.mobile_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Trip selector (optional) */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              🚛 Link to Trip (Optional)
            </label>
            <select
              className="form-control"
              value={formData.trip_id}
              onChange={(e) => setFormData((p) => ({ ...p, trip_id: e.target.value }))}
              disabled={!formData.driver_id}
            >
              <option value="">— No Trip · General Advance —</option>
              {modalDriverTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  TRIP-{t.id} · {(t as any).from_location ?? ''} → {(t as any).to_location ?? ''} · {(t as any).trip_date?.slice(0, 10) ?? ''} · {t.status}
                </option>
              ))}
            </select>
            {formData.trip_id && (() => {
              const sel = modalDriverTrips.find(t => String(t.id) === formData.trip_id);
              return sel ? (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#1d4ed8', background: '#eff6ff', padding: '5px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', fontWeight: 700 }}>
                  📦 Trip #{sel.id} — {(sel as any).lorry_number ?? ''} · {(sel as any).party_name ?? ''}
                </div>
              ) : null;
            })()}
            {!formData.driver_id && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>Select a driver first to see their active trips</div>
            )}
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
              👤 Filter Trucks by Owner (Optional)
            </label>
            <select
              className="form-control"
              value={modalOwnerFilter}
              onChange={(e) => {
                const oVal = e.target.value;
                setModalOwnerFilter(oVal);
                if (oVal && formData.vehicle_id) {
                  const currVeh = vehicles.find((v) => String(v.id) === String(formData.vehicle_id));
                  if (currVeh && String(currVeh.owner_id) !== String(oVal)) {
                    setFormData((p) => ({ ...p, vehicle_id: '' }));
                  }
                }
              }}
            >
              <option value="">— All Owners / Any Truck —</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.mobile_number ? `(${o.mobile_number})` : ''}
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
              onChange={(e) => {
                const vVal = e.target.value;
                setFormData((p) => ({ ...p, vehicle_id: vVal }));
                if (vVal && !modalOwnerFilter) {
                  const selVeh = vehicles.find((v) => String(v.id) === String(vVal));
                  if (selVeh && selVeh.owner_id) {
                    setModalOwnerFilter(String(selVeh.owner_id));
                  }
                }
              }}
            >
              <option value="">— None / Not Linked to Lorry —</option>
              {(modalOwnerFilter ? vehicles.filter((v) => String(v.owner_id) === String(modalOwnerFilter)) : vehicles).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.lorry_number} {v.owner_name ? `• ${v.owner_name}` : ''} {v.vehicle_type ? `(${v.vehicle_type})` : ''}
                </option>
              ))}
            </select>
            {(() => {
              const sel = vehicles.find((v) => String(v.id) === String(formData.vehicle_id));
              if (!sel || !sel.owner_name) return null;
              return (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#4338ca', background: '#e0e7ff', padding: '5px 10px', borderRadius: '6px', border: '1px solid #c7d2fe', fontWeight: 700 }}>
                  👤 Truck Owner: <strong>{sel.owner_name}</strong>
                </div>
              );
            })()}
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
