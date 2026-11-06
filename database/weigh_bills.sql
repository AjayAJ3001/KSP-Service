-- Weighment / material receipt bill attached to a trip (net or accepted weight).
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS weigh_bill_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS weigh_bill_slip_no VARCHAR(80),
  ADD COLUMN IF NOT EXISTS weigh_bill_vehicle_no VARCHAR(30),
  ADD COLUMN IF NOT EXISTS weigh_bill_net_weight DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS weigh_bill_accepted_weight DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS weigh_bill_image TEXT,
  ADD COLUMN IF NOT EXISTS weigh_bill_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_weigh_bill_hash
  ON trips (weigh_bill_hash)
  WHERE weigh_bill_hash IS NOT NULL AND status <> 'CANCELLED';

DROP INDEX IF EXISTS idx_trips_weigh_bill_slip_vehicle;

DROP INDEX IF EXISTS idx_trips_weigh_bill_slip_no;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_weigh_bill_slip_date
  ON trips (weigh_bill_slip_no, weigh_bill_date)
  WHERE weigh_bill_slip_no IS NOT NULL
    AND weigh_bill_slip_no <> ''
    AND status <> 'CANCELLED';
