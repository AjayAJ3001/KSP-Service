import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Link, useNavigate } from 'react-router-dom';
import {
  Wallet,
  Scale,
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Share2,
  Loader2,
  RefreshCw,
  HandCoins,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronDown,
  ChevronUp,
  Truck,
  CreditCard,
  X,
  Check,
  Users,
  Navigation,
  Building2,
  AlertCircle,
  Clock,
  CheckCircle,
  Eye,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  driverAdvanceService,
  ownerAdvanceService,
  driverService,
  vehicleService,
  ownerService,
  userService,
  tripService,
  settlementService,
} from '../services/adminService';
import { Driver, Vehicle, Owner, User, DriverAdvance, DriverAdvanceSummary, Trip, OwnerAdvance, Settlement } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { DateField } from '../components/Common/DateField';
import { formatIST, formatISTDate } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { generateDriverStatementHtml, openStatementWindow } from '../utils/driverStatementPdf';
import { PRINT_BRAND_CSS, printBrandLockup } from '../utils/printBrand';

const formatCurrency = (val: number | string) => {
  const num = Math.max(0, parseFloat(String(val)) || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

type AdvanceLine = { amount: number; givenBy: string };

const isOwnerAdvance = (a: DriverAdvance) => {
  const role = String(a.given_by_role || '').toUpperCase();
  const src = String(a.source_type || '').toUpperCase();
  return role === 'OWNER' || src.includes('OWNER');
};

const givenByLabel = (adv: DriverAdvance): string => {
  if (isOwnerAdvance(adv)) {
    const name = String(adv.given_by_name || adv.given_by || '').replace(/^(Manager|Owner):\s*/i, '').trim();
    return `Owner: ${name || 'Owner'}`;
  }
  if (adv.given_by && !/^Owner:/i.test(adv.given_by)) return adv.given_by;
  return `Manager: ${adv.manager_name || adv.given_by_name || 'Manager'}`;
};

const uniquePeople = (names: string[]) =>
  [...new Set(names.map((n) => String(n || '').replace(/^(Manager|Owner):\s*/i, '').trim()).filter((n) => n && !['MANAGER', 'OWNER'].includes(n.toUpperCase())))].join(', ');

const managerNameForTrip = (trip: Trip, advances: DriverAdvance[]) =>
  uniquePeople([
    ...advances
      .filter((a) => Number(a.trip_id) === Number(trip.id) && !isOwnerAdvance(a))
      .map((a) => a.manager_name || a.given_by_name || a.given_by || ''),
    ...(trip.truck_advances || []).map((ta) => ta.manager_name || ''),
  ]);

const ownerNameForDriver = (_trip: Trip, advances: DriverAdvance[]) =>
  uniquePeople(advances.filter(isOwnerAdvance).map((a) => a.given_by_name || a.given_by || ''));

type OwnerAlloc = {
  manager_advance: number;
  owner_applied: number;
  owner_balance: number;
  owner_leftover_used: number;
  owner_given: number;
};

const allocateOwnerAdvanceBreakdown = (trips: Trip[], advances: DriverAdvance[]): Record<number, OwnerAlloc> => {
  const byTrip: Record<number, OwnerAlloc> = {};
  const ensure = (id: number): OwnerAlloc => {
    if (!byTrip[id]) {
      byTrip[id] = { manager_advance: 0, owner_applied: 0, owner_balance: 0, owner_leftover_used: 0, owner_given: 0 };
    }
    return byTrip[id];
  };

  const active = [...trips]
    .filter((t) => {
      const st = String(t.status || '').toUpperCase();
      return st !== 'CANCELLED' && st !== 'DRAFT';
    })
    .sort((a, b) => {
      const ta = new Date(a.trip_date || 0).getTime();
      const tb = new Date(b.trip_date || 0).getTime();
      if (ta !== tb) return ta - tb;
      return Number(a.id) - Number(b.id);
    });

  type Ev = { date: number; created: number; kind: 'TRIP' | 'OWNER'; trip?: Trip; ownerAmt?: number };
  const events: Ev[] = [];
  for (const t of active) {
    events.push({
      date: new Date(t.trip_date || (t as any).created_at || 0).getTime(),
      created: new Date((t as any).created_at || t.trip_date || 0).getTime(),
      kind: 'TRIP',
      trip: t,
    });
  }
  for (const o of advances.filter(isOwnerAdvance)) {
    events.push({
      date: new Date(o.advance_date || o.created_at || 0).getTime(),
      created: new Date(o.created_at || o.advance_date || 0).getTime(),
      kind: 'OWNER',
      ownerAmt: numAmt(o.amount),
    });
  }
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date - b.date;
    if (a.created !== b.created) return a.created - b.created;
    if (a.kind === b.kind) return 0;
    return a.kind === 'TRIP' ? -1 : 1;
  });

  let currentTripId: number | null = null;
  let pendingOwner = 0;
  for (const ev of events) {
    if (ev.kind === 'OWNER') {
      const given = ev.ownerAmt || 0;
      if (given <= 0) continue;
      if (currentTripId == null) pendingOwner += given;
      else ensure(currentTripId).owner_given += given;
      continue;
    }
    const trip = ev.trip!;
    currentTripId = Number(trip.id);
    const rec = ensure(currentTripId);
    const mgrAmt = getTripAdvanceLines(trip, advances)
      .filter((l) => !/^Owner:/i.test(l.givenBy))
      .reduce((s, l) => s + l.amount, 0);
    rec.manager_advance = mgrAmt || numAmt((trip as any).initial_trip_advance ?? trip.advance_paid);
    if (pendingOwner > 0) {
      rec.owner_given += pendingOwner;
      pendingOwner = 0;
    }
  }

  let carry = 0;
  for (const trip of active) {
    const rec = ensure(Number(trip.id));
    const expenses = tripExpenseTotal(trip);
    const manager = rec.manager_advance;
    const ownerAmt = rec.owner_given;
    const remaining = carry + manager + ownerAmt - expenses;
    const shortfallBeforeOwner = Math.max(0, expenses - carry - manager);
    rec.owner_applied = Math.min(ownerAmt, shortfallBeforeOwner);
    rec.owner_leftover_used = Math.min(carry, expenses);
    rec.owner_balance = Math.max(0, remaining);
    rec.owner_given = ownerAmt;
    carry = rec.owner_balance;
  }
  return byTrip;
};

type AdvancePaidChip = { label: string; name?: string; amount: number; color: string; bg: string; minus?: boolean };

type AdvanceAdjLink = {
  toPrior: { tripId: number; lorry?: string; amount: number } | null;
  fromNext: { tripId: number; lorry?: string; amount: number } | null;
};

const buildAdvanceAdjustmentLinks = (trips: Trip[]): Map<number, AdvanceAdjLink> => {
  const sorted = [...trips].sort((a, b) => {
    const da = new Date(a.trip_date || 0).getTime();
    const db = new Date(b.trip_date || 0).getTime();
    if (da !== db) return da - db;
    return (a.id || 0) - (b.id || 0);
  });
  const map = new Map<number, AdvanceAdjLink>();
  sorted.forEach((t, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    const next = i < sorted.length - 1 ? sorted[i + 1] : null;
    const toPriorAmt = Math.max(0, numAmt(t.prior_deficit_deduction));
    let fromNextAmt = next ? Math.max(0, numAmt(next.prior_deficit_deduction)) : 0;
    const paidAdj = String(t.settlement_payment_mode || '') === 'ADJUSTED_ADVANCE'
      ? Math.max(0, numAmt(t.settlement_paid_amount))
      : 0;
    if (fromNextAmt < 0.5 && paidAdj > 0.5 && next) fromNextAmt = paidAdj;
    map.set(t.id, {
      toPrior: toPriorAmt > 0.5
        ? { tripId: prev?.id || 0, lorry: prev?.lorry_number, amount: toPriorAmt }
        : null,
      fromNext: fromNextAmt > 0.5 && next
        ? { tripId: next.id, lorry: next.lorry_number, amount: fromNextAmt }
        : null,
    });
  });
  return map;
};

const tripAdvancePaid = (
  trip: Trip,
  advances: DriverAdvance[],
  settlement: Settlement | undefined,
  alloc: OwnerAlloc | undefined,
  adj?: AdvanceAdjLink | null
): { chips: AdvancePaidChip[]; manager: number; ownerAdvance: number; less: number; ownerBal: number } => {
  const manager = numAmt(alloc?.manager_advance) || numAmt(settlement?.manager_advance ?? settlement?.initial_trip_advance);
  const leftoverUsed = numAmt(alloc?.owner_leftover_used);
  const ownerApplied = numAmt(alloc?.owner_applied);
  const ownerBal = numAmt(alloc?.owner_balance);
  const ownerAdvance = numAmt(alloc?.owner_given);
  const leftoverOnly = manager < 0.5 && leftoverUsed > 0.5 && ownerAdvance < 0.5;
  const less = leftoverOnly ? leftoverUsed : ownerApplied > 0.5 ? ownerApplied : 0;
  const mgrName = managerNameForTrip(trip, advances);
  const ownName = ownerNameForDriver(trip, advances);
  const ownerLabel = ownName ? `Owner: ${ownName}` : undefined;

  const chips: AdvancePaidChip[] = [];
  if (leftoverOnly) {
    chips.push({
      label: 'Advance Balance in Hand',
      name: ownerLabel,
      amount: leftoverUsed,
      color: '#047857',
      bg: '#ecfdf5',
    });
  }
  if (manager > 0.5) {
    chips.push({
      label: 'Advance',
      name: mgrName ? `Manager: ${mgrName}` : undefined,
      amount: manager,
      color: '#1d4ed8',
      bg: '#eff6ff',
    });
  }
  if (!leftoverOnly && ownerAdvance > 0.5) {
    chips.push({
      label: 'Owner Advance',
      name: ownerLabel,
      amount: ownerAdvance,
      color: '#6d28d9',
      bg: '#f5f3ff',
    });
  }
  if (!leftoverOnly && less > 0.5) {
    chips.push({
      label: 'Less',
      amount: less,
      color: '#c2410c',
      bg: '#fff7ed',
      minus: true,
    });
  }
  if (adj?.toPrior && adj.toPrior.amount > 0.5) {
    chips.push({
      label: adj.toPrior.tripId
        ? `Less previous Trip #${adj.toPrior.tripId}`
        : 'Less previous trip',
      name: 'Given advance used for previous trip dues',
      amount: adj.toPrior.amount,
      color: '#c2410c',
      bg: '#fff7ed',
      minus: true,
    });
  }
  if (adj?.fromNext && adj.fromNext.amount > 0.5) {
    chips.push({
      label: 'Advance adjusted from next trip',
      name: `From Trip #${adj.fromNext.tripId}`,
      amount: adj.fromNext.amount,
      color: '#1d4ed8',
      bg: '#eff6ff',
    });
  }

  return {
    chips,
    manager,
    ownerAdvance: leftoverOnly ? 0 : ownerAdvance,
    less,
    ownerBal: leftoverOnly ? (ownerBal > 0.5 ? ownerBal : 0) : ownerBal,
  };
};

