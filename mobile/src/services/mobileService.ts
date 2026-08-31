import api from './api';
import {
  User, Driver, Vehicle, Party, Unit, Route, FreightRate, ExpenseRate,
  Trip, TripPayment, DriverExpense, Settlement, MobileDashboardData,
  ApiResponse
} from '../types';

export const mobileAuthService = {
  login: async (username: string, password: string): Promise<ApiResponse<{ token: string; user: User }>> => {
    const res = await api.post('/auth/login', { username, password });
    return res.data;
  },
  logout: async (): Promise<ApiResponse> => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
  getMe: async (): Promise<ApiResponse<User>> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  changePassword: async (current_password: string, new_password: string): Promise<ApiResponse> => {
    const res = await api.post('/auth/change-password', { current_password, new_password });
    return res.data;
  },
};

export const mobileDashboardService = {
  getDashboard: async (): Promise<ApiResponse<MobileDashboardData>> => {
    const res = await api.get('/dashboard/mobile');
    return res.data;
  },
};

export const mobileLookupService = {
  getVehicles: async (): Promise<ApiResponse<{ items: Vehicle[] }>> => {
    const res = await api.get('/vehicles', { params: { limit: 100, status: 'ACTIVE' } });
    return res.data;
  },
  getDrivers: async (): Promise<ApiResponse<{ items: Driver[] }>> => {
    const res = await api.get('/drivers', { params: { limit: 100, status: 'ACTIVE' } });
    return res.data;
  },
  getParties: async (): Promise<ApiResponse<{ items: Party[] }>> => {
    const res = await api.get('/parties', { params: { limit: 100, status: 'ACTIVE' } });
    return res.data;
  },
  getRoutes: async (): Promise<ApiResponse<{ items: Route[] }>> => {
    const res = await api.get('/routes', { params: { limit: 100, status: 'ACTIVE' } });
    return res.data;
  },
  getUnits: async (): Promise<ApiResponse<Unit[]>> => {
    const res = await api.get('/units', { params: { status: 'ACTIVE' } });
    return res.data;
  },
  getFreightRates: async (): Promise<ApiResponse<{ items: FreightRate[] }>> => {
    const res = await api.get('/freight-rates', { params: { limit: 100, status: 'ACTIVE' } });
    return res.data;
  },
  getExpenseRates: async (): Promise<ApiResponse<ExpenseRate[]>> => {
    const res = await api.get('/expense-rates', { params: { status: 'ACTIVE' } });
    return res.data;
  },
};

export const mobileTripService = {
  getTrips: async (status?: string): Promise<ApiResponse<{ items: Trip[]; total: number }>> => {
    const res = await api.get('/trips', { params: { status, limit: 50 } });
    return res.data;
  },
  getTripById: async (id: number): Promise<ApiResponse<Trip>> => {
    const res = await api.get(`/trips/${id}`);
    return res.data;
  },
  createTrip: async (data: {
    vehicle_id: number;
    driver_id: number;
    party_id: number;
    route_id: number;
    unit_id: number;
    freight_rate_id?: number;
    freight_rate: number;
    goods_weight: number;
    advance_paid?: number;
    trip_date: string;
  }): Promise<ApiResponse<Trip>> => {
    const res = await api.post('/trips', data);
    return res.data;
  },
};

export const mobilePaymentService = {
  addPayment: async (tripId: number, data: { received_amount: number; payment_date?: string; notes?: string }): Promise<ApiResponse<TripPayment>> => {
    const res = await api.post(`/payments/trip/${tripId}`, data);
    return res.data;
  },
  getPartyLedger: async (partyId: number): Promise<ApiResponse<any[]>> => {
    const res = await api.get(`/payments/ledger/${partyId}`);
    return res.data;
  },
};

export const mobileExpenseService = {
  getTripExpenses: async (tripId: number): Promise<ApiResponse<{ expenses: DriverExpense[]; total_expenses: number; advance_paid: number; balance_to_driver: number }>> => {
    const res = await api.get(`/expenses/trip/${tripId}`);
    return res.data;
  },
  addExpense: async (tripId: number, data: { expense_type: string; description?: string; amount: number }): Promise<ApiResponse<DriverExpense>> => {
    const res = await api.post(`/expenses/trip/${tripId}`, data);
    return res.data;
  },
  deleteExpense: async (id: number): Promise<ApiResponse> => {
    const res = await api.delete(`/expenses/${id}`);
    return res.data;
  },
};

export const mobileSettlementService = {
  getSettlementByTripId: async (tripId: number): Promise<ApiResponse<Settlement>> => {
    const res = await api.get(`/settlements/trip/${tripId}`);
    return res.data;
  },
  generateSettlement: async (tripId: number): Promise<ApiResponse<Settlement>> => {
    const res = await api.post(`/settlements/trip/${tripId}/generate`);
    return res.data;
  },
};
