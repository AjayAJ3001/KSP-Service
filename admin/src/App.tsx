import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminLayout } from './components/Layout/AdminLayout';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { DriversPage } from './pages/DriversPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { PartiesPage } from './pages/PartiesPage';

import { TripsPage } from './pages/TripsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { SettlementsPage } from './pages/SettlementsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ProfilePage } from './pages/ProfilePage';
import { OwnersPage } from './pages/OwnersPage';
import { CleaningExpensesPage } from './pages/CleaningExpensesPage';
import { OwnerAdvancesPage } from './pages/OwnerAdvancesPage';
import { UnloadingRatesPage } from './pages/UnloadingRatesPage';
import { DriverBataPage } from './pages/DriverBataPage';
import { OtherExpenseLimitPage } from './pages/OtherExpenseLimitPage';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#475569' }}>Loading KSP Transport System...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="trips" element={<TripsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="expenses" element={<Navigate to="/trips" replace />} />
            <Route path="settlements" element={<SettlementsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="drivers" element={<DriversPage />} />
            <Route path="owners" element={<OwnersPage />} />
            <Route path="owner-advances" element={<OwnerAdvancesPage />} />
            <Route path="vehicles" element={<VehiclesPage />} />
            <Route path="parties" element={<PartiesPage />} />
            <Route path="routes" element={<Navigate to="/parties" replace />} />
            <Route path="freight-rates" element={<Navigate to="/parties" replace />} />
            <Route path="expense-rates" element={<Navigate to="/cleaning-expenses" replace />} />
            <Route path="cleaning-expenses" element={<CleaningExpensesPage />} />
            <Route path="unloading-rates" element={<UnloadingRatesPage />} />
            <Route path="driver-bata" element={<DriverBataPage />} />
            <Route path="other-expense-limit" element={<OtherExpenseLimitPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
