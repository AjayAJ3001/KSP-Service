-- Unloading Rates
-- Stores unloading rate definition per Party / Unit / Route
-- For Krishi Nutrition Company:
--   Units 1 to 4: Rs.50 / Ton
--   Units 5 to 9: Rs.60 / Ton
-- Unloading formula: Goods Weight (Tons) * Rate Per Ton

CREATE TABLE IF NOT EXISTS unloading_rates (
  id            SERIAL PRIMARY KEY,
  party_id      INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  unit_number   INTEGER,
  unit_name     VARCHAR(150) NOT NULL,
  route_id      INTEGER REFERENCES routes(id) ON DELETE SET NULL,
  rate_per_ton  DECIMAL(12,2) NOT NULL CHECK (rate_per_ton >= 0),
  description   VARCHAR(255),
  status        VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unloading_rates_party ON unloading_rates(party_id);
CREATE INDEX IF NOT EXISTS idx_unloading_rates_route ON unloading_rates(route_id);
