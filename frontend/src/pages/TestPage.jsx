import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logoImg from '../assets/images/logo.png';
import api, { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/common/BottomNav';
import { 
  CheckCircle2, 
  Server, 
  Zap, 
  Palette, 
  Activity,
  User,
  LogOut,
  LogIn,
  UserPlus,
  ShieldCheck
} from 'lucide-react';

export default function TestPage() {
  const [activeTab, setActiveTab] = useState('home');
  const [apiStatus, setApiStatus] = useState({ state: 'idle', message: 'Click below to test Django API proxy' });
  const [loading, setLoading] = useState(false);

  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const testApiProxy = async () => {
    setLoading(true);
    setApiStatus({ state: 'testing', message: 'Connecting to Django at /api/v1/nutrition/categories/ ...' });
    try {
      const response = await api.get('/nutrition/categories/');
      const count = Array.isArray(response.data) ? response.data.length : 0;
      setApiStatus({
        state: 'success',
        message: `Success! Received ${count} food categories from Django backend. Status: ${response.status} OK`,
        data: response.data,
      });
    } catch (error) {
      setApiStatus({
        state: 'error',
        message: `Connection error: ${error.message}. Ensure Django server is running on port 8000.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const testAuthMe = async () => {
    setLoading(true);
    setApiStatus({ state: 'testing', message: 'Connecting to Django at /api/v1/auth/me/ ...' });
    try {
      const data = await authService.getMe();
      setApiStatus({
        state: 'success',
        message: `Authenticated as "${data.username}". Goal: ${data.profile?.goal || 'Not set'}, Onboarded: ${data.profile?.is_onboarded ? 'Yes' : 'No'}.`,
        data,
      });
    } catch (error) {
      setApiStatus({
        state: 'error',
        message: `Auth check: ${error.response?.status === 401 ? '401 Unauthorized (not logged in)' : error.message}.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5 pb-24">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between pt-2 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white shadow-sm flex items-center justify-center p-1.5 border border-[#ede9fe]">
              <img src={logoImg} alt="NutriCore Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#4c1d95] tracking-tight">NutriCore</h1>
              <p className="text-xs text-[#a78bfa] font-medium">React + Vite Frontend</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-[#ede9fe] text-[#7c3aed] rounded-full flex items-center gap-1 border border-[#c084fc]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed] animate-pulse"></span>
            Auth Ready
          </span>
        </div>

        {/* Authentication State Card */}
        <div className="glass-card p-4 mb-4 text-[#4c1d95]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <User size={18} className="text-[#7c3aed]" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#7c3aed]">
                {isAuthenticated ? 'Active User Session' : 'User State: Guest'}
              </h2>
            </div>
            {isAdmin && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-300 flex items-center gap-1">
                <ShieldCheck size={12} />
                Admin
              </span>
            )}
          </div>

          {isAuthenticated ? (
            <div>
              <p className="text-sm font-bold text-[#111827]">
                Welcome, {user.username}!
              </p>
              <p className="text-xs text-[#64748b] mt-0.5">
                Email: {user.email || 'None'} · Onboarded: {user.profile?.is_onboarded ? 'Yes' : 'No'}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  to="/welcome"
                  className="px-3 py-1.5 text-xs font-semibold bg-white text-[#7c3aed] border border-[#7c3aed]/20 rounded-xl hover:bg-purple-50 transition"
                >
                  View Welcome
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition flex items-center gap-1 cursor-pointer"
                >
                  <LogOut size={13} />
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs text-[#64748b] mb-3">
                No active session in memory. You can log in or create a new account to test authenticated flows.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  className="py-2 px-3 text-xs font-bold text-center bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white rounded-xl shadow-sm hover:opacity-95 transition flex items-center justify-center gap-1.5"
                >
                  <LogIn size={14} />
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="py-2 px-3 text-xs font-bold text-center bg-white text-[#7c3aed] border border-[#7c3aed]/30 rounded-xl hover:bg-purple-50 transition flex items-center justify-center gap-1.5"
                >
                  <UserPlus size={14} />
                  Signup
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Hero Card */}
        <div className="glass-card p-4 mb-4 text-[#4c1d95]">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={18} className="text-[#7c3aed]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#7c3aed]">Scaffolding Shell</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/80 rounded-xl p-2.5 border border-[#7c3aed]/10">
              <span className="text-[#64748b] block text-[10px]">Viewport</span>
              <span className="font-semibold text-[#4c1d95]">390px Mobile</span>
            </div>
            <div className="bg-white/80 rounded-xl p-2.5 border border-[#7c3aed]/10">
              <span className="text-[#64748b] block text-[10px]">Font Family</span>
              <span className="font-semibold text-[#4c1d95]">Poppins</span>
            </div>
          </div>
        </div>

        {/* API Proxy Live Test */}
        <div className="premium-card">
          <h3 className="text-xs font-bold text-[#4c1d95] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Server size={14} className="text-[#7c3aed]" />
            Backend REST API Verification
          </h3>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={testApiProxy}
              disabled={loading}
              className="py-2 px-2.5 bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white text-[11px] font-semibold rounded-xl shadow-sm hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60"
            >
              <Activity size={13} />
              <span>Public API</span>
            </button>
            <button
              type="button"
              onClick={testAuthMe}
              disabled={loading}
              className="py-2 px-2.5 bg-white text-[#7c3aed] border border-[#7c3aed]/40 text-[11px] font-semibold rounded-xl shadow-sm hover:bg-purple-50 transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60"
            >
              <User size={13} />
              <span>GET /auth/me/</span>
            </button>
          </div>

          {apiStatus.state !== 'idle' && (
            <div className={`p-2.5 rounded-xl text-[11px] border leading-relaxed ${
              apiStatus.state === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : apiStatus.state === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
            }`}>
              <div className="font-semibold mb-0.5 flex items-center gap-1">
                {apiStatus.state === 'success' && <CheckCircle2 size={13} className="text-emerald-600" />}
                {apiStatus.state === 'success' ? 'Response Received' : apiStatus.state === 'error' ? 'Notice' : 'Testing'}
              </div>
              <p>{apiStatus.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Nav */}
      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  );
}
