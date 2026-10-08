export interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  mobile_number?: string;
  role: 'ADMIN' | 'TRANSPORT_USER';
  driver_id?: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
}

export interface Driver {
  id: number;
  name: string;
  mobile_number?: string;
  license_number?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}

export interface Vehicle {
  id: number;
  lorry_number: string;
  truck_image_url?: string;
  vehicle_type?: string;
  capacity_tons?: number;
  goodshed_loading_expense?: number;
  rc_number?: string;
  rc_photo_url?: string;
  rc_expiry_date?: string;
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
  created_at: Date;
  updated_at: Date;
}

export interface Party {
  id: number;
  name: string;
  contact_person?: string;
  mobile_number?: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}

export interface Unit {
  id: number;
  name: string;
  abbreviation?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}

export interface Route {
  id: number;
  from_location: string;
  to_location: string;
  distance_km?: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}

export interface FreightRate {
  id: number;
  route_id: number;
  unit_id: number;
  party_id?: number;
  rate_per_unit: number;
  effective_from: Date;
  effective_to?: Date;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}

export interface ExpenseRate {
  id: number;
  expense_type: 'LOADING' | 'UNLOADING' | 'OTHER';
  name: string;
  rate_per_unit?: number;
  route_id?: number;
  unit_id?: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}

export interface Trip {
  id: number;
  trip_date: Date;
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
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface TripPayment {
  id: number;
  trip_id: number;
  received_amount: number;
  payment_date: Date;
  balance_due: number;
  payment_status: 'PENDING' | 'PARTIAL' | 'RECEIVED';
  notes?: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface DriverExpense {
  id: number;
  trip_id: number;
  expense_type: 'FREIGHT_BASED' | 'LOADING' | 'UNLOADING' | 'TOLL' | 'FOOD' | 'REPAIR' | 'CLEANING' | 'CLEANING_CHARGE' | 'DRIVER_BETA' | 'DRIVER_BATA' | 'OTHER';
  description?: string;
  amount: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface Settlement {
  id: number;
  trip_id: number;
  total_freight: number;
  total_expenses: number;
  advance_paid: number;
  balance_to_driver: number;
  settlement_status: 'PENDING' | 'VERIFIED' | 'SETTLED';
  verified_by?: number;
  verified_at?: Date;
  payment_mode?: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  payment_date?: Date | string;
  paid_amount?: number;
  reference_no?: string;
  notes?: string;
  settled_by?: number;
  settled_by_name?: string;
  settled_at?: Date;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface DriverSettlementPayment {
  id: number;
  settlement_id: number;
  trip_id: number;
  amount: number;
  payment_mode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  payment_date: Date | string;
  reference_no?: string;
  notes?: string;
  created_by?: number;
  created_by_name?: string;
  created_at: Date;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  action: string;
  module: string;
  record_id?: string;
  details?: any;
  created_at: Date;
}

export interface JWTPayload {
  userId: number;
  username: string;
  role: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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
  created_at: Date;
  updated_at: Date;
}

export interface DriverBataRate {
  id: number;
  party_id?: number | null;
  party_name?: string;
  rate_percentage: number;
  rate_multiplier: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}

export interface OtherExpenseLimit {
  id: number;
  party_id?: number | null;
  party_name?: string;
  max_amount: number;
  description?: string;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}
