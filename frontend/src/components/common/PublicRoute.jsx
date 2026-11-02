import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function PublicRoute() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-[#7c3aed]">
        <div className="w-8 h-8 border-3 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (!user?.profile?.is_onboarded) {
      return <Navigate to="/welcome" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
