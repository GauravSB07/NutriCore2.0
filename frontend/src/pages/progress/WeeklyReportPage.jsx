import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import '../../components/progress/chartConfig';
import { progressService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import weeklyReportImg from '../../assets/images/weeklyreport.webp';

export default function WeeklyReportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const weekOffset = parseInt(searchParams.get('week_offset') || searchParams.get('week') || '0', 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchWeeklyReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await progressService.getWeeklyReport({ week_offset: weekOffset });
      setData(res);
    } catch (err) {
      setError('Unable to load weekly report.');
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => {
    fetchWeeklyReport();
  }, [fetchWeeklyReport]);

  const changeWeek = (delta) => {
    const nextOffset = Math.max(0, weekOffset + delta);
    setSearchParams({ week_offset: nextOffset });
  };

  const progressPercent = data?.progress_percent ?? 0;
  const streak = data?.streak ?? 0;
  const labels = data?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dailyBreakdown = data?.daily_breakdown || [];

  const calories = dailyBreakdown.map((d) => d.calories);
  const protein = dailyBreakdown.map((d) => d.protein);

  // SVG Ring calculation matching Django math.pi * 2 * 40 ~= 251.3
  const circumference = 251.32;
  const ringOffset = circumference * (1 - Math.min(progressPercent, 100) / 100);

  const barChartData = {
    labels,
    datasets: [
      {
        label: 'Calories',
        data: calories.length ? calories : [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: '#7c3aed',
        borderRadius: 4,
      },
      {
        label: 'Protein',
        data: protein.length ? protein : [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: '#60a5fa',
        borderRadius: 4,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#4c1d95',
          font: { family: 'Poppins', size: 12 },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(124, 58, 237, 0.08)' } },
    },
  };

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      <div className="px-4 pb-24 pt-4 overflow-y-auto no-scrollbar space-y-5">
        {/* TOP BAR */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Weekly Report ⇡</h2>
              <p className="text-xs text-gray-500">Your weekly fitness overview</p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchWeeklyReport}
            disabled={loading}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
          </button>
        </div>

        {/* WEEK NAVIGATION */}
        <div className="card-lavender flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">Period</p>
            <p className="text-sm font-semibold text-gray-800">
              {data?.start_date && data?.end_date
                ? `${data.start_date} → ${data.end_date}`
                : weekOffset === 0
                ? 'Current Week'
                : `${weekOffset} week${weekOffset > 1 ? 's' : ''} ago`}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => changeWeek(1)}
              className="pill-lavender cursor-pointer font-medium"
            >
              ← Prev
            </button>
            {weekOffset > 0 && (
              <button
                type="button"
                onClick={() => changeWeek(-1)}
                className="pill-lavender cursor-pointer font-medium"
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {/* REPORT TYPE TABS */}
        <div className="flex justify-around bg-purple-50 p-1.5 rounded-2xl text-xs font-semibold">
          <Link
            to="/progress/daily"
            className="text-gray-600 hover:text-[#7c3aed] px-4 py-1.5 rounded-xl transition"
          >
            Daily
          </Link>
          <span className="bg-[#7c3aed] text-white px-4 py-1.5 rounded-xl shadow-sm">Weekly</span>
          <Link
            to="/progress/monthly"
            className="text-gray-600 hover:text-[#7c3aed] px-4 py-1.5 rounded-xl transition"
          >
            Monthly
          </Link>
        </div>

        {/* 👋 GREETING */}
        <h3 className="text-sm font-semibold text-gray-700">
          Hello, {user?.username || 'Champion'} 👋
        </h3>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs">
            {error}
          </div>
        )}

        {/* 📊 PROGRESS & STREAK CARD */}
        <div className="card-lavender flex justify-between items-center">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-gray-700">
              Progress:{' '}
              <span className="text-[#7c3aed] font-semibold">
                {Math.round(progressPercent)}%
              </span>
            </p>

            <p className="text-xs text-gray-500 mt-1">Keep it up! You're doing great.</p>

            <div className="h-2 bg-[#ede9fe] rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] transition-all duration-500"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>

            <div className="text-xs text-[#7c3aed] font-semibold mt-1">
              {Math.round(progressPercent)}%
            </div>
          </div>

          {/* 🔥 STREAK RING */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-24 h-24 -rotate-90">
              {/* background */}
              <circle cx="48" cy="48" r="40" stroke="#ede9fe" strokeWidth="6" fill="none" />
              {/* progress */}
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="#7c3aed"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="251.32"
                strokeDashoffset={ringOffset}
                className="transition-all duration-700"
              />
            </svg>

            {/* center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-sm font-semibold text-purple-700">
              <span>🔥</span>
              <div className="font-bold">{streak}</div>
              <span className="text-[10px] text-gray-500 uppercase">Days</span>
            </div>
          </div>
        </div>

        {/* 💬 MOTIVATION CARD */}
        <div className="card-lavender flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">You’ve got this! 💪</p>
            <p className="text-xs text-gray-500 mt-1">Small steps every day lead to big changes.</p>
          </div>

          <img
            src={weeklyReportImg}
            alt="Weekly Motivation"
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
            loading="lazy"
            decoding="async"
            width={80}
            height={80}
          />
        </div>

        {/* 📊 FITNESS ACTIVITY CHART */}
        <div className="card-lavender">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm text-gray-800">Fitness Activity (7 Days)</h3>
            <div className="chip-lavender">7 Days</div>
          </div>

          <div className="h-56">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>

        {/* 📋 DAILY BREAKDOWN LIST */}
        {dailyBreakdown.length > 0 && (
          <div className="card-lavender">
            <h3 className="font-semibold text-sm text-gray-800 mb-3">Daily Breakdown</h3>
            <div className="divide-y divide-purple-100">
              {dailyBreakdown.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-semibold text-gray-800 mr-2">{item.day}</span>
                    <span className="text-gray-400">{item.date}</span>
                    {item.is_cheat_day && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold text-[10px]">
                        Cheat Day
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-purple-700">{item.calories} kcal</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-blue-600 font-medium">{item.protein}g</span>
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
