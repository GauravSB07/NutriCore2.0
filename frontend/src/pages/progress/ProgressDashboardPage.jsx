import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  TrendingUp,
  Calendar,
  BarChart2,
  PieChart,
  Scale,
  Footprints,
  Dumbbell,
  Award,
  ChevronRight,
  RefreshCw,
  Flame,
} from 'lucide-react';
import { progressService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ProgressDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);

  const fetchSummaryData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, historyRes] = await Promise.allSettled([
        progressService.getSummary(),
        progressService.getHistory(),
      ]);

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value);
      }
      if (historyRes.status === 'fulfilled') {
        const histData = historyRes.value;
        setHistory(Array.isArray(histData) ? histData : histData.results || []);
      }
    } catch (err) {
      setError('Unable to load progress summary dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummaryData();
  }, [fetchSummaryData]);

  const handleTabSelect = (tabId) => {
    if (tabId === 'home') navigate('/');
    else if (tabId === 'nutrition') navigate('/nutrition/meals');
    else if (tabId === 'workouts') navigate('/workouts/start');
    else if (tabId === 'progress') navigate('/progress');
    else if (tabId === 'recipes') navigate('/recipes');
  };

  const nutritionSum = summary?.nutrition_summary || {};
  const workoutSum = summary?.workout_summary || {};
  const stepsSum = summary?.steps_summary || {};
  const weightSum = summary?.weight_summary || {};

  const modules = [
    {
      title: 'Daily Report',
      description: 'Calories, protein, and daily goal status',
      icon: Calendar,
      color: 'from-purple-500 to-indigo-500',
      path: '/progress/daily',
    },
    {
      title: 'Weekly Report',
      description: '7-day overview, streak, and activity bars',
      icon: BarChart2,
      color: 'from-violet-500 to-purple-600',
      path: '/progress/weekly',
    },
    {
      title: 'Monthly Report',
      description: '4-week breakdown and 28-day trends',
      icon: PieChart,
      color: 'from-amber-500 to-rose-500',
      path: '/progress/monthly',
    },
    {
      title: 'Steps Tracker',
      description: 'Daily step goals and quick logging',
      icon: Footprints,
      color: 'from-emerald-500 to-teal-600',
      path: '/progress/steps',
    },
    {
      title: 'Weight & Body',
      description: 'Goal progression, BMI, and weight logs',
      icon: Scale,
      color: 'from-blue-500 to-indigo-600',
      path: '/progress/weight',
    },
    {
      title: 'Workout Overload',
      description: 'Weight progression and strength growth',
      icon: Dumbbell,
      color: 'from-purple-600 to-pink-500',
      path: '/progress/workout',
    },
    {
      title: 'Muscle Balance',
      description: 'Targeted vs missing sub-muscles',
      icon: Award,
      color: 'from-purple-700 to-purple-900',
      path: '/progress/muscle-reports',
    },
    {
      title: 'Workout Charts',
      description: 'Interactive timelines & muscle frequencies',
      icon: TrendingUp,
      color: 'from-fuchsia-600 to-purple-700',
      path: '/progress/workout-charts',
    },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      <div className="px-4 pb-28 pt-4 overflow-y-auto no-scrollbar space-y-5">
        {/* TOP HEADER */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Progress Hub 📈</h1>
            <p className="text-xs text-gray-500">Track your fitness journey & results</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSummaryData}
              disabled={loading}
              className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
            </button>

            <div className="px-3 py-1 rounded-full bg-[#ede9fe] text-[#7c3aed] text-xs font-semibold flex items-center gap-1 border border-purple-200">
              <Award size={14} />
              <span>{summary?.profile?.points ?? user?.profile?.points ?? 0} pts</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs">
            {error}
          </div>
        )}

        {/* 🌟 LIFETIME SUMMARY CARD */}
        <div className="bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] rounded-[24px] p-5 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="text-xs text-purple-200 uppercase tracking-wider font-medium">
                  Lifetime Milestones
                </p>
                <h2 className="text-xl font-bold mt-0.5">
                  {user?.username || 'Champion'}'s Progress
                </h2>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-lg">
                🔥
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/20 text-center">
              <div>
                <p className="text-lg font-extrabold">{workoutSum.total_sessions ?? 0}</p>
                <p className="text-[10px] text-purple-200 uppercase">Workouts</p>
              </div>
              <div>
                <p className="text-lg font-extrabold">{nutritionSum.days_tracked ?? 0}</p>
                <p className="text-[10px] text-purple-200 uppercase">Days</p>
              </div>
              <div>
                <p className="text-lg font-extrabold">
                  {Math.round((stepsSum.total_steps || 0) / 1000)}k
                </p>
                <p className="text-[10px] text-purple-200 uppercase">Steps</p>
              </div>
              <div>
                <p className="text-lg font-extrabold">
                  {weightSum.current_weight != null ? `${weightSum.current_weight}k` : '--'}
                </p>
                <p className="text-[10px] text-purple-200 uppercase">Weight</p>
              </div>
            </div>
          </div>
        </div>

        {/* 🚀 QUICK ACCESS MODULE GRID */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
            Reports & Analytics
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.title}
                  type="button"
                  onClick={() => navigate(m.path)}
                  className="card-lavender text-left flex flex-col justify-between p-3.5 cursor-pointer hover:border-[#7c3aed]/40 transition group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${m.color} text-white flex items-center justify-center shadow-xs`}
                    >
                      <Icon size={18} />
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-400 group-hover:text-[#7c3aed] transition-colors"
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-800">{m.title}</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1 leading-tight">
                      {m.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 📅 RECENT DAILY LOGS */}
        {history.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Recent Daily Activity
              </h2>
              <Link to="/progress/daily" className="text-xs text-[#7c3aed] font-medium hover:underline">
                View Today
              </Link>
            </div>

            <div className="space-y-2">
              {history.slice(0, 5).map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate(`/progress/daily?date=${item.date}`)}
                  className="bg-white rounded-2xl p-3 shadow-xs border border-purple-50 flex justify-between items-center cursor-pointer hover:border-purple-200 transition"
                >
                  <div>
                    <span className="font-semibold text-gray-800 text-xs">{item.date}</span>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                      <span>{Math.round(item.nutrition?.total_calories || 0)} kcal</span>
                      <span>•</span>
                      <span>{(item.steps?.total_steps || 0).toLocaleString()} steps</span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        item.nutrition?.good_day
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {item.nutrition?.day_type || 'Tracked'}
                    </span>
                    <ChevronRight size={14} className="text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
