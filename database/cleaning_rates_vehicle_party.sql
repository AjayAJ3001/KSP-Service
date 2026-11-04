ALTER TABLE cleaning_expense_rates
  ADD COLUMN IF NOT EXISTS party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaning_rates_unit_party_vehicle
  ON cleaning_expense_rates (LOWER(unit_name), COALESCE(party_id, 0), COALESCE(vehicle_id, 0));

INSERT INTO cleaning_expense_rates (unit_name, cleaning_charge, party_id, vehicle_id, description, status)
SELECT v.unit_name, 50, 5, veh.id,
       'Krishi · ' || veh.lorry_number || ' · ' || v.unit_name || ' Rs.50',
       'ACTIVE'
FROM (VALUES ('SIPCOT'), ('RGS - VAVIKADAI')) AS v(unit_name)
CROSS JOIN (
  SELECT id, lorry_number FROM vehicles
  WHERE regexp_replace(upper(lorry_number), '[^A-Z0-9]', '', 'g') IN
        ('TN33AW7171', 'TN33BK0342', 'TN33BM0919', 'TN52D3441')
) veh
ON CONFLICT (LOWER(unit_name), COALESCE(party_id, 0), COALESCE(vehicle_id, 0)) DO UPDATE
SET cleaning_charge = 50,
    description = EXCLUDED.description,
    status = 'ACTIVE',
    updated_at = NOW();
