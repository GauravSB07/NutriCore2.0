import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/api';
import BottomNav from '../../components/common/BottomNav';
import workoutLibImg from '../../assets/images/workoutlib.png';
import progressImg from '../../assets/images/progressimage.png';
import workoutChartsImg from '../../assets/images/workoutcharts.png';
import loginFallbackImg from '../../assets/images/login.jpg';
import { RefreshCw, AlertCircle, X, ChevronRight } from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('home');
  const [reportRange, setReportRange] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingNotice, setPendingNotice] = useState(null);

  // Metrics state
  const [metrics, setMetrics] = useState({
    calories: 0,
    water: 0,
    protein: 0,
    cheatCount: 0,
    dayType: 'Undereaten',
    goodDay: false,
    steps: 0,
    stepsTarget: 8000,
    points: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Execute parallel calls to backend REST APIs
      const [nutritionSummary, progressDaily, cheatStatus] = await Promise.allSettled([
        dashboardService.getNutritionSummary(),
        dashboardService.getProgressDaily(),
        dashboardService.getCheatStatus(),
      ]);

      const nutData = nutritionSummary.status === 'fulfilled' ? nutritionSummary.value : null;
      const progData = progressDaily.status === 'fulfilled' ? progressDaily.value : null;
      const cheatData = cheatStatus.status === 'fulfilled' ? cheatStatus.value : null;

      // Extract values with exact fallbacks matching Django business logic
      const totalCalories =
        nutData?.calories?.consumed ?? progData?.nutrition?.total_calories ?? 0;
      const totalWater =
        nutData?.water_summary?.total_consumed_ml ?? progData?.water?.total_water_ml ?? 0;
      const totalProtein =
        nutData?.macronutrients?.protein?.consumed ?? progData?.nutrition?.total_protein ?? 0;
      const cheatCount =
        cheatData?.today_cheat_meals ?? nutData?.cheat_summary?.cheat_meals_count ?? 0;
      const dayType =
        progData?.nutrition?.day_type ||
        (user?.profile?.goal === 'fat_loss' || user?.profile?.goal === 'cut'
          ? (totalCalories <= (user?.profile?.daily_calorie_target || 2000) ? 'Good (Fat Loss)' : 'Overeaten')
          : (totalCalories >= (user?.profile?.daily_calorie_target || 2000) ? 'Good (Bulk)' : 'Undereaten'));
      const goodDay = progData?.nutrition?.good_day ?? (dayType.startsWith('Good'));
      const totalSteps = progData?.steps?.total_steps ?? 0;
      const stepsTarget = progData?.steps?.daily_steps_target || user?.profile?.daily_steps_target || 8000;
      const points = cheatData?.points ?? user?.profile?.points ?? 0;

      setMetrics({
        calories: Math.round(totalCalories),
        water: Math.round(totalWater),
        protein: Math.round(totalProtein),
        cheatCount,
        dayType,
        goodDay,
        steps: totalSteps,
        stepsTarget,
        points,
      });
    } catch (err) {
      setError('Unable to load latest dashboard statistics.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handlePendingFeature = (featureName) => {
    setPendingNotice(`${featureName} module will be activated in upcoming migration steps.`);
  };

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'home') {
      // already on home
    } else if (tabId === 'profile') {
      navigate('/profile');
    } else if (tabId === 'nutrition') {
      navigate('/nutrition/meals');
    } else if (tabId === 'workouts') {
      navigate('/workouts/start');
    } else if (tabId === 'progress') {
      navigate('/progress');
    } else if (tabId === 'recipes') {
      navigate('/recipes');
    } else {
      handlePendingFeature(tabId.charAt(0).toUpperCase() + tabId.slice(1));
    }
  };

  const profileImg = user?.profile?.profile_image || loginFallbackImg;

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      <div className="px-4 pt-4 pb-24 overflow-y-auto no-scrollbar">
        {/* 🔝 HEADER */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="relative group">
              <img
                src={profileImg}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover border-2 border-[#7c3aed] shadow-sm transition group-hover:scale-105"
              />
            </Link>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 leading-tight">
                Hello, {user?.username || 'Champion'} 🙋
              </h2>
              <p className="text-xs text-gray-400">Welcome to NutriCore</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDashboardData}
              disabled={loading}
              title="Refresh statistics"
              className="p-1.5 rounded-full text-gray-400 hover:text-[#7c3aed] hover:bg-purple-50 transition"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
            </button>
            <div className="px-2.5 py-1 rounded-full bg-[#ede9fe] text-[#7c3aed] text-xs font-semibold flex items-center gap-1 border border-[#c084fc]/30">
              <span>🌟</span>
              <span>{metrics.points} Points</span>
            </div>
          </div>
        </div>

        {/* PENDING NOTIFICATION BANNER */}
        {pendingNotice && (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 text-[#4c1d95] rounded-2xl text-xs flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-sm">📌</span>
              <span>{pendingNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setPendingNotice(null)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ERROR STATE BANNER */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="text-xs font-semibold text-red-800 underline ml-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* 🔥 MAIN STATS */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div
            className="gradient-card"
            style={{ background: 'linear-gradient(135deg, #ff7eb3, #8b5cf6)' }}
          >
            <p className="text-sm opacity-90">🔥 Calories</p>
            <h2 className="text-2xl font-semibold mt-0.5">
              {loading ? '--' : metrics.calories}
            </h2>
            <p className="text-xs opacity-80">kcal</p>
          </div>

          <div
            className="gradient-card"
            style={{ background: 'linear-gradient(135deg, #60a5fa, #8b5cf6)' }}
          >
            <p className="text-sm opacity-90">💧 Water</p>
            <h2 className="text-2xl font-semibold mt-0.5">
              {loading ? '--' : metrics.water}
            </h2>
            <p className="text-xs opacity-80">ml</p>
          </div>
        </div>

        {/* 🧊 SMALL STATS */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="premium-card text-center">
            <p className="text-xs text-gray-500">Protein</p>
            <h3 className="font-semibold text-lg text-gray-800 mt-0.5">
              {loading ? '--' : metrics.protein}
            </h3>
            <p className="text-[11px] text-gray-400">grams</p>
          </div>

          <div className="premium-card text-center">
            <p className="text-xs text-gray-500">Cheat Meal Count</p>
            <h3 className="font-semibold text-lg text-gray-800 mt-0.5">
              {loading ? '--' : metrics.cheatCount}
            </h3>
            <p className="text-[11px] text-gray-400">today</p>
          </div>

          <div className="premium-card text-center flex flex-col justify-center">
            <p className="text-xs text-gray-500 mb-1">Status</p>
            {metrics.goodDay ? (
              <p className="text-emerald-500 font-semibold text-xs leading-tight">
                {metrics.dayType}
              </p>
            ) : (
              <p className="text-rose-500 font-semibold text-xs leading-tight">
                {metrics.dayType}
              </p>
            )}
          </div>
        </div>

        {/* 🍽️ NUTRITION */}
        <h3 className="font-semibold text-gray-600 mb-2 flex items-center gap-1.5 text-sm">
          <span>🥗</span>
          <span>Nutrition</span>
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => navigate('/nutrition/log')}
            className="premium-card text-center cursor-pointer hover:border-[#7c3aed]/40"
          >
            <p className="text-sm font-medium text-gray-800">✎ Log Meal</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/nutrition/water')}
            className="premium-card text-center cursor-pointer hover:border-[#7c3aed]/40"
          >
            <p className="text-sm font-medium text-gray-800">🫗 Water Intake</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/nutrition/meals')}
            className="premium-card text-center cursor-pointer hover:border-[#7c3aed]/40"
          >
            <p className="text-sm font-medium text-gray-800">🍴 Meals</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/nutrition/foods')}
            className="premium-card text-center cursor-pointer hover:border-[#7c3aed]/40"
          >
            <p className="text-sm font-medium text-gray-800">🍵 Food Library</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/recipes')}
            className="premium-card text-center col-span-2 cursor-pointer hover:border-[#7c3aed]/40"
          >
            <p className="text-sm font-medium text-gray-800">🍳 Recipe Library</p>
          </button>
        </div>

        {/* 💪 WORKOUT */}
        <h3 className="font-semibold text-gray-600 mb-2 flex items-center gap-1.5 text-sm">
          <span>🏋️</span>
          <span>Workout</span>
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* WORKOUT LIBRARY */}
          <button
            type="button"
            onClick={() => navigate('/workouts/start')}
            className="premium-card flex flex-col justify-between text-left cursor-pointer"
          >
            <div>
              <h3 className="text-base font-semibold text-gray-800 mt-1">Workout Library</h3>
            </div>
            <div className="mt-3 flex justify-center">
              <img src={workoutLibImg} alt="Workout Library" className="h-16 object-contain" />
            </div>
          </button>

          {/* 🚶 STEPS CARD */}
          <button
            type="button"
            onClick={() => navigate('/progress/steps')}
            className="premium-card flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500">Steps</p>
                <h2 className="text-2xl font-bold text-gray-800 mt-0.5">
                  {loading ? '--' : metrics.steps.toLocaleString()}
                </h2>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-100 text-[#7c3aed] flex items-center justify-center text-sm font-bold shadow-sm">
                →
              </div>
            </div>

            {/* mini bars */}
            <div className="mt-5 flex items-end justify-between gap-1 h-14">
              <div className="w-2 bg-purple-300 rounded-full h-5"></div>
              <div className="w-2 bg-purple-400 rounded-full h-9"></div>
              <div className="w-2 bg-purple-500 rounded-full h-7"></div>
              <div className="w-2 bg-purple-300 rounded-full h-11"></div>
              <div className="w-2 bg-purple-400 rounded-full h-6"></div>
              <div className="w-2 bg-purple-500 rounded-full h-13"></div>
              <div className="w-2 bg-purple-300 rounded-full h-8"></div>
              <div className="w-2 bg-purple-400 rounded-full h-14"></div>
              <div className="w-2 bg-purple-500 rounded-full h-10"></div>
            </div>
          </button>

          {/* 📈 MUSCLE REPORTS */}
          <button
            type="button"
            onClick={() => navigate('/progress/muscle-reports')}
            className="premium-card col-span-2 text-left cursor-pointer p-2"
          >
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-sm font-semibold text-white">Muscle Reports</p>
                <p className="text-xs text-white/80">Track balance & strength</p>
              </div>
              <div className="w-8 h-8 bg-white/30 backdrop-blur rounded-full flex items-center justify-center text-white text-xs">
                <ChevronRight size={16} />
              </div>
            </div>
          </button>

          {/* MUSCLE PROGRESS */}
          <button
            type="button"
            onClick={() => navigate('/progress/workout')}
            className="premium-card flex flex-col justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-xs text-gray-500">Muscle Progress</p>
            </div>
            <div className="mt-3 flex justify-center">
              <img src={progressImg} alt="Progress" className="h-16 object-contain" />
            </div>
          </button>

          {/* WORKOUT CHARTS */}
          <button
            type="button"
            onClick={() => navigate('/progress/workout-charts')}
            className="premium-card flex flex-col justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-xs text-gray-500">Workout Charts</p>
            </div>
            <div className="mt-3 flex justify-center">
              <img src={workoutChartsImg} alt="Charts" className="h-16 object-contain" />
            </div>
          </button>
        </div>


        {/* 📊 REPORTS */}
        <h3 className="font-semibold text-gray-600 mb-2 flex items-center gap-1.5 text-sm">
          <span>📝</span>
          <span>Reports</span>
        </h3>

        <div className="premium-card flex justify-around text-xs p-1.5 mb-2">
          <button
            type="button"
            onClick={() => navigate('/progress/daily')}
            className="px-4 py-1.5 rounded-full transition cursor-pointer font-medium text-gray-600 hover:text-[#7c3aed] hover:bg-purple-50"
          >
            Daily
          </button>

          <button
            type="button"
            onClick={() => navigate('/progress/weekly')}
            className="px-4 py-1.5 rounded-full transition cursor-pointer font-medium text-gray-600 hover:text-[#7c3aed] hover:bg-purple-50"
          >
            Weekly
          </button>

          <button
            type="button"
            onClick={() => navigate('/progress/monthly')}
            className="px-4 py-1.5 rounded-full transition cursor-pointer font-medium text-gray-600 hover:text-[#7c3aed] hover:bg-purple-50"
          >
            Monthly
          </button>
        </div>
      </div>

      {/* FLOATING ACTION BUTTON (+) */}
      <div className="fab-container">
        <button
          type="button"
          onClick={() => navigate('/nutrition/log')}
          aria-label="Add new log"
          className="w-14 h-14 flex items-center justify-center bg-gradient-to-r from-purple-500 to-purple-600 text-white text-2xl rounded-full shadow-lg transition transform hover:scale-110 active:scale-95 cursor-pointer focus:outline-none"
        >
          +
        </button>
      </div>

      {/* BOTTOM NAVIGATION */}
      <BottomNav activeTab={activeTab} onSelectTab={handleTabSelect} />
    </div>
  );
}
