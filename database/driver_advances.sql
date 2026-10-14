-- Driver Advances Table
-- Records advances given by Manager directly to a Driver before/between trips

CREATE TABLE IF NOT EXISTS driver_advances (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  manager_id INTEGER NOT NULL REFERENCES users(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  advance_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_mode VARCHAR(20) DEFAULT 'CASH',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_advances_driver ON driver_advances(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_advances_manager ON driver_advances(manager_id);
CREATE INDEX IF NOT EXISTS idx_driver_advances_vehicle ON driver_advances(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_driver_advances_date ON driver_advances(advance_date);
