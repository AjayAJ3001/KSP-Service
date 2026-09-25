-- Truck Advances Table
-- Records advances given by Manager to a specific Truck (Vehicle) before a trip

CREATE TABLE IF NOT EXISTS truck_advances (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  manager_id INTEGER NOT NULL REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  advance_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_truck_advances_manager ON truck_advances(manager_id);
CREATE INDEX IF NOT EXISTS idx_truck_advances_vehicle ON truck_advances(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_truck_advances_date ON truck_advances(advance_date);
