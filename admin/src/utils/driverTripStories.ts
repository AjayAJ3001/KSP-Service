export type AdjustedSource = {
  tripId: number | null;
  label: string;
  amount: number;
  givers: { role: string; name: string; amount: number }[];
};

export type AppliedToOlder = {
  tripId: number | null;
  label: string;
  amount: number;
  remainingOnThatTrip: number;
};

export type CashMovement = {
  totalGiven: number;
  reducedDue: number;
  leftInHand: number;
  sourceLabel: string;
};

export type LaterPay = {
  totalGiven: number;
  thisTripPaid: number;
  leftoverInHand: number;
  sourceLabel: string;
  sourceTripId: number | null;
};

export type DriverTripStory = {
  key: string;
  kind: 'TRIP' | 'DIRECT_ADVANCE';
  tripId: number | null;
  date: string | null;
  lorry: string;
  ownerName: string;
  partyName: string;
  route: string;
  advances: any[];
  expenses: any[];
  settlements: any[];
  totalAdvance: number;
  totalExpenses: number;
  totalSettled: number;
  totalAdjusted: number;
  needToPay: number;
  balanceInHand: number;
  adjustedSources: AdjustedSource[];
  appliedTo: AppliedToOlder[];
  olderDueTripId: number | null;
  cashMovement: CashMovement | null;
  laterPays: LaterPay[];
  broughtForward: number;
  inHandUsed: number;
  inHandUsedFrom: string;
};

const num = (val: any) => parseFloat(String(val || 0)) || 0;

const giversOf = (story: DriverTripStory) =>
  story.advances.map((adv) => ({
    role: adv.given_by_role === 'Owner' ? 'Owner' : 'Manager',
    name: String(adv.given_by_name || (adv.given_by_role === 'Owner' ? 'Owner' : 'Manager')),
    amount: num(adv.amount),
  }));

const sourceLabelOf = (story: DriverTripStory) => {
  const givers = giversOf(story);
  const owner = givers.find((g) => g.role === 'Owner');
  const manager = givers.find((g) => g.role === 'Manager');
  if (story.kind === 'DIRECT_ADVANCE') {
    if (owner) return `Advance from Owner${owner.name ? ` (${owner.name})` : ''}`;
    if (manager) return `Advance from Manager${manager.name ? ` (${manager.name})` : ''}`;
    return 'Advance from office';
  }
  const who = owner && manager ? 'Manager + Owner' : owner ? `Owner${owner.name ? ` (${owner.name})` : ''}` : `Manager${manager?.name ? ` (${manager.name})` : ''}`;
  return `Trip #${story.tripId} advance from ${who}`;
};

const tripLabel = (story: DriverTripStory) => {
  if (story.kind === 'DIRECT_ADVANCE') return sourceLabelOf(story);
  const bits = [`Trip #${story.tripId}`];
  if (story.lorry) bits.push(story.lorry);
  if (story.ownerName) bits.push(story.ownerName);
  return bits.join(' · ');
};

