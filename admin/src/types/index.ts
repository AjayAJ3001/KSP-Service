export interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  mobile_number?: string;
  role: 'ADMIN' | 'MANAGER' | 'TRANSPORT_USER';
  driver_id?: number;
  driver_name?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface Driver {
  id: number;
  name: string;
  mobile_number?: string;
  license_number?: string;
  license_type?: 'HEAVY' | 'REGULAR' | string;
  photo_url?: string;
  license_photo_url?: string;
  license_expiry_date?: string;
  days_remaining?: number;
  id_proof_type?: string;
  id_proof_url?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: number;
  lorry_number: string;
  vehicle_type?: string;
  capacity_tons?: number;
  goodshed_loading_expense?: number;
  rc_number?: string;
  rc_photo_url?: string;
  account_number?: string;
  bank_name?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  account_photo_url?: string;
  pan_number?: string;
  pan_card_url?: string;
  dts_number?: string;
  dts_expiry_date?: string;
  dts_certificate_url?: string;
  insurance_policy_number?: string;
  insurance_expiry_date?: string;
  insurance_photo_url?: string;
  permit_number?: string;
  permit_expiry_date?: string;
  permit_photo_url?: string;
  fc_number?: string;
  fc_expiry_date?: string;
  fc_photo_url?: string;
  tax_expiry_date?: string;
  tax_photo_url?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface Party {
  id: number;
  name: string;
  contact_person?: string;
  mobile_number?: string;
  address?: string;
  routes_count?: number | string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface Owner {
  id: number;
  name: string;
  mobile_number?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface OwnerAdvance {
  id: number;
  owner_id: number;
  owner_name?: string;
  manager_id: number;
  manager_name?: string;
  amount: number;
  advance_date: string;
  payment_mode?: string;
  screenshot_url?: string;
  notes?: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}


export interface Unit {
  id: number;
  name: string;
  abbreviation?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: number;
  from_location: string;
  to_location: string;
  distance_km?: number;
  party_id?: number;
  party_name?: string;
  rate_per_unit?: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface FreightRate {
  id: number;
  route_id: number;
  unit_id: number;
  party_id?: number;
  rate_per_unit: number;
  effective_from: string;
  effective_to?: string;
  status: 'ACTIVE' | 'INACTIVE';
  from_location?: string;
  to_location?: string;
  unit_name?: string;
  party_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRate {
  id: number;
  expense_type: 'LOADING' | 'UNLOADING' | 'OTHER';
  name: string;
  rate_per_unit?: number;
  route_id?: number;
  unit_id?: number;
  from_location?: string;
  to_location?: string;
  unit_name?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface CleaningExpenseRate {
  id: number;
  loading_expense: number;
  cleaning_charge: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface UnloadingRate {
  id: number;
  party_id: number;
  party_name?: string;
  unit_number?: number;
  unit_name: string;
  route_id?: number;
  from_location?: string;
  to_location?: string;
  rate_per_ton: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface DriverBataRate {
  id: number;
  party_id?: number | null;
  party_name?: string;
  rate_percentage: number;
  rate_multiplier: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface OtherExpenseLimit {
  id: number;
  party_id?: number | null;
  party_name?: string;
  max_amount: number;
  description?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: number;
  trip_date: string;
  vehicle_id: number;
  driver_id: number;
  party_id: number;
  route_id: number;
  unit_id: number;
  freight_rate_id?: number;
  freight_rate: number;
  goods_weight: number;
  total_freight: number;
  advance_paid: number;
  status: 'NEW' | 'PAYMENT_PENDING' | 'PARTIALLY_PAID' | 'SETTLED' | 'CANCELLED';
  lorry_number?: string;
  driver_name?: string;
  driver_mobile?: string;
  party_name?: string;
  party_mobile?: string;
  from_location?: string;
  to_location?: string;
  unit_name?: string;
  unit_abbreviation?: string;
  total_received?: number;
  balance_due?: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface TripPayment {
  id: number;
  trip_id: number;
  received_amount: number;
  payment_date: string;
  balance_due: number;
  payment_status: 'PENDING' | 'PARTIAL' | 'RECEIVED';
  notes?: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
}

export interface DriverExpense {
  id: number;
  trip_id: number;
  expense_type: 'FREIGHT_BASED' | 'LOADING' | 'UNLOADING' | 'TOLL' | 'FOOD' | 'REPAIR' | 'OTHER';
  description?: string;
  amount: number;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
}

export interface Settlement {
  id: number;
  trip_id: number;
  total_freight: number;
  total_expenses: number;
  advance_paid: number;
  balance_to_driver: number;
  settlement_status: 'PENDING' | 'VERIFIED';
  verified_by?: number;
  verified_at?: string;
  created_by?: number;
  trip_date?: string;
  lorry_number?: string;
  driver_name?: string;
  party_name?: string;
  from_location?: string;
  to_location?: string;
  goods_weight?: number;
  freight_rate?: number;
  expense_items?: { expense_type: string; description: string; amount: number }[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  username?: string;
  user_name?: string;
  action: string;
  module: string;
  record_id?: string;
  details?: any;
  created_at: string;
}

export interface DashboardData {
  stats: {
    total_users: number;
    active_users: number;
    total_drivers: number;
    total_vehicles: number;
    total_parties: number;
    trips_today: number;
    pending_payments: number;
    settled_trips: number;
    pending_settlements: number;
  };
  financials: {
    total_freight: string | number;
    total_received: string | number;
    total_balance: string | number;
  };
  recent_trips: Trip[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
