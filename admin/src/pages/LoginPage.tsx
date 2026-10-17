import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Eye, EyeOff, Lock, User as UserIcon, AlertCircle, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import transportBgDay from '../assets/transport_bg_day.jpg';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }

    try {
      setError('');
      setIsLoading(true);
      await login(username.trim(), password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '20px 16px',
        backgroundColor: '#f1f5f9',
      }}
    >
      {/* ── Bright & Visible Transport Highway Background ── */}
      <div
        style={{
          position: 'absolute',
          inset: '-12px',
          backgroundImage: `url(${transportBgDay})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          backgroundRepeat: 'no-repeat',
          animation: 'transportKenBurns 30s ease-in-out infinite alternate',
          transformOrigin: 'center center',
          filter: 'brightness(1.03) contrast(1.02)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Soft & Light Ambient Overlay (Ensures background is 100% visible) ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(240, 249, 255, 0.04) 45%, rgba(15, 23, 42, 0.22) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Top Floating Status Pill ── */}
      <div
        style={{
          position: 'relative',
          marginBottom: '16px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 18px',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxShadow: '0 6px 20px rgba(15, 23, 42, 0.12)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'inline-block',
              animation: 'liveBeaconPulse 2s infinite',
            }}
          />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            Fleet Network Online
          </span>
        </div>
        <span style={{ width: 1, height: 12, backgroundColor: '#cbd5e1' }} />
        <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
          Real-Time Transport Operations
        </span>
      </div>

      {/* ── Central Glassmorphic Card ── */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(255, 255, 255, 0.96)',
          borderRadius: '24px',
          padding: '32px 34px 26px',
          boxShadow: '0 25px 60px -10px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.9), 0 8px 24px rgba(0, 0, 0, 0.06)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          animation: 'modalSpringIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          position: 'relative',
          zIndex: 10,
          overflow: 'hidden',
        }}
      >
        {/* Amber-Orange Highway Top Stripe */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)',
          }}
        />

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 45%, #ea580c 100%)',
              borderRadius: '18px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              marginBottom: '12px',
              boxShadow: '0 8px 20px rgba(245, 158, 11, 0.4)',
              animation: 'amberBrandPulse 3s ease-in-out infinite',
            }}
          >
            <Truck size={30} strokeWidth={2.3} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.28)',
              marginBottom: 6,
            }}
          >
            <Activity size={12} color="#b45309" />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b45309', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Transport Management Portal
            </span>
          </div>

          <h1
            style={{
              fontSize: '25px',
              fontWeight: 900,
              color: '#0f172a',
              margin: '0 0 3px 0',
              letterSpacing: '-0.4px',
            }}
          >
            KSP Transport
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', fontWeight: 500, margin: 0 }}>
            Fleet Operations & Administrative Portal
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: '12px',
              marginBottom: '16px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              animation: 'slideDown 0.3s ease both',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
              Admin Username
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                style={{
                  paddingLeft: '38px',
                  height: '44px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  border: '1.5px solid #cbd5e1',
                  transition: 'all 0.2s ease',
                  backgroundColor: '#ffffff',
                }}
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
              <UserIcon
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '22px' }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                style={{
                  paddingLeft: '38px',
                  paddingRight: '40px',
                  height: '44px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  border: '1.5px solid #cbd5e1',
                  transition: 'all 0.2s ease',
                  backgroundColor: '#ffffff',
                }}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <Lock
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 40%, #ea580c 100%)',
              color: '#ffffff',
              fontSize: '14.5px',
              fontWeight: 700,
              letterSpacing: '0.3px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 8px 20px -3px rgba(245, 158, 11, 0.45)',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 24px -3px rgba(245, 158, 11, 0.55)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 20px -3px rgba(245, 158, 11, 0.45)';
            }}
          >
            {isLoading ? (
              <>
                <div
                  style={{
                    width: 17,
                    height: 17,
                    border: '2.5px solid rgba(255, 255, 255, 0.35)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Authenticating...
              </>
            ) : (
              <>
                <span>Sign In to Admin Portal</span>
                <ArrowRight size={16} strokeWidth={2.4} />
              </>
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '11px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <ShieldCheck size={14} color="#10b981" />
          <span>256-Bit SSL Encrypted • KSP Logistics Enterprise</span>
        </div>
      </div>

      {/* ── Bottom Feature Chips (Frosted Light Design) ── */}
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '10px',
          zIndex: 10,
        }}
      >
        {[
          { icon: '🚛', label: 'Fleet & Trip Dispatch' },
          { icon: '⚡', label: 'Driver & Truck Advances' },
          { icon: '📊', label: 'Automated Settlements' },
        ].map((item, idx) => (
          <div
            key={idx}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              color: '#1e293b',
              fontSize: '11.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