const advancePaidChipRowStyle = (bg: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  background: bg,
  borderRadius: 6,
  padding: '4px 8px',
  lineHeight: 1.25,
});

const advancePaidHtml = (chips: AdvancePaidChip[]) =>
  chips
    .map(
      (c) =>
        `<div style="display:flex;justify-content:space-between;gap:8px;background:${c.bg};border-radius:6px;padding:3px 7px;margin:2px 0">
          <div><div style="font-size:10px;font-weight:800;color:${c.color}">${c.label}</div>${c.name ? `<div style="font-size:9px;font-weight:700;color:${c.color}">${c.name}</div>` : ''}</div>
          <div style="font-size:11px;font-weight:800;color:${c.color};white-space:nowrap">${c.minus ? '(-) ' : ''}${formatCurrency(c.amount)}</div>
        </div>`
    )
    .join('');

const settlementAdjNotes = (pay: TripPaymentInfo, adj?: AdvanceAdjLink | null) => {
  const notes: string[] = [];
  if (pay.cashPaid > 0.5) notes.push(`Paid ${formatCurrency(pay.cashPaid)}`);
  if (adj?.fromNext && adj.fromNext.amount > 0.5) {
    notes.push(`Advance adjusted from next Trip #${adj.fromNext.tripId} ${formatCurrency(adj.fromNext.amount)}`);
  }
  if (adj?.toPrior && adj.toPrior.amount > 0.5) {
    notes.push(
      adj.toPrior.tripId
        ? `Given advance ${formatCurrency(adj.toPrior.amount)} less for previous Trip #${adj.toPrior.tripId}`
        : `Given advance ${formatCurrency(adj.toPrior.amount)} less for previous trip`
    );
  } else if (pay.adjusted > 0.5) {
    notes.push(`Adjusted ${formatCurrency(pay.adjusted)}`);
  }
  return notes;
};

const tripCashAmounts = (paid: { ownerBal: number }, pay: TripPaymentInfo) => {
  const inHandAmt = Math.max(0, paid.ownerBal > 0.5 ? paid.ownerBal : pay.inHand);
  const needPayAmt = inHandAmt > 0.5 ? 0 : Math.max(0, pay.needPay);
  return { inHandAmt, needPayAmt };
};

const cashCellsHtml = (paid: { ownerBal: number }, pay: TripPaymentInfo) => {
  const { inHandAmt, needPayAmt } = tripCashAmounts(paid, pay);
  return `<td class="num" style="color:#047857">${formatCurrency(inHandAmt)}</td>
    <td class="num" style="color:#dc2626">${formatCurrency(needPayAmt)}</td>`;
};

const tripDetailRowHtml = (tr: Trip, advances: DriverAdvance[], settlements: Settlement[], alloc: Record<number, OwnerAlloc>, adj?: AdvanceAdjLink | null, allTrips: Trip[] = []) => {
  const paid = tripAdvancePaid(tr, advances, settlements.find((s) => Number(s.trip_id) === Number(tr.id)), alloc[tr.id], adj);
  const pay = tripPaymentInfo(tr, advances, alloc[tr.id], allTrips);
  const adjNotes = settlementAdjNotes(pay, adj);
  return `<tr>
    <td><strong>#${tr.id}</strong></td>
    <td>${formatISTDate(tr.trip_date)}</td>
    <td>${tr.party_name || '—'}<div style="font-size:10px;color:#64748b">${tr.from_location || '—'} → ${tr.to_location || '—'}</div></td>
    <td>${tr.lorry_number || '—'}${tr.owner_name ? `<div style="font-size:10px;color:#64748b">${tr.owner_name}</div>` : ''}</td>
    <td>${advancePaidHtml(paid.chips) || '—'}</td>
    <td class="num" style="color:#b45309">${formatCurrency(tripExpenseTotal(tr))}</td>
    ${cashCellsHtml(paid, pay)}
    <td style="font-weight:800;color:${paymentStatusColor(pay.driverKind)}">${pay.driverLabel}${adjNotes.map((n) => `<div style="font-size:10px;font-weight:700;color:#c2410c">${n}</div>`).join('')}</td>
  </tr>`;
};

const getTripAdvanceLines = (trip: Trip, advances: DriverAdvance[] = []): AdvanceLine[] => {
  const lines: AdvanceLine[] = [];
  const seen = new Set<string>();
  advances
    .filter((a) => Number(a.trip_id) === Number(trip.id))
    .forEach((a) => {
      seen.add(`${a.source_type || 'ADV'}-${a.id}`);
      lines.push({ amount: parseFloat(String(a.amount)) || 0, givenBy: givenByLabel(a) });
    });
  (trip.truck_advances || []).forEach((ta) => {
    const key = `TRIP_TRUCK_ADVANCE-${ta.id}`;
    if (seen.has(key)) return;
    lines.push({
      amount: parseFloat(String(ta.amount)) || 0,
      givenBy: `Manager: ${ta.manager_name || 'Manager'}`,
    });
  });
  if (!lines.length && parseFloat(String(trip.advance_paid || 0)) > 0) {
    lines.push({ amount: parseFloat(String(trip.advance_paid)) || 0, givenBy: 'Trip advance' });
  }
  return lines;
};

const tripAdvanceTotal = (trip: Trip, advances: DriverAdvance[] = []) => {
  const sum = getTripAdvanceLines(trip, advances).reduce((s, l) => s + l.amount, 0);
  return sum > 0 ? sum : Math.max(0, parseFloat(String(trip.advance_paid || 0)) || 0);
};

const tripExpenseTotal = (trip: Trip) => Math.max(0, parseFloat(String(trip.total_expenses || 0)) || 0);

const numAmt = (val: unknown) => parseFloat(String(val ?? 0)) || 0;

type TripSeqCash = {
  ownAdv: number;
  expenses: number;
  appliedToPrior: number;
  receivedFromLater: number;
  inHand: number;
  needPay: number;
};

const computeSequentialTripCash = (trips: Trip[], advances: DriverAdvance[]) => {
  const active = [...trips]
    .filter((t) => {
      const st = String(t.status || '').toUpperCase();
      return st !== 'CANCELLED' && st !== 'DRAFT';
    })
    .sort((a, b) => {
      const ta = new Date(a.trip_date || 0).getTime();
      const tb = new Date(b.trip_date || 0).getTime();
      if (ta !== tb) return ta - tb;
      return Number(a.id) - Number(b.id);
    });

  const result: Record<number, TripSeqCash> = {};
  const dues: Array<{ id: number; remaining: number }> = [];
  let carry = 0;

  for (const t of active) {
    const ownAdv = Math.round(tripAdvanceTotal(t, advances));
    const expenses = Math.round(tripExpenseTotal(t));
    let remainingNew = ownAdv;
    let remainingCarry = Math.round(carry);
    let appliedToPrior = 0;

    for (const due of dues) {
      if (due.remaining <= 0) continue;
      if (remainingNew > 0) {
        const take = Math.min(remainingNew, due.remaining);
        remainingNew -= take;
        due.remaining -= take;
        appliedToPrior += take;
        result[due.id].receivedFromLater += take;
        result[due.id].needPay = due.remaining;
        if (due.remaining > 0) result[due.id].inHand = 0;
      }
      if (due.remaining > 0 && remainingCarry > 0) {
        const take = Math.min(remainingCarry, due.remaining);
        remainingCarry -= take;
        due.remaining -= take;
        result[due.id].receivedFromLater += take;
        result[due.id].needPay = due.remaining;
        if (due.remaining > 0) result[due.id].inHand = 0;
      }
    }

    const pool = remainingNew + remainingCarry;
    const cover = Math.min(pool, expenses);
    const need = Math.round(expenses - cover);
    const left = Math.round(pool - cover);
    result[Number(t.id)] = {
      ownAdv,
      expenses,
      appliedToPrior,
      receivedFromLater: 0,
      inHand: need > 0 ? 0 : left,
      needPay: need,
    };
    if (need > 0) dues.push({ id: Number(t.id), remaining: need });
    carry = need > 0 ? 0 : left;
  }

  return result;
};

type TripPaymentInfo = {
  driverLabel: string;
  driverKind: 'settled' | 'in_hand' | 'need_pay' | 'pending' | 'verified';
  inHand: number;
  needPay: number;
  leftover: number;
  freight: number;
  expenses: number;
  advance: number;
  adjusted: number;
  effectiveAdvance: number;
  cashPaid: number;
  payMode: string;
  isAdjusted: boolean;
};

