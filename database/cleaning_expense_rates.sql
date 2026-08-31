-- Cleaning Expense Rates
-- Maps a truck's loading expense (goodshed_loading_expense) to a cleaning charge
-- e.g., Loading Expense Rs.500  -> Cleaning Charge Rs.30
--       Loading Expense Rs.1000 -> Cleaning Charge Rs.50
--       Loading Expense Rs.1280 -> Cleaning Charge Rs.1000

CREATE TABLE IF NOT EXISTS cleaning_expense_rates (
  id               SERIAL PRIMARY KEY,
  loading_expense  DECIMAL(12,2) NOT NULL UNIQUE,
  cleaning_charge  DECIMAL(12,2) NOT NULL CHECK (cleaning_charge >= 0),
  description      VARCHAR(255),
  status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_expense_rates_loading ON cleaning_expense_rates(loading_expense);

-- Seed the example rows
INSERT INTO cleaning_expense_rates (loading_expense, cleaning_charge, description)
VALUES
  (500,  30,   'Loading Rs.500 -> Cleaning Rs.30'),
  (1000, 50,   'Loading Rs.1000 -> Cleaning Rs.50'),
  (1280, 100,  'Loading Rs.1280 -> Cleaning Rs.100')
ON CONFLICT (loading_expense) DO NOTHING;
