import { query } from '../config/database';

export type SuggestedExpense = {
  expense_type: 'LOADING' | 'UNLOADING' | 'DRIVER_BATA' | 'CLEANING_CHARGE';
  description: string;
  amount: number;
  applies: boolean;
};

export type TripExpenseDefaults = {
  trip_id: number;
  trip_status: string;
  party_id: number;
  party_name: string;
  lorry_number: string | null;
  to_location: string | null;
  unit_name: string | null;
  goods_weight: number;
  total_freight: number;
  advance_paid: number;
  driver_carry_forward: number;
  other_limit: number;
  unloading_applies: boolean;
  unloading_unit_name: string | null;
  unloading_unit_number: number | null;
  unloading_rate_per_ton: number;
  unloading_amount: number;
  loading_amount: number;
  cleaning_amount: number;
  cleaning_description: string;
  bata_percentage: number;
  bata_multiplier: number;
  bata_amount: number;
  suggested: SuggestedExpense[];
};

const money = (value: any, fallback = 0) => {
  const n = parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

const pickCleaningRate = (
  rates: {
    unit_name?: string;
    cleaning_charge: number;
    party_id?: number | null;
    vehicle_id?: number | null;
  }[],
  opts: { toLocation?: string | null; unitName?: string | null; partyId?: number; vehicleId?: number }
) => {
  let best: (typeof rates)[0] | undefined;
  let bestScore = -1;
  const loc = String(opts.toLocation || '').toUpperCase();
  const unit = String(opts.unitName || '').toUpperCase();
  const needles = [loc, unit].filter(Boolean);

  for (const cr of rates) {
    if (!cr.unit_name) continue;
    const un = cr.unit_name.toUpperCase();
    const locHit = needles.some(
      (n) =>
        n.includes(un) ||
        un.includes(n) ||
        un.split(/[\s\-–]+/).some((word) => word.length > 1 && n.includes(word))
    );
    if (!locHit) continue;
    if (cr.vehicle_id && Number(cr.vehicle_id) !== Number(opts.vehicleId || 0)) continue;
    if (cr.party_id && Number(cr.party_id) !== Number(opts.partyId || 0)) continue;
    let score = 1;
    if (cr.party_id) score += 2;
    if (cr.vehicle_id) score += 4;
    if (score > bestScore) {
      bestScore = score;
      best = cr;
    }
  }
  return best;
};

const pickUnloadingRate = (
  rates: {
    id: number;
    unit_name: string;
    unit_number: number | null;
    route_id: number | null;
    rate_per_ton: number;
    to_location?: string | null;
  }[],
  opts: { routeId: number; toLocation?: string | null; unitName?: string | null }
) => {
  const byRoute = rates.find((r) => r.route_id && Number(r.route_id) === Number(opts.routeId));
  if (byRoute) return byRoute;

  const loc = String(opts.toLocation || '').toUpperCase();
  const unit = String(opts.unitName || '').toUpperCase();
  const needles = [loc, unit].filter(Boolean);
  return rates.find((r) => {
    const un = String(r.unit_name || '').toUpperCase();
    const dest = String(r.to_location || '').toUpperCase();
    return needles.some(
      (n) =>
        (un && (n.includes(un) || un.includes(n))) ||
        (dest && (n.includes(dest) || dest.includes(n)))
    );
  });
};

export async function buildTripExpenseDefaults(tripId: number): Promise<TripExpenseDefaults> {
  const tripRes = await query(
    `SELECT t.id, t.status, t.party_id, t.vehicle_id, t.driver_id, t.route_id, t.unit_id,
            t.goods_weight, t.total_freight, t.freight_rate, t.advance_paid,
            p.name as party_name, v.lorry_number, v.goodshed_loading_expense,
            r.to_location, u.name as unit_name
     FROM trips t
     JOIN parties p ON p.id = t.party_id
     JOIN vehicles v ON v.id = t.vehicle_id
     JOIN routes r ON r.id = t.route_id
     LEFT JOIN units u ON u.id = t.unit_id
     WHERE t.id = $1`,
    [tripId]
  );
  if (tripRes.rows.length === 0) {
    throw new Error('Trip not found.');
  }
  const trip = tripRes.rows[0];
  const goods_weight = money(trip.goods_weight);
  const total_freight = Math.round(
    money(trip.total_freight) || goods_weight * money(trip.freight_rate)
  );
  const advance_paid = money(trip.advance_paid);

  const [cleaningRes, unloadingRes, bataRes, limitRes, carryRes] = await Promise.all([
    query(
      `SELECT unit_name, cleaning_charge, party_id, vehicle_id
       FROM cleaning_expense_rates
       WHERE status = 'ACTIVE'`
    ),
    query(
      `SELECT ur.id, ur.unit_name, ur.unit_number, ur.route_id, ur.rate_per_ton, r.to_location
       FROM unloading_rates ur
       LEFT JOIN routes r ON r.id = ur.route_id
       WHERE ur.party_id = $1 AND UPPER(ur.status) = 'ACTIVE'`,
      [trip.party_id]
    ),
    query(
      `SELECT rate_percentage, rate_multiplier FROM driver_bata_rates
       WHERE status = 'ACTIVE' AND party_id = $1
       UNION ALL
       SELECT rate_percentage, rate_multiplier FROM driver_bata_rates
       WHERE status = 'ACTIVE' AND party_id IS NULL
       LIMIT 1`,
      [trip.party_id]
    ),
    query(
      `SELECT max_amount FROM other_expense_limits
       WHERE LOWER(status) = 'active' AND party_id = $1
       UNION ALL
       SELECT max_amount FROM other_expense_limits
       WHERE LOWER(status) = 'active' AND party_id IS NULL
       LIMIT 1`,
      [trip.party_id]
    ),
    query(
      `SELECT GREATEST(0,
         COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.driver_id = $1), 0) +
         COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.driver_id = $1), 0) +
         COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = $1), 0) +
         COALESCE((SELECT SUM(tr.advance_paid) FROM trips tr WHERE tr.driver_id = $1 AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr.id)), 0) +
         COALESCE((SELECT SUM(dsp.amount) FROM driver_settlement_payments dsp JOIN settlements st ON dsp.settlement_id = st.id JOIN trips tr ON st.trip_id = tr.id WHERE tr.driver_id = $1), 0) -
         COALESCE((
           SELECT SUM(COALESCE(s.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = t.id), 0))
           FROM trips t LEFT JOIN settlements s ON s.trip_id = t.id
           WHERE t.driver_id = $1 AND t.status NOT IN ('CANCELLED', 'DRAFT')
         ), 0)
       ) as remaining_advance_balance`,
      [trip.driver_id]
    ),
  ]);

  const loading_amount = Math.round(money(trip.goodshed_loading_expense));

  const matchedUnload = pickUnloadingRate(unloadingRes.rows, {
    routeId: trip.route_id,
    toLocation: trip.to_location,
    unitName: trip.unit_name,
  });
  const unloading_applies = Boolean(matchedUnload);
  const unloading_rate_per_ton = matchedUnload ? money(matchedUnload.rate_per_ton) : 0;
  const unloading_amount = unloading_applies ? Math.round(goods_weight * unloading_rate_per_ton) : 0;
  const unloading_unit_name = matchedUnload?.unit_name || null;
  const unloading_unit_number = matchedUnload?.unit_number ?? null;

  const matchedClean = pickCleaningRate(cleaningRes.rows, {
    toLocation: trip.to_location,
    unitName: trip.unit_name,
    partyId: trip.party_id,
    vehicleId: trip.vehicle_id,
  });
  const cleaning_amount = Math.round(matchedClean ? money(matchedClean.cleaning_charge) : 100);
  const cleaning_description = matchedClean
    ? `Cleaning charge: ${matchedClean.unit_name}`
    : 'Cleaning charge (₹100 default)';

  const bataRow = bataRes.rows[0];
  const bata_multiplier = money(bataRow?.rate_multiplier, 0.15);
  const bata_percentage = money(bataRow?.rate_percentage, bata_multiplier * 100);
  const bata_amount = Math.round(total_freight * bata_multiplier);

  const other_limit = money(limitRes.rows[0]?.max_amount, 200);
  const driver_carry_forward = money(carryRes.rows[0]?.remaining_advance_balance);

  const suggested: SuggestedExpense[] = [
    {
      expense_type: 'LOADING',
      description: `Loading charge for ${trip.lorry_number || 'truck'}`,
      amount: loading_amount,
      applies: loading_amount > 0,
    },
    {
      expense_type: 'UNLOADING',
      description: unloading_applies
        ? `Unloading ${unloading_unit_name || 'unit'} (${goods_weight}T × ₹${unloading_rate_per_ton}/T)`
        : 'Unloading not applicable for this party/destination',
      amount: unloading_amount,
      applies: unloading_applies && unloading_amount > 0,
    },
    {
      expense_type: 'DRIVER_BATA',
      description: `Driver Bata (${bata_percentage}% of Total Freight ₹${total_freight})`,
      amount: bata_amount,
      applies: bata_amount > 0,
    },
    {
      expense_type: 'CLEANING_CHARGE',
      description: cleaning_description,
      amount: cleaning_amount,
      applies: cleaning_amount > 0,
    },
  ];

  return {
    trip_id: trip.id,
    trip_status: trip.status,
    party_id: trip.party_id,
    party_name: trip.party_name,
    lorry_number: trip.lorry_number,
    to_location: trip.to_location,
    unit_name: trip.unit_name,
    goods_weight,
    total_freight,
    advance_paid,
    driver_carry_forward,
    other_limit,
    unloading_applies,
    unloading_unit_name,
    unloading_unit_number,
    unloading_rate_per_ton,
    unloading_amount,
    loading_amount,
    cleaning_amount,
    cleaning_description,
    bata_percentage,
    bata_multiplier,
    bata_amount,
    suggested,
  };
}

export async function applyTripExpenseDefaults(tripId: number, userId: number) {
  const defaults = await buildTripExpenseDefaults(tripId);
  const applied: string[] = [];
  if (['SETTLED', 'CANCELLED'].includes(String(defaults.trip_status || '').toUpperCase())) {
    return { defaults, applied };
  }

  const existing = await query(
    `SELECT expense_type FROM driver_expenses WHERE trip_id = $1`,
    [tripId]
  );
  const types = new Set(existing.rows.map((r: any) => String(r.expense_type)));

  for (const line of defaults.suggested) {
    if (!line.applies || line.amount <= 0) continue;
    const already =
      types.has(line.expense_type) ||
      (line.expense_type === 'DRIVER_BATA' && types.has('DRIVER_BETA')) ||
      (line.expense_type === 'CLEANING_CHARGE' && types.has('CLEANING'));
    if (already) continue;
    await query(
      `INSERT INTO driver_expenses (trip_id, expense_type, description, amount, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [tripId, line.expense_type, line.description, Math.round(line.amount), userId]
    );
    applied.push(line.expense_type);
  }

  return { defaults, applied };
}

export async function getTripExpensePayload(tripId: number, defaults?: TripExpenseDefaults) {
  const result = await query(
    `SELECT de.*, u.name as created_by_name FROM driver_expenses de
     JOIN users u ON de.created_by = u.id
     WHERE de.trip_id = $1 ORDER BY de.created_at ASC`,
    [tripId]
  );
  const totalResult = await query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM driver_expenses WHERE trip_id = $1`,
    [tripId]
  );
  const total_expenses = money(totalResult.rows[0].total);
  const advance_paid = defaults?.advance_paid ?? money((
    await query(`SELECT advance_paid FROM trips WHERE id = $1`, [tripId])
  ).rows[0]?.advance_paid);
  return {
    expenses: result.rows,
    total_expenses,
    advance_paid,
    balance_to_driver: total_expenses - advance_paid,
    defaults: defaults || (await buildTripExpenseDefaults(tripId)),
  };
}
