import { query } from '../config/database';

type Ctx = {
  driver_name?: string;
  owner_name?: string;
  lorry_number?: string;
  party_name?: string;
  from_location?: string;
  to_location?: string;
  trip_date?: string;
  trip_id?: number;
  expense_type?: string;
  description?: string;
  amount?: number;
  received_amount?: number;
  balance_due?: number;
  total_freight?: number;
  status?: string;
};

function parseDetails(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return { note: raw };
    }
  }
  return {};
}

function intIds(values: any[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of values) {
    const n = parseInt(String(v ?? ''), 10);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function money(val: any): string {
  const n = parseFloat(String(val ?? ''));
  if (!Number.isFinite(n)) return '';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function niceAction(action?: string): string {
  return String(action || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function buildShortLabel(action?: string): string {
  const a = String(action || '').toUpperCase();
  if (a === 'LOGIN') return 'Logged in';
  if (a === 'LOGOUT') return 'Logged out';
  if (a === 'CHANGE_PASSWORD') return 'Password changed';
  if (a === 'CREATE_TRIP') return 'Trip created';
  if (a.startsWith('UPDATE_TRIP_STATUS')) return `Trip status: ${niceAction(a.replace('UPDATE_TRIP_STATUS_', ''))}`;
  if (a === 'DELETE_TRIP' || a === 'DELETE_DRAFT_TRIP' || a === 'CANCEL_DRAFT_TRIP') return 'Trip cancelled';
  if (a === 'ADD_EXPENSE') return 'Expense added';
  if (a === 'UPDATE_EXPENSE') return 'Expense updated';
  if (a === 'DELETE_EXPENSE') return 'Expense deleted';
  if (a === 'ADD_PAYMENT') return 'Party payment received';
  if (a === 'DELETE_PAYMENT') return 'Party payment deleted';
  if (a === 'CREATE_TRUCK_ADVANCE' || a === 'CREATE_DRIVER_ADVANCE' || a === 'CREATE_OWNER_ADVANCE') return 'Advance given';
  if (a === 'UPDATE_TRUCK_ADVANCE' || a === 'UPDATE_DRIVER_ADVANCE' || a === 'UPDATE_OWNER_ADVANCE') return 'Advance updated';
  if (a === 'DELETE_TRUCK_ADVANCE' || a === 'DELETE_DRIVER_ADVANCE' || a === 'DELETE_OWNER_ADVANCE') return 'Advance deleted';
  if (a === 'GENERATE_SETTLEMENT') return 'Settlement generated';
  if (a === 'VERIFY_SETTLEMENT') return 'Settlement verified';
  if (a === 'SETTLE_DRIVER_PAYMENT') return 'Driver payment settled';
  if (a === 'DELETE_SETTLEMENT') return 'Settlement deleted';
  if (a === 'CREATE_DRIVER') return 'Driver added';
  if (a === 'UPDATE_DRIVER') return 'Driver updated';
  if (a.endsWith('_DRIVER')) return niceAction(a);
  if (a === 'CREATE_VEHICLE') return 'Lorry added';
  if (a === 'UPDATE_VEHICLE') return 'Lorry updated';
  if (a.endsWith('_VEHICLE')) return niceAction(a);
  if (a === 'CREATE_OWNER') return 'Owner added';
  if (a === 'UPDATE_OWNER') return 'Owner updated';
  if (a === 'DELETE_OWNER') return 'Owner deleted';
  if (a === 'CREATE_PARTY') return 'Party added';
  if (a === 'UPDATE_PARTY') return 'Party updated';
  if (a.endsWith('_PARTY')) return niceAction(a);
  if (a === 'CREATE_USER') return 'User created';
  if (a === 'UPDATE_USER') return 'User updated';
  if (a === 'DELETE_USER') return 'User deleted';
  return niceAction(a) || 'Activity recorded';
}

function niceType(val?: string): string {
  return String(val || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function mapById(sql: string, ids: number[]): Promise<Map<number, any>> {
  const map = new Map<number, any>();
  if (!ids.length) return map;
  try {
    const res = await query(sql, [ids]);
    for (const row of res.rows) {
      map.set(Number(row.id), row);
    }
  } catch (err) {
    console.error('Audit context lookup failed:', err);
  }
  return map;
}

function cleanName(val?: string): string {
  return String(val || '').replace(/\s+/g, ' ').trim();
}

function sentence(parts: Array<string | false | null | undefined>): string {
  const text = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();
  if (!text) return 'Activity recorded.';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function buildStory(log: any, details: Record<string, any>): string {
  const driver = cleanName(details.driver_name);
  const owner = cleanName(details.owner_name);
  const lorry = cleanName(details.lorry_number);
  const party = cleanName(details.party_name);
  const route = details.from_location && details.to_location
    ? `${cleanName(details.from_location)} to ${cleanName(details.to_location)}`
    : '';
  const amt = money(details.amount ?? details.received_amount ?? details.total_freight ?? details.entered_advance);
  const action = String(log.action || '').toUpperCase();
  const loginName = cleanName(log.username) || 'Staff';

  if (action === 'LOGIN') return `User ${loginName} logged in.`;
  if (action === 'LOGOUT') return `User ${loginName} logged out.`;
  if (action === 'CHANGE_PASSWORD') return `Account password was changed.`;

  if (action === 'CREATE_TRIP') {
    return sentence([
      'A new trip was created',
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
      owner && `(owner ${owner})`,
      party && `to party ${party}`,
      route && `via ${route}`,
      details.total_freight && `Freight billed ${money(details.total_freight)}`,
      details.entered_advance && `Advance given ${money(details.entered_advance)}`,
    ]);
  }
  if (action.startsWith('UPDATE_TRIP_STATUS')) {
    return sentence([
      `Trip status was changed to ${niceType(action.replace('UPDATE_TRIP_STATUS_', ''))}`,
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
    ]);
  }
  if (action === 'DELETE_TRIP' || action === 'DELETE_DRAFT_TRIP' || action === 'CANCEL_DRAFT_TRIP') {
    return sentence([
      'The trip was cancelled',
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
    ]);
  }
  if (action === 'ADD_EXPENSE') {
    return sentence([
      `${niceType(details.expense_type) || 'An'} expense of ${amt || 'an amount'} was added`,
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
      owner && `(owner ${owner})`,
      details.description && `(${cleanName(details.description)})`,
    ]);
  }
  if (action === 'UPDATE_EXPENSE') {
    return sentence([
      'A driver expense was updated',
      amt && `to ${amt}`,
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
    ]);
  }
  if (action === 'DELETE_EXPENSE') {
    return sentence([
      'A driver expense was deleted',
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
    ]);
  }
  if (action === 'ADD_PAYMENT') {
    return sentence([
      `Party payment of ${money(details.received_amount) || amt || 'an amount'} was received`,
      party && `from ${party}`,
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
      owner && `(owner ${owner})`,
      details.balance_due != null && `Balance still due ${money(details.balance_due)}`,
    ]);
  }
  if (action === 'DELETE_PAYMENT') {
    return sentence([
      'A party payment was deleted',
      party && `for ${party}`,
    ]);
  }
  if (action === 'CREATE_TRUCK_ADVANCE') {
    return sentence([
      `Truck advance of ${amt || 'an amount'} was given`,
      driver && `to driver ${driver}`,
      lorry && `for lorry ${lorry}`,
      owner && `(owner ${owner})`,
    ]);
  }
  if (action === 'DELETE_TRUCK_ADVANCE') {
    return sentence([
      'A truck advance was deleted',
      amt && `of ${amt}`,
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
    ]);
  }
  if (action === 'CREATE_DRIVER_ADVANCE') {
    return sentence([
      `Driver advance of ${amt || 'an amount'} was given`,
      driver && `to ${driver}`,
      lorry && `for lorry ${lorry}`,
      owner && `(owner ${owner})`,
    ]);
  }
  if (action === 'UPDATE_DRIVER_ADVANCE') {
    return sentence([
      'A driver advance was updated',
      amt && `to ${amt}`,
      driver && `for ${driver}`,
    ]);
  }
  if (action === 'DELETE_DRIVER_ADVANCE') {
    return sentence([
      'A driver advance was deleted',
      amt && `of ${amt}`,
      driver && `for ${driver}`,
    ]);
  }
  if (action === 'CREATE_OWNER_ADVANCE') {
    if (driver) {
      return sentence([
        `Owner advance of ${amt || 'an amount'} was given to driver ${driver}`,
        owner && `from owner ${owner}`,
        lorry && `for lorry ${lorry}`,
      ]);
    }
    return sentence([
      `Owner advance of ${amt || 'an amount'} was given`,
      owner && `to owner ${owner}`,
      lorry && `for lorry ${lorry}`,
    ]);
  }
  if (action === 'UPDATE_OWNER_ADVANCE') {
    return sentence([
      'An owner advance was updated',
      amt && `to ${amt}`,
      owner && `for owner ${owner}`,
    ]);
  }
  if (action === 'DELETE_OWNER_ADVANCE') {
    return sentence([
      'An owner advance was deleted',
      amt && `of ${amt}`,
      owner && `for owner ${owner}`,
    ]);
  }
  if (action === 'GENERATE_SETTLEMENT') {
    return sentence([
      'A settlement slip was generated',
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
      owner && `(owner ${owner})`,
      party && `party ${party}`,
    ]);
  }
  if (action === 'VERIFY_SETTLEMENT') {
    return sentence([
      'The settlement was verified',
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
    ]);
  }
  if (action === 'SETTLE_DRIVER_PAYMENT') {
    return sentence([
      `Driver payment of ${amt || 'the due amount'} was settled`,
      driver && `to ${driver}`,
      lorry && `for lorry ${lorry}`,
      owner && `(owner ${owner})`,
    ]);
  }
  if (action === 'DELETE_SETTLEMENT') {
    return sentence([
      'A settlement was deleted',
      driver && `for driver ${driver}`,
      lorry && `on lorry ${lorry}`,
    ]);
  }
  if (action === 'CREATE_DRIVER') return sentence(['A driver was added', (details.name || driver) && `: ${details.name || driver}`]);
  if (action === 'UPDATE_DRIVER') return sentence(['Driver details were updated', (details.name || driver) && `for ${details.name || driver}`]);
  if (action === 'DELETE_DRIVER' || action.endsWith('_DRIVER')) return sentence([niceAction(action), (details.name || driver) && `for ${details.name || driver}`]);
  if (action === 'CREATE_VEHICLE') return sentence(['A lorry was added', lorry && lorry, owner && `(owner ${owner})`]);
  if (action === 'UPDATE_VEHICLE') return sentence(['Lorry details were updated', lorry && `for ${lorry}`]);
  if (action === 'DELETE_VEHICLE' || action.endsWith('_VEHICLE')) return sentence([niceAction(action), lorry && `for ${lorry}`]);
  if (action === 'CREATE_OWNER') return sentence(['An owner was added', (details.name || owner) && `: ${details.name || owner}`]);
  if (action === 'UPDATE_OWNER') return sentence(['Owner details were updated', (details.name || owner) && `for ${details.name || owner}`]);
  if (action === 'DELETE_OWNER') return sentence(['An owner was deleted', (details.name || owner) && `: ${details.name || owner}`]);
  if (action === 'CREATE_PARTY') return sentence(['A party was added', (details.name || party) && `: ${details.name || party}`]);
  if (action === 'UPDATE_PARTY') return sentence(['Party details were updated', (details.name || party) && `for ${details.name || party}`]);
  if (action === 'DELETE_PARTY' || action.endsWith('_PARTY')) return sentence([niceAction(action), (details.name || party) && `for ${details.name || party}`]);

  return sentence([
    niceAction(log.action),
    amt && `amount ${amt}`,
    driver && `driver ${driver}`,
    owner && `owner ${owner}`,
    lorry && `lorry ${lorry}`,
    party && `party ${party}`,
  ]);
}

export const enrichAuditLogRows = async (rows: any[]): Promise<any[]> => {
  if (!rows?.length) return rows;

  const parsed = rows.map((log) => ({ log, details: parseDetails(log.details) }));

  const tripIds: any[] = [];
  const expenseIds: any[] = [];
  const paymentIds: any[] = [];
  const settlementIds: any[] = [];
  const truckAdvIds: any[] = [];
  const driverAdvIds: any[] = [];
  const ownerAdvIds: any[] = [];
  const vehicleIds: any[] = [];
  const driverIds: any[] = [];
  const ownerIds: any[] = [];

  for (const { log, details } of parsed) {
    const rec = log.record_id;
    const mod = String(log.module || '').toUpperCase();
    if (details.trip_id) tripIds.push(details.trip_id);
    if (details.driver_id) driverIds.push(details.driver_id);
    if (details.owner_id) ownerIds.push(details.owner_id);
    if (details.vehicle_id) vehicleIds.push(details.vehicle_id);
    if (mod === 'TRIPS') tripIds.push(rec);
    else if (mod === 'EXPENSES') expenseIds.push(rec);
    else if (mod === 'PAYMENTS') paymentIds.push(rec);
    else if (mod === 'SETTLEMENTS') settlementIds.push(rec);
    else if (mod === 'TRUCK_ADVANCES') truckAdvIds.push(rec);
    else if (mod === 'DRIVER_ADVANCES') driverAdvIds.push(rec);
    else if (mod === 'OWNER_ADVANCES') ownerAdvIds.push(rec);
    else if (mod === 'VEHICLES') vehicleIds.push(rec);
    else if (mod === 'DRIVERS') driverIds.push(rec);
    else if (mod === 'OWNERS') ownerIds.push(rec);
  }

  const expenses = await mapById(
    `SELECT de.id, de.trip_id, de.expense_type, de.description, de.amount
     FROM driver_expenses de WHERE de.id = ANY($1::int[])`,
    intIds(expenseIds)
  );
  expenses.forEach((row) => { if (row.trip_id) tripIds.push(row.trip_id); });

  const payments = await mapById(
    `SELECT tp.id, tp.trip_id, tp.received_amount, tp.balance_due, tp.notes, tp.payment_status
     FROM trip_payments tp WHERE tp.id = ANY($1::int[])`,
    intIds(paymentIds)
  );
  payments.forEach((row) => { if (row.trip_id) tripIds.push(row.trip_id); });

  const settlements = await mapById(
    `SELECT s.id, s.trip_id, s.total_expenses as amount, s.settlement_status as status
     FROM settlements s WHERE s.id = ANY($1::int[])`,
    intIds(settlementIds)
  );
  settlements.forEach((row) => { if (row.trip_id) tripIds.push(row.trip_id); });

  const truckAdvs = await mapById(
    `SELECT ta.id, ta.trip_id, ta.amount, ta.driver_id, ta.vehicle_id,
            d.name as driver_name, v.lorry_number, o.name as owner_name
     FROM truck_advances ta
     LEFT JOIN drivers d ON ta.driver_id = d.id
     LEFT JOIN vehicles v ON ta.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     WHERE ta.id = ANY($1::int[])`,
    intIds(truckAdvIds)
  );
  truckAdvs.forEach((row) => {
    if (row.trip_id) tripIds.push(row.trip_id);
    if (row.driver_id) driverIds.push(row.driver_id);
    if (row.vehicle_id) vehicleIds.push(row.vehicle_id);
  });

  const driverAdvs = await mapById(
    `SELECT da.id, da.trip_id, da.amount, da.driver_id, da.vehicle_id,
            d.name as driver_name,
            COALESCE(v.lorry_number, tr_v.lorry_number) as lorry_number,
            COALESCE(o.name, tr_o.name) as owner_name
     FROM driver_advances da
     LEFT JOIN drivers d ON da.driver_id = d.id
     LEFT JOIN vehicles v ON da.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     LEFT JOIN trips tr ON da.trip_id = tr.id
     LEFT JOIN vehicles tr_v ON tr.vehicle_id = tr_v.id
     LEFT JOIN owners tr_o ON tr_v.owner_id = tr_o.id
     WHERE da.id = ANY($1::int[])`,
    intIds(driverAdvIds)
  );
  driverAdvs.forEach((row) => {
    if (row.trip_id) tripIds.push(row.trip_id);
    if (row.driver_id) driverIds.push(row.driver_id);
  });

  const ownerAdvs = await mapById(
    `SELECT oa.id, oa.amount, oa.owner_id, oa.vehicle_id, oa.driver_id,
            o.name as owner_name, d.name as driver_name, v.lorry_number
     FROM owner_advances oa
     LEFT JOIN owners o ON oa.owner_id = o.id
     LEFT JOIN drivers d ON oa.driver_id = d.id
     LEFT JOIN vehicles v ON oa.vehicle_id = v.id
     WHERE oa.id = ANY($1::int[])`,
    intIds(ownerAdvIds)
  );

  const trips = await mapById(
    `SELECT t.id, t.trip_date, t.status, t.total_freight, t.goods_weight, t.driver_id, t.vehicle_id,
            d.name as driver_name, o.name as owner_name, v.lorry_number, p.name as party_name,
            r.from_location, r.to_location
     FROM trips t
     LEFT JOIN drivers d ON t.driver_id = d.id
     LEFT JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     LEFT JOIN parties p ON t.party_id = p.id
     LEFT JOIN routes r ON t.route_id = r.id
     WHERE t.id = ANY($1::int[])`,
    intIds(tripIds)
  );
  trips.forEach((row) => {
    if (row.driver_id) driverIds.push(row.driver_id);
    if (row.vehicle_id) vehicleIds.push(row.vehicle_id);
  });

  const vehicles = await mapById(
    `SELECT v.id, v.lorry_number, o.name as owner_name
     FROM vehicles v
     LEFT JOIN owners o ON v.owner_id = o.id
     WHERE v.id = ANY($1::int[])`,
    intIds(vehicleIds)
  );

  const drivers = await mapById(
    `SELECT id, name as driver_name FROM drivers WHERE id = ANY($1::int[])`,
    intIds(driverIds)
  );

  const owners = await mapById(
    `SELECT id, name as owner_name FROM owners WHERE id = ANY($1::int[])`,
    intIds(ownerIds)
  );

  const pick = (...sources: Array<Ctx | undefined | null>) => {
    const out: Ctx = {};
    for (const src of sources) {
      if (!src) continue;
      for (const key of Object.keys(src) as (keyof Ctx)[]) {
        if (out[key] == null && src[key] != null && src[key] !== '') {
          (out as any)[key] = src[key];
        }
      }
    }
    return out;
  };

  return parsed.map(({ log, details }) => {
    const rec = parseInt(String(log.record_id || ''), 10);
    const mod = String(log.module || '').toUpperCase();
    const expense = mod === 'EXPENSES' ? expenses.get(rec) : undefined;
    const payment = mod === 'PAYMENTS' ? payments.get(rec) : undefined;
    const settlement = mod === 'SETTLEMENTS' ? settlements.get(rec) : undefined;
    const truckAdv = mod === 'TRUCK_ADVANCES' ? truckAdvs.get(rec) : undefined;
    const driverAdv = mod === 'DRIVER_ADVANCES' ? driverAdvs.get(rec) : undefined;
    const ownerAdv = mod === 'OWNER_ADVANCES' ? ownerAdvs.get(rec) : undefined;
    const tripId = details.trip_id || expense?.trip_id || payment?.trip_id || settlement?.trip_id || truckAdv?.trip_id || driverAdv?.trip_id;
    const trip = tripId ? trips.get(Number(tripId)) : (mod === 'TRIPS' ? trips.get(rec) : undefined);
    const vehicle = details.vehicle_id ? vehicles.get(Number(details.vehicle_id)) : (mod === 'VEHICLES' ? vehicles.get(rec) : undefined);
    const driver = details.driver_id ? drivers.get(Number(details.driver_id)) : (mod === 'DRIVERS' ? drivers.get(rec) : undefined);
    const owner = details.owner_id ? owners.get(Number(details.owner_id)) : (mod === 'OWNERS' ? owners.get(rec) : undefined);

    const skipPeople = mod === 'AUTH' || mod === 'USERS';
    const ctx = skipPeople
      ? pick(details)
      : pick(
          details,
          expense,
          payment,
          settlement,
          truckAdv,
          driverAdv,
          ownerAdv,
          trip,
          vehicle,
          driver,
          owner,
          details.name && mod === 'DRIVERS' ? { driver_name: details.name } : {},
          details.name && mod === 'OWNERS' ? { owner_name: details.name } : {},
          details.name && mod === 'PARTIES' ? { party_name: details.name } : {}
        );

    const merged: Record<string, any> = skipPeople
      ? { ...details }
      : {
          ...details,
          driver_name: ctx.driver_name,
          owner_name: ctx.owner_name,
          lorry_number: ctx.lorry_number,
          party_name: ctx.party_name,
          from_location: ctx.from_location,
          to_location: ctx.to_location,
          trip_date: ctx.trip_date || details.trip_date,
          expense_type: ctx.expense_type || details.expense_type,
          description: ctx.description || details.description,
          amount: details.amount ?? ctx.amount,
          received_amount: details.received_amount ?? ctx.received_amount,
          balance_due: details.balance_due ?? ctx.balance_due,
          total_freight: details.total_freight ?? ctx.total_freight,
        };

    Object.keys(merged).forEach((k) => {
      if (merged[k] == null || merged[k] === '') delete merged[k];
    });

    merged.what_happened = buildStory(log, merged);
    merged.short_label = buildShortLabel(log.action);

    return { ...log, details: merged };
  });
};
