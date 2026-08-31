-- Seed data for KSP Transport Management System
-- Run after schema.sql

-- Default Admin User: admin / Admin@123
-- Password hash for 'Admin@123' with bcrypt rounds=12
-- Generated with: bcrypt.hashSync('Admin@123', 12)
INSERT INTO users (username, name, password_hash, email, role, status) VALUES
('admin', 'KSP Admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniV7XyXC4lq0K4i9lmWwmEzDW', 'admin@ksp.com', 'ADMIN', 'ACTIVE')
ON CONFLICT (username) DO NOTHING;

-- Sample Units
INSERT INTO units (name, abbreviation) VALUES
('Tons', 'T'),
('Kilograms', 'KG'),
('Quintals', 'QTL'),
('Bags', 'Bags'),
('Loads', 'Loads')
ON CONFLICT DO NOTHING;

-- Sample Drivers
INSERT INTO drivers (name, mobile_number, license_number) VALUES
('Rajan Kumar', '9876543210', 'TN01 20200012345'),
('Suresh Babu', '9876543211', 'TN01 20180054321'),
('Murugan R', '9876543212', 'TN02 20190076543')
ON CONFLICT DO NOTHING;

-- Sample Vehicles
INSERT INTO vehicles (lorry_number, vehicle_type, capacity_tons) VALUES
('TN 01 AB 1234', 'Heavy Lorry', 25.0),
('TN 01 CD 5678', 'Medium Lorry', 15.0),
('TN 02 EF 9012', 'Heavy Lorry', 20.0)
ON CONFLICT (lorry_number) DO NOTHING;

-- Sample Parties
INSERT INTO parties (name, contact_person, mobile_number) VALUES
('ABC Trading Co', 'Arun Kumar', '9876500001'),
('XYZ Industries', 'Priya Sharma', '9876500002'),
('PQR Enterprises', 'Ravi Patel', '9876500003'),
('MNO Construction', 'Sita Devi', '9876500004')
ON CONFLICT DO NOTHING;

-- Sample Routes
INSERT INTO routes (from_location, to_location, distance_km) VALUES
('Chennai', 'Coimbatore', 498),
('Chennai', 'Madurai', 461),
('Chennai', 'Salem', 340),
('Coimbatore', 'Madurai', 209),
('Chennai', 'Trichy', 330),
('Chennai', 'Erode', 400)
ON CONFLICT DO NOTHING;

-- Sample Freight Rates (after routes and units are inserted)
INSERT INTO freight_rates (route_id, unit_id, rate_per_unit, effective_from)
SELECT r.id, u.id, 1250.00, '2025-01-01'
FROM routes r, units u
WHERE r.from_location = 'Chennai' AND r.to_location = 'Coimbatore'
AND u.abbreviation = 'T'
ON CONFLICT DO NOTHING;

INSERT INTO freight_rates (route_id, unit_id, rate_per_unit, effective_from)
SELECT r.id, u.id, 1100.00, '2025-01-01'
FROM routes r, units u
WHERE r.from_location = 'Chennai' AND r.to_location = 'Madurai'
AND u.abbreviation = 'T'
ON CONFLICT DO NOTHING;

-- Sample Expense Rates
INSERT INTO expense_rates (expense_type, name, rate_per_unit) VALUES
('LOADING', 'Loading Charges', 50.00),
('UNLOADING', 'Unloading Charges', 50.00),
('OTHER', 'Toll Charges', NULL),
('OTHER', 'Food Allowance', NULL),
('OTHER', 'Repair/Maintenance', NULL)
ON CONFLICT DO NOTHING;
