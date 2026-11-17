import { formatDateDMY } from './dateUtils';
import { tripStartedByLabel } from './tripStartedBy';
import { buildDriverTripStories, getSettlementBreakdown, storyBalanceAdvance, storyCashSettlements } from './driverTripStories';
import { PRINT_BRAND_CSS, printBrandLockup } from './printBrand';
import { normalizeExpenseItems, settlementExpenseBreakdown } from './expenseBreakdown';
import {
  SETTLEMENT_ACCOUNT_CSS,
  settlementAccountStatementHtml,
  settlementExpenseTableHtml,
} from './settlementAccountHtml';

export interface DriverStatementPdfData {
  driver: {
    id: number;
    name: string;
    mobile_number?: string;
    license_number?: string;
    status?: string;
  };
  summary: {
    total_advance_given: number;
    total_expenses: number;
    total_settled_cash_paid: number;
    balance_in_manager_hand: number;
    is_deficit: boolean;
    is_surplus: boolean;
    is_settled: boolean;
    deficit_amount: number;
    surplus_amount: number;
    manager_advance_total?: number;
    owner_advance_total?: number;
    trip_advance_total?: number;
    without_trip_advance_total?: number;
  };
  timeline: Array<{
    id: string;
    type: 'ADVANCE' | 'EXPENSE' | 'SETTLEMENT';
    date: string;
    title: string;
    subtitle?: string;
    amount: number;
    effect: '+' | '-';
    notes?: string;
    ref_id?: string;
    lorry_number?: string;
    settlement_status?: string;
    given_by?: string;
    given_by_role?: string;
    given_by_name?: string;
    balance_due?: number;
  }>;
  dateRangeText?: string;
  advances?: any[];
  trips_and_expenses?: any[];
  settlement_payments?: any[];
}

