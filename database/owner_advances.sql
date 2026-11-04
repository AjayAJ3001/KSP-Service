-- Owner Advances Table
-- Records cash/advances given by Owners directly to Managers or Drivers

CREATE TABLE IF NOT EXISTS owner_advances (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  recipient_type VARCHAR(20) DEFAULT 'MANAGER' CHECK (recipient_type IN ('MANAGER', 'DRIVER')),
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  advance_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_mode VARCHAR(50) DEFAULT 'CASH',
  screenshot_url TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_recipient CHECK (
    (recipient_type = 'MANAGER' AND manager_id IS NOT NULL) OR
    (recipient_type = 'DRIVER' AND driver_id IS NOT NULL) OR
    (manager_id IS NOT NULL OR driver_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_owner_advances_owner ON owner_advances(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_advances_manager ON owner_advances(manager_id);
CREATE INDEX IF NOT EXISTS idx_owner_advances_driver ON owner_advances(driver_id);
CREATE INDEX IF NOT EXISTS idx_owner_advances_vehicle ON owner_advances(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_owner_advances_recipient ON owner_advances(recipient_type);
CREATE INDEX IF NOT EXISTS idx_owner_advances_date ON owner_advances(advance_date);

