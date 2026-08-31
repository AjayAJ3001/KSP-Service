import React from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
            <Building2 /> Parties
          </NavLink>

          <NavLink to="/routes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <MapPin /> Routes
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
    </div>
  );
};