const tripPaymentInfo = (trip: Trip, advances: DriverAdvance[] = [], alloc?: OwnerAlloc, allTrips?: Trip[]): TripPaymentInfo => {
  const settle = String(trip.settlement_status || '').toUpperCase();
  const freight = Math.max(0, numAmt(trip.total_freight));
  const expenses = tripExpenseTotal(trip);
  const advance = alloc
    ? numAmt(alloc.manager_advance) + numAmt(alloc.owner_given)
    : tripAdvanceTotal(trip, advances);
  const seq = allTrips?.length ? computeSequentialTripCash(allTrips, advances)[Number(trip.id)] : undefined;
  const adjusted = seq ? seq.appliedToPrior : Math.max(0, numAmt(trip.prior_deficit_deduction));
  const effectiveAdvance = seq ? Math.max(0, seq.ownAdv - seq.appliedToPrior) : Math.max(0, advance - adjusted);
  const leftover = seq ? (seq.needPay > 0.5 ? -seq.needPay : seq.inHand) : (alloc ? numAmt(alloc.owner_balance) : effectiveAdvance - expenses);
  const payMode = String(trip.settlement_payment_mode || '');
  const isAdjusted = payMode === 'ADJUSTED_ADVANCE' || adjusted > 0.5;
  const rawPaid = Math.max(0, numAmt(trip.settlement_paid_amount));
  const cashPaid = payMode === 'ADJUSTED_ADVANCE' ? 0 : rawPaid;
  const computedNeed = seq
    ? seq.needPay
    : alloc
    ? Math.max(0, expenses - numAmt(alloc.manager_advance) - numAmt(alloc.owner_given) - numAmt(alloc.owner_leftover_used))
    : Math.max(0, -leftover);
  const netFromSettlement = trip.net_balance_to_driver != null && trip.net_balance_to_driver !== undefined
    ? numAmt(trip.net_balance_to_driver)
    : leftover;

  let inHand = 0;
  let needPay = 0;
  if (seq) {
    inHand = seq.inHand;
    needPay = Math.max(0, seq.needPay);
    if (needPay > 0.5) inHand = 0;
  } else if (alloc) {
    inHand = leftover > 0.5 ? leftover : 0;
    needPay = inHand > 0.5 ? 0 : Math.max(0, computedNeed - cashPaid);
  } else if (settle === 'SETTLED') {
    needPay = 0;
    inHand = leftover > 0.5 ? leftover : 0;
  } else if (netFromSettlement > 0.5) {
    needPay = Math.max(0, netFromSettlement - cashPaid);
    inHand = 0;
  } else if (netFromSettlement < -0.5) {
    inHand = Math.abs(netFromSettlement);
    needPay = 0;
  } else if (leftover > 0.5) {
    inHand = leftover;
  } else if (leftover < -0.5) {
    needPay = Math.max(0, Math.abs(leftover) - cashPaid);
  }

  let driverKind: TripPaymentInfo['driverKind'] = 'pending';
  let driverLabel = 'Pending';
  if (settle === 'SETTLED') {
    driverKind = 'settled';
    driverLabel = cashPaid > 0.5 ? 'Settled' : isAdjusted ? 'Settled · Adjusted' : 'Settled';
  } else if (needPay > 0.5) {
    driverKind = 'need_pay';
    driverLabel = settle === 'VERIFIED' ? 'Verified · Need to Pay' : 'Need to Pay';
  } else if (inHand > 0.5) {
    driverKind = 'in_hand';
    driverLabel = isAdjusted ? 'Adjusted · Cash in Hand' : 'Cash in Hand';
  } else if (settle === 'VERIFIED') {
    driverKind = 'verified';
    driverLabel = 'Verified';
  } else if (settle === 'PENDING') {
    driverKind = 'pending';
    driverLabel = 'Pending';
  } else {
    driverKind = 'settled';
    driverLabel = 'Settled';
  }

  const netSettled = trip.net_balance_to_driver != null && trip.net_balance_to_driver !== undefined
    ? numAmt(trip.net_balance_to_driver)
    : null;
  if (netSettled != null) {
    if (netSettled > 0.5) {
      needPay = Math.round(netSettled);
      inHand = 0;
      driverKind = 'need_pay';
      driverLabel = settle === 'VERIFIED' ? 'Verified · Need to Pay' : 'Need to Pay';
    } else if (netSettled < -0.5) {
      inHand = Math.round(Math.abs(netSettled));
      needPay = 0;
      driverKind = 'in_hand';
      driverLabel = 'Cash in Hand';
    } else {
      needPay = 0;
      inHand = 0;
    }
  }

  return {
    driverLabel,
    driverKind,
    inHand,
    needPay,
    leftover,
    freight,
    expenses,
    advance,
    adjusted,
    effectiveAdvance,
    cashPaid,
    payMode,
    isAdjusted,
  };
};

const paymentStatusColor = (kind: TripPaymentInfo['driverKind']) => {
  if (kind === 'need_pay') return '#dc2626';
  if (kind === 'in_hand') return '#059669';
  if (kind === 'verified') return '#7c3aed';
  if (kind === 'pending') return '#d97706';
  return '#64748b';
};

const driverOverallPaymentStatus = (d: DriverAdvanceSummary) => {
  const balInHand = Math.max(0, parseFloat(String(d.balance_in_hand ?? 0)));
  const needToPay = Math.max(0, parseFloat(String(d.need_to_pay ?? 0)));
  if (needToPay > 0.5) return { label: 'Need to Pay', kind: 'need_pay' as const, amount: needToPay };
  if (balInHand > 0.5) return { label: 'Cash in Hand', kind: 'in_hand' as const, amount: balInHand };
  return { label: 'Settled', kind: 'settled' as const, amount: 0 };
};

type SlipContext = { advances?: DriverAdvance[]; driver?: DriverAdvanceSummary; alloc?: Record<number, OwnerAlloc>; trips?: Trip[] };

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

