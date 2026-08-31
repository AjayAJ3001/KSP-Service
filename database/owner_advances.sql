-- Owner Advances Table
-- Records cash/advances given by Owners and received by Managers/Staff

CREATE TABLE IF NOT EXISTS owner_advances (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  advance_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_mode VARCHAR(50) DEFAULT 'CASH',
  screenshot_url TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owner_advances_owner ON owner_advances(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_advances_manager ON owner_advances(manager_id);
CREATE INDEX IF NOT EXISTS idx_owner_advances_date ON owner_advances(advance_date);
