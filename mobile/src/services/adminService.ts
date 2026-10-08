import api from './api';
import {
  User, Driver, Vehicle, Party, Owner, OwnerAdvance, Unit, Route, FreightRate, ExpenseRate, CleaningExpenseRate, UnloadingRate, DriverBataRate, OtherExpenseLimit,
  Trip, TripPayment, DriverExpense, Settlement, AuditLog, DashboardData,
  ApiResponse, PaginatedData
} from '../types';

// Dashboard Service
export const adminDashboardService = {
  getAdminDashboard: async (): Promise<ApiResponse<DashboardData>> => {
    const res = await api.get('/dashboard/admin');
    return res.data;
  },
};

// User Service
export const adminUserService = {
  getUsers: async (params?: { page?: number; limit?: number; search?: string; role?: string; status?: string }): Promise<ApiResponse<PaginatedData<User>>> => {
    const res = await api.get('/users', { params });
    return res.data;
  },
  getUserById: async (id: number): Promise<ApiResponse<User>> => {
    const res = await api.get(`/users/${id}`);
    return res.data;
  },
  createUser: async (data: Partial<User> & { password: string }): Promise<ApiResponse<User>> => {
    const res = await api.post('/users', data);
    return res.data;
  },
  updateUser: async (id: number, data: Partial<User>): Promise<ApiResponse<User>> => {
    const res = await api.put(`/users/${id}`, data);
    return res.data;
  },
  updateStatus: async (id: number, status: 'ACTIVE' | 'INACTIVE'): Promise<ApiResponse<User>> => {
    const res = await api.patch(`/users/${id}/status`, { status });
    return res.data;
  },
  resetPassword: async (id: number, new_password: string): Promise<ApiResponse> => {
    const res = await api.post(`/users/${id}/reset-password`, { new_password });
    return res.data;
  },
  deleteUser: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },
};

// Driver Service
export const adminDriverService = {
  getDrivers: async (params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<ApiResponse<PaginatedData<Driver>>> => {
    const res = await api.get('/drivers', { params });
    return res.data;
  },
  getExpiringDrivers: async (days: number = 30): Promise<ApiResponse<Driver[]>> => {
    const res = await api.get('/drivers/expiring', { params: { days } });
    return res.data;
  },
  getDriverById: async (id: number): Promise<ApiResponse<Driver>> => {
    const res = await api.get(`/drivers/${id}`);
    return res.data;
  },
  createDriver: async (data: Partial<Driver>): Promise<ApiResponse<Driver>> => {
    const res = await api.post('/drivers', data);
    return res.data;
  },
  updateDriver: async (id: number, data: Partial<Driver>): Promise<ApiResponse<Driver>> => {
    const res = await api.put(`/drivers/${id}`, data);
    return res.data;
  },
  updateStatus: async (id: number, status: 'ACTIVE' | 'INACTIVE'): Promise<ApiResponse<Driver>> => {
    const res = await api.patch(`/drivers/${id}/status`, { status });
    return res.data;
  },
  deleteDriver: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/drivers/${id}`);
    return res.data;
  },
};

// Vehicle Service
export const adminVehicleService = {
  getVehicles: async (params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<ApiResponse<PaginatedData<Vehicle>>> => {
    const res = await api.get('/vehicles', { params });
    return res.data;
  },
  getVehicleById: async (id: number): Promise<ApiResponse<Vehicle>> => {
    const res = await api.get(`/vehicles/${id}`);
    return res.data;
  },
  createVehicle: async (data: Partial<Vehicle>): Promise<ApiResponse<Vehicle>> => {
    const res = await api.post('/vehicles', data);
    return res.data;
  },
  updateVehicle: async (id: number, data: Partial<Vehicle>): Promise<ApiResponse<Vehicle>> => {
    const res = await api.put(`/vehicles/${id}`, data);
    return res.data;
  },
  updateStatus: async (id: number, status: 'ACTIVE' | 'INACTIVE'): Promise<ApiResponse<Vehicle>> => {
    const res = await api.patch(`/vehicles/${id}/status`, { status });
    return res.data;
  },
  deleteVehicle: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/vehicles/${id}`);
    return res.data;
  },
  getExpiringVehicles: async (days: number = 30): Promise<ApiResponse<Vehicle[]>> => {
    const res = await api.get('/vehicles/expiring', { params: { days } });
    return res.data;
  },
};

