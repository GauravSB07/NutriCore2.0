import React from 'react';
import { Outlet } from 'react-router-dom';

export default function PhoneLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center p-0 md:p-6 bg-gradient-to-br from-[#f3e8ff] via-[#d8b4fe] to-[#9333ea]">
      <div className="phone-container">
        <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
