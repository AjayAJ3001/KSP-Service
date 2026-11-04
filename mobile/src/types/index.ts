export interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  mobile_number?: string;
  role: 'ADMIN' | 'MANAGER' | 'TRANSPORT_USER' | 'OWNER';
  owners?: { id: number; name: string }[];
  ownerIds?: number[];
  vehicleIds?: number[];
  driver_id?: number;
  driver_name?: string;
  driver_mobile?: string;
  license_number?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  updated_at?: string;
}

export interface Driver {
  id: number;
  name: string;
  mobile_number?: string;
  license_number?: string;
  license_type?: string;
  license_expiry_date?: string;
  days_remaining?: number;
  photo_url?: string;
  license_photo_url?: string;
  license_photo_back_url?: string;
  id_proof_type?: string;
  id_proof_url?: string;
  status: 'ACTIVE' | 'INACTIVE';
  total_advance_given?: number;
  remaining_advance_balance?: number;
  driver_balance?: number;
  pending_owed_to_driver?: number;
  created_at?: string;
}

export interface Vehicle {
  id: number;
  lorry_number: string;
  owner_id?: number;
  owner_name?: string;
  owner_mobile?: string;
  truck_image_url?: string;
  vehicle_type?: string;
  capacity_tons?: number;
  goodshed_loading_expense?: number;
  status: 'ACTIVE' | 'INACTIVE';
  rc_number?: string;
  rc_reg_date?: string;
  rc_photo_url?: string;
  rc_photo_back_url?: string;
  rc_expiry_date?: string;
  fc_number?: string;
  fc_expiry_date?: string;
  fc_photo_url?: string;
  insurance_policy_number?: string;
  insurance_expiry_date?: string;
  insurance_photo_url?: string;
  permit_number?: string;
  permit_expiry_date?: string;
  permit_photo_url?: string;
  tax_expiry_date?: string;
  tax_photo_url?: string;
  pan_number?: string;
  pan_card_url?: string;
  dts_number?: string;
  dts_expiry_date?: string;
  dts_certificate_url?: string;
  tds_number?: string;
  tds_expiry_date?: string;
  tds_certificate_url?: string;
  account_number?: string;
  bank_name?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  account_photo_url?: string;
  created_at?: string;
}

export interface Party {
  id: number;
  name: string;
  contact_person?: string;
  mobile_number?: string;
  address?: string;
  routes_count?: number | string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
}

export interface Unit {
  id: number;
  name: string;
  abbreviation?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
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
  created_at?: string;
}

export interface FreightRate {
  id: number;
  route_id: number;
  unit_id: number;
  party_id?: number;
  rate_per_unit: number;
  effective_from: string;
  unit_name?: string;
  unit_abbreviation?: string;
  party_name?: string;
  from_location?: string;
  to_location?: string;
  status: 'ACTIVE' | 'INACTIVE';
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
}

export interface Owner {
  id: number;
  name: string;
  mobile_number?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
}

export interface CleaningExpenseRate {
  id: number;
  unit_name: string;
  cleaning_charge: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  party_id?: number | null;
  vehicle_id?: number | null;
  party_name?: string;
  lorry_number?: string;
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
}