// Party Service
export const adminPartyService = {
  getParties: async (params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<ApiResponse<PaginatedData<Party>>> => {
    const res = await api.get('/parties', { params });
    return res.data;
  },
  getPartyById: async (id: number): Promise<ApiResponse<Party>> => {
    const res = await api.get(`/parties/${id}`);
    return res.data;
  },
  createParty: async (data: Partial<Party>): Promise<ApiResponse<Party>> => {
    const res = await api.post('/parties', data);
    return res.data;
  },
  updateParty: async (id: number, data: Partial<Party>): Promise<ApiResponse<Party>> => {
    const res = await api.put(`/parties/${id}`, data);
    return res.data;
  },
  updateStatus: async (id: number, status: 'ACTIVE' | 'INACTIVE'): Promise<ApiResponse<Party>> => {
    const res = await api.patch(`/parties/${id}/status`, { status });
    return res.data;
  },
  deleteParty: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/parties/${id}`);
    return res.data;
  },
};

// Unit Service
export const adminUnitService = {
  getUnits: async (status?: string): Promise<ApiResponse<Unit[]>> => {
    const res = await api.get('/units', { params: { status } });
    return res.data;
  },
  createUnit: async (data: Partial<Unit>): Promise<ApiResponse<Unit>> => {
    const res = await api.post('/units', data);
    return res.data;
  },
  updateUnit: async (id: number, data: Partial<Unit>): Promise<ApiResponse<Unit>> => {
    const res = await api.put(`/units/${id}`, data);
    return res.data;
  },
  deleteUnit: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/units/${id}`);
    return res.data;
  },
};

// Route Service
export const adminRouteService = {
  getRoutes: async (params?: { page?: number; limit?: number; search?: string; party_id?: number; status?: string }): Promise<ApiResponse<PaginatedData<Route>>> => {
    const res = await api.get('/routes', { params });
    return res.data;
  },
  createRoute: async (data: Partial<Route> & { party_id?: number; rate_per_unit?: number | string }): Promise<ApiResponse<Route>> => {
    const res = await api.post('/routes', data);
    return res.data;
  },
  updateRoute: async (id: number, data: Partial<Route> & { party_id?: number; rate_per_unit?: number | string }): Promise<ApiResponse<Route>> => {
    const res = await api.put(`/routes/${id}`, data);
    return res.data;
  },
  deleteRoute: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/routes/${id}`);
    return res.data;
  },
};

// Freight Rate Service
export const adminFreightRateService = {
  getFreightRates: async (params?: { page?: number; limit?: number; route_id?: number; party_id?: number; status?: string }): Promise<ApiResponse<PaginatedData<FreightRate>>> => {
    const res = await api.get('/freight-rates', { params });
    return res.data;
  },
  createFreightRate: async (data: Partial<FreightRate>): Promise<ApiResponse<FreightRate>> => {
    const res = await api.post('/freight-rates', data);
    return res.data;
  },
  updateFreightRate: async (id: number, data: Partial<FreightRate>): Promise<ApiResponse<FreightRate>> => {
    const res = await api.put(`/freight-rates/${id}`, data);
    return res.data;
  },
  deleteFreightRate: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/freight-rates/${id}`);
    return res.data;
  },
};

// Trip Service
export const adminTripService = {
  getTrips: async (params?: any): Promise<ApiResponse<PaginatedData<Trip>>> => {
    const res = await api.get('/trips', { params });
    return res.data;
  },
  getTripById: async (id: number): Promise<ApiResponse<Trip>> => {
    const res = await api.get(`/trips/${id}`);
    return res.data;
  },
  createTrip: async (data: Partial<Trip>): Promise<ApiResponse<Trip>> => {
    const res = await api.post('/trips', data);
    return res.data;
  },
  updateTripStatus: async (id: number, status: string): Promise<ApiResponse<Trip>> => {
    const res = await api.patch(`/trips/${id}/status`, { status });
    return res.data;
  },
  deleteTrip: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/trips/${id}`);
    return res.data;
  },
};

// Payment Service
export const adminPaymentService = {
  getTripPayments: async (tripId: number): Promise<ApiResponse<TripPayment[]>> => {
    const res = await api.get(`/payments/trip/${tripId}`);
    return res.data;
  },
  addPayment: async (tripId: number, data: { received_amount: number; payment_date?: string; notes?: string }): Promise<ApiResponse<TripPayment>> => {
    const res = await api.post(`/payments/trip/${tripId}`, data);
    return res.data;
  },
  deletePayment: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/payments/${id}`);
    return res.data;
  },
  getPartyLedger: async (partyId: number, params?: { from_date?: string; to_date?: string }): Promise<ApiResponse<any[]>> => {
    const res = await api.get(`/payments/ledger/${partyId}`, { params });
    return res.data;
  },
};

