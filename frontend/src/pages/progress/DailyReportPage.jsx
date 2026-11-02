import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, PlusCircle, RefreshCw } from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import '../../components/progress/chartConfig';
import { progressService } from '../../services/api';

export default function DailyReportPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchDailyReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await progressService.getDailyProgress(dateParam);
      setData(res);
    } catch (err) {
      setError('Unable to load daily report for the selected date.');
    } finally {
      setLoading(false);
    }
  }, [dateParam]);

  useEffect(() => {
    fetchDailyReport();
  }, [fetchDailyReport]);

  const changeDate = (days) => {
    const current = new Date(dateParam);
    current.setDate(current.getDate() + days);
    const newDateStr = current.toISOString().split('T')[0];
    setSearchParams({ date: newDateStr });
  };

  const isToday = dateParam === new Date().toISOString().split('T')[0];

  // Helper chart configurations matching Django template
  const waveOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
  };

  const caloriesWaveData = {
    labels: [1, 2, 3, 4, 5, 6, 7],
    datasets: [
      {
        data: [5, 8, 6, 9, 7, 10, 8],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        tension: 0.4,
        fill: true,
        pointRadius: 0,
      },
    ],
  };

  const proteinWaveData = {
    labels: [1, 2, 3, 4, 5, 6, 7],
    datasets: [
      {
        data: [4, 7, 5, 8, 6, 9, 7],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        tension: 0.4,
        fill: true,
        pointRadius: 0,
      },
    ],
  };

  const stepsBarData = {
    labels: [1, 2, 3, 4, 5, 6],
    datasets: [
      {
        data: [3, 6, 4, 8, 5, 9],
        backgroundColor: '#8b5cf6',
        borderRadius: 6,
      },
    ],
  };

  // Metrics extracted from backend response
  const totalCalories = data?.nutrition?.total_calories ?? 0;
  const totalProtein = data?.nutrition?.total_protein ?? 0;
  const caloriesLeft = data?.nutrition?.calories_left ?? 0;
  const proteinLeft = data?.nutrition?.protein_left ?? 0;
  const calorieTarget = data?.nutrition?.calorie_target || 2000;
  const proteinTarget = data?.nutrition?.protein_target || 80;
  const dayType = data?.nutrition?.day_type || 'Undereaten';
  const goodDay = data?.nutrition?.good_day ?? false;

  const totalSteps = data?.steps?.total_steps ?? 0;
  const stepsLeft = data?.steps?.steps_left ?? 0;
  const stepsPercent = data?.steps?.steps_percent ?? 0;

  // Ring calculations
  const calPercent = Math.min(100, Math.max(0, Math.round((totalCalories / calorieTarget) * 100)));
  const proteinPercent = Math.min(100, Math.max(0, Math.round((totalProtein / proteinTarget) * 100)));

  const calRingData = {
    datasets: [
      {
        data: [calPercent, Math.max(0, 100 - calPercent)],
        backgroundColor: ['#8b5cf6', '#eee'],
        borderWidth: 0,
      },
    ],
  };

  const proteinRingData = {
    datasets: [
      {
        data: [proteinPercent, Math.max(0, 100 - proteinPercent)],
        backgroundColor: ['#8b5cf6', '#eee'],
        borderWidth: 0,
      },
    ],
  };

  const ringOptions = {
    cutout: '70%',
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      <div className="px-4 pt-4 pb-24 overflow-y-auto no-scrollbar space-y-4">
        {/* TOP NAVIGATION & HEADER */}
        <div className="flex items-center justify-between mb-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-800">Daily Report</h2>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="28"
              viewBox="0 -960 960 960"
              width="28"
              fill="#EA33F7"
            >
              <path d="m296-329.33 122-122 80 80L646.67-519v72.33h66.66v-186.66H526.67v66.66H599l-101 101-80-80L249.33-376 296-329.33ZM186.67-120q-27 0-46.84-19.83Q120-159.67 120-186.67v-586.66q0-27 19.83-46.84Q159.67-840 186.67-840h586.66q27 0 46.84 19.83Q840-800.33 840-773.33v586.66q0 27-19.83 46.84Q800.33-120 773.33-120H186.67Zm0-66.67h586.66v-586.66H186.67v586.66Z" />
            </svg>
          </div>

          <button
            type="button"
            onClick={fetchDailyReport}
            disabled={loading}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
          </button>
        </div>

        {/* DATE SELECTOR BAR */}
        <div className="bg-white rounded-2xl p-2.5 shadow-sm flex items-center justify-between border border-purple-100">
          <button
            type="button"
            onClick={() => changeDate(-1)}
            className="p-1.5 rounded-xl hover:bg-purple-50 text-purple-700 transition cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[#7c3aed]" />
            <span className="text-sm font-semibold text-gray-800">
              {isToday ? `Today (${dateParam})` : dateParam}
            </span>
          </div>

          <button
            type="button"
            onClick={() => changeDate(1)}
            className="p-1.5 rounded-xl hover:bg-purple-50 text-purple-700 transition cursor-pointer"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* REPORT TYPE QUICK TABS */}
        <div className="flex justify-around bg-purple-50 p-1.5 rounded-2xl text-xs font-semibold">
          <span className="bg-[#7c3aed] text-white px-4 py-1.5 rounded-xl shadow-sm">Daily</span>
          <Link
            to="/progress/weekly"
            className="text-gray-600 hover:text-[#7c3aed] px-4 py-1.5 rounded-xl transition"
          >
            Weekly
          </Link>
          <Link
            to="/progress/monthly"
            className="text-gray-600 hover:text-[#7c3aed] px-4 py-1.5 rounded-xl transition"
          >
            Monthly
          </Link>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs">
            {error}
          </div>
        )}

        {/* 2-COLUMN METRIC GRID */}
        <div className="grid grid-cols-2 gap-4">
          {/* 🔥 CALORIES (WAVE) */}
          <div className="bg-white rounded-2xl p-4 shadow">
            <p className="text-sm text-gray-500">Calories</p>
            <h2 className="text-2xl font-bold text-gray-800">
              {loading ? '--' : Number(totalCalories).toFixed(1)}
            </h2>
            <p className="text-xs text-gray-400">kcal</p>
            <div className="mt-3 h-16">
              <Line data={caloriesWaveData} options={waveOptions} />
            </div>
          </div>

          {/* 💪 PROTEIN (WAVE) */}
          <div className="bg-white rounded-2xl p-4 shadow">
            <p className="text-sm text-gray-500">Protein</p>
            <h2 className="text-2xl font-bold text-gray-800">
              {loading ? '--' : Number(totalProtein).toFixed(2)}
            </h2>
            <p className="text-xs text-gray-400">g</p>
            <div className="mt-3 h-16">
              <Line data={proteinWaveData} options={waveOptions} />
            </div>
          </div>

          {/* 🔥 CALORIES LEFT (RING) */}
          <div className="bg-white rounded-2xl p-4 shadow text-center flex flex-col items-center">
            <p className="text-sm text-gray-500">Calories Left</p>
            <h2 className="text-xl font-bold text-gray-800">
              {loading ? '--' : Number(caloriesLeft).toFixed(1)}
            </h2>
            <div className="mt-3 w-20 h-20 flex items-center justify-center">
              <Doughnut data={calRingData} options={ringOptions} />
            </div>
          </div>

          {/* 💪 PROTEIN LEFT (RING) */}
          <div className="bg-white rounded-2xl p-4 shadow text-center flex flex-col items-center">
            <p className="text-sm text-gray-500">Protein Left</p>
            <h2 className="text-xl font-bold text-gray-800">
              {loading ? '--' : Number(proteinLeft).toFixed(2)}
            </h2>
            <div className="mt-3 w-20 h-20 flex items-center justify-center">
              <Doughnut data={proteinRingData} options={ringOptions} />
            </div>
          </div>

          {/* 🚶 STEPS (BARS) */}
          <div className="bg-white rounded-2xl p-4 shadow flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">Steps</p>
                <Link
                  to="/progress/steps"
                  className="text-xs text-[#7c3aed] font-medium flex items-center gap-1 hover:underline"
                >
                  <PlusCircle size={12} /> Log
                </Link>
              </div>

              <h2 className="text-2xl font-bold text-gray-800">
                {loading ? '--' : totalSteps.toLocaleString()}
              </h2>

              <p className="text-xs text-gray-400">{stepsLeft.toLocaleString()} left</p>

              {/* Progress Bar */}
              <div className="mt-2 w-full bg-gray-200 h-2 rounded-full">
                <div
                  className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stepsPercent, 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-3 h-16">
              <Bar data={stepsBarData} options={waveOptions} />
            </div>
          </div>

          {/* ❤️ STATUS */}
          <div className="bg-white rounded-2xl p-4 shadow flex flex-col justify-between">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <h2
                className={`text-lg font-bold mt-1 ${
                  goodDay ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {dayType}
              </h2>
              {goodDay && (
                <p className="text-[11px] text-purple-600 mt-1 font-medium">
                  +50 Points earned!
                </p>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <div className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center text-xl shadow-md">
                ⭐
              </div>
            </div>
          </div>
        </div>

        {/* QUICK LINK TO LOG STEPS */}
        <div className="mt-4">
          <Link
            to="/progress/steps"
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition"
          >
            <span>🚶</span>
            <span>Update Daily Steps Tracker</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
