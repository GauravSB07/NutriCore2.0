import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/images/logo.png';
import welcomeImg from '../assets/images/welcome.jpg';

export default function WelcomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleStartSetup = () => {
    // Navigate to profile or home
    navigate('/', { replace: true });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const username = user?.username || 'Champion';

  return (
    <div className="phone-container glass-phone">
      <div className="scroll flex-1 overflow-y-auto no-scrollbar">
        {/* HERO */}
        <div className="pt-7 px-6 pb-0">
          {/* TOP NAV */}
          <div className="flex justify-between items-center">
            {/* BRAND */}
            <div className="text-[34px] font-extrabold text-[#4c1d95] tracking-[-1px] leading-none">
              Nutr<span className="leaf-i">i</span>Core
            </div>

            {/* LOGO */}
            <div className="w-14 h-14 rounded-[18px] bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.12)] flex items-center justify-center backdrop-blur-[16px] overflow-hidden">
              <img
                src={logoImg}
                alt="NutriCore Logo"
                className="w-7 h-7 object-contain"
              />
            </div>
          </div>

          {/* TAG */}
          <div className="w-max mt-6 px-4 py-2.5 rounded-full bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.14)] text-[#6d28d9] text-[11px] font-bold tracking-[0.6px]">
            ✦ PERSONALIZED FITNESS EXPERIENCE
          </div>

          {/* TITLE */}
          <div className="mt-6 text-[#3b0764] text-[48px] font-extrabold leading-[0.95] tracking-[-2px]">
            Welcome
            <br />
            {username} 🎉
          </div>

          {/* SUB */}
          <div className="mt-[18px] text-[#6b21a8] text-[16px] font-medium leading-[1.8]">
            Let’s setup your fitness profile and personalize your workouts, nutrition, and progress tracking.
          </div>

          {/* IMAGE CARD */}
          <div className="mt-7 relative h-[260px] rounded-[34px] overflow-hidden shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <img
              src={welcomeImg}
              alt="Welcome to NutriCore"
              className="w-full h-full object-cover brightness-[0.76] contrast-[1.05]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/12 to-black/8" />
          </div>
        </div>

        {/* SETUP CARD */}
        <div className="auth-card mx-[18px] mt-6 mb-[30px] p-[28px_24px] text-center">
          <div className="text-[28px] font-extrabold text-[#111827] leading-[1.2]">
            Start Your Journey 🚀
          </div>

          <div className="mt-3 text-[#6b7280] text-[14px] leading-[1.8]">
            Complete your profile setup to unlock personalized meal plans, workouts, reports, and smart fitness tracking.
          </div>

          {/* BUTTON */}
          <button
            type="button"
            onClick={handleStartSetup}
            className="w-full mt-7 p-4 rounded-[22px] bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-white text-[15px] font-bold no-underline shadow-[0_14px_30px_rgba(124,58,237,0.22)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2.5"
          >
            Setup Profile →
          </button>

          <div className="mt-[18px] text-[12px] text-[#9ca3af]">
            Takes less than 2 minutes
          </div>

          {/* LOGOUT OPTION */}
          <div className="mt-6 pt-4 border-t border-purple-100 flex justify-center">
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-[#a78bfa] hover:text-[#7c3aed] font-medium transition cursor-pointer"
            >
              Sign out of {username}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