// Expense Service
export const adminExpenseService = {
  getTripExpenses: async (tripId: number): Promise<ApiResponse<{ expenses: DriverExpense[]; total_expenses: number; advance_paid: number; balance_to_driver: number }>> => {
    const res = await api.get(`/expenses/trip/${tripId}`);
    return res.data;
  },
  addExpense: async (tripId: number, data: { expense_type: string; description?: string; amount: number }): Promise<ApiResponse<DriverExpense>> => {
    const res = await api.post(`/expenses/trip/${tripId}`, data);
    return res.data;
  },
  updateExpense: async (id: number, data: Partial<DriverExpense>): Promise<ApiResponse<DriverExpense>> => {
    const res = await api.put(`/expenses/${id}`, data);
    return res.data;
  },
  deleteExpense: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/expenses/${id}`);
    return res.data;
  },
};

// Settlement Service
export const adminSettlementService = {
  getSettlements: async (params?: { page?: number; limit?: number; status?: string }): Promise<ApiResponse<PaginatedData<Settlement>>> => {
    const res = await api.get('/settlements', { params });
    return res.data;
  },
  getSettlementByTripId: async (tripId: number): Promise<ApiResponse<Settlement>> => {
    const res = await api.get(`/settlements/trip/${tripId}`);
    return res.data;
  },
  generateSettlement: async (tripId: number): Promise<ApiResponse<Settlement>> => {
    const res = await api.post(`/settlements/trip/${tripId}/generate`);
    return res.data;
  },
  verifySettlement: async (id: number): Promise<ApiResponse<Settlement>> => {
    const res = await api.patch(`/settlements/${id}/verify`);
    return res.data;
  },
  deleteSettlement: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/settlements/${id}`);
    return res.data;
  },
};

// Report Service
export const adminReportService = {
  getTripReport: async (params?: any): Promise<ApiResponse<{ trips: any[]; summary: any }>> => {
    const res = await api.get('/reports/trips', { params });
    return res.data;
  },
  getPaymentReport: async (params?: any): Promise<ApiResponse<any[]>> => {
    const res = await api.get('/reports/payments', { params });
    return res.data;
  },
  getSettlementReport: async (params?: any): Promise<ApiResponse<any[]>> => {
    const res = await api.get('/reports/settlements', { params });
    return res.data;
  },
};

// Audit Log Service
export const adminAuditLogService = {
  getAuditLogs: async (params?: { page?: number; limit?: number; module?: string; source?: string; from_date?: string; to_date?: string }): Promise<ApiResponse<PaginatedData<AuditLog> & { counts?: { total_all: number; total_admin: number; total_mobile: number } }>> => {
    const res = await api.get('/audit-logs', { params });
    return res.data;
  },
};

// Owner Service
export const adminOwnerService = {
  getOwners: async (params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<PaginatedData<Owner>>> => {
    const res = await api.get('/owners', { params });
    return res.data;
  },
  createOwner: async (data: Partial<Owner>): Promise<ApiResponse<Owner>> => {
    const res = await api.post('/owners', data);
    return res.data;
  },
  updateOwner: async (id: number, data: Partial<Owner>): Promise<ApiResponse<Owner>> => {
    const res = await api.put(`/owners/${id}`, data);
    return res.data;
  },
  deleteOwner: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/owners/${id}`);
    return res.data;
  },
};

// Cleaning Expense Rate Service
export const adminCleaningExpenseRateService = {
  getCleaningExpenseRates: async (params?: { status?: string }): Promise<ApiResponse<CleaningExpenseRate[]>> => {
    const res = await api.get('/cleaning-expense-rates', { params });
    return res.data;
  },
  createCleaningExpenseRate: async (data: Partial<CleaningExpenseRate>): Promise<ApiResponse<CleaningExpenseRate>> => {
    const res = await api.post('/cleaning-expense-rates', data);
    return res.data;
  },
  updateCleaningExpenseRate: async (id: number, data: Partial<CleaningExpenseRate>): Promise<ApiResponse<CleaningExpenseRate>> => {
    const res = await api.put(`/cleaning-expense-rates/${id}`, data);
    return res.data;
  },
  deleteCleaningExpenseRate: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/cleaning-expense-rates/${id}`);
    return res.data;
  },
};

