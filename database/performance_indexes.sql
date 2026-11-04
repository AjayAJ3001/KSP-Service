-- Hot-path indexes for faster list/filter clicks
CREATE INDEX IF NOT EXISTS idx_truck_advances_trip ON truck_advances(trip_id);
CREATE INDEX IF NOT EXISTS idx_driver_advances_trip ON driver_advances(trip_id);
CREATE INDEX IF NOT EXISTS idx_owner_advances_driver ON owner_advances(driver_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(settlement_status);
CREATE INDEX IF NOT EXISTS idx_settlements_status_trip ON settlements(settlement_status, trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_payments_payment_date ON trip_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_status_date ON trips(status, trip_date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_expenses_type ON driver_expenses(trip_id, expense_type);
