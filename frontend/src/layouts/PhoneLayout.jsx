import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import BottomNav from '../components/common/BottomNav';

export default function PhoneLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = (pathname) => {
    if (pathname.startsWith('/nutrition')) return 'nutrition';
    if (pathname.startsWith('/workouts')) return 'workouts';
    if (pathname.startsWith('/progress') || pathname.startsWith('/reports')) return 'progress';
    if (pathname.startsWith('/recipes')) return 'recipes';
    return 'home';
  };

  const activeTab = getActiveTab(location.pathname);

  const handleSelectTab = (tabId) => {
    if (tabId === 'home') navigate('/');
    else if (tabId === 'nutrition') navigate('/nutrition/meals');
    else if (tabId === 'workouts') navigate('/workouts/start');
    else if (tabId === 'progress') navigate('/progress');
    else if (tabId === 'recipes') navigate('/recipes');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-0 md:p-6 bg-gradient-to-br from-[#f3e8ff] via-[#d8b4fe] to-[#9333ea]">
      <div className="phone-container">
        <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
          <Outlet />
        </div>
        <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />
      </div>
    </div>
  );
}