const pdfSafeText = (val: any) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[₹]/g, 'Rs. ')
    .replace(/[→]/g, '-&gt;')
    .replace(/[←]/g, '&lt;-')
    .replace(/[−–—]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');

export const generateDriverStatementHtml = (data: DriverStatementPdfData, options?: { tripId?: number }): string => {
  const esc = pdfSafeText;

  const formatCurrency = (val: number | string) => {
    const num = Math.round(parseFloat(String(val)) || 0);
    const digits = Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `Rs. ${num < 0 ? '-' : ''}${digits}`;
  };

  const printDate = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const allStories = buildDriverTripStories(timeline);
  allStories.forEach((story) => {
    const dueFromExp = story.expenses
      .map((e: any) => parseFloat(String(e.balance_due)))
      .find((n: number) => Number.isFinite(n) && n >= 0);
    if (dueFromExp != null) {
      story.needToPay = Math.round(dueFromExp);
      if (dueFromExp > 0.5) story.balanceInHand = 0;
    }
  });
  const tripRows = [...(data.trips_and_expenses || [])].sort((a: any, b: any) => {
    const dt = new Date(a.trip_date || a.date || 0).getTime() - new Date(b.trip_date || b.date || 0).getTime();
    return dt || Number(a.trip_id || 0) - Number(b.trip_id || 0);
  });
  allStories.forEach((story) => {
    const already = (story.laterPays || []).reduce((s, p) => s + Math.round(p.thisTripPaid || 0), 0);
    const idx = tripRows.findIndex((t: any) => Number(t.trip_id) === Number(story.tripId));
    const nextRow = idx >= 0 ? tripRows[idx + 1] : null;
    const nextDed = Math.round(parseFloat(String(nextRow?.prior_deficit_deduction || 0)) || 0);
    if (nextRow && nextDed > already + 0.5) {
      const nextGiven = Math.round(parseFloat(String(nextRow.advance_paid || 0)) || 0);
      story.laterPays.push({
        totalGiven: Math.max(nextDed, nextGiven),
        thisTripPaid: nextDed,
        leftoverInHand: Math.max(0, nextGiven - nextDed),
        sourceLabel: `Trip #${nextRow.trip_id}`,
        sourceTripId: Number(nextRow.trip_id),
      });
    }
  });
  const tripExpenseItemsById = new Map<number, any[]>(
    (data.trips_and_expenses || []).map((t: any) => [Number(t.trip_id || t.id), normalizeExpenseItems(t.expense_items)])
  );
  const tripStories = options?.tripId
    ? allStories.filter((s) => Number(s.tripId) === Number(options.tripId))
    : allStories;
  const withoutTripTotal = Math.round(parseFloat(String(data.summary.without_trip_advance_total || 0)) || 0)
    || tripStories.filter((s) => s.kind === 'DIRECT_ADVANCE').reduce((s, x) => s + Math.round(x.totalAdvance || 0), 0);
  const focus = options?.tripId ? tripStories[0] : null;

  let isDeficit = data.summary.is_deficit;
  let isSurplus = data.summary.is_surplus;
  let managerAdvanceTotal = data.summary.manager_advance_total ?? timeline
    .filter((i) => i.type === 'ADVANCE' && i.given_by_role !== 'Owner')
    .reduce((s, i) => s + (parseFloat(String(i.amount)) || 0), 0);
  let ownerAdvanceTotal = data.summary.owner_advance_total ?? timeline
    .filter((i) => i.type === 'ADVANCE' && i.given_by_role === 'Owner')
    .reduce((s, i) => s + (parseFloat(String(i.amount)) || 0), 0);
  let needToPay = Math.round(parseFloat(String(data.summary.deficit_amount || 0)) || 0);
  let balanceInHand = Math.round(parseFloat(String(data.summary.surplus_amount || 0)) || 0);
  if (balanceInHand > 0.5) needToPay = 0;
  else balanceInHand = 0;
  let totalAdvanceGiven = data.summary.total_advance_given;
  let totalExpenses = data.summary.total_expenses;
  let bannerLabel = isDeficit
    ? 'DEFICIT - BALANCE NEED TO PAY TO DRIVER'
    : isSurplus
      ? 'SURPLUS - BALANCE IN DRIVER HAND'
      : 'ALL BALANCES FULLY SETTLED';
  let bannerDetail = isDeficit
    ? `Trip expenses exceeded advance. Manager/office must pay ${formatCurrency(data.summary.deficit_amount)} to driver.`
    : isSurplus
      ? `Remaining advance of ${formatCurrency(data.summary.surplus_amount)} held in driver hand.`
      : 'Advance received and trip expenses are completely balanced.';
  let bannerAmt = isDeficit ? formatCurrency(data.summary.deficit_amount) : isSurplus ? formatCurrency(data.summary.surplus_amount) : 'Rs. 0';
  let docTitle = 'DRIVER STATEMENT';
  let periodText = data.dateRangeText || 'All Transactions';

  const leftoverAfterTrip = (story: typeof allStories[number]) => {
    const fromPays = (story.laterPays || []).reduce((s, p) => (
      s + Math.round(p.leftoverInHand || Math.max(0, (p.totalGiven || 0) - (p.thisTripPaid || 0)))
    ), 0);
    const fromSources = allStories
      .filter((src) => (src.appliedTo || []).some((a) => Number(a.tripId) === Number(story.tripId)))
      .reduce((s, src) => s + Math.round(src.cashMovement?.leftInHand || 0), 0);
    const idx = tripRows.findIndex((t: any) => Number(t.trip_id) === Number(story.tripId));
    const nextRow = idx >= 0 ? tripRows[idx + 1] : null;
    const nextDeduct = nextRow ? Math.round(parseFloat(String(nextRow.prior_deficit_deduction || 0)) || 0) : 0;
    const fromNextRow = nextRow && nextDeduct > 0.5
      ? Math.max(0, Math.round(parseFloat(String(nextRow.advance_paid || 0)) || 0) - nextDeduct)
      : 0;
    return Math.max(0, fromPays, fromSources, fromNextRow);
  };

  const extraAdvances: any[] = [];
  if (focus) {
    const balAdv = storyBalanceAdvance(focus);
    if (balAdv) {
      extraAdvances.push({
        type: 'ADVANCE',
        given_by_role: balAdv.isOwner ? 'Owner' : 'Manager',
        given_by_name: balAdv.name,
        amount: balAdv.amount,
      });
    }
  }
  const advanceItems = focus ? [...focus.advances, ...extraAdvances] : timeline;
  if (focus) {
    const br = getSettlementBreakdown(focus);
    const balAdv = storyBalanceAdvance(focus);
    totalExpenses = focus.totalExpenses;
    needToPay = Math.round(focus.needToPay || 0);
    balanceInHand = needToPay > 0.5 ? 0 : Math.max(0, Math.round(focus.balanceInHand || 0), leftoverAfterTrip(focus));
    const leftoverHdr = leftoverAfterTrip(focus);
    const laterFullHdr = (br.laterPays || []).reduce((s, p) => {
      const used = Math.round(p.thisTripPaid || 0);
      const left = Math.max(0, Math.round(p.leftoverInHand || 0), leftoverHdr);
      return s + Math.max(Math.round(p.totalGiven || 0), used + left);
    }, 0);
    totalAdvanceGiven = Math.max(0, Math.round(focus.totalAdvance || 0) + laterFullHdr);
    isDeficit = needToPay > 0.5;
    isSurplus = !isDeficit && balanceInHand > 0.5;
    managerAdvanceTotal = advanceItems.filter((i: any) => i.given_by_role !== 'Owner').reduce((s: number, i: any) => s + (parseFloat(String(i.amount)) || 0), 0);
    ownerAdvanceTotal = advanceItems.filter((i: any) => i.given_by_role === 'Owner').reduce((s: number, i: any) => s + (parseFloat(String(i.amount)) || 0), 0);
    if (laterFullHdr < 0.5 && totalAdvanceGiven > managerAdvanceTotal + ownerAdvanceTotal) {
      managerAdvanceTotal = Math.max(0, totalAdvanceGiven - ownerAdvanceTotal);
    }
    docTitle = `TRIP #${focus.tripId} DRIVER BALANCE`;
    periodText = focus.date ? formatDateDMY(focus.date) : 'This trip';
    if (isDeficit) {
      bannerLabel = 'NEED TO PAY TO DRIVER';
      bannerDetail = `In Hand ${formatCurrency(0)}. Office must pay ${formatCurrency(needToPay)} to driver.`;
      bannerAmt = formatCurrency(needToPay);
    } else if (isSurplus) {
      bannerLabel = 'BALANCE IN HAND';
      bannerDetail = `Driver holds ${formatCurrency(balanceInHand)} in hand. Need to Pay ${formatCurrency(0)}.`;
      bannerAmt = formatCurrency(balanceInHand);
    } else {
      bannerLabel = 'THIS TRIP SETTLED';
      bannerDetail = `In Hand ${formatCurrency(balanceInHand)}. Need to Pay ${formatCurrency(0)}.`;
      bannerAmt = formatCurrency(balanceInHand);
    }
  }

  const groupAdvances = (isOwner: boolean) => {
    const groups = new Map<string, number>();
    for (const item of advanceItems) {
      if (item.type && item.type !== 'ADVANCE') continue;
      if ((item.given_by_role === 'Owner') !== isOwner) continue;
      const name = (item.given_by_name || (isOwner ? 'Owner' : 'Manager')).trim();
      groups.set(name, (groups.get(name) || 0) + (parseFloat(String(item.amount)) || 0));
    }
    return Array.from(groups.entries());
  };
  const isOwnerPay = (pay: { sourceLabel?: string }) => /Owner/i.test(String(pay.sourceLabel || ''));
  const payFullGiven = (pay: { totalGiven?: number; thisTripPaid?: number; leftoverInHand?: number }, leftoverHint = 0) => {
    const used = Math.round(pay.thisTripPaid || 0);
    const left = Math.max(0, Math.round(pay.leftoverInHand || 0), leftoverHint);
    return Math.max(Math.round(pay.totalGiven || 0), used + left);
  };
  const headerLaterPays = focus
    ? (getSettlementBreakdown(focus).laterPays || []).filter((pay, idx, arr) =>
        arr.findIndex((p) => String(p.sourceTripId || p.sourceLabel) === String(pay.sourceTripId || pay.sourceLabel)) === idx
      )
    : [];
  const headerLeftover = focus ? leftoverAfterTrip(focus) : 0;
  const laterOwnerHtml = headerLaterPays.filter(isOwnerPay).map((pay) => {
    const full = payFullGiven(pay, headerLeftover);
    const used = Math.round(pay.thisTripPaid || 0);
    const name = String(pay.sourceLabel || 'Owner').replace(/^Advance from\s+/i, '');
    return `<div style="font-size:11px;font-weight:700;color:#5b21b6;padding:2px 0;">${esc(name)} given - ${formatCurrency(full)}</div>
            <div style="font-size:11px;font-weight:700;color:#c2410c;padding:2px 0;">Less: reduced to this trip - (-) ${formatCurrency(used)}</div>`;
  }).join('');
  const laterMgrHtml = headerLaterPays.filter((p) => !isOwnerPay(p)).map((pay) => {
    const from = pay.sourceTripId ? `Trip #${pay.sourceTripId}` : (pay.sourceLabel || 'next trip');
    const full = payFullGiven(pay, headerLeftover);
    const used = Math.round(pay.thisTripPaid || 0);
    return `<div style="font-size:11px;font-weight:700;color:#166534;padding:2px 0;">${esc(from)} given - ${formatCurrency(full)}</div>
            <div style="font-size:11px;font-weight:700;color:#c2410c;padding:2px 0;">Less: reduced to this trip - (-) ${formatCurrency(used)}</div>`;
  }).join('');
  if (focus) {
    const ownerFromLater = headerLaterPays.filter(isOwnerPay).reduce((s, p) => s + payFullGiven(p, headerLeftover), 0);
    if (ownerFromLater > ownerAdvanceTotal) ownerAdvanceTotal = ownerFromLater;
    const givenSum = managerAdvanceTotal + ownerAdvanceTotal;
    if (givenSum > totalAdvanceGiven) totalAdvanceGiven = givenSum;
  }
  const managerBreakdownHtml = (
    groupAdvances(false).map(([name, amt]) =>
      `<div style="font-size:11px;font-weight:700;color:#1e3a8a;padding:2px 0;">${esc(name)} - ${formatCurrency(amt)}</div>`
    ).join('') + laterMgrHtml
  ) || `<div style="font-size:11px;color:#64748b;">No manager advances</div>`;
  const ownerBreakdownHtml = (
    groupAdvances(true).map(([name, amt]) =>
      `<div style="font-size:11px;font-weight:700;color:#5b21b6;padding:2px 0;">${esc(name)} - ${formatCurrency(amt)}</div>`
    ).join('') + laterOwnerHtml
  ) || `<div style="font-size:11px;color:#64748b;">No owner advances</div>`;
  let tripNo = 0;
  const storiesHtml = tripStories.length > 0
    ? tripStories.map((story) => {
        const br = getSettlementBreakdown(story);
        const laterPays = (br.laterPays || []).filter((pay, idx, arr) =>
          arr.findIndex((p) => String(p.sourceTripId || p.sourceLabel) === String(pay.sourceTripId || pay.sourceLabel)) === idx
        );
        const laterCovered = laterPays.reduce((s, p) => s + Math.round(p.thisTripPaid || 0), 0);
        const priorFromExp = story.expenses
          .map((e: any) => Math.round(parseFloat(String(e.prior_deficit_deduction || 0)) || 0))
          .find((n: number) => n > 0) || 0;
        const priorFromApplied = (br.appliedTo || []).reduce((s, r) => s + Math.round(r.amount || 0), 0);
        const reducedPrior = Math.max(
          Math.round(br.cashMovement?.reducedDue || 0),
          priorFromApplied,
          priorFromExp
        );
        tripNo += 1;
        const title = story.kind === 'DIRECT_ADVANCE'
          ? `Without trip · Direct advance${story.date ? ' - ' + formatDateDMY(story.date) : ''}`
          : `Trip ${tripNo}${story.tripId ? ' #' + story.tripId : ''}${story.date ? ' - ' + formatDateDMY(story.date) : ''}`;
        const infoRows = [
          ['Party', story.partyName],
          ['Trip Started By', tripStartedByLabel(story.startedByName, story.startedByRole)],
          ['Truck No', story.lorry],
          ['Owner', story.ownerName],
          ['Route', story.route ? String(story.route).replace(/→/g, 'to') : ''],
        ].filter(([, val]) => !!val)
          .map(([label, val]) => `<tr><td style="padding:2px 8px;width:90px;font-size:10px;font-weight:800;color:#64748b;">${esc(label)}</td><td style="padding:2px 8px;font-size:11px;font-weight:700;color:#0f172a;">${esc(val)}</td></tr>`)
          .join('');
        const cashSettles = storyCashSettlements(story);
        if (!cashSettles.length && br.paid > 0) cashSettles.push({ amount: br.paid, by: 'Admin' });
        const cashPaid = cashSettles.reduce((s, p) => s + Math.round(p.amount || 0), 0);
        const mgrAdv = story.advances.filter((a: any) => String(a.given_by_role || '') !== 'Owner');
        const ownAdv = story.advances.filter((a: any) => String(a.given_by_role || '') === 'Owner');
        const tripAdvance = story.kind === 'DIRECT_ADVANCE' ? 0 : mgrAdv.reduce((s: number, a: any) => s + Math.round(parseFloat(String(a.amount)) || 0), 0);
        const ownerOnStory = ownAdv.reduce((s: number, a: any) => s + Math.round(parseFloat(String(a.amount)) || 0), 0);
        const ownerAdvance = story.kind === 'DIRECT_ADVANCE'
          ? (String(story.advances[0]?.given_by_role || '') === 'Owner' ? Math.round(story.totalAdvance || 0) : 0)
          : Math.max(ownerOnStory, allStories.filter((s) => s.kind === 'DIRECT_ADVANCE' && s.advances.some((a: any) => String(a.given_by_role || '') === 'Owner')).reduce((s, x) => s + Math.round(x.totalAdvance || 0), 0));
        const tripRow = story.kind === 'DIRECT_ADVANCE'
          ? null
          : (data.trips_and_expenses || []).find((t: any) => Number(t.trip_id || t.id) === Number(story.tripId));
        const withTrip = story.kind === 'DIRECT_ADVANCE'
          ? 0
          : (tripRow && tripRow.manager_advance != null
            ? Math.round(parseFloat(String(tripRow.manager_advance)) || 0)
            : tripAdvance);
        const withoutTrip = story.kind === 'DIRECT_ADVANCE'
          ? Math.round(story.totalAdvance || 0)
          : (tripRow && tripRow.without_trip_advance != null
            ? Math.max(0, Math.round(parseFloat(String(tripRow.without_trip_advance)) || 0), Math.round(parseFloat(String(tripRow.owner_given || 0)) || 0))
            : Math.max(withoutTripTotal, ownerAdvance));
        const mgrName = mgrAdv.map((a: any) => a.given_by_name).filter(Boolean)[0] || '';
        const ownName = ownAdv.map((a: any) => a.given_by_name).filter(Boolean)[0]
          || allStories.flatMap((s) => s.advances).find((a: any) => String(a.given_by_role || '') === 'Owner')?.given_by_name
          || '';
        const fromTrip = story.tripId ? (tripExpenseItemsById.get(Number(story.tripId)) || []) : [];
        const fromStory = (story.expenses || []).flatMap((e: any) => normalizeExpenseItems(e.expense_items));
        const exp = settlementExpenseBreakdown({
          expense_items: fromTrip.length ? fromTrip : fromStory,
          total_expenses: story.totalExpenses,
          loading_expense: tripRow?.loading_expense,
          unloading_expense: tripRow?.unloading_expense,
          bata_expense: tripRow?.bata_expense,
          cleaning_expense: tripRow?.cleaning_expense,
          other_expense: tripRow?.other_expense,
        });
        const leftoverRaw = Math.round(story.inHandUsed || 0);
        const leftoverUsed = leftoverRaw > 0 && (leftoverRaw === ownerAdvance || leftoverRaw === withoutTrip) ? 0 : leftoverRaw;
        const expensesAmt = story.kind === 'DIRECT_ADVANCE' ? 0 : Math.round(exp.total || story.totalExpenses || 0);
        const pool = withTrip + withoutTrip + leftoverUsed;
        const stmtNeed = tripRow && tripRow.need_to_pay != null
          ? Math.round(parseFloat(String(tripRow.need_to_pay)) || 0)
          : Math.max(0, expensesAmt - pool - cashPaid);
        const stmtInHand = stmtNeed > 0.5
          ? 0
          : (tripRow && tripRow.in_hand != null
            ? Math.round(parseFloat(String(tripRow.in_hand)) || 0)
            : Math.max(0, pool - expensesAmt));
        const ownerUsed = Math.min(withoutTrip, Math.max(0, expensesAmt - withTrip));
        const ownerApplied = leftoverUsed > 0 ? 0 : Math.max(Math.round(br.adjusted || 0), ownerUsed);
        const laterPaidAmt = Math.round(laterCovered || 0);
        const laterIsDuplicate = laterPaidAmt > 0 && (
          Math.abs(laterPaidAmt - ownerApplied) < 1
          || Math.abs(laterPaidAmt - leftoverUsed) < 1
          || Math.abs(laterPaidAmt - ownerUsed) < 1
        );
        return `<div style="border:1px solid #cbd5e1;margin:10px 0;padding:10px 10px 4px;border-radius:4px;">
          <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:8px;">${esc(title)}</div>
          ${infoRows ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px;">${infoRows}</table>` : ''}
          ${settlementExpenseTableHtml(story.kind === 'DIRECT_ADVANCE' ? [] : exp.rows, story.kind === 'DIRECT_ADVANCE' ? 0 : exp.total, formatCurrency)}
          ${settlementAccountStatementHtml({
            expenses: expensesAmt,
            withTrip,
            tripAdvance,
            ownerAdvance,
            advanceGivenBy: mgrName,
            ownerName: ownName,
            withoutTrip,
            priorDeficit: reducedPrior,
            effectiveAdvance: Math.max(0, withTrip - reducedPrior),
            ownerApplied: ownerApplied > leftoverUsed ? ownerApplied : 0,
            leftoverUsed,
            laterAdvanceAdjusted: laterPaidAmt > 0 && !laterIsDuplicate,
            laterPaid: laterPaidAmt,
            paidAmount: cashPaid,
            isCashDisbursement: cashPaid > 0,
            mode: cashSettles[0]?.by || 'CASH',
            settledBy: cashSettles[0]?.by || '',
            needToPay: stmtNeed,
            inHand: stmtInHand,
          }, formatCurrency)}
        </div>`;
      }).join('')
    : `<div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;">No transactions recorded for this driver.</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Driver Statement - ${esc(data.driver.name)}</title>
  <style>
    ${PRINT_BRAND_CSS}
    ${SETTLEMENT_ACCOUNT_CSS}
    @page { size: A4 portrait; margin: 10mm 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #ffffff; padding: 12px; }
    td { vertical-align: top; }
    .print-bar { display:flex; justify-content:flex-end; gap:8px; margin-bottom:12px; }
    .pbtn { background:#2563eb; color:#fff; border:none; padding:7px 14px; border-radius:6px; font-weight:700; cursor:pointer; }
    @media print { .print-bar { display:none !important; } }
  </style>
</head>
<body>
        <div class="print-bar">
          <button class="pbtn" onclick="window.print()">Print / Save PDF</button>
          <button class="pbtn" style="background:#64748b" onclick="window.close()">Close</button>
        </div>
        <div id="driver-statement">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px;">
          <tr>
            <td>
              ${printBrandLockup()}
              <div style="font-size:10px;color:#475569;text-transform:uppercase;">Fleet Logistics and Transport Management</div>
            </td>
            <td style="text-align:right;">
              <div style="background:#0f172a;color:#ffffff;padding:4px 10px;font-size:11px;font-weight:800;">${esc(docTitle)}</div>
              <div style="font-size:10px;color:#64748b;margin-top:4px;">Generated: ${esc(printDate)}</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f8fafc;border:1px solid #cbd5e1;margin-bottom:14px;">
          <tr>
            <td style="padding:6px 8px;width:18%;color:#64748b;font-weight:700;font-size:11px;">DRIVER NAME:</td>
            <td style="padding:6px 8px;width:32%;font-size:14px;font-weight:800;">${esc(data.driver.name)}</td>
            <td style="padding:6px 8px;width:18%;color:#64748b;font-weight:700;font-size:11px;">MOBILE:</td>
            <td style="padding:6px 8px;width:32%;font-weight:700;font-size:11px;">${esc(data.driver.mobile_number || '-')}</td>
          </tr>
          <tr>
            <td style="padding:6px 8px;color:#64748b;font-weight:700;font-size:11px;">DRIVER ID:</td>
            <td style="padding:6px 8px;font-weight:700;font-size:11px;">#${data.driver.id}</td>
            <td style="padding:6px 8px;color:#64748b;font-weight:700;font-size:11px;">PERIOD:</td>
            <td style="padding:6px 8px;font-size:11px;">${esc(periodText)}</td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px;background:${isDeficit ? '#fef2f2' : isSurplus ? '#f0fdf4' : '#f8fafc'};border:2px solid ${isDeficit ? '#f87171' : isSurplus ? '#4ade80' : '#94a3b8'};">
          <tr>
            <td style="padding:12px 16px;">
              <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:${isDeficit ? '#991b1b' : isSurplus ? '#166534' : '#334155'};">
                ${esc(bannerLabel)}
              </div>
              <div style="font-size:10px;margin-top:2px;color:${isDeficit ? '#991b1b' : isSurplus ? '#166534' : '#334155'};">
                ${esc(bannerDetail)}
              </div>
            </td>
            <td style="padding:12px 16px;font-size:22px;font-weight:800;text-align:right;color:${isDeficit ? '#991b1b' : isSurplus ? '#166534' : '#334155'};">
              ${bannerAmt}
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px;">
          <tr>
            <td style="border:1px solid #cbd5e1;padding:8px 10px;background:#f8fafc;text-align:center;width:20%;">
              <div style="font-size:9px;font-weight:800;color:#1d4ed8;text-transform:uppercase;">Advance given with trip</div>
              <div style="font-size:15px;font-weight:800;color:#1d4ed8;">${formatCurrency(Math.max(0, totalAdvanceGiven - withoutTripTotal))}</div>
            </td>
            <td style="border:1px solid #fed7aa;padding:8px 10px;background:#fff7ed;text-align:center;width:20%;">
              <div style="font-size:9px;font-weight:800;color:#c2410c;text-transform:uppercase;">Advance given without trip</div>
              <div style="font-size:15px;font-weight:800;color:#c2410c;">${formatCurrency(withoutTripTotal)}</div>
            </td>
            <td style="border:1px solid #bbf7d0;padding:8px 10px;background:#f0fdf4;text-align:center;width:20%;">
              <div style="font-size:9px;font-weight:800;color:#16a34a;text-transform:uppercase;">Balance in Hand</div>
              <div style="font-size:15px;font-weight:800;color:#16a34a;">${formatCurrency(balanceInHand)}</div>
            </td>
            <td style="border:1px solid #cbd5e1;padding:8px 10px;background:#f8fafc;text-align:center;width:20%;">
              <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;">Trip Expenses</div>
              <div style="font-size:15px;font-weight:800;color:#c2410c;">${formatCurrency(totalExpenses)}</div>
            </td>
            <td style="border:1px solid #fecaca;padding:8px 10px;background:#fef2f2;text-align:center;width:20%;">
              <div style="font-size:9px;font-weight:800;color:#dc2626;text-transform:uppercase;">Need to Pay</div>
              <div style="font-size:15px;font-weight:800;color:#dc2626;">${formatCurrency(needToPay)}</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px;">
          <tr>
            <td style="border:1px solid #bfdbfe;padding:8px 10px;background:#eff6ff;width:50%;">
              <div style="font-size:9px;font-weight:800;color:#1d4ed8;text-transform:uppercase;">From Manager - ${formatCurrency(managerAdvanceTotal)}</div>
              ${managerBreakdownHtml}
            </td>
            <td style="border:1px solid #ddd6fe;padding:8px 10px;background:#f5f3ff;width:50%;">
              <div style="font-size:9px;font-weight:800;color:#6d28d9;text-transform:uppercase;">From Owner - ${formatCurrency(ownerAdvanceTotal)}</div>
              ${ownerBreakdownHtml}
            </td>
          </tr>
        </table>

        <div style="font-size:11px;font-weight:800;color:#0f172a;margin:10px 0;text-transform:uppercase;">
          Trip Story History (${tripStories.length})
        </div>
        ${storiesHtml}

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:24px;">
          <tr>
            <td style="text-align:center;width:50%;padding-top:16px;">
              <div style="border-top:1px solid #0f172a;margin:0 24px 4px;"></div>
              <div style="font-size:10px;font-weight:700;color:#334155;text-transform:uppercase;">Driver Signature (${esc(data.driver.name)})</div>
            </td>
            <td style="text-align:center;width:50%;padding-top:16px;">
              <div style="border-top:1px solid #0f172a;margin:0 24px 4px;"></div>
              <div style="font-size:10px;font-weight:700;color:#334155;text-transform:uppercase;">Authorized Signatory (KSP Service)</div>
            </td>
          </tr>
        </table>

        <div style="text-align:center;margin-top:20px;font-size:9px;color:#94a3b8;">
          This is a computer-generated document from KSP Fleet Management System | Statement #${data.driver.id}-${Date.now()}
        </div>
        </div>
</body>
</html>`;
};

export const openStatementWindow = (html: string, autoPrint = true) => {
  const win = window.open('', '_blank', 'width=950,height=900');
  if (!win) {
    alert('Please allow popups to print/download the PDF.');
    return null;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  if (autoPrint) setTimeout(() => win.print(), 400);
  return win;
};


