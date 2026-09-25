-- Other Expense Limits Master Table
-- Admin sets the maximum allowed amount for "Other" expense category in mobile app

CREATE TABLE IF NOT EXISTS other_expense_limits (
  id SERIAL PRIMARY KEY,
  party_id INTEGER REFERENCES parties(id) ON DELETE CASCADE,
  max_amount NUMERIC(12,2) NOT NULL DEFAULT 200.00,
  description VARCHAR(255) DEFAULT 'Maximum allowed amount for Other expenses',
  status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default global limit (no party_id = applies to all)
INSERT INTO other_expense_limits (party_id, max_amount, description, status)
VALUES (NULL, 200.00, 'Standard maximum limit for Other expenses', 'active')
ON CONFLICT DO NOTHING;
