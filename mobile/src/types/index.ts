export interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  mobile_number?: string;
  role: 'ADMIN' | 'TRANSPORT_USER';
  driver_id?: number;
  driver_name?: string;
  driver_mobile?: string;
  license_number?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Driver {
  id: number;
  name: string;
  mobile_number?: string;
  license_number?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Vehicle {
  id: number;
  lorry_number: string;
  vehicle_type?: string;
  capacity_tons?: number;
  goodshed_loading_expense?: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Party {
  id: number;
  name: string;
  contact_person?: string;
  mobile_number?: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Unit {
  id: number;
  name: string;
  abbreviation?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Route {
  id: number;
  from_location: string;
  to_location: string;
  distance_km?: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface FreightRate {
  id: number;
  route_id: number;
  unit_id: number;
  party_id?: number;
  rate_per_unit: number;
  effective_from: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ExpenseRate {
  id: number;
  expense_type: 'LOADING' | 'UNLOADING' | 'OTHER';
  name: string;
  rate_per_unit?: number;
  route_id?: number;
  unit_id?: number;
  status: 'ACTIVE' | 'INACTIVE';
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
  created_at: string;
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
  created_at: string;
}

export interface DriverExpense {
  id: number;
  trip_id: number;
  expense_type: 'FREIGHT_BASED' | 'LOADING' | 'UNLOADING' | 'TOLL' | 'FOOD' | 'REPAIR' | 'OTHER';
  description?: string;
  amount: number;
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
  trip_date?: string;
  lorry_number?: string;
  driver_name?: string;
  party_name?: string;
  from_location?: string;
  to_location?: string;
  expense_items?: { expense_type: string; description: string; amount: number }[];
  created_at: string;
}

export interface MobileDashboardData {
  trips_today: number;
  balance_due: number;
  recent_trips: Trip[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

// Navigation Param Lists
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  MainTabs: undefined;
  NewTrip: undefined;
  PartyPayment: { trip: Trip };
  DriverExpenses: { trip: Trip };
  SettlementReceipt: { trip: Trip; settlement?: Settlement };
};

export type MainTabParamList = {
  Home: undefined;
  Trips: undefined;
  Ledger: undefined;
  Profile: undefined;
};
