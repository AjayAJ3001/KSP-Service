const { Pool } = require('pg');
require('dotenv').config({ path: 'backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const driverId = 15;
  const advancesRes = await pool.query(
    `WITH all_advances AS (
       SELECT 
         da.id,
         da.driver_id,
         da.amount,
         da.advance_date,
         da.payment_mode,
         da.notes,
         da.trip_id,
         da.vehicle_id,
         'DIRECT_ADVANCE' as source_type,
         da.created_at,
         u.name as manager_name
       FROM driver_advances da
       LEFT JOIN users u ON da.manager_id = u.id
       WHERE da.driver_id = $1

       UNION ALL

       SELECT 
         ta.id,
         ta.driver_id,
         ta.amount,
         ta.advance_date,
         'CASH' as payment_mode,
         ta.notes,
         ta.trip_id,
         ta.vehicle_id,
         'TRUCK_ADVANCE' as source_type,
         ta.created_at,
         u.name as manager_name
       FROM truck_advances ta
       LEFT JOIN users u ON ta.manager_id = u.id
       WHERE ta.driver_id = $1

       UNION ALL

       SELECT 
         tr.id,
         tr.driver_id,
         tr.advance_paid as amount,
         tr.trip_date as advance_date,
         'CASH' as payment_mode,
         'Trip Advance' as notes,
         tr.id as trip_id,
         tr.vehicle_id,
         'TRIP_ADVANCE' as source_type,
         tr.created_at,
         u.name as manager_name
       FROM trips tr
       LEFT JOIN users u ON tr.created_by = u.id
       WHERE tr.driver_id = $1
         AND tr.status NOT IN ('CANCELLED', 'DRAFT')
         AND tr.advance_paid > 0
         AND NOT EXISTS (SELECT 1 FROM truck_advances ta2 WHERE ta2.trip_id = tr.id)

        UNION ALL

        SELECT 
          oa.id,
          oa.driver_id,
          oa.amount,
          oa.advance_date,
          oa.payment_mode,
          COALESCE(oa.notes, 'Direct Owner Advance') as notes,
          NULL::integer as trip_id,
          oa.vehicle_id,
          'OWNER_ADVANCE' as source_type,
          oa.created_at,
          o.name as manager_name
        FROM owner_advances oa
        LEFT JOIN owners o ON oa.owner_id = o.id
        WHERE oa.driver_id = $1
     )
     SELECT aa.*, v.lorry_number
     FROM all_advances aa
     LEFT JOIN vehicles v ON aa.vehicle_id = v.id
     ORDER BY aa.advance_date DESC, aa.created_at DESC`,
    [driverId]
  );

  const tripsRes = await pool.query(
    `SELECT 
       t.id as trip_id,
       t.trip_date,
       t.status as trip_status,
       COALESCE(s.advance_paid, t.advance_paid) as advance_paid,
       t.advance_paid as initial_trip_advance,
       GREATEST(0, COALESCE(s.advance_paid, t.advance_paid) - COALESCE(t.advance_paid, 0)) as additional_advance_paid,
       t.prior_deficit_deduction,
       v.lorry_number,
       p.name as party_name,
       r.from_location,
       r.to_location,
       COALESCE(s.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = t.id), 0) as total_expenses,
       s.id as settlement_id,
       COALESCE(s.settlement_status, 'PENDING') as settlement_status,
       s.balance_to_driver,
       s.net_balance_to_driver,
       s.payment_mode as settlement_payment_mode,
       s.payment_date as settlement_date,
       s.paid_amount as settlement_paid_amount
     FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     LEFT JOIN settlements s ON s.trip_id = t.id
     WHERE t.driver_id = $1
       AND t.status NOT IN ('CANCELLED', 'DRAFT')
     ORDER BY t.trip_date DESC, t.id DESC`,
    [driverId]
  );

  const totalAdvanceGiven = advancesRes.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const totalExpenses = tripsRes.rows.reduce((sum, r) => sum + parseFloat(r.total_expenses || 0), 0);
  const balanceInManagerHand = totalAdvanceGiven - totalExpenses;

  console.log('Statement summary:');
  console.log('Advances rows:', advancesRes.rows);
  console.log('Trips rows:', tripsRes.rows);
  console.log('totalAdvanceGiven:', totalAdvanceGiven);
  console.log('totalExpenses:', totalExpenses);
  console.log('balanceInManagerHand:', balanceInManagerHand);
  pool.end();
}
check();