const tripIdOf = (item: any): number | null => {
  if (item?.trip_id) return Number(item.trip_id);
  const match = String(item?.ref_id || item?.subtitle || '').match(/Trip\s*#(\d+)/i);
  return match ? Number(match[1]) : null;
};

const storyTime = (story: DriverTripStory) => {
  const dates = [...story.advances, ...story.expenses, ...story.settlements]
    .map((i) => new Date(i.date || i.created_at || 0).getTime())
    .filter((t) => !isNaN(t));
  return dates.length ? Math.min(...dates) : 0;
};

const emptyStory = (): Pick<
  DriverTripStory,
  'totalAdvance' | 'totalExpenses' | 'totalSettled' | 'totalAdjusted' | 'needToPay' | 'balanceInHand' | 'adjustedSources' | 'appliedTo' | 'olderDueTripId' | 'cashMovement' | 'laterPays' | 'broughtForward' | 'inHandUsed' | 'inHandUsedFrom'
> => ({
  totalAdvance: 0,
  totalExpenses: 0,
  totalSettled: 0,
  totalAdjusted: 0,
  needToPay: 0,
  balanceInHand: 0,
  adjustedSources: [],
  appliedTo: [],
  olderDueTripId: null,
  cashMovement: null,
  laterPays: [],
  broughtForward: 0,
  inHandUsed: 0,
  inHandUsedFrom: '',
});

export const getSettlementBreakdown = (story: DriverTripStory) => {
  const adjusted = Math.round(story.totalAdjusted || 0);
  const paid = Math.round(story.totalSettled || 0);
  const stillToPay = Math.round(story.needToPay || 0);
  const remainingInHand = Math.round(story.balanceInHand || 0);
  const happened =
    story.settlements.length > 0
    || adjusted > 0
    || paid > 0
    || (story.appliedTo || []).length > 0
    || (story.cashMovement?.reducedDue || 0) > 0
    || (story.laterPays || []).length > 0
    || story.inHandUsed > 0
    || story.broughtForward > 0;
  return {
    adjusted,
    paid,
    stillToPay,
    remainingInHand,
    happened,
    sources: story.adjustedSources || [],
    appliedTo: story.appliedTo || [],
    olderDueTripId: story.olderDueTripId,
    cashMovement: (story.cashMovement?.reducedDue || 0) > 0 ? story.cashMovement : null,
    laterPays: story.laterPays || [],
    broughtForward: Math.round(story.broughtForward || 0),
    inHandUsed: Math.round(story.inHandUsed || 0),
    inHandUsedFrom: story.inHandUsedFrom || '',
  };
};

export type BalanceAdvance = { amount: number; isOwner: boolean; name: string; from: string };

export const storyBalanceAdvance = (story: DriverTripStory): BalanceAdvance | null => {
  const amount = Math.round(story.inHandUsed || 0);
  if (amount <= 0) return null;
  const from = story.inHandUsedFrom || '';
  const isOwner = /Owner/i.test(from);
  const named = from.match(/\(([^)]+)\)/);
  return {
    amount,
    isOwner,
    name: named ? named[1] : (isOwner ? 'Owner' : 'Manager'),
    from,
  };
};

export const storyCashSettlements = (story: DriverTripStory) =>
  (story.settlements || [])
    .filter((s) => !s.is_adjusted)
    .map((s) => ({
      amount: Math.round(num(s.amount)),
      by: String(s.given_by_name || s.settled_by_name || s.given_by || 'Admin').replace(/^Accounts\s*\((.+)\)\s*$/i, '$1'),
    }))
    .filter((s) => s.amount > 0);

