-- Driver Bata Rates Master
-- Defines driver bata percentage rate applied to Total Freight Amount
-- Default is 15% (0.15 * Total Freight)
-- Can be global (party_id IS NULL) or configured per specific party

CREATE TABLE IF NOT EXISTS driver_bata_rates (
  id               SERIAL PRIMARY KEY,
  party_id         INTEGER REFERENCES parties(id) ON DELETE CASCADE,
  rate_percentage  DECIMAL(6,2) NOT NULL DEFAULT 15.00 CHECK (rate_percentage >= 0),
  rate_multiplier  DECIMAL(6,4) NOT NULL DEFAULT 0.1500 CHECK (rate_multiplier >= 0),
  description      VARCHAR(255),
  status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_bata_rates_party ON driver_bata_rates(party_id);

-- Insert standard global 15% driver bata rate if not exists
INSERT INTO driver_bata_rates (party_id, rate_percentage, rate_multiplier, description, status)
SELECT NULL, 15.00, 0.1500, 'Default Standard Driver Bata (15% of Total Freight)', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM driver_bata_rates WHERE party_id IS NULL);