export interface DriverBataRate {
  id: number;
  party_id?: number | null;
  party_name?: string;
  rate_percentage: number;
  rate_multiplier: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface OtherExpenseLimit {
  id: number;
  party_id?: number | null;
  party_name?: string;
  max_amount: number;
  description?: string;
  status: 'active' | 'inactive';
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
  status: 'DRAFT' | 'NEW' | 'PAYMENT_PENDING' | 'PARTIALLY_PAID' | 'SETTLED' | 'CANCELLED';
  lorry_number?: string;
  owner_id?: number;
  owner_name?: string;
  owner_mobile?: string;
  driver_name?: string;
  driver_mobile?: string;
  party_name?: string;
  party_mobile?: string;
  from_location?: string;
  to_location?: string;
  unit_name?: string;
  unit_abbreviation?: string;
  goodshed_loading_expense?: number;
  total_received?: number;
  balance_due?: number;
  created_at: string;
}

export interface DriverExpense {
  id: number;
  trip_id: number;
  expense_type: 'FREIGHT_BASED' | 'LOADING' | 'UNLOADING' | 'DRIVER_BATA' | 'DRIVER_BETA' | 'CLEANING_CHARGE' | 'TOLL' | 'FOOD' | 'REPAIR' | 'OTHER' | string;
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
  initial_trip_advance?: number;
  additional_advance_paid?: number;
  manager_advance?: number;
  owner_applied?: number;
  owner_balance?: number;
  owner_leftover_used?: number;
  owner_given?: number;
  advance_owner_name?: string;
  balance_to_driver: number;
  previous_driver_balance?: number;
  net_balance_to_driver?: number;
  driver_current_balance?: number;
  settlement_status: 'PENDING' | 'VERIFIED' | 'SETTLED';
  trip_date?: string;
  lorry_number?: string;
  owner_id?: number;
  owner_name?: string;
  owner_mobile?: string;
  driver_name?: string;
  party_name?: string;
  from_location?: string;
  to_location?: string;
  expense_items?: { expense_type: string; description: string; amount: number }[];
  payment_mode?: 'CASH' | 'UPI' | 'BANK_TRANSFER' | string;
  payment_date?: string;
  paid_amount?: number;
  prior_deficit_deduction?: number;
  reference_no?: string;
  settled_by_name?: string;
  created_at: string;
}

export interface ComplianceAlertItem {
  id: number;
  lorry_number: string;
  fc_expiry_date?: string | null;
  insurance_expiry_date?: string | null;
  permit_expiry_date?: string | null;
  tax_expiry_date?: string | null;
}

export interface DashboardData {
  stats: {
    trips_today: number;
    pending_payments: number;
    settled_trips: number;
    pending_settlements: number;
    total_vehicles: number;
    total_drivers: number;
    total_parties: number;
    total_users: number;
  };
  financials: {
    total_freight: number;
    total_received: number;
    total_balance: number;
  };
  recent_trips: Trip[];
  compliance_alerts?: ComplianceAlertItem[];
}

export interface AuditLog {
  id: number;
  user_id?: number;
  action: string;
  module: string;
  record_id?: number;
  old_values?: any;
  new_values?: any;
  details?: any;
  source?: 'ADMIN' | 'MOBILE_ADMIN' | 'MOBILE' | string;
  ip_address?: string;
  created_at: string;
  username?: string;
  name?: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MobileDashboardData {
  trips_today: number;
  balance_due: number;
  recent_trips: Trip[];
  owner_advance_credit: number;
  owner_advance_entries: number;
  truck_advance_used: number;
  manager_available_balance: number;
  owner_advance_breakdown: {
    owner_name: string;
    amount: number;
    advance_date: string;
    payment_mode: string;
  }[];
  driver_advance_balances: {
    driver_id: number;
    driver_name: string;
    driver_mobile?: string;
    total_advance_given: number;
    total_expenses: number;
    balance_in_manager_hand: number;
  }[];
}

export interface OwnerAdvance {
  id: number;
  owner_id: number;
  recipient_type?: 'MANAGER' | 'DRIVER';
  manager_id?: number | null;
  driver_id?: number | null;
  vehicle_id?: number | null;
  amount: number;
  advance_date: string;
  payment_mode: string;
  notes?: string;
  screenshot_url?: string;
  owner_name?: string;
  manager_name?: string;
  driver_name?: string;
  driver_mobile?: string;
  lorry_number?: string;
  vehicle_number?: string;
  created_at: string;
}

export interface TruckAdvance {
  id: number;
  vehicle_id: number;
  owner_id?: number;
  owner_name?: string;
  driver_id?: number;
  trip_id?: number;
  manager_id: number;
  amount: number;
  advance_date: string;
  notes?: string;
  lorry_number?: string;
  vehicle_type?: string;
  driver_name?: string;
  driver_mobile?: string;
  party_name?: string;
  manager_name?: string;
  created_by_name?: string;
  created_at: string;
  // Trip details
  trip_date?: string;
  goods_weight?: number | string;
  total_freight?: number | string;
  freight_rate?: number | string;
  trip_status?: string;
  driver_expenses?: number | string;
  unit_name?: string;
  unit_abbreviation?: string;
  from_location?: string;
  to_location?: string;
}

export interface DriverAdvance {
  id: number;
  driver_id: number;
  manager_id: number;
  vehicle_id?: number;
  trip_id?: number;
  amount: number;
  advance_date: string;
  payment_mode?: 'CASH' | 'UPI' | 'BANK_TRANSFER' | string;
  notes?: string;
  driver_name: string;
  driver_mobile?: string;
  driver_license?: string;
  manager_name: string;
  manager_email?: string;
  lorry_number?: string;
  vehicle_type?: string;
  owner_id?: number;
  owner_name?: string;
  owner_mobile?: string;
  created_by_name?: string;
  created_at: string;
  // Trip details from backend
  trip_date?: string;
  trip_status?: string;
  party_name?: string;
  from_location?: string;
  to_location?: string;
  goods_weight?: number | string;
  freight_rate?: number | string;
  total_freight?: number | string;
  unit_name?: string;
  unit_abbreviation?: string;
  trip_advance_paid?: number | string;
  trip_driver_expenses?: number | string;
  // Live balance & source
  driver_balance_in_hand?: number | string;
  source_type?: 'DIRECT_DRIVER_ADVANCE' | 'TRIP_TRUCK_ADVANCE' | string;
}

export interface DriverAdvanceSummary {
  driver_id: number;
  driver_name: string;
  driver_mobile?: string;
  driver_license?: string;
  status: string;
  lorry_number?: string;
  owner_id?: number;
  owner_name?: string;
  owner_mobile?: string;
  total_advance_given: number;
  advance_count: number;
  total_trip_advance_used: number;
  trip_count: number;
  total_expenses_reported: number;
  remaining_advance_balance: number;
  balance_in_hand: number;
  // Extended fields from summary query rows
  overall_balance_in_hand?: number;
  need_to_pay?: number;
  settlement_status?: string;
  is_active_trip?: boolean;
  trip_id?: number;
  trip_status?: string;
  party_name?: string;
  from_location?: string;
  to_location?: string;
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
  NewTrip: { preselectedVehicleId?: number; preselectedDriverId?: number; advancePaid?: number; draftTripId?: number } | undefined;
  GiveTruckAdvance: { availableBalance: number };
  PartyPayment: { trip: Trip; draftTripId?: number };
  DriverExpenses: { trip: Trip };
  SettlementReceipt: { trip: Trip; settlement?: Settlement; fromGenerate?: boolean };
  // Admin Screens
  AdminDashboard: undefined;
  AdminReports: undefined;
  AdminAuditLogs: undefined;
  AdminUsers: undefined;
  AdminVehicles: undefined;
  AdminDrivers: undefined;
  AdminParties: undefined;
  AdminMasters: { initialTab?: 'UNITS' | 'ROUTES' | 'CLEANING' | 'UNLOADING' | 'BATA' | 'LIMITS' | 'OWNERS' | 'ADVANCES' | 'DRIVER_ADVANCES' | 'TRUCK_ADVANCES' } | undefined;
  AdminTrips: undefined;
  AdminPayments: undefined;
  AdminSettlements: undefined;
  AdminOwnerAdvances: undefined;
  AdminManagerLedger: undefined;
  AdminTruckAdvances: undefined;
  AdminDriverAdvances: undefined;
  AdminDriverBalanceMaster: undefined;
};

export type MainTabParamList = {
  Home?: undefined;
  Trips: undefined;
  Ledger: undefined;
  Profile: undefined;
  Admin?: undefined;
};
