import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/api';
import BottomNav from '../../components/common/BottomNav';
import loginFallbackImg from '../../assets/images/login.jpg';
import { ArrowLeft, Edit3, LogOut, ChevronRight, RefreshCw } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(user?.profile || {});

  useEffect(() => {
    let isMounted = true;
    const fetchFreshProfile = async () => {
      try {
        setLoading(true);
        const data = await authService.getMe();
        if (isMounted && data) {
          setProfileData(data.profile || {});
        }
      } catch {
        // Fallback to user from context
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFreshProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'home') {
      navigate('/');
    }
  };

  // Weight progress calculation matching Django profile_view
  const startWeight = profileData.start_weight ? parseFloat(profileData.start_weight) : null;
  const targetWeight = profileData.target_weight ? parseFloat(profileData.target_weight) : null;
  const currentWeight = profileData.weight ? parseFloat(profileData.weight) : null;

  let weightProgress = 0;
  if (startWeight !== null && targetWeight !== null && currentWeight !== null) {
    const total = Math.abs(startWeight - targetWeight);
    const done = Math.abs(startWeight - currentWeight);
    if (total !== 0) {
      weightProgress = Math.min(Math.round((done / total) * 100), 100);
    }
  }

  // Format Goal display
  const goalDisplayMap = {
    fat_loss: 'Fat Loss',
    cut: 'Fat Loss',
    muscle_gain: 'Muscle Gain',
    bulk: 'Muscle Gain',
    maintain: 'Maintain',
  };
  const goalDisplay = goalDisplayMap[profileData.goal] || profileData.goal || '--';

  const avatarUrl = profileData.profile_image || user?.profile?.profile_image || loginFallbackImg;

  return (
    <div className="flex-1 flex flex-col justify-between relative bg-[#f5f3ff]">
      <div className="p-[14px] pb-24 overflow-y-auto no-scrollbar">
        {/* HEADER */}
        <div className="bg-white rounded-[18px] p-[12px_16px] flex justify-between items-center font-medium mb-3 shadow-xs">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-[#5b21b6] font-semibold hover:text-[#7c3aed] transition cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>
          <span className="text-sm font-semibold text-gray-800">My Profile</span>
          <button
            type="button"
            onClick={refreshProfile}
            disabled={loading}
            className="text-gray-400 hover:text-[#7c3aed] transition"
            title="Refresh profile"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
          </button>
        </div>

        {/* MAIN CONTAINER */}
        <div className="bg-gradient-to-br from-[#ffffff] to-[#ede9fe] rounded-[26px] p-[18px] shadow-[0_20px_40px_rgba(124,58,237,0.25)]">
          {/* PROFILE AVATAR & NAME */}
          <div className="flex flex-col items-center justify-center mt-2.5">
            <img
              src={avatarUrl}
              alt={user?.username || 'Profile'}
              className="w-[110px] h-[110px] rounded-full object-cover border-4 border-[#8b5cf6] shadow-md mb-2.5"
            />
            <div className="text-[22px] font-bold text-[#5b21b6] tracking-tight">
              {user?.username || 'User'}
            </div>
            <div className="text-xs text-[#7c3aed] font-medium mt-0.5">
              {user?.email || 'No email registered'}
            </div>
          </div>

          {/* INFO GRID */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-[#ffffff] to-[#ede9fe] p-3.5 rounded-[16px] text-center shadow-[0_10px_20px_rgba(124,58,237,0.15)]">
              <h4 className="text-[12px] font-semibold text-[#7c3aed]">Goal</h4>
              <p className="font-bold text-[17px] text-[#1f2937] mt-0.5">{goalDisplay}</p>
            </div>

            <div className="bg-gradient-to-br from-[#ffffff] to-[#ede9fe] p-3.5 rounded-[16px] text-center shadow-[0_10px_20px_rgba(124,58,237,0.15)]">
              <h4 className="text-[12px] font-semibold text-[#7c3aed]">Height</h4>
              <p className="font-bold text-[17px] text-[#1f2937] mt-0.5">
                {profileData.height ? `${profileData.height} cm` : '--'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-[#ffffff] to-[#ede9fe] p-3.5 rounded-[16px] text-center shadow-[0_10px_20px_rgba(124,58,237,0.15)]">
              <h4 className="text-[12px] font-semibold text-[#7c3aed]">Weight</h4>
              <p className="font-bold text-[17px] text-[#1f2937] mt-0.5">
                {profileData.weight ? `${profileData.weight} kg` : '--'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-[#ffffff] to-[#ede9fe] p-3.5 rounded-[16px] text-center shadow-[0_10px_20px_rgba(124,58,237,0.15)]">
              <h4 className="text-[12px] font-semibold text-[#7c3aed]">Steps Goal</h4>
              <p className="font-bold text-[17px] text-[#1f2937] mt-0.5">
                {profileData.daily_steps_target || '--'}
              </p>
            </div>
          </div>

          {/* WEIGHT CARD */}
          <div className="bg-gradient-to-br from-[#ffffff] to-[#ede9fe] rounded-[18px] p-4 mt-4 shadow-[0_10px_20px_rgba(124,58,237,0.15)]">
            <div className="flex justify-between items-center">
              <b className="text-sm text-gray-800">Progress</b>
              <span className="text-xs font-bold text-[#7c3aed]">{weightProgress}%</span>
            </div>

            <div className="text-[13px] text-gray-400 mt-0.5">
              {startWeight !== null ? `${startWeight} kg` : '--'} →{' '}
              {targetWeight !== null ? `${targetWeight} kg` : '--'}
            </div>

            <div className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#7c3aed] to-[#c084fc] rounded-full transition-all duration-500"
                style={{ width: `${weightProgress}%` }}
              />
            </div>
          </div>

          {/* ACTIONS */}
          <Link to="/profile/edit" className="profile-menu">
            <span className="flex items-center gap-2">
              <Edit3 size={15} />
              <span>Edit Profile</span>
            </span>
            <ChevronRight size={16} />
          </Link>

          <div className="profile-menu opacity-75">
            <span>Workout Plans → Coming Soon</span>
          </div>

          {/* LOGOUT */}
          <div className="mt-[18px] text-center">
            <button
              type="button"
              onClick={handleLogout}
              className="bg-gradient-to-r from-[#ef4444] to-[#f87171] text-white p-[12px_24px] rounded-[14px] border-none font-medium text-sm shadow-[0_8px_18px_rgba(239,68,68,0.3)] hover:opacity-95 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2 mx-auto"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <BottomNav activeTab={activeTab} onSelectTab={handleTabSelect} />
    </div>
  );
}
