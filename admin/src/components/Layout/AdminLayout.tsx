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
  Receipt,
  Navigation,
  CreditCard,
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
  Banknote,
  BookOpen,
  Wallet,
  Menu,
  X,
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth > 768 : true;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavClick = () => {
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  useEffect(() => {
    // Driver license expiry count (30 days threshold)
    driverService.getExpiringDrivers(30).then((res) => {
      if (res.data) setExpiringCount(res.data.length);
    }).catch(() => {});
    // Vehicle compliance expiry count (30 days threshold)
    vehicleService.getExpiringVehicles(30).then((res) => {
      if (res.data) setExpiringVehicleCount(res.data.length);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Mobile / Modal Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <div className="brand-icon-box">KSP</div>
            <div className="brand-text">
              <h1>KSP Transport</h1>
              <span>Admin Portal</span>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="sidebar-close-btn"
            title="Close Sidebar"
            aria-label="Close Sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Overview</div>
          <NavLink to="/dashboard" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard /> Dashboard
          </NavLink>

          <div className="nav-section-title">Operations</div>
          <NavLink to="/trips" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Navigation /> Trips
          </NavLink>
          <NavLink to="/payments" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <CreditCard /> Party Payments
          </NavLink>
          <NavLink to="/owner-advances" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <HandCoins /> Owner Advances
          </NavLink>
          <NavLink to="/manager-ledger" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BookOpen /> Manager Advances
          </NavLink>
          <NavLink to="/truck-advances" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Banknote /> Truck Advances
          </NavLink>
          <NavLink to="/driver-advances" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Wallet /> Driver Advances
          </NavLink>
          <NavLink to="/settlements" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileCheck /> Settlements
          </NavLink>

          <div className="nav-section-title">Master Data</div>
          <NavLink to="/users" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users /> User Management
          </NavLink>
          <NavLink to="/drivers" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserCheck /> Drivers
          </NavLink>
          <NavLink to="/owners" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Briefcase /> Owners
          </NavLink>
          <NavLink to="/vehicles" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Truck /> Vehicles / Lorries
          </NavLink>
          <NavLink to="/parties" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Building2 /> Parties and Units
          </NavLink>
          <NavLink to="/cleaning-expenses" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Droplets /> Cleaning Expenses
          </NavLink>
          <NavLink to="/unloading-rates" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ArrowDownCircle /> Unloading Rates
          </NavLink>
          <NavLink to="/driver-bata" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Percent /> Driver Bata
          </NavLink>
          <NavLink to="/other-expense-limit" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ShieldAlert /> Other Expense Limit
          </NavLink>

          <div className="nav-section-title">Analytics & Security</div>
          <NavLink to="/reports" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BarChart3 /> Reports
          </NavLink>
          <NavLink to="/audit-logs" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <History /> Audit Logs
          </NavLink>
          <NavLink to="/profile" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserCircle /> Profile
          </NavLink>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="sidebar-toggle-btn"
              title={isSidebarOpen ? "Collapse Sidebar" : "Open Sidebar"}
              aria-label="Toggle Sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="page-title">KSP Transport Management System</div>
          </div>
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
