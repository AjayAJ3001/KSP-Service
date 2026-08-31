-- KSP Transport Management System
-- Complete Database Schema
-- PostgreSQL 18.x

-- Drop existing tables (for fresh setup)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS driver_expenses CASCADE;
DROP TABLE IF EXISTS trip_payments CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS freight_rates CASCADE;
DROP TABLE IF EXISTS expense_rates CASCADE;
DROP TABLE IF EXISTS party_units CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS parties CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- USERS
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  mobile_number VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'TRANSPORT_USER' CHECK (role IN ('ADMIN', 'TRANSPORT_USER')),
  driver_id INTEGER,
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- DRIVERS
CREATE TABLE drivers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  mobile_number VARCHAR(20),
  license_number VARCHAR(50),
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add FK for users.driver_id after drivers is created
ALTER TABLE users ADD CONSTRAINT fk_users_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;

-- VEHICLES
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  lorry_number VARCHAR(20) NOT NULL UNIQUE,
  vehicle_type VARCHAR(50),
  capacity_tons DECIMAL(10,2),
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PARTIES
CREATE TABLE parties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contact_person VARCHAR(100),
  mobile_number VARCHAR(20),
  address TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- UNITS
CREATE TABLE units (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  abbreviation VARCHAR(20),
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ROUTES
CREATE TABLE routes (
  id SERIAL PRIMARY KEY,
  from_location VARCHAR(100) NOT NULL,
  to_location VARCHAR(100) NOT NULL,
  distance_km DECIMAL(10,2),
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FREIGHT RATES
CREATE TABLE freight_rates (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id),
  unit_id INTEGER NOT NULL REFERENCES units(id),
  party_id INTEGER REFERENCES parties(id),
  rate_per_unit DECIMAL(12,2) NOT NULL CHECK (rate_per_unit >= 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EXPENSE RATES
CREATE TABLE expense_rates (
  id SERIAL PRIMARY KEY,
  expense_type VARCHAR(20) NOT NULL CHECK (expense_type IN ('LOADING', 'UNLOADING', 'OTHER')),
  name VARCHAR(100) NOT NULL,
  rate_per_unit DECIMAL(12,2) CHECK (rate_per_unit >= 0),
  route_id INTEGER REFERENCES routes(id),
  unit_id INTEGER REFERENCES units(id),
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRIPS
CREATE TABLE trips (
  id SERIAL PRIMARY KEY,
  trip_date DATE NOT NULL,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  party_id INTEGER NOT NULL REFERENCES parties(id),
  route_id INTEGER NOT NULL REFERENCES routes(id),
  unit_id INTEGER NOT NULL REFERENCES units(id),
  freight_rate_id INTEGER REFERENCES freight_rates(id),
  freight_rate DECIMAL(12,2) NOT NULL CHECK (freight_rate >= 0),
  goods_weight DECIMAL(12,3) NOT NULL CHECK (goods_weight > 0),
  total_freight DECIMAL(14,2) NOT NULL CHECK (total_freight >= 0),
  advance_paid DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (advance_paid >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'PAYMENT_PENDING' 
    CHECK (status IN ('NEW', 'PAYMENT_PENDING', 'PARTIALLY_PAID', 'SETTLED', 'CANCELLED')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRIP PAYMENTS
CREATE TABLE trip_payments (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id),
  received_amount DECIMAL(12,2) NOT NULL CHECK (received_amount >= 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  balance_due DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(10) NOT NULL DEFAULT 'PARTIAL' 
    CHECK (payment_status IN ('PENDING', 'PARTIAL', 'RECEIVED')),
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DRIVER EXPENSES
CREATE TABLE driver_expenses (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id),
  expense_type VARCHAR(20) NOT NULL 
    CHECK (expense_type IN ('FREIGHT_BASED', 'LOADING', 'UNLOADING', 'TOLL', 'FOOD', 'REPAIR', 'OTHER')),
  description VARCHAR(255),
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SETTLEMENTS
CREATE TABLE settlements (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL UNIQUE REFERENCES trips(id),
  total_freight DECIMAL(14,2) NOT NULL,
  total_expenses DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_to_driver DECIMAL(12,2) NOT NULL DEFAULT 0,
  settlement_status VARCHAR(10) NOT NULL DEFAULT 'PENDING' 
    CHECK (settlement_status IN ('PENDING', 'VERIFIED')),
  verified_by INTEGER REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  record_id VARCHAR(50),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_trips_date ON trips(trip_date);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_party ON trips(party_id);
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX idx_trips_created_by ON trips(created_by);
CREATE INDEX idx_trip_payments_trip ON trip_payments(trip_id);
CREATE INDEX idx_driver_expenses_trip ON driver_expenses(trip_id);
CREATE INDEX idx_settlements_trip ON settlements(trip_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_freight_rates_route ON freight_rates(route_id);
