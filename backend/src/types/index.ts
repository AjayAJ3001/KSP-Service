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
  vehicle_type?: string;
  capacity_tons?: number;
  goodshed_loading_expense?: number;
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
  expense_type: 'FREIGHT_BASED' | 'LOADING' | 'UNLOADING' | 'TOLL' | 'FOOD' | 'REPAIR' | 'OTHER';
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
  settlement_status: 'PENDING' | 'VERIFIED';
  verified_by?: number;
  verified_at?: Date;
  created_by: number;
  created_at: Date;
  updated_at: Date;
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
