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
    <div className="h-dvh w-full bg-[#f8f6fb] overflow-hidden md:h-auto md:min-h-screen md:flex md:items-center md:justify-center md:p-6 md:bg-gradient-to-br md:from-[#f3e8ff] md:via-[#d8b4fe] md:to-[#9333ea] md:overflow-visible">
      <div className="phone-container">
        <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col overscroll-contain">
          <Outlet />
        </div>
        <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />
      </div>
    </div>
  );
}

