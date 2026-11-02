import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Chart } from 'react-chartjs-2';
import '../../components/progress/chartConfig';
import { progressService } from '../../services/api';

export default function MonthlyReportPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchMonthlyReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await progressService.getMonthlyReport();
      setData(res);
    } catch (err) {
      setError('Unable to load monthly progress report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthlyReport();
  }, [fetchMonthlyReport]);

  const progress = data?.progress_percent ?? 0;
  const consistencyDays = data?.consistency_days ?? 0;
  const cheatDays = data?.total_cheat_days ?? 0;
  const streak = data?.streak ?? 0;
  const weeklySummary = data?.weekly_summary || [];
  const targetCalories = data?.target_calories || 2000;

  // 28 days chart labels
  const daysLabels = Array.from({ length: 28 }, (_, i) => String(i + 1));
  const caloriesData = weeklySummary.length > 0
    ? weeklySummary.flatMap((w) => Array(7).fill(w.avg_calories))
    : Array(28).fill(0);
  const proteinData = weeklySummary.length > 0
    ? weeklySummary.flatMap((w) => Array(7).fill(w.avg_protein))
    : Array(28).fill(0);

  const chartData = {
    labels: daysLabels,
    datasets: [
      {
        type: 'bar',
        label: 'Calories',
        data: caloriesData,
        backgroundColor: '#f59e0b',
        borderRadius: 3,
      },
      {
        type: 'bar',
        label: 'Protein',
        data: proteinData,
        backgroundColor: '#8b5cf6',
        borderRadius: 3,
      },
      {
        type: 'line',
        label: 'Target',
        data: daysLabels.map(() => targetCalories),
        borderColor: '#7c3aed',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#4c1d95', font: { family: 'Poppins', size: 11 } },
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
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>

          <h1 className="text-xl font-bold text-[#4c1d95]">Monthly Report 🚀</h1>

          <button
            type="button"
            onClick={fetchMonthlyReport}
            disabled={loading}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
          </button>
        </div>

        {/* REPORT TYPE TABS */}
        <div className="flex justify-around bg-purple-50 p-1.5 rounded-2xl text-xs font-semibold">
          <Link
            to="/progress/daily"
            className="text-gray-600 hover:text-[#7c3aed] px-4 py-1.5 rounded-xl transition"
          >
            Daily
          </Link>
          <Link
            to="/progress/weekly"
            className="text-gray-600 hover:text-[#7c3aed] px-4 py-1.5 rounded-xl transition"
          >
            Weekly
          </Link>
          <span className="bg-[#7c3aed] text-white px-4 py-1.5 rounded-xl shadow-sm">Monthly</span>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs">
            {error}
          </div>
        )}

        {/* 📊 SUMMARY CARD */}
        <div className="bg-white rounded-[20px] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.05)] border border-purple-50">
          <div className="flex justify-between items-center">
            <div className="flex-1 pr-3">
              <strong className="text-gray-900 text-base">Monthly Summary</strong>
              <p className="text-xs text-gray-500 mt-0.5">Keep it up! You're doing great.</p>

              <div className="h-2 bg-[#ddd6fe] rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 font-medium block mt-1">
                {progress}%
              </span>

              <div className="mt-3 text-xs text-gray-600">
                Consistency:{' '}
                <span className="font-bold text-[#7c3aed]">{consistencyDays}</span> days
              </div>

              <div className="text-xs text-gray-600 mt-1">
                Cheat Days:{' '}
                <span className="font-bold text-[#7c3aed]">{cheatDays}</span>
              </div>
            </div>

            {/* STREAK CIRCLE */}
            <div className="w-20 h-20 rounded-full border-[5px] border-[#7c3aed] flex flex-col items-center justify-center text-sm font-semibold text-[#4c1d95] flex-shrink-0 shadow-sm">
              <span>🔥</span>
              <div className="leading-tight font-bold">{streak}</div>
              <small className="text-[10px] text-gray-500 uppercase">Days</small>
            </div>
          </div>
        </div>

        {/* 🗓️ 4-WEEK CARDS CONTAINER */}
        <div className="grid grid-cols-2 gap-3">
          {weeklySummary.length > 0 ? (
            weeklySummary.map((w, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-3.5 text-[13px] shadow-[0_6px_15px_rgba(0,0,0,0.05)] border border-purple-50 hover:-translate-y-0.5 transition-transform"
              >
                <strong className="text-gray-800 text-sm block mb-1">{w.week}</strong>

                <div className="text-gray-600 text-xs space-y-1">
                  <div>Calories: {w.avg_calories || 0} kcal</div>
                  <div>Protein: {w.avg_protein || 0} g</div>

                  <div>
                    Cheat:{' '}
                    {w.cheat_days > 2 ? (
                      <span className="text-red-500 font-semibold">{w.cheat_days} ⚠️</span>
                    ) : (
                      <span className="text-emerald-600 font-semibold">{w.cheat_days} ✅</span>
                    )}
                  </div>

                  <div>
                    Fat Loss:{' '}
                    {w.fat_loss_days >= 5 ? (
                      <span className="text-[#7c3aed] font-bold">{w.fat_loss_days} 🔥</span>
                    ) : (
                      <span className="text-red-500 font-semibold">{w.fat_loss_days}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 bg-white rounded-2xl p-4 text-center text-xs text-gray-500">
              No weekly breakdown data available
            </div>
          )}
        </div>

        {/* 📈 MONTHLY INTAKE CHART */}
        <div className="bg-white rounded-[20px] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.05)] border border-purple-50">
          <strong className="text-[#4c1d95] text-sm block mb-2">Monthly Intake (28 Days)</strong>
          <div className="h-56">
            <Chart type="bar" data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
