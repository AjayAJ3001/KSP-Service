import { query } from './src/config/database';

// From the handwritten list, the "from_location" is the loading point (SIPCOT area, Namakkal side)
// The routes are: origin → destination per party
// Unit = Tons (id=1)

const TONS_UNIT_ID = 1;
const TODAY = '2026-08-30';

const data: Array<{
  partyName: string;
  routes: Array<{ from: string; to: string; rate: number }>;
}> = [
  {
    partyName: 'KRISHI NUTRITION COMPANY',
    routes: [
      { from: 'SIPCOT', to: 'SIPCOT', rate: 300 },
      { from: 'SIPCOT', to: 'RGS-VANIKADAI', rate: 300 },
      { from: 'SIPCOT', to: 'GOBI-SAKTHI FEEDS', rate: 400 },
      { from: 'SIPCOT', to: 'PALLADAM-PPK HATCHERIES', rate: 500 },
      { from: 'SIPCOT', to: 'PAPPAMPATTI-VALARMATHI FEEDS', rate: 595 },
      { from: 'SIPCOT', to: 'NACHIPALAYAM-SULUNA FEEDS', rate: 650 },
      { from: 'SIPCOT', to: 'NAMAKKAL', rate: 465 },
      { from: 'SIPCOT', to: 'PUDHUCHATHARAM', rate: 465 },
      { from: 'SIPCOT', to: 'VENNANTHUR', rate: 445 },
    ],
  },
  {
    partyName: 'KUPPANNA POULTRY FARM',
    routes: [
      { from: 'SIPCOT', to: 'NUTHUR', rate: 350 },
      { from: 'SIPCOT', to: 'VELLAKOOIL', rate: 400 },
      { from: 'SIPCOT', to: 'NULLANUR', rate: 490 },
    ],
  },
  {
    partyName: 'SWAMI FEEDS',
    routes: [
      { from: 'SIPCOT', to: 'NULLANUR', rate: 475 },
    ],
  },
  {
    partyName: 'VENKATESHWARA HATCHERIES',
    routes: [
      { from: 'SIPCOT', to: 'KUNDASAM', rate: 450 },
    ],
  },
  {
    partyName: 'SENTHIL ANDAVAR FEEDS',
    routes: [
      { from: 'SIPCOT', to: 'PALANI', rate: 600 },
    ],
  },
];

async function getOrCreateRoute(from: string, to: string): Promise<number> {
  const existing = await query(
    `SELECT id FROM routes WHERE UPPER(from_location) = UPPER($1) AND UPPER(to_location) = UPPER($2)`,
    [from, to]
  );
  if (existing.rows.length > 0) {
    console.log(`  Route exists: ${from} → ${to} (id=${existing.rows[0].id})`);
    return existing.rows[0].id;
  }
  const res = await query(
    `INSERT INTO routes (from_location, to_location, status) VALUES ($1, $2, 'ACTIVE') RETURNING id`,
    [from, to]
  );
  console.log(`  Route created: ${from} → ${to} (id=${res.rows[0].id})`);
  return res.rows[0].id;
}

async function seedFreightRates() {
  for (const entry of data) {
    // Get party id
    const partyRes = await query(`SELECT id FROM parties WHERE UPPER(name) = UPPER($1)`, [entry.partyName]);
    if (partyRes.rows.length === 0) {
      console.warn(`  ⚠️ Party not found: ${entry.partyName}`);
      continue;
    }
    const partyId = partyRes.rows[0].id;
    console.log(`\n📦 Party: ${entry.partyName} (id=${partyId})`);

    for (const route of entry.routes) {
      const routeId = await getOrCreateRoute(route.from, route.to);

      // Check if freight rate already exists for this party+route
      const existing = await query(
        `SELECT id FROM freight_rates WHERE party_id = $1 AND route_id = $2 AND unit_id = $3`,
        [partyId, routeId, TONS_UNIT_ID]
      );

      if (existing.rows.length > 0) {
        await query(
          `UPDATE freight_rates SET rate_per_unit = $1, status = 'ACTIVE', updated_at = NOW() WHERE id = $2`,
          [route.rate, existing.rows[0].id]
        );
        console.log(`  Updated rate: ${route.to} = ₹${route.rate}/ton`);
      } else {
        await query(
          `INSERT INTO freight_rates (route_id, unit_id, party_id, rate_per_unit, effective_from, status)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
          [routeId, TONS_UNIT_ID, partyId, route.rate, TODAY]
        );
        console.log(`  Created rate: ${route.to} = ₹${route.rate}/ton`);
      }
    }
  }

  // Final summary
  const summary = await query(`
    SELECT p.name as party, r.from_location, r.to_location, fr.rate_per_unit, u.name as unit
    FROM freight_rates fr
    JOIN parties p ON fr.party_id = p.id
    JOIN routes r ON fr.route_id = r.id
    JOIN units u ON fr.unit_id = u.id
    WHERE fr.status = 'ACTIVE'
    ORDER BY p.name, r.to_location
  `);
  console.log('\n\n--- ALL ACTIVE FREIGHT RATES ---');
  console.table(summary.rows);
  process.exit(0);
}

seedFreightRates().catch(err => {
  console.error('Error seeding freight rates:', err);
  process.exit(1);
});
