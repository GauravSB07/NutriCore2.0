import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Home, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isRootAdmin = location.pathname === '/admin' || location.pathname === '/admin/';

  return (
    <div className="min-h-screen flex items-center justify-center p-0 sm:p-4 bg-gradient-to-br from-[#e9d5ff] via-[#d8b4fe] to-[#c084fc]">
      {/* 420px GLASS CONTAINER */}
      <div className="w-full max-w-[420px] min-h-[95vh] max-h-[95vh] bg-[#f8f6fb] rounded-[36px] overflow-hidden shadow-2xl border border-purple-200/50 flex flex-col relative">
        {/* TOP ADMIN HEADER BAR */}
        <div className="px-4 py-3 bg-white/70 backdrop-blur border-b border-purple-100 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            {!isRootAdmin ? (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="w-8 h-8 rounded-full bg-purple-50 hover:bg-purple-100 text-[#7c3aed] flex items-center justify-center transition cursor-pointer"
                title="Back to Admin Dashboard"
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-full bg-purple-100 text-[#7c3aed] flex items-center justify-center">
                <Shield size={16} />
              </div>
            )}

            <div>
              <span className="text-xs font-bold text-gray-900 leading-none block">
                Control Panel
              </span>
              <span className="text-[10px] text-purple-600 font-semibold uppercase tracking-wider">
                Superuser Mode
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="px-2.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 text-[#7c3aed] text-xs font-semibold flex items-center gap-1 border border-purple-200 transition"
              title="Return to Main NutriCore App"
            >
              <Home size={13} />
              <span>User App</span>
            </Link>
          </div>
        </div>

        {/* ADMIN CONTENT OUTLET */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col bg-gradient-to-br from-[#f8f6fb] to-[#ede9fe]/40">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