const buildTripSlipHtml = (trip: Trip, ctx: SlipContext = {}) => {
  const lines = getTripAdvanceLines(trip, ctx.advances || []);
  const pay = tripPaymentInfo(trip, ctx.advances || [], ctx.alloc?.[trip.id], ctx.trips || []);
  const d = ctx.driver;
  const fromWhomRows = lines.length
    ? lines.map((l) => `<tr><td>${l.givenBy}</td><td class="num">${formatCurrency(l.amount)}</td></tr>`).join('')
    : `<tr><td colspan="2" class="center">No advance recorded</td></tr>`;
  const expenseItems = trip.expense_items || [];
  const expenseRows = expenseItems.length
    ? expenseItems.map((item, idx) => `<tr><td>${idx + 1}</td><td>${item.expense_type || 'Expense'}</td><td>${item.description || '—'}</td><td class="num">${formatCurrency(item.amount)}</td></tr>`).join('')
    : `<tr><td>1</td><td>Trip expenses</td><td>—</td><td class="num">${formatCurrency(pay.expenses)}</td></tr>`;

  const adj = buildAdvanceAdjustmentLinks(ctx.trips || []).get(trip.id);
  const outcomeRows = [
    adj?.toPrior && adj.toPrior.amount > 0.5
      ? `<div class="totals-row" style="color:#c2410c"><span class="label">Less: given advance used for previous Trip #${adj.toPrior.tripId || ''}${adj.toPrior.lorry ? ` (${adj.toPrior.lorry})` : ''}</span><span class="val">(-) ${formatCurrency(adj.toPrior.amount)}</span></div>
         <div class="totals-row"><span class="label">Effective advance after adjustment</span><span class="val">${formatCurrency(pay.effectiveAdvance)}</span></div>`
      : pay.adjusted > 0.5
      ? `<div class="totals-row" style="color:#c2410c"><span class="label">Less: Adjusted to prior dues</span><span class="val">(-) ${formatCurrency(pay.adjusted)}</span></div>
         <div class="totals-row"><span class="label">Effective advance after adjustment</span><span class="val">${formatCurrency(pay.effectiveAdvance)}</span></div>`
      : '',
    adj?.fromNext && adj.fromNext.amount > 0.5
      ? `<div class="totals-row" style="color:#166534"><span class="label">Adjusted from next Trip #${adj.fromNext.tripId}${adj.fromNext.lorry ? ` (${adj.fromNext.lorry})` : ''} advance</span><span class="val">${formatCurrency(adj.fromNext.amount)}</span></div>`
      : '',
    `<div class="totals-row"><span class="label">Less: Total expenses</span><span class="val" style="color:#b45309">(-) ${formatCurrency(pay.expenses)}</span></div>`,
    pay.cashPaid > 0.5
      ? `<div class="totals-row" style="color:#15803d"><span class="label">Settlement paid by admin${pay.payMode ? ` (${pay.payMode})` : ''}</span><span class="val">${formatCurrency(pay.cashPaid)}</span></div>`
      : pay.isAdjusted && String(trip.settlement_status || '').toUpperCase() === 'SETTLED'
        ? `<div class="totals-row" style="color:#1d4ed8"><span class="label">Settlement</span><span class="val">Adjusted from advance (no cash paid)</span></div>`
        : '',
    `<div class="totals-row grand" style="color:#15803d"><span>${pay.isAdjusted && pay.inHand > 0.5 ? 'Adjusted balance in hand' : 'In Hand'}</span><span>${formatCurrency(pay.inHand > 0.5 ? pay.inHand : 0)}</span></div>`,
    `<div class="totals-row grand" style="color:#dc2626"><span>Need to Pay</span><span>${formatCurrency(pay.inHand > 0.5 ? 0 : pay.needPay)}</span></div>`,
  ].join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Trip Driver Balance #${trip.id} - ${trip.lorry_number || ''}</title>
  <style>
    ${PRINT_BRAND_CSS}
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Segoe UI, Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; background: #fff; font-size: 13px; }
    @page { size: portrait; margin: 12mm; }
    .card { border: 2px solid #0f172a; border-radius: 8px; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 22px; font-weight: 800; margin: 0; }
    .sub { font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom: 16px; }
    .row-item { display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding: 6px 0; }
    .label { color: #64748b; font-weight: 600; }
    .val { font-weight: 700; }
    .section { font-weight: 800; margin: 14px 0 6px; text-transform: uppercase; font-size: 12px; }
    .totals-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 12px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .grand { font-weight: 800; border-top: 1px solid #94a3b8; padding-top: 8px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
    th { background: #0f172a; color: #fff; text-align: left; padding: 6px 8px; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
    .num { text-align: right; font-weight: 700; }
    .center { text-align: center; color: #94a3b8; }
    .signatures { display: flex; justify-content: space-between; margin-top: 36px; padding-top: 20px; }
    .sig-line { border-top: 1px solid #0f172a; width: 180px; text-align: center; font-size: 11px; padding-top: 6px; color: #475569; }
    .print-btn-bar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 16px; }
    .btn { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    @media print { .print-btn-bar { display: none !important; } }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="btn" onclick="window.print()">Print</button>
    <button class="btn" style="background:#64748b" onclick="window.close()">Close</button>
  </div>
  <div class="card" id="trip-slip">
    <div class="header">
      ${printBrandLockup()}
      <div class="sub">Trip Driver Balance Slip</div>
      <div style="margin-top:6px;font-weight:700;color:#2563eb">Trip #${trip.id}</div>
    </div>
    <div class="grid">
      <div class="row-item"><span class="label">Date</span><span class="val">${formatISTDate(trip.trip_date)}</span></div>
      <div class="row-item"><span class="label">Lorry</span><span class="val">${trip.lorry_number || '—'}</span></div>
      <div class="row-item"><span class="label">Driver</span><span class="val">${trip.driver_name || d?.driver_name || '—'}</span></div>
      <div class="row-item"><span class="label">Party</span><span class="val">${trip.party_name || '—'}</span></div>
      <div class="row-item"><span class="label">Route</span><span class="val">${trip.from_location || '—'} → ${trip.to_location || '—'}</span></div>
      <div class="row-item"><span class="label">Driver Settlement</span><span class="val" style="color:${paymentStatusColor(pay.driverKind)}">${pay.driverLabel}</span></div>
    </div>

    <div class="section">1. Total freight for this trip</div>
    <div class="totals-box" style="margin-top:0">
      <div class="totals-row"><span class="label">Total freight</span><span class="val">${formatCurrency(pay.freight)}</span></div>
    </div>

    <div class="section">2. Advance received — from whom</div>
    <table>
      <thead><tr><th>Given By</th><th class="num">Advance Amount</th></tr></thead>
      <tbody>${fromWhomRows}
        <tr><td style="font-weight:800">Total advance</td><td class="num">${formatCurrency(pay.advance)}</td></tr>
      </tbody>
    </table>

    <div class="section">3. Trip expenses</div>
    <table>
      <thead><tr><th>#</th><th>Type</th><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>${expenseRows}
        <tr><td colspan="3" style="font-weight:800;text-align:right">Total expenses</td><td class="num">${formatCurrency(pay.expenses)}</td></tr>
      </tbody>
    </table>

    <div class="section">4. Driver balance for this trip</div>
    <div class="totals-box" style="margin-top:0">
      <div class="totals-row"><span class="label">Total freight</span><span class="val">${formatCurrency(pay.freight)}</span></div>
      <div class="totals-row"><span class="label">Total advance received</span><span class="val">${formatCurrency(pay.advance)}</span></div>
      ${outcomeRows}
    </div>
    <div class="signatures">
      <div class="sig-line">Driver's Signature</div>
      <div class="sig-line">Prepared By</div>
      <div class="sig-line">Authorized Signatory</div>
    </div>
  </div>
</body>
</html>`;
};

export const DriverBalanceMasterPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const isManagerLogin = authUser?.role === 'MANAGER' || authUser?.role === 'TRANSPORT_USER';
  const [tripSlipLoading, setTripSlipLoading] = useState<{ [tripId: number]: 'print' | 'download' | 'share' | null }>({});
  // Lookups
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tripDrivers, setTripDrivers] = useState<{ id: number; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [managers, setManagers] = useState<User[]>([]);

  // Driver Summaries
  const [driverSummaries, setDriverSummaries] = useState<DriverAdvanceSummary[]>([]);
  const [grandTotals, setGrandTotals] = useState({
    total_advance_given: 0,
    total_trip_advance_used: 0,
    total_expenses_reported: 0,
    remaining_advance_balance: 0,
    balance_in_hand: 0,
    total_need_to_pay: 0,
    settlement_net_balance: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const [driverFilter, setDriverFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CASH_IN_HAND' | 'NEED_TO_PAY' | 'SETTLED'>('ALL');

  // Expand state
  const [expandedDriverId, setExpandedDriverId] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<{
    [driverId: number]: {
      advances: DriverAdvance[];
      trips: Trip[];
      settlements: Settlement[];
      loading: boolean;
    };
  }>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingDriverId, setPrintingDriverId] = useState<number | null>(null);
  const [selectedTripIds, setSelectedTripIds] = useState<{ [driverId: number]: number[] }>({});

  // Give Advance Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [giverType, setGiverType] = useState<'MANAGER' | 'OWNER'>('MANAGER');
  const [modalDriverId, setModalDriverId] = useState('');
  const [modalManagerId, setModalManagerId] = useState('');
  const [modalOwnerId, setModalOwnerId] = useState('');
  const [modalVehicleId, setModalVehicleId] = useState('');
  const [modalTripId, setModalTripId] = useState('');
  const [modalDriverTrips, setModalDriverTrips] = useState<Trip[]>([]);
  const [modalAmount, setModalAmount] = useState('');
  const [modalDate, setModalDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalPaymentMode, setModalPaymentMode] = useState('CASH');
  const [modalNotes, setModalNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const [dRes, vRes, oRes, uRes] = await Promise.all([
        driverService.getDrivers({ limit: 500, status: 'ACTIVE' }),
        vehicleService.getVehicles({ limit: 500, status: 'ACTIVE' }),
        ownerService.getOwners({ limit: 500, status: 'ACTIVE' }),
        userService.getUsers({ limit: 200, status: 'ACTIVE', for_advance: true }),
      ]);
      setDrivers(dRes.data.items || (Array.isArray(dRes.data) ? dRes.data : []));
      setVehicles(vRes.data.items || (Array.isArray(vRes.data) ? vRes.data : []));
      setOwners(oRes.data.items || (Array.isArray(oRes.data) ? oRes.data : []));
      setManagers((uRes.data.items || []).filter((u: User) => u.role === 'MANAGER' || u.role === 'ADMIN'));
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  const loadDriverSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await driverAdvanceService.getDriverSummary({
        driver_id: driverFilter || undefined,
        owner_id: ownerFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        search: debouncedSearch || undefined,
      });

      const items = res.data?.drivers || [];
      setDriverSummaries(items);
      if (!driverFilter) {
        const unique = Array.from(new Map(items.map((i: any) => [i.driver_id, { id: i.driver_id, name: i.driver_name }])).values());
        setTripDrivers(unique as { id: number; name: string }[]);
      }
      if (res.data?.grand_totals) {
        setGrandTotals(res.data.grand_totals);
      }
    } catch (err) {
      console.error('Failed to load driver balance summary', err);
    } finally {
      setIsLoading(false);
    }
  }, [driverFilter, ownerFilter, vehicleFilter, debouncedSearch]);

  useEffect(() => {
    loadDriverSummary();
  }, [loadDriverSummary]);

  useEffect(() => {
    const onFocus = () => loadDriverSummary();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadDriverSummary]);

  // Filtered summaries
  const filteredSummaries = useMemo(() => {
    return driverSummaries.filter((d) => {
      const balInHand = Math.max(0, parseFloat(String(d.balance_in_hand ?? 0)));
      const needToPay = Math.max(0, parseFloat(String(d.need_to_pay ?? 0)));
      const status = d.settlement_status || (balInHand > 0 ? 'CASH_IN_HAND' : 'SETTLED');

      if (statusFilter === 'CASH_IN_HAND') {
        if (balInHand <= 0 && status !== 'CASH_IN_HAND') return false;
      } else if (statusFilter === 'NEED_TO_PAY') {
        if (needToPay <= 0 && status !== 'NEED_TO_PAY') return false;
      } else if (statusFilter === 'SETTLED') {
        if (balInHand > 0 || needToPay > 0) return false;
      }

      if (vehicleFilter) {
        const v = vehicles.find((veh) => String(veh.id) === String(vehicleFilter));
        if (v && d.lorry_number !== v.lorry_number) return false;
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

  // Dynamic totals of filtered
  const filteredTotals = useMemo(() => {
    return filteredSummaries.reduce(
      (acc, d) => ({
        total_advance_given: acc.total_advance_given + (parseFloat(String(d.total_advance_given)) || 0),
        total_expenses_reported: acc.total_expenses_reported + (parseFloat(String(d.total_expenses_reported)) || 0),
        balance_in_hand: acc.balance_in_hand + Math.max(0, parseFloat(String(d.balance_in_hand)) || 0),
        need_to_pay: acc.need_to_pay + Math.max(0, parseFloat(String(d.need_to_pay)) || 0),
      }),
      {
        total_advance_given: 0,
        total_expenses_reported: 0,
        balance_in_hand: 0,
        need_to_pay: 0,
      }
    );
  }, [filteredSummaries]);

  // Expand row and load driver breakdown
  const handleToggleExpand = async (driverId: number) => {
    if (expandedDriverId === driverId) {
      setExpandedDriverId(null);
      return;
    }
    setExpandedDriverId(driverId);
    setExpandedDetails((prev) => ({
      ...prev,
      [driverId]: {
        advances: prev[driverId]?.advances || [],
        trips: prev[driverId]?.trips || [],
        settlements: prev[driverId]?.settlements || [],
        loading: true,
      },
    }));

    try {
      const [advRes, tripRes, settleRes] = await Promise.all([
        driverAdvanceService.getDriverAdvances({ driver_id: String(driverId), limit: 200 }),
        tripService.getTrips({ driver_id: String(driverId), limit: 200 }),
        settlementService.getSettlements({ driver_id: driverId, limit: 200 }),
      ]);

      setExpandedDetails((prev) => ({
        ...prev,
        [driverId]: {
          advances: advRes.data?.items || [],
          trips: tripRes.data?.items || [],
          settlements: settleRes.data?.items || [],
          loading: false,
        },
      }));
    } catch (err) {
      console.error('Failed to load driver expand details', err);
      setExpandedDetails((prev) => ({
        ...prev,
        [driverId]: { advances: [], trips: [], settlements: [], loading: false },
      }));
    }
  };

  const loadFullTrip = async (trip: Trip): Promise<Trip> => {
    try {
      const res = await tripService.getTripById(trip.id);
      return res.data || trip;
    } catch {
      return trip;
    }
  };

  const slipCtxForTrip = (trip: Trip): SlipContext => {
    const details = expandedDetails[trip.driver_id];
    const advances = details?.advances || [];
    const trips = details?.trips || [];
    return {
      advances,
      driver: driverSummaries.find((x) => x.driver_id === trip.driver_id),
      alloc: trips.length ? allocateOwnerAdvanceBreakdown(trips, advances) : {},
      trips,
    };
  };

  const toggleTripSelected = (driverId: number, tripId: number) => {
    setSelectedTripIds((prev) => {
      const cur = prev[driverId] || [];
      const next = cur.includes(tripId) ? cur.filter((id) => id !== tripId) : [...cur, tripId];
      return { ...prev, [driverId]: next };
    });
  };

  const toggleSelectAllTrips = (driverId: number, trips: Trip[]) => {
    setSelectedTripIds((prev) => {
      const ids = trips.map((t) => t.id);
      const cur = prev[driverId] || [];
      const allOn = ids.length > 0 && ids.every((id) => cur.includes(id));
      return { ...prev, [driverId]: allOn ? [] : ids };
    });
  };

  const printSelectedForDriver = async (d: DriverAdvanceSummary, action: 'print' | 'download') => {
    const trips = expandedDetails[d.driver_id]?.trips || [];
    const selected = selectedTripIds[d.driver_id] || [];
    if (!selected.length) {
      alert('Select one or more trips, or Select all for the full driver statement.');
      return;
    }
    const allSelected = trips.length > 0 && trips.every((t) => selected.includes(t.id));
    if (allSelected) {
      await handlePrintDriverStatement(d);
      return;
    }
    if (selected.length === 1) {
      const trip = trips.find((t) => t.id === selected[0]);
      if (!trip) return;
      if (action === 'download') await downloadTripSlip(trip);
      else await printTripSlip(trip);
      return;
    }
    const chosen = trips.filter((t) => selected.includes(t.id));
    const printAdvances = expandedDetails[d.driver_id]?.advances || [];
    const printSettlements = expandedDetails[d.driver_id]?.settlements || [];
    const printAlloc = allocateOwnerAdvanceBreakdown(trips, printAdvances);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Selected trips - ${d.driver_name}</title>
      <style>
    ${PRINT_BRAND_CSS}
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:Segoe UI,Arial,sans-serif;margin:0;padding:20px;color:#0f172a;background:#fff;font-size:12px}
        @page{size:landscape;margin:8mm}
        h1{margin:0 0 4px;font-size:18px} table{width:100%;border-collapse:collapse;margin-top:10px}
        th{background:#0f172a;color:#fff;padding:7px 8px;text-align:left} td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
        .num{text-align:right;font-weight:700} .print-bar{display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px}
        .pbtn{background:#2563eb;color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-weight:700}
        @media print{.print-bar{display:none!important}}
      </style></head><body>
      <div class="print-bar"><button class="pbtn" onclick="window.print()">Print / Save PDF</button><button class="pbtn" style="background:#64748b" onclick="window.close()">Close</button></div>
      ${printBrandLockup('Selected trip statement')}
      <h1>Selected trips for ${d.driver_name}</h1>
      <div style="color:#64748b;margin-bottom:8px">${selected.length} trip(s) · not the full driver overall</div>
      <table><thead><tr>
        <th>Trip</th><th>Date</th><th>Party / Route</th><th>Lorry</th><th>Advance from whom</th>
        <th class="num">Expense</th><th class="num">In Hand</th><th class="num">Need to Pay</th><th>Driver Settlement</th>
      </tr></thead><tbody>
      ${(() => { const adjMap = buildAdvanceAdjustmentLinks(trips); return chosen.map((tr) => tripDetailRowHtml(tr, printAdvances, printSettlements, printAlloc, adjMap.get(tr.id), trips)).join(''); })()}
      </tbody></table></body></html>`;
    const win = window.open('', '_blank', 'width=1100,height=850');
    if (!win) {
      alert('Allow popups to print/download.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    if (action === 'print') setTimeout(() => win.print(), 400);
  };

  const loadStatementData = async (driverId: number) => {
    const res = await driverAdvanceService.getDriverStatement(driverId);
    const data = res.data;
    return {
      ...data,
      timeline: data.chronological_timeline || data.timeline || [],
    };
  };

  const printTripSlip = async (trip: Trip) => {
    try {
      setTripSlipLoading((p) => ({ ...p, [trip.id]: 'print' }));
      const data = await loadStatementData(trip.driver_id);
      openStatementWindow(generateDriverStatementHtml(data, { tripId: trip.id }), true);
    } catch (err: any) {
      alert(err.message || 'Failed to print trip slip.');
    } finally {
      setTripSlipLoading((p) => ({ ...p, [trip.id]: null }));
    }
  };

  const tripSlipToPdfBlob = async (trip: Trip): Promise<Blob> => {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const data = await loadStatementData(trip.driver_id);
    const wrap = document.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.left = '-10000px';
    wrap.style.top = '0';
    wrap.style.width = '800px';
    wrap.style.background = '#fff';
    wrap.innerHTML = generateDriverStatementHtml(data, { tripId: trip.id });
    document.body.appendChild(wrap);
    const card = wrap.querySelector('#driver-statement') as HTMLElement;
    const canvas = await html2canvas(card || wrap, { scale: 2, backgroundColor: '#ffffff' });
    document.body.removeChild(wrap);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const imgW = pageW - 20;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, imgW, imgH);
    return pdf.output('blob');
  };

  const downloadTripSlip = async (trip: Trip) => {
    try {
      setTripSlipLoading((p) => ({ ...p, [trip.id]: 'download' }));
      const blob = await tripSlipToPdfBlob(await loadFullTrip(trip));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KSP-Trip-${trip.id}-${trip.lorry_number || 'slip'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download trip PDF.');
    } finally {
      setTripSlipLoading((p) => ({ ...p, [trip.id]: null }));
    }
  };

  const shareTripSlip = async (trip: Trip) => {
    try {
      setTripSlipLoading((p) => ({ ...p, [trip.id]: 'share' }));
      const blob = await tripSlipToPdfBlob(await loadFullTrip(trip));
      const file = new File([blob], `KSP-Trip-${trip.id}.pdf`, { type: 'application/pdf' });
      if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ title: `KSP Trip #${trip.id}`, files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        alert('Sharing is not supported in this browser. PDF downloaded instead.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') alert(err.message || 'Failed to share trip PDF.');
    } finally {
      setTripSlipLoading((p) => ({ ...p, [trip.id]: null }));
    }
  };

  // Open Give Advance Modal
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

  const handleOpenGiveAdvance = (driverId?: number) => {
    const dId = driverId ? String(driverId) : (drivers[0] ? String(drivers[0].id) : '');
    setModalDriverId(dId);
    setGiverType('MANAGER');
    setModalManagerId(isManagerLogin && authUser ? String(authUser.id) : (managers[0] ? String(managers[0].id) : ''));
    setModalOwnerId(owners[0] ? String(owners[0].id) : '');
    setModalVehicleId('');
    setModalTripId('');
    setModalAmount('');
    setModalDate(new Date().toISOString().split('T')[0]);
    setModalPaymentMode('CASH');
    setModalNotes('');
    setFormError('');
    if (dId) loadDriverTripsForModal(dId);
    else setModalDriverTrips([]);
    setIsModalOpen(true);
  };

  const handleGiveAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalDriverId) {
      setFormError('Please select a driver.');
      return;
    }
    const numAmount = parseFloat(modalAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid amount greater than ₹0.');
      return;
    }
    if (giverType === 'MANAGER' && !modalManagerId) {
      setFormError('Please select a manager.');
      return;
    }
    if (giverType === 'OWNER' && !modalOwnerId) {
      setFormError('Please select an owner.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');

      if (giverType === 'MANAGER') {
        await driverAdvanceService.createDriverAdvance({
          driver_id: parseInt(modalDriverId),
          manager_id: parseInt(modalManagerId),
          vehicle_id: modalVehicleId ? parseInt(modalVehicleId) : undefined,
          trip_id: modalTripId ? parseInt(modalTripId) : undefined,
          amount: numAmount,
          advance_date: modalDate,
          payment_mode: modalPaymentMode,
          notes: modalNotes.trim() || undefined,
        });
      } else {
        await ownerAdvanceService.createOwnerAdvance({
          owner_id: parseInt(modalOwnerId),
          recipient_type: 'DRIVER',
          driver_id: parseInt(modalDriverId),
          vehicle_id: modalVehicleId ? parseInt(modalVehicleId) : undefined,
          amount: numAmount,
          advance_date: modalDate,
          payment_mode: modalPaymentMode,
          notes: modalNotes.trim() || undefined,
        });
      }

      setIsModalOpen(false);
      // Invalidate cached expand details
      setExpandedDetails((prev) => {
        const copy = { ...prev };
        delete copy[parseInt(modalDriverId)];
        return copy;
      });
      loadDriverSummary();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err?.message || 'Failed to save advance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Badge
  const renderStatusBadge = (d: DriverAdvanceSummary) => {
    const pay = driverOverallPaymentStatus(d);
    const needToPay = pay.kind === 'need_pay' ? pay.amount : 0;
    const balInHand = pay.kind === 'in_hand' ? pay.amount : 0;

    if (pay.kind === 'need_pay') {
      return (
        <span
          style={{
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 700,
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <AlertCircle size={11} color="#dc2626" />
          Need to Pay: ₹{Math.round(needToPay).toLocaleString('en-IN')}
        </span>
      );
    }

    if (pay.kind === 'in_hand') {
      return (
        <span
          style={{
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 700,
            background: '#ecfdf5',
            color: '#059669',
            border: '1px solid #a7f3d0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <CheckCircle size={11} color="#059669" />
          Cash in Hand: ₹{Math.round(balInHand).toLocaleString('en-IN')}
        </span>
      );
    }

    return (
      <span
        style={{
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 700,
          background: '#f8fafc',
          color: '#64748b',
          border: '1px solid #e2e8f0',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <Check size={11} color="#64748b" /> Settled
      </span>
    );
  };

  // ── Print PDF Full Report ──────────────────────────────────────────
  const handlePrintFullReport = async () => {
    if (filteredSummaries.length === 0) {
      alert('No driver balance records found to print.');
      return;
    }

    const fmtINR = (v: number) => `₹${Math.round(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const totalMgrAdv = filteredSummaries.reduce((s, d) => s + (parseFloat(String(d.manager_advance_given || 0)) || 0), 0);
    const totalOwnAdv = filteredSummaries.reduce((s, d) => s + (parseFloat(String(d.owner_advance_given || 0)) || 0), 0);

    try {
      setIsPrinting(true);
      const details = await Promise.all(
        filteredSummaries.map(async (d) => {
          const cached = expandedDetails[d.driver_id];
          if (cached && !cached.loading && (cached.trips?.length || cached.advances?.length)) {
            return { driver: d, trips: cached.trips || [], advances: cached.advances || [], settlements: cached.settlements || [] };
          }
          const [advRes, tripRes, settleRes] = await Promise.all([
            driverAdvanceService.getDriverAdvances({ driver_id: String(d.driver_id), limit: 200 }),
            tripService.getTrips({ driver_id: String(d.driver_id), limit: 200 }),
            settlementService.getSettlements({ driver_id: d.driver_id, limit: 200 }),
          ]);
          return {
            driver: d,
            trips: tripRes.data?.items || [],
            advances: advRes.data?.items || [],
            settlements: settleRes.data?.items || [],
          };
        })
      );

      const driverBlocks = details.map(({ driver: d, trips, advances, settlements }) => {
        const alloc = allocateOwnerAdvanceBreakdown(trips, advances);
        const balInHand = Math.max(0, parseFloat(String(d.balance_in_hand ?? 0)));
        const needToPay = Math.max(0, parseFloat(String(d.need_to_pay ?? 0)));
        const adjMap = buildAdvanceAdjustmentLinks(trips);
        const tripRows = trips.length
          ? trips.map((tr) => tripDetailRowHtml(tr, advances, settlements, alloc, adjMap.get(tr.id), trips)).join('')
          : `<tr><td colspan="9" style="color:#94a3b8;padding:12px">No trips for this driver.</td></tr>`;
        return `<div class="driver-block">
          <div class="driver-head">
            <div>
              <div class="dname">${d.driver_name}</div>
              <div class="dmeta">${trips.length} trip(s)${d.driver_mobile ? ` · ${d.driver_mobile}` : ''}</div>
            </div>
            <div class="dkpis">
              <span>Advance <b>${formatCurrency(d.total_advance_given || 0)}</b></span>
              <span>Expense <b style="color:#b45309">${formatCurrency(d.total_expenses_reported || 0)}</b></span>
              <span style="color:#047857">In Hand <b>${formatCurrency(balInHand)}</b></span>
              <span style="color:#dc2626">Need to Pay <b>${formatCurrency(needToPay)}</b></span>
            </div>
          </div>
          <table>
            <thead><tr>
              <th>Trip</th><th>Date</th><th>Party / Route</th><th>Lorry</th>
              <th>Advance from whom</th><th class="num">Expense</th>
              <th class="num">In Hand</th><th class="num">Need to Pay</th><th>Driver Settlement</th>
            </tr></thead>
            <tbody>${tripRows}</tbody>
          </table>
        </div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>KSP Transport - Driver Balance Master Report</title>
        <style>
    ${PRINT_BRAND_CSS}
          *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:20px;color:#0f172a;background:#fff;font-size:11px}
          @page{size:landscape;margin:8mm}
          .header-bar{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #0f172a;margin-bottom:12px}
          .company-title{font-size:20px;font-weight:900;color:#0f172a;margin:0 0 3px;text-transform:uppercase;letter-spacing:0.5px}
          .report-subtitle{font-size:12px;font-weight:700;color:#2563eb;margin:0;text-transform:uppercase}
          .meta-text{font-size:10.5px;color:#64748b;margin:0}
          .kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}
          .kpi-card{background:#f8fafc;border:1px solid #cbd5e1;padding:8px 10px;border-radius:6px;text-align:center}
          .kpi-card .lbl{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase}
          .kpi-card .val{font-size:13px;font-weight:800;color:#0f172a;margin-top:2px}
          .driver-block{margin:14px 0 18px;page-break-inside:avoid}
          .driver-head{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#0f172a;color:#fff;padding:8px 12px;border-radius:8px 8px 0 0}
          .dname{font-size:13px;font-weight:800}
          .dmeta{font-size:10px;color:#cbd5e1;margin-top:2px}
          .dkpis{display:flex;gap:14px;font-size:11px}
          .dkpis b{font-weight:800}
          table{width:100%;border-collapse:collapse;font-size:10.5px}
          th{background:#1e293b;color:#fff;font-weight:700;text-align:left;padding:7px 8px;font-size:10px}
          td{padding:7px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;background:#fff}
          .num{text-align:right;font-weight:700}
          .print-bar{display:flex;justify-content:flex-end;gap:10px;margin-bottom:14px}
          .pbtn{background:#2563eb;color:#fff;border:none;padding:7px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:11.5px}
          .signatures{display:flex;justify-content:space-between;margin-top:30px;padding-top:15px}
          .sig-col{width:220px;text-align:center}
          .sig-line{border-top:1.5px solid #0f172a;margin-bottom:6px}
          .sig-text{font-size:11px;font-weight:700;color:#334155}
          @media print{.print-bar{display:none!important};body{padding:0}}
        </style></head><body>
        <div class="print-bar">
          <button class="pbtn" onclick="window.print()">Print / Save PDF</button>
          <button class="pbtn" style="background:#64748b" onclick="window.close()">Close</button>
        </div>
        <div class="header-bar">
          <div>
            ${printBrandLockup()}
            <div class="report-subtitle">Driver Balance Master Statement (Live Fleet Balances &amp; Advances)</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800;font-size:13px;color:#0f172a">Total Drivers: ${filteredSummaries.length}</div>
            <p class="meta-text" style="margin-top:3px">Generated on: ${new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div class="kpi-row">
          <div class="kpi-card" style="border-color:#bbf7d0;background:#f0fdf4">
            <div class="lbl" style="color:#15803d">Total Advances</div>
            <div class="val" style="color:#15803d">${fmtINR(filteredTotals.total_advance_given)}</div>
          </div>
          <div class="kpi-card">
            <div class="lbl">Mgr Advances</div>
            <div class="val">${fmtINR(totalMgrAdv)}</div>
          </div>
          <div class="kpi-card">
            <div class="lbl">Owner Advances</div>
            <div class="val">${fmtINR(totalOwnAdv)}</div>
          </div>
          <div class="kpi-card" style="border-color:#fde68a;background:#fffbeb">
            <div class="lbl" style="color:#b45309">Trip Expenses</div>
            <div class="val" style="color:#b45309">${fmtINR(filteredTotals.total_expenses_reported)}</div>
          </div>
          <div class="kpi-card" style="border-color:${filteredTotals.balance_in_hand > 0 ? '#bbf7d0' : '#fecaca'};background:${filteredTotals.balance_in_hand > 0 ? '#f0fdf4' : '#fef2f2'}">
            <div class="lbl" style="color:${filteredTotals.balance_in_hand > 0 ? '#15803d' : '#dc2626'}">Fleet Net Balance</div>
            <div class="val" style="color:${filteredTotals.balance_in_hand > 0 ? '#15803d' : '#dc2626'}">${filteredTotals.balance_in_hand > 0 ? fmtINR(filteredTotals.balance_in_hand) + ' In Hand' : fmtINR(filteredTotals.need_to_pay) + ' Due'}</div>
          </div>
        </div>
        ${driverBlocks}
        <div class="signatures">
          <div class="sig-col"><div class="sig-line"></div><div class="sig-text">Accounts / Manager Signature</div></div>
          <div class="sig-col"><div class="sig-line"></div><div class="sig-text">Authorized Signatory (KSP Service)</div></div>
        </div>
        </body></html>`;

      const win = window.open('', '_blank', 'width=1150,height=850');
      if (!win) {
        alert('Please allow popups to print/download the PDF.');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err: any) {
      alert(err?.message || 'Failed to load trip details for print.');
    } finally {
      setIsPrinting(false);
    }
  };

  // ── Print Individual Driver Statement ─────────────────────────────
  const handlePrintDriverStatement = async (d: DriverAdvanceSummary) => {
    try {
      setPrintingDriverId(d.driver_id);
      const data = await loadStatementData(d.driver_id);
      openStatementWindow(generateDriverStatementHtml(data), true);
    } catch (err: any) {
      alert(err?.message || 'Failed to load driver statement.');
    } finally {
      setPrintingDriverId(null);
    }
  };


  // ── Download Excel (.xlsx) ─────────────────────────────────────────
  const handleExportExcel = () => {
    try {
      setIsExportingExcel(true);
      const rows = filteredSummaries.map((d, i) => {
        const balInHand = Math.max(0, parseFloat(String(d.balance_in_hand ?? 0)));
        const needToPay = Math.max(0, parseFloat(String(d.need_to_pay ?? 0)));
        return {
          'S.No': i + 1,
          'Driver Name': d.driver_name,
          'Driver Mobile': d.driver_mobile || '—',
          'Driver License': d.driver_license || '—',
          'Status': d.status,
          'Vehicle / Lorry': d.lorry_number || '—',
          'Vehicle Owner': d.owner_name || '—',
          'Total Advance Given (₹)': parseFloat(String(d.total_advance_given || 0)),
          'Total Expenses Reported (₹)': parseFloat(String(d.total_expenses_reported || 0)),
          'Balance in Hand (₹)': balInHand,
          'Need to Pay / Dues (₹)': needToPay,
          'Driver Settlement': driverOverallPaymentStatus(d).label,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Driver Balance Master');
      XLSX.writeFile(wb, `KSP_Driver_Balance_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel', err);
      alert('Failed to export Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setDriverFilter('');
    setOwnerFilter('');
    setVehicleFilter('');
    setStatusFilter('ALL');
  };

  return (
    <div className="page-container" style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Wallet size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Driver Balance Master
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0' }}>
              One master for driver advances, cash in hand, and amount to pay
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleOpenGiveAdvance()}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#059669',
              color: '#fff',
              border: 'none',
              padding: '9px 14px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <Plus size={15} /> Give Advance
          </button>

          <button
            onClick={handlePrintFullReport}
            disabled={isPrinting}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#fff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              padding: '9px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: isPrinting ? 'wait' : 'pointer',
            }}
            title="Print or Save PDF"
          >
            {isPrinting ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} {isPrinting ? 'Preparing...' : 'Print PDF'}
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#fff',
              color: '#15803d',
              border: '1px solid #bbf7d0',
              padding: '9px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
            title="Download Excel"
          >
            <FileSpreadsheet size={15} /> {isExportingExcel ? 'Exporting...' : 'Export Excel'}
          </button>

          <button
            onClick={() => loadDriverSummary()}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#fff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              padding: '9px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
            title="Refresh"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          background: '#fff',
          borderRadius: '10px',
          padding: '16px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 240px', minWidth: '220px', position: 'relative' }}>
          <Search
            size={16}
            color="#94a3b8"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search driver, mobile, vehicle, trip ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#0f172a',
            }}
          />
        </div>

        {/* Status Chips */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setStatusFilter('ALL')}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: statusFilter === 'ALL' ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: statusFilter === 'ALL' ? '#eff6ff' : '#fff',
              color: statusFilter === 'ALL' ? '#2563eb' : '#64748b',
            }}
          >
            All ({driverSummaries.length})
          </button>

          <button
            onClick={() => setStatusFilter('CASH_IN_HAND')}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: statusFilter === 'CASH_IN_HAND' ? '1px solid #10b981' : '1px solid #e2e8f0',
              background: statusFilter === 'CASH_IN_HAND' ? '#ecfdf5' : '#fff',
              color: statusFilter === 'CASH_IN_HAND' ? '#059669' : '#64748b',
            }}
          >
            Cash in Hand
          </button>

          <button
            onClick={() => setStatusFilter('NEED_TO_PAY')}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: statusFilter === 'NEED_TO_PAY' ? '1px solid #ef4444' : '1px solid #e2e8f0',
              background: statusFilter === 'NEED_TO_PAY' ? '#fef2f2' : '#fff',
              color: statusFilter === 'NEED_TO_PAY' ? '#dc2626' : '#64748b',
            }}
          >
            Need to Pay
          </button>

          <button
            onClick={() => setStatusFilter('SETTLED')}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: statusFilter === 'SETTLED' ? '1px solid #64748b' : '1px solid #e2e8f0',
              background: statusFilter === 'SETTLED' ? '#f1f5f9' : '#fff',
              color: statusFilter === 'SETTLED' ? '#0f172a' : '#64748b',
            }}
          >
            Settled
          </button>
        </div>

        {/* Owner Dropdown */}
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            background: '#fff',
            color: '#0f172a',
            minWidth: '150px',
          }}
        >
          <option value="">All Owners</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        {/* Vehicle Dropdown */}
        <select
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            background: '#fff',
            color: '#0f172a',
            minWidth: '150px',
          }}
        >
          <option value="">All Vehicles</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.lorry_number}
            </option>
          ))}
        </select>

        {/* Driver Dropdown */}
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            borderRadius: '8px',
            border: driverFilter ? '1px solid #2563eb' : '1px solid #cbd5e1',
            fontSize: '13px',
            background: driverFilter ? '#eff6ff' : '#fff',
            color: driverFilter ? '#1e40af' : '#0f172a',
            minWidth: '160px',
            fontWeight: driverFilter ? 700 : 400,
          }}
        >
          <option value="">All Drivers</option>
          {tripDrivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {(search || driverFilter || ownerFilter || vehicleFilter || statusFilter !== 'ALL') && (
          <button
            onClick={resetFilters}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              background: '#f1f5f9',
              border: 'none',
              color: '#475569',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Driver Balance Master cards (same layout as mobile) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '14px',
          marginBottom: '12px',
        }}
      >
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af' }}>Total Advance</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1e40af' }}>{formatCurrency(filteredTotals.total_advance_given)}</div>
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309' }}>Expenses</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#b45309' }}>{formatCurrency(filteredTotals.total_expenses_reported)}</div>
        </div>
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>In Hand</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#059669' }}>{formatCurrency(filteredTotals.balance_in_hand)}</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>To Pay</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#dc2626' }}>{formatCurrency(filteredTotals.need_to_pay)}</div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
          <Loader2 size={24} className="animate-spin" style={{ marginBottom: 8 }} />
          Loading driver balances...
        </div>
      ) : filteredSummaries.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>No drivers found matching current filters.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              {filteredSummaries.map((d) => {
                  const balInHand = Math.max(0, parseFloat(String(d.balance_in_hand ?? 0)));
                  const needToPay = Math.max(0, parseFloat(String(d.need_to_pay ?? 0)));
                  const isExpanded = expandedDriverId === d.driver_id;
                  const expData = expandedDetails[d.driver_id];
                  const allocMap = isExpanded && expData?.trips
                    ? allocateOwnerAdvanceBreakdown(expData.trips, expData.advances || [])
                    : {};

                  return (
                    <React.Fragment key={d.driver_id}>
                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '14px',
                          padding: '16px',
                          boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                          gridColumn: isExpanded ? '1 / -1' : 'auto',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(d.driver_id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 12,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            {isExpanded ? <ChevronUp size={16} color="#0f172a" /> : <ChevronDown size={16} color="#64748b" />}
                            <UserCheck size={16} color="#059669" />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{d.driver_name}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                {d.trip_count || 0} trips
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>Total Advance</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e40af' }}>{formatCurrency(d.total_advance_given || 0)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>Total Expense</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#b45309' }}>{formatCurrency(d.total_expenses_reported || 0)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>In Hand</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: balInHand > 0 ? '#059669' : '#64748b' }}>{formatCurrency(balInHand)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>Need to Pay</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: needToPay > 0 ? '#dc2626' : '#64748b' }}>{formatCurrency(needToPay)}</div>
                            </div>
                            {renderStatusBadge(d)}
                          </div>
                        </button>

                      {isExpanded && (
                        <div style={{ marginTop: 12 }}>
                            {expData?.loading ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                <Loader2 size={16} className="animate-spin" />
                                Loading trips for {d.driver_name}...
                              </div>
                            ) : (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                                  <div style={{ fontWeight: 800, fontSize: 13 }}>Trips for {d.driver_name}</div>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); printSelectedForDriver(d, 'print'); }}
                                      style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: 8, padding: '6px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                                    >
                                      Print selected
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); printSelectedForDriver(d, 'download'); }}
                                      style={{ background: '#ecfdf5', color: '#15803d', border: '1px solid #86efac', borderRadius: 8, padding: '6px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                                    >
                                      PDF selected
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleOpenGiveAdvance(d.driver_id); }}
                                      style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                                    >
                                      Give Advance
                                    </button>
                                  </div>
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                                  Tick trips, then Print/PDF. One trip = that trip only. Select all = full driver overall statement.
                                </div>
                                {!expData?.trips?.length && !(expData?.advances || []).length ? (
                                  <div style={{ color: '#94a3b8', fontSize: 13, padding: '16px 0' }}>No trips or advances for this driver.</div>
                                ) : (
                                  <>
                                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 1080 }}>
                                      <thead>
                                        <tr style={{ background: '#0f172a', color: '#fff' }}>
                                          <th style={{ padding: '8px 10px', textAlign: 'center', width: 42 }}>
                                            <input
                                              type="checkbox"
                                              title="Select all"
                                              checked={(expData?.trips || []).length > 0 && (expData?.trips || []).every((t) => (selectedTripIds[d.driver_id] || []).includes(t.id))}
                                              onChange={() => toggleSelectAllTrips(d.driver_id, expData?.trips || [])}
                                            />
                                          </th>
                                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Trip</th>
                                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Party / Route</th>
                                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Lorry</th>
                                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Advance from whom</th>
                                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Expense</th>
                                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>In Hand</th>
                                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Need to Pay</th>
                                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Driver Settlement</th>
                                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(() => {
                                          const adjMap = buildAdvanceAdjustmentLinks(expData?.trips || []);
                                          return (expData?.trips || []).map((tr) => {
                                          const slipBusy = tripSlipLoading[tr.id];
                                          const advances = expData?.advances || [];
                                          const adj = adjMap.get(tr.id);
                                          const paid = tripAdvancePaid(
                                            tr,
                                            advances,
                                            (expData?.settlements || []).find((s) => Number(s.trip_id) === Number(tr.id)),
                                            allocMap[tr.id],
                                            adj
                                          );
                                          const expAmt = tripExpenseTotal(tr);
                                          const pay = tripPaymentInfo(tr, advances, allocMap[tr.id], expData?.trips || []);
                                          const cash = tripCashAmounts(paid, pay);
                                          const checked = (selectedTripIds[d.driver_id] || []).includes(tr.id);
                                          return (
                                            <tr key={tr.id} style={{ borderBottom: '1px solid #e2e8f0', background: checked ? '#f8fafc' : '#fff' }}>
                                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <input type="checkbox" checked={checked} onChange={() => toggleTripSelected(d.driver_id, tr.id)} />
                                              </td>
                                              <td style={{ padding: '10px', fontWeight: 800, color: '#1d4ed8' }}>#{tr.id}</td>
                                              <td style={{ padding: '10px' }}>{formatISTDate(tr.trip_date)}</td>
                                              <td style={{ padding: '10px' }}>
                                                <div style={{ fontWeight: 700 }}>{tr.party_name || '—'}</div>
                                                <div style={{ fontSize: 11, color: '#64748b' }}>{tr.from_location || '—'} → {tr.to_location || '—'}</div>
                                              </td>
                                              <td style={{ padding: '10px', fontWeight: 700 }}>
                                                {tr.lorry_number || '—'}
                                                {tr.owner_name ? <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{tr.owner_name}</div> : null}
                                              </td>
                                              <td style={{ padding: '10px', minWidth: 210 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                  {paid.chips.map((row) => (
                                                    <div key={row.label} style={advancePaidChipRowStyle(row.bg)}>
                                                      <div>
                                                        <div style={{ fontSize: 11, fontWeight: 800, color: row.color }}>{row.label}</div>
                                                        {row.name ? <div style={{ fontSize: 10, fontWeight: 700, color: row.color }}>{row.name}</div> : null}
                                                      </div>
                                                      <div style={{ fontSize: 12, fontWeight: 800, color: row.color, whiteSpace: 'nowrap' }}>
                                                        {row.minus ? '(-) ' : ''}{formatCurrency(row.amount)}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </td>
                                              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>{formatCurrency(expAmt)}</td>
                                              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: cash.inHandAmt > 0 ? '#047857' : '#64748b' }}>
                                                {formatCurrency(cash.inHandAmt)}
                                              </td>
                                              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: cash.needPayAmt > 0 ? '#dc2626' : '#64748b' }}>
                                                {formatCurrency(cash.needPayAmt)}
                                              </td>
                                              <td style={{ padding: '10px' }}>
                                                <div style={{ fontWeight: 800, color: paymentStatusColor(pay.driverKind) }}>{pay.driverLabel}</div>
                                                {settlementAdjNotes(pay, adj).map((note) => (
                                                  <div key={note} style={{ fontSize: 11, color: note.startsWith('Paid') ? '#15803d' : '#c2410c' }}>{note}</div>
                                                ))}
                                              </td>
                                              <td style={{ padding: '10px' }}>
                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                  <button type="button" title="Print this trip only" onClick={() => printTripSlip(tr)} style={{ border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    {slipBusy === 'print' ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />} Print
                                                  </button>
                                                  <button type="button" title="Download this trip only" onClick={() => downloadTripSlip(tr)} style={{ border: '1px solid #86efac', background: '#ecfdf5', color: '#15803d', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    {slipBusy === 'download' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Download
                                                  </button>
                                                  <button type="button" title="Share this trip only" onClick={() => shareTripSlip(tr)} style={{ border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#7c3aed', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    {slipBusy === 'share' ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />} Share
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        });
                                        })()}
                                      </tbody>
                                    </table>
                                  </div>
                                  {(expData?.advances || []).filter((a) => !a.trip_id && !isOwnerAdvance(a)).length > 0 && (
                                    <div style={{ marginTop: 12, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                                      <div style={{ padding: '8px 10px', fontWeight: 800, fontSize: 12, background: '#f8fafc' }}>Advances without a trip</div>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                                        <thead>
                                          <tr style={{ background: '#1e293b', color: '#fff' }}>
                                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>From whom</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Notes</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(expData?.advances || []).filter((a) => !a.trip_id && !isOwnerAdvance(a)).map((a) => (
                                            <tr key={`adv-${a.source_type}-${a.id}`} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                              <td style={{ padding: '10px' }}>{formatISTDate(a.advance_date)}</td>
                                              <td style={{ padding: '10px', fontWeight: 700 }}>{givenByLabel(a)}</td>
                                              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: '#1e40af' }}>{formatCurrency(a.amount)}</td>
                                              <td style={{ padding: '10px', color: '#64748b' }}>{a.notes || '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                  </>
                                )}
                              </div>
                            )}
                        </div>
                      )}
                      </div>
                    </React.Fragment>
                  );
                })
              }
        </div>
      )}

      {/* Give Advance Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Give Advance to Driver"
        >
          <form onSubmit={handleGiveAdvanceSubmit}>
            {formError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '14px',
                }}
              >
                {formError}
              </div>
            )}

            {/* Giver Type Selection */}
            {!isManagerLogin && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Advance Given By:
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setGiverType('MANAGER')}
                  style={{
                    flex: 1,
                    padding: '9px',
                    borderRadius: '6px',
                    border: giverType === 'MANAGER' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: giverType === 'MANAGER' ? '#eff6ff' : '#fff',
                    color: giverType === 'MANAGER' ? '#1e40af' : '#475569',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  🏢 Manager → Driver
                </button>
                <button
                  type="button"
                  onClick={() => setGiverType('OWNER')}
                  style={{
                    flex: 1,
                    padding: '9px',
                    borderRadius: '6px',
                    border: giverType === 'OWNER' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    background: giverType === 'OWNER' ? '#f0fdf4' : '#fff',
                    color: giverType === 'OWNER' ? '#15803d' : '#475569',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  👑 Owner → Driver Directly
                </button>
              </div>
            </div>
            )}

            {/* Driver Selection */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Recipient Driver <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={modalDriverId}
                onChange={(e) => {
                  const dId = e.target.value;
                  setModalDriverId(dId);
                  setModalTripId('');
                  loadDriverTripsForModal(dId);
                }}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                }}
              >
                <option value="">Select Driver</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.mobile_number ? `(${d.mobile_number})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Trip selector — only for Manager advances */}
            {giverType === 'MANAGER' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  🚛 Link to Trip (Optional)
                </label>
                <select
                  value={modalTripId}
                  onChange={(e) => setModalTripId(e.target.value)}
                  disabled={!modalDriverId}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    background: !modalDriverId ? '#f8fafc' : '#fff',
                  }}
                >
                  <option value="">— No Trip · General Advance to Driver —</option>
                  {modalDriverTrips.map((t) => (
                    <option key={t.id} value={t.id}>
                      TRIP-{t.id} · {(t as any).from_location ?? ''} → {(t as any).to_location ?? ''} · {(t as any).trip_date?.slice(0,10) ?? ''} · {t.status}
                    </option>
                  ))}
                </select>
                {modalTripId && (() => {
                  const sel = modalDriverTrips.find(t => String(t.id) === modalTripId);
                  return sel ? (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#1d4ed8', background: '#eff6ff', padding: '5px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid #bfdbfe' }}>
                      📦 Trip #{sel.id} — {(sel as any).lorry_number ?? ''} · {(sel as any).party_name ?? ''}
                    </div>
                  ) : null;
                })()}
                {!modalDriverId ? (
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>Select a driver first to see their active trips</div>
                ) : (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const q = new URLSearchParams();
                        q.set('create', 'true');
                        if (modalDriverId) q.set('driver_id', modalDriverId);
                        if (modalVehicleId) q.set('vehicle_id', modalVehicleId);
                        if (modalAmount) q.set('advance_paid', modalAmount);
                        navigate(`/trips?${q.toString()}`);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#0284c7',
                        background: '#f0f9ff',
                        border: '1px dashed #7dd3fc',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      🚀 Start a New Trip with this Driver & Advance
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Manager or Owner Giver Dropdown */}
            {giverType === 'MANAGER' ? (
              isManagerLogin ? (
              <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>Given by</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e40af' }}>{authUser?.name || 'Manager'}</div>
              </div>
              ) : (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Disbursing Manager <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={modalManagerId}
                  onChange={(e) => setModalManagerId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                >
                  <option value="">Select Manager</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              )
            ) : (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Disbursing Owner <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={modalOwnerId}
                  onChange={(e) => setModalOwnerId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                >
                  <option value="">Select Owner</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} {o.mobile_number ? `(${o.mobile_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Vehicle (Optional) */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Associated Vehicle / Lorry (Optional)
              </label>
              <select
                value={modalVehicleId}
                onChange={(e) => setModalVehicleId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                }}
              >
                <option value="">None / General Advance</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.lorry_number} {v.owner_name ? `(${v.owner_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Advance Amount & Payment Mode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Amount (₹) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Payment Mode
                </label>
                <select
                  value={modalPaymentMode}
                  onChange={(e) => setModalPaymentMode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            {/* Advance Date */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Advance Date
              </label>
              <DateField
                value={modalDate}
                onChange={(e) => setModalDate(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Notes / Remarks (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Advance for upcoming Salem trip diesel & toll"
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                }}
              />
            </div>

            {/* Live Ledger Notice */}
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              ℹ️ <strong>Driver Advance Options:</strong> Advances given <strong>with a trip</strong> are tracked and adjusted against trip settlements. Advances given <strong>without a trip</strong> (food, toll, or personal advance) are immediately credited to the driver's live ledger balance.
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn btn-outline"
                style={{
                  padding: '9px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{
                  padding: '9px 20px',
                  borderRadius: '6px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {isSubmitting ? 'Saving...' : 'Disburse Advance'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default DriverBalanceMasterPage;
