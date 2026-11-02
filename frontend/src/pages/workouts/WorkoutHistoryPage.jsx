import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workoutService } from '../../services/api';
import { ArrowLeft, RefreshCw, AlertCircle, Dumbbell, Calendar, TrendingUp } from 'lucide-react';

export default function WorkoutHistoryPage() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistoryAndSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, histData] = await Promise.all([
        workoutService.getSummary(),
        workoutService.getHistory(),
      ]);
      setSummary(sumData);
      setHistory(Array.isArray(histData) ? histData : histData.results || []);
    } catch (err) {
      console.error('Failed to load workout history/summary', err);
      setError('Unable to load workout history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryAndSummary();
  }, []);

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      {/* 🔙 BACK */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/workouts/start')}
          className="w-10 h-10 rounded-xl bg-[#ede9fe] text-purple-700 flex items-center justify-center font-bold text-lg hover:bg-purple-200 transition cursor-pointer active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-xs text-gray-500 font-semibold tracking-wider">
            WORKOUT LOGS
          </p>
          <h2 className="text-[20px] font-bold text-gray-900 leading-tight">
            History & Summary
          </h2>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchHistoryAndSummary}
            className="underline font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="space-y-3 pt-2">
          <div className="h-28 bg-purple-100 rounded-2xl animate-pulse"></div>
          <div className="h-40 bg-gray-100 rounded-2xl animate-pulse"></div>
        </div>
      )}

      {/* 📊 SUMMARY METRICS */}
      {!loading && summary && (
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex justify-between items-center border-b border-purple-400/50 pb-2.5">
            <div>
              <p className="text-xs text-purple-200 font-medium">Total Volume Lifted</p>
              <h3 className="text-2xl font-black mt-0.5">
                {Math.round(summary.total_weight_volume || 0).toLocaleString()} kg
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
              🏋️
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-white/10 rounded-xl p-2">
              <p className="text-[10px] text-purple-200 font-medium uppercase">Sessions</p>
              <h4 className="text-base font-bold mt-0.5">{summary.total_sessions || 0}</h4>
            </div>

            <div className="bg-white/10 rounded-xl p-2">
              <p className="text-[10px] text-purple-200 font-medium uppercase">Sets</p>
              <h4 className="text-base font-bold mt-0.5">{summary.total_sets || 0}</h4>
            </div>

            <div className="bg-white/10 rounded-xl p-2">
              <p className="text-[10px] text-purple-200 font-medium uppercase">Reps</p>
              <h4 className="text-base font-bold mt-0.5">{summary.total_reps || 0}</h4>
            </div>
          </div>
        </div>
      )}

      {/* 🥩 MUSCLE BREAKDOWN */}
      {!loading && summary?.muscle_groups_breakdown?.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-50 space-y-2.5">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Muscle Focus
          </h4>
          <div className="space-y-1.5">
            {summary.muscle_groups_breakdown.map((m, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-800">{m.muscle_name}</span>
                <span className="text-purple-600 font-medium">{m.sets_count} sets</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📜 RECENT SETS CHRONOLOGICAL HISTORY */}
      <div>
        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
          Activity Log
        </h4>

        {!loading && history.length > 0 ? (
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-purple-50 divide-y divide-gray-100">
            {history.map((item, idx) => (
              <div key={idx} className="py-2.5 first:pt-1 last:pb-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-semibold text-sm text-gray-800">
                      {item.exercise_name}
                    </h5>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {item.muscle_group} • {item.sub_muscle}
                    </p>
                  </div>
                  <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-semibold border border-purple-100">
                    {item.date}
                  </span>
                </div>

                <div className="flex gap-3 text-xs text-gray-600 mt-1.5">
                  <span>Set {item.set_number}</span>
                  <span>•</span>
                  <span>🔁 {item.reps} reps</span>
                  <span>•</span>
                  <span>🏋️ {item.weight} kg</span>
                  <span>•</span>
                  <span className="text-purple-600 font-medium">
                    Vol: {Math.round(item.volume)} kg
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : !loading ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-purple-50 text-gray-400 space-y-1">
            <p className="text-2xl">📋</p>
            <p className="text-xs font-semibold text-gray-600">No workout logs found</p>
            <p className="text-[11px] text-gray-400">
              Start a workout session to see your progress here.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
