import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { progressService } from '../../services/api';

export default function WorkoutReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const weekOffset = parseInt(searchParams.get('week') || searchParams.get('week_offset') || '0', 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchWorkoutReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await progressService.getWorkoutProgress({ week_offset: weekOffset });
      setData(res);
    } catch (err) {
      setError('Unable to load workout balance reports.');
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => {
    fetchWorkoutReports();
  }, [fetchWorkoutReports]);

  const changeWeek = (delta) => {
    const nextOffset = Math.max(0, weekOffset + delta);
    setSearchParams({ week: nextOffset });
  };

  const weekRange = data?.week_range || {};
  const muscleReport = data?.weekly_muscle_report || [];
  const muscleBalance = data?.muscle_balance || {};

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      <div className="px-4 pb-24 pt-4 overflow-y-auto no-scrollbar space-y-6">
        {/* TOP BAR */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex gap-2">
            <Link
              to="/progress/workout"
              className="pill-lavender text-xs font-semibold"
            >
              Overload
            </Link>
            <Link
              to="/progress/workout-charts"
              className="pill-lavender text-xs font-semibold"
            >
              Charts
            </Link>
          </div>

          <button
            type="button"
            onClick={fetchWorkoutReports}
            disabled={loading}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
          </button>
        </div>

        {/* 📋 HEADER CARD */}
        <div className="bg-[#ede9fe] rounded-[22px] p-4 shadow-sm border border-purple-200/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] flex items-center justify-center text-xl text-white shadow-sm flex-shrink-0">
              📋
            </div>

            <div>
              <h2 className="text-base font-bold text-gray-900 m-0">Workout Report</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {weekRange.start_of_week && weekRange.end_of_week
                  ? `${weekRange.start_of_week} → ${weekRange.end_of_week}`
                  : weekOffset === 0
                  ? 'Current Week'
                  : `${weekOffset} week${weekOffset > 1 ? 's' : ''} ago`}
              </p>
            </div>
          </div>
        </div>

        {/* WEEK NAVIGATION */}
        <div className="card-lavender flex justify-between items-center py-2.5">
          <span className="text-xs font-semibold text-gray-600">
            {weekOffset === 0 ? 'Current Week' : `Week Offset: -${weekOffset}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => changeWeek(1)}
              className="pill-lavender cursor-pointer font-medium text-xs"
            >
              ← Previous
            </button>
            {weekOffset > 0 && (
              <button
                type="button"
                onClick={() => changeWeek(-1)}
                className="pill-lavender cursor-pointer font-medium text-xs"
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs">
            {error}
          </div>
        )}

        {/* 🔥 MUSCLE FREQUENCY SECTION */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#4c1d95]">Muscle Frequency</h3>

          {muscleReport.length > 0 ? (
            muscleReport.map((item, idx) => (
              <div
                key={idx}
                className="card-lavender flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{item.muscle}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.current_week || 0} session
                    {(item.current_week || 0) !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 items-end">
                  {/* Frequency Badge */}
                  {(item.current_week || 0) < 2 ? (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#fff7ed] text-[#d97706]">
                      ⚠ Low frequency
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#ecfdf5] text-[#16a34a]">
                      ✔ Good frequency
                    </span>
                  )}

                  {/* Change Badge */}
                  {(item.change || 0) > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-[#ecfdf5] text-[#16a34a]">
                      ⬆ Improved ({item.previous_week || 0} → {item.current_week || 0})
                    </span>
                  ) : (item.change || 0) < 0 ? (
                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-[#fef2f2] text-[#dc2626]">
                      ⬇ Decreased
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-gray-100 text-gray-600">
                      ➡ Same
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="card-lavender text-center py-6 text-xs text-gray-500">
              No muscle frequency recorded this week.
            </div>
          )}
        </div>

        {/* ⚖️ MUSCLE BALANCE SECTION */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#4c1d95]">Muscle Balance</h3>

          {Object.keys(muscleBalance).length > 0 ? (
            Object.entries(muscleBalance).map(([muscle, bData]) => {
              const score = bData.balance_score || 0;
              const missing = bData.missing_sub_muscles || [];
              const circumference = 188.4;
              const offset = circumference - (circumference * score) / 100;

              return (
                <div
                  key={muscle}
                  className="card-lavender flex justify-between items-center"
                >
                  {/* LEFT DETAILS */}
                  <div className="flex-1 pr-3">
                    <p className="font-semibold text-gray-900 text-sm">{muscle}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Balance Score</p>

                    {/* PROGRESS BAR */}
                    <div className="h-1.5 bg-[#ede9fe] rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] transition-all duration-500"
                        style={{ width: `${score}%` }}
                      />
                    </div>

                    <p className="text-xs text-[#7c3aed] font-semibold mt-1">
                      {score}%
                    </p>

                    {missing.length > 0 ? (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded-xl border border-red-100">
                        Missing: {missing.join(', ')}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                        All muscles trained ✔
                      </div>
                    )}
                  </div>

                  {/* RIGHT SVG RING */}
                  <div className="relative w-[70px] h-[70px] flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="35"
                        cy="35"
                        r="30"
                        stroke="#ede9fe"
                        strokeWidth="6"
                        fill="none"
                      />
                      <circle
                        cx="35"
                        cy="35"
                        r="30"
                        stroke="url(#balanceGrad)"
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray="188.4"
                        strokeDashoffset={offset}
                        className="transition-all duration-700"
                      />
                      <defs>
                        <linearGradient id="balanceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#7c3aed" />
                          <stop offset="100%" stopColor="#a78bfa" />
                        </linearGradient>
                      </defs>
                    </svg>

                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-700">
                      {score}%
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="card-lavender text-center py-6 text-xs text-gray-500">
              No balance data available for this week.
            </div>
          )}
        </div>

        {/* 💬 MOTIVATION CARD */}
        <div className="card-lavender flex justify-between items-center">
          <div>
            <p className="font-semibold text-gray-800 text-sm">Keep it up!</p>
            <p className="text-xs text-gray-500 mt-1">
              Focus on missing muscle groups to improve balance.
            </p>
          </div>

          <span className="text-3xl ml-3">✨</span>
        </div>

        {/* FOOTER */}
        {weekRange.end_of_week && (
          <p className="text-[11px] text-gray-400 text-center pb-2">
            Report generated on {weekRange.end_of_week}
          </p>
        )}
      </div>
    </div>
  );
}
