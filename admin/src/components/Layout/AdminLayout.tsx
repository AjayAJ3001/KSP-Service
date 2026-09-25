import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Truck,
  Building2,
  Scale,
  MapPin,
  CircleDollarSign,
  Receipt,
  Navigation,
  CreditCard,
  Wallet,
  FileCheck,
  BarChart3,
  History,
  UserCircle,
  LogOut,
  Briefcase,
  Droplets,
  HandCoins,
  ArrowDownCircle,
  Percent,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LicenseExpiryAlertModal } from '../Common/LicenseExpiryAlertModal';
import { VehicleExpiryAlertModal } from '../Common/VehicleExpiryAlertModal';
import { driverService, vehicleService } from '../../services/adminService';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [showVehicleExpiryModal, setShowVehicleExpiryModal] = useState(false);
  const [expiringCount, setExpiringCount] = useState(0);
  const [expiringVehicleCount, setExpiringVehicleCount] = useState(0);

  useEffect(() => {
    // Driver license expiry count
    driverService.getExpiringDrivers(45).then((res) => {
      if (res.data) setExpiringCount(res.data.length);
    }).catch(() => {});
    // Vehicle compliance expiry count
    vehicleService.getExpiringVehicles(45).then((res) => {
      if (res.data) setExpiringVehicleCount(res.data.length);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon-box">KSP</div>
          <div className="brand-text">
            <h1>KSP Transport</h1>
            <span>Admin Portal</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Overview</div>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard /> Dashboard
          </NavLink>

          <div className="nav-section-title">Operations</div>
          <NavLink to="/trips" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Navigation /> Trips
          </NavLink>
          <NavLink to="/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <CreditCard /> Party Payments
          </NavLink>
          <NavLink to="/expenses" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Wallet /> Driver Expenses
          </NavLink>
          <NavLink to="/owner-advances" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <HandCoins /> Owner Advances
          </NavLink>
          <NavLink to="/settlements" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileCheck /> Settlements
          </NavLink>

          <div className="nav-section-title">Master Data</div>
          <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users /> User Management
          </NavLink>
          <NavLink to="/drivers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserCheck /> Drivers
          </NavLink>
          <NavLink to="/owners" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Briefcase /> Owners
          </NavLink>
          <NavLink to="/vehicles" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Truck /> Vehicles / Lorries
          </NavLink>
          <NavLink to="/parties" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Building2 /> Parties and Units
          </NavLink>
          <NavLink to="/freight-rates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <CircleDollarSign /> Freight Rates
          </NavLink>
          <NavLink to="/expense-rates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Receipt /> Expense Rates
          </NavLink>
          <NavLink to="/cleaning-expenses" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Droplets /> Cleaning Expenses
          </NavLink>
          <NavLink to="/unloading-rates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ArrowDownCircle /> Unloading Rates
          </NavLink>
          <NavLink to="/driver-bata" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Percent /> Driver Bata
          </NavLink>
          <NavLink to="/other-expense-limit" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ShieldAlert /> Other Expense Limit
          </NavLink>

          <div className="nav-section-title">Analytics & Security</div>
          <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BarChart3 /> Reports
          </NavLink>
          <NavLink to="/audit-logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <History /> Audit Logs
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserCircle /> Profile
          </NavLink>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="header">
          <div className="page-title">KSP Transport Management System</div>
          <div className="header-actions">
            {expiringCount > 0 && (
              <button
                onClick={() => setShowExpiryModal(true)}
                className="btn btn-sm"
                style={{
                  background: '#fef2f2',
                  borderColor: '#fca5a5',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 5px rgba(220, 38, 38, 0.15)',
                }}
                title={`${expiringCount} driver(s) have licenses expiring within 45 days`}
              >
                <AlertTriangle size={15} color="#dc2626" />
                <span>{expiringCount} License Alert{expiringCount === 1 ? '' : 's'}</span>
              </button>
            )}
            {expiringVehicleCount > 0 && (
              <button
                onClick={() => setShowVehicleExpiryModal(true)}
                className="btn btn-sm"
                style={{
                  background: '#fffbeb',
                  borderColor: '#fde68a',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 5px rgba(217, 119, 6, 0.15)',
                }}
                title={`${expiringVehicleCount} vehicle(s) have compliance documents expiring within 45 days`}
              >
                <AlertTriangle size={15} color="#d97706" />
                <span>{expiringVehicleCount} Fleet Alert{expiringVehicleCount === 1 ? '' : 's'}</span>
              </button>
            )}

            <div className="user-badge">
              <div className="user-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'A'}</div>
              <div>
                <div>{user?.name || 'Administrator'}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.role}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="btn btn-outline btn-sm" title="Logout">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>

        <main className="content-body">
          <Outlet />
        </main>
      </div>

      {/* Driver License Expiry Alert Modal */}
      <LicenseExpiryAlertModal
        isOpenManually={showExpiryModal}
        onCloseManual={() => setShowExpiryModal(false)}
      />
      {/* Vehicle Compliance Expiry Alert Modal */}
      <VehicleExpiryAlertModal
        isOpenManually={showVehicleExpiryModal}
        onCloseManual={() => setShowVehicleExpiryModal(false)}
      />
    </div>
  );
};