// Unloading Rate Service
export const adminUnloadingRateService = {
  getUnloadingRates: async (params?: { status?: string; party_id?: number; search?: string }): Promise<ApiResponse<UnloadingRate[]>> => {
    const res = await api.get('/unloading-rates', { params });
    return res.data;
  },
  createUnloadingRate: async (data: Partial<UnloadingRate>): Promise<ApiResponse<UnloadingRate>> => {
    const res = await api.post('/unloading-rates', data);
    return res.data;
  },
  updateUnloadingRate: async (id: number, data: Partial<UnloadingRate>): Promise<ApiResponse<UnloadingRate>> => {
    const res = await api.put(`/unloading-rates/${id}`, data);
    return res.data;
  },
  deleteUnloadingRate: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/unloading-rates/${id}`);
    return res.data;
  },
};

// Driver Bata Rate Service
export const adminDriverBataRateService = {
  getDriverBataRates: async (params?: { status?: string; party_id?: string }): Promise<ApiResponse<DriverBataRate[]>> => {
    const res = await api.get('/driver-bata-rates', { params });
    return res.data;
  },
  createDriverBataRate: async (data: Partial<DriverBataRate>): Promise<ApiResponse<DriverBataRate>> => {
    const res = await api.post('/driver-bata-rates', data);
    return res.data;
  },
  updateDriverBataRate: async (id: number, data: Partial<DriverBataRate>): Promise<ApiResponse<DriverBataRate>> => {
    const res = await api.put(`/driver-bata-rates/${id}`, data);
    return res.data;
  },
  deleteDriverBataRate: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/driver-bata-rates/${id}`);
    return res.data;
  },
};

// Other Expense Limit Service
export const adminOtherExpenseLimitService = {
  getOtherExpenseLimits: async (params?: { status?: string; party_id?: string }): Promise<ApiResponse<OtherExpenseLimit[]>> => {
    const res = await api.get('/other-expense-limits', { params });
    return res.data;
  },
  createOtherExpenseLimit: async (data: Partial<OtherExpenseLimit>): Promise<ApiResponse<OtherExpenseLimit>> => {
    const res = await api.post('/other-expense-limits', data);
    return res.data;
  },
  updateOtherExpenseLimit: async (id: number, data: Partial<OtherExpenseLimit>): Promise<ApiResponse<OtherExpenseLimit>> => {
    const res = await api.put(`/other-expense-limits/${id}`, data);
    return res.data;
  },
  deleteOtherExpenseLimit: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/other-expense-limits/${id}`);
    return res.data;
  },
};

// Owner Advance Service
export const adminOwnerAdvanceService = {
  getOwnerAdvances: async (params?: {
    page?: number;
    limit?: number;
    owner_id?: number;
    manager_id?: number;
    from_date?: string;
    to_date?: string;
    search?: string;
  }): Promise<ApiResponse<{ items: OwnerAdvance[]; total: number; totalAmount: number; page: number; limit: number; totalPages: number }>> => {
    const res = await api.get('/owner-advances', { params });
    return res.data;
  },
  createOwnerAdvance: async (data: {
    owner_id: number;
    manager_id: number;
    amount: number;
    advance_date?: string;
    payment_mode?: string;
    screenshot_url?: string;
    notes?: string;
  }): Promise<ApiResponse<OwnerAdvance>> => {
    const res = await api.post('/owner-advances', data);
    return res.data;
  },
  updateOwnerAdvance: async (
    id: number,
    data: Partial<{
      owner_id: number;
      manager_id: number;
      amount: number;
      advance_date: string;
      payment_mode: string;
      screenshot_url: string;
      notes: string;
    }>
  ): Promise<ApiResponse<OwnerAdvance>> => {
    const res = await api.put(`/owner-advances/${id}`, data);
    return res.data;
  },
  deleteOwnerAdvance: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/owner-advances/${id}`);
    return res.data;
  },
};