export const buildDriverTripStories = (timeline: any[] = []): DriverTripStory[] => {
  const trips = new Map<number, DriverTripStory>();
  const directs: DriverTripStory[] = [];

  for (const item of timeline) {
    const tripId = tripIdOf(item);
    const isDirect = item.type === 'ADVANCE' && (item.is_without_trip || !tripId);

    if (isDirect) {
      directs.push({
        key: `direct-${item.id}`,
        kind: 'DIRECT_ADVANCE',
        tripId: null,
        date: item.date || item.created_at || null,
        lorry: item.lorry_number || '',
        ownerName: item.owner_name || '',
        partyName: item.party_name || '',
        route: '',
        advances: [item],
        expenses: [],
        settlements: [],
        ...emptyStory(),
        totalAdvance: num(item.amount),
        balanceInHand: num(item.amount),
      });
      continue;
    }

    if (!tripId) continue;

    if (!trips.has(tripId)) {
      trips.set(tripId, {
        key: `trip-${tripId}`,
        kind: 'TRIP',
        tripId,
        date: item.date || item.created_at || null,
        lorry: item.lorry_number || '',
        ownerName: item.owner_name || '',
        partyName: item.party_name || '',
        route: item.from_location && item.to_location ? `${item.from_location} → ${item.to_location}` : '',
        advances: [],
        expenses: [],
        settlements: [],
        ...emptyStory(),
      });
    }

    const story = trips.get(tripId)!;
    if (item.lorry_number) story.lorry = item.lorry_number;
    if (item.owner_name) story.ownerName = item.owner_name;
    if (item.party_name) story.partyName = item.party_name;
    if (item.from_location && item.to_location) {
      story.route = `${item.from_location} → ${item.to_location}`;
    } else if (!story.route && item.subtitle && String(item.subtitle).includes('→')) {
      story.route = String(item.subtitle);
    }
    if (item.type === 'ADVANCE') story.advances.push(item);
    else if (item.type === 'EXPENSE') story.expenses.push(item);
    else if (item.type === 'SETTLEMENT') story.settlements.push(item);
  }

  const stories = [...trips.values(), ...directs].map((story) => ({
    ...story,
    totalAdvance: story.advances.reduce((s, i) => s + num(i.amount), 0),
    totalExpenses: story.expenses.reduce((s, i) => s + num(i.amount), 0),
    totalSettled: story.settlements
      .filter((i) => !i.is_adjusted)
      .reduce((s, i) => s + num(i.amount), 0),
    totalAdjusted: 0,
    needToPay: 0,
    balanceInHand: 0,
    adjustedSources: [] as AdjustedSource[],
    appliedTo: [] as AppliedToOlder[],
    olderDueTripId: null as number | null,
    cashMovement: null as CashMovement | null,
    laterPays: [] as LaterPay[],
    broughtForward: 0,
    inHandUsed: 0,
    inHandUsedFrom: '',
  }));

  stories.sort((a, b) => {
    const dt = storyTime(a) - storyTime(b);
    if (dt !== 0) return dt;
    return (a.tripId || 0) - (b.tripId || 0);
  });

  type Lot = { remaining: number; label: string; givers: ReturnType<typeof giversOf>; isInHand: boolean };
  type Due = { story: DriverTripStory; remaining: number };
  const lots: Lot[] = [];
  const dues: Due[] = [];

  const poolTotal = () => lots.reduce((s, l) => s + l.remaining, 0);

  const consumeLots = (amount: number, preferInHand: boolean | null) => {
    let need = Math.round(amount);
    let usedInHand = 0;
    const fromLabels = new Set<string>();
    for (const lot of lots) {
      if (need <= 0) break;
      if (lot.remaining <= 0) continue;
      if (preferInHand === true && !lot.isInHand) continue;
      if (preferInHand === false && lot.isInHand) continue;
      const take = Math.min(need, lot.remaining);
      lot.remaining = Math.round(lot.remaining - take);
      need = Math.round(need - take);
      if (lot.isInHand) usedInHand += take;
      fromLabels.add(lot.label);
    }
    if (need > 0 && preferInHand !== null) {
      const extra = consumeLots(need, null);
      usedInHand += extra.usedInHand;
      extra.fromLabels.forEach((l) => fromLabels.add(l));
      need = 0;
    }
    return { usedInHand, fromLabels: [...fromLabels] };
  };

  const applyOldestDuesFromSource = (source: DriverTripStory) => {
    let reducedDue = 0;
    for (const due of dues) {
      const available = poolTotal();
      if (available <= 0) break;
      if (due.remaining <= 0) continue;
      const take = Math.min(available, due.remaining);
      consumeLots(take, false);
      due.remaining = Math.round(due.remaining - take);
      reducedDue += take;
      due.story.totalAdjusted = Math.round((due.story.totalAdjusted || 0) + take);
      due.story.needToPay = due.remaining;
      due.story.adjustedSources.push({
        tripId: source.tripId,
        label: sourceLabelOf(source),
        amount: take,
        givers: giversOf(source),
      });
      source.appliedTo.push({
        tripId: due.story.tripId,
        label: tripLabel(due.story),
        amount: take,
        remainingOnThatTrip: due.remaining,
      });
    }
    return reducedDue;
  };

  for (const story of stories) {
    const broughtForward = poolTotal();
    story.broughtForward = broughtForward;
    lots.forEach((lot) => {
      if (lot.remaining > 0) lot.isInHand = true;
    });

    if (story.totalAdvance > 0) {
      lots.push({
        remaining: Math.round(story.totalAdvance),
        label: sourceLabelOf(story),
        givers: giversOf(story),
        isInHand: false,
      });
    }

    const reducedDue = applyOldestDuesFromSource(story);
    const leftInHand = poolTotal();
    if (story.totalAdvance > 0) {
      story.cashMovement = {
        totalGiven: Math.round(story.totalAdvance),
        reducedDue: Math.round(reducedDue),
        leftInHand: Math.round(leftInHand),
        sourceLabel: sourceLabelOf(story),
      };
    }

    if (story.kind === 'DIRECT_ADVANCE') {
      story.needToPay = 0;
      story.balanceInHand = Math.max(0, leftInHand);
      continue;
    }

    const expenses = Math.round(story.totalExpenses);
    const covered = Math.min(poolTotal(), expenses);
    const used = consumeLots(covered, true);
    story.inHandUsed = Math.round(used.usedInHand);
    story.inHandUsedFrom = used.fromLabels.join(', ');
    let due = Math.round(expenses - covered);

    const cashPaid = Math.round(story.totalSettled);
    due = Math.round(due - Math.min(cashPaid, due));

    story.needToPay = due;
    story.balanceInHand = due > 0 ? 0 : Math.max(0, poolTotal());
    story.olderDueTripId = dues.find((d) => d.remaining > 0)?.story.tripId || null;

    if (due > 0) {
      dues.push({ story, remaining: due });
    }
  }

  for (const source of stories) {
    for (const applied of source.appliedTo || []) {
      if (!applied?.tripId) continue;
      const target = stories.find((s) => s.kind === 'TRIP' && s.tripId === applied.tripId);
      if (!target) continue;
      const thisTripPaid = Math.round(applied.amount);
      const totalGiven = Math.round(source.totalAdvance);
      target.laterPays.push({
        totalGiven,
        thisTripPaid,
        leftoverInHand: Math.max(0, totalGiven - thisTripPaid),
        sourceLabel: sourceLabelOf(source),
        sourceTripId: source.tripId,
      });
    }
  }

  const tripStories = stories.filter((s) => s.kind === 'TRIP');
  for (let i = 0; i < tripStories.length; i++) {
    const cur = tripStories[i];
    const next = tripStories[i + 1];
    const already = (cur.laterPays || []).reduce((s, p) => s + Math.round(p.thisTripPaid || 0), 0);
    let nextAmt = 0;
    let nextGiven = 0;
    if (next) {
      nextGiven = Math.round(next.totalAdvance || 0);
      nextAmt = Math.max(
        Math.round(next.cashMovement?.reducedDue || 0),
        (next.appliedTo || []).reduce((s, r) => s + Math.round(r.amount || 0), 0),
        ...((next.expenses || []).map((e: any) => Math.round(num(e.prior_deficit_deduction))) || [0])
      );
    }
    for (const sp of cur.settlements || []) {
      if (!sp.is_adjusted) continue;
      const amt = Math.round(num(sp.adjusted_amount || sp.amount));
      if (amt > nextAmt) nextAmt = amt;
      if (!next && sp.source_trip_id) {
        cur.laterPays.push({
          totalGiven: amt,
          thisTripPaid: amt,
          leftoverInHand: 0,
          sourceLabel: `Trip #${sp.source_trip_id}`,
          sourceTripId: Number(sp.source_trip_id),
        });
      }
    }
    if (next && nextAmt > already + 0.5) {
      const paid = Math.round(nextAmt - already);
      cur.laterPays.push({
        totalGiven: Math.max(nextGiven, paid),
        thisTripPaid: paid,
        leftoverInHand: Math.max(0, nextGiven - paid),
        sourceLabel: sourceLabelOf(next),
        sourceTripId: next.tripId,
      });
    }
  }

  for (const story of tripStories) {
    const uniq = new Map<string, LaterPay>();
    for (const pay of story.laterPays || []) {
      const key = String(pay.sourceTripId || pay.sourceLabel || 'next');
      const prev = uniq.get(key);
      if (!prev) {
        uniq.set(key, { ...pay, leftoverInHand: Math.max(0, Math.round(pay.leftoverInHand || pay.totalGiven - pay.thisTripPaid || 0)) });
        continue;
      }
      const thisTripPaid = Math.max(prev.thisTripPaid, pay.thisTripPaid);
      const totalGiven = Math.max(prev.totalGiven, pay.totalGiven);
      uniq.set(key, {
        ...prev,
        thisTripPaid,
        totalGiven,
        leftoverInHand: Math.max(prev.leftoverInHand || 0, pay.leftoverInHand || 0, totalGiven - thisTripPaid, 0),
        sourceTripId: prev.sourceTripId || pay.sourceTripId,
      });
    }
    story.laterPays = Array.from(uniq.values());
  }

  return tripStories;
};
