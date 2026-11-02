import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { nutritionService } from '../../services/api';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

export default function WaterPage() {
  const navigate = useNavigate();

  const [totalWater, setTotalWater] = useState(0);
  const [goal, setGoal] = useState(3000);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const fetchWater = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await nutritionService.getWater();
      setTotalWater(data.total_consumed_ml || 0);
      setGoal(data.daily_goal_ml || 3000);
    } catch (err) {
      console.error('Failed to load water intake', err);
      setError('Unable to load water intake data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWater();
  }, [fetchWater]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2500);
  };

  const handleLogAmount = async (amount) => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await nutritionService.logWater(amt);
      if (res.daily_total_ml !== undefined) {
        setTotalWater(res.daily_total_ml);
      } else {
        fetchWater();
      }
      showToast(`💧 +${amt} ml added`);
      setCustomAmount('');
    } catch (err) {
      setError('Failed to log water intake.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customAmount) return;
    handleLogAmount(customAmount);
  };

  const progressPercent = goal > 0 ? (totalWater / goal) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));
  const waveLevel = 100 - clampedPercent;

  return (
    <div className="px-4 pt-4 pb-20 space-y-5">
      {/* Top back link */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-xs font-medium text-gray-500">Back</span>
      </div>

      {/* ERROR */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={fetchWater} className="underline font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* 💧 HEADER BANNER */}
      <div className="relative rounded-3xl p-5 overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg flex justify-between items-center">
        {/* LEFT TEXT */}
        <div>
          <h2 className="text-xl font-semibold">💧 Stay Hydrated</h2>
          <p className="text-sm opacity-90">Track your water intake</p>

          <div className="flex gap-6 mt-4 text-sm">
            <div>
              <p className="opacity-80">Goal</p>
              <h3 className="text-lg font-bold">{goal} ml</h3>
            </div>
            <div>
              <p className="opacity-80">Completed</p>
              <h3 className="text-lg font-bold">{Math.round(totalWater)} ml</h3>
            </div>
          </div>
        </div>

        {/* RIGHT IMAGE */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <img
            src="/images/Water_img.jpg"
            alt="Water"
            className="w-full h-full object-cover rounded-2xl opacity-90"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/images/login.jpg';
            }}
          />
          {/* BLEND OVERLAY */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-blue-500 opacity-50 rounded-2xl"></div>
        </div>
      </div>

      {/* 🌊 PROGRESS CARD */}
      <div className="bg-blue-50/70 backdrop-blur rounded-2xl p-4 shadow-sm flex items-center gap-4 border border-blue-100">
        {/* WAVE CIRCLE */}
        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-blue-300 flex-shrink-0 bg-blue-100">
          <div
            className="wave"
            style={{
              top: `${waveLevel}%`,
              transition: 'top 0.8s ease-in-out',
            }}
          ></div>
          <div
            className="wave wave2"
            style={{
              top: `${waveLevel}%`,
              transition: 'top 0.8s ease-in-out',
            }}
          ></div>

          <div className="absolute inset-0 flex items-center justify-center font-bold text-blue-700 text-sm z-10">
            {Math.round(progressPercent)}%
          </div>
        </div>

        {/* BAR */}
        <div className="flex-1">
          <p className="text-sm text-gray-700">
            <span className="text-blue-600 font-semibold">{Math.round(totalWater)} ml</span> /{' '}
            {goal} ml
          </p>

          <div className="w-full bg-blue-100 h-2 rounded-full mt-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${clampedPercent}%` }}
            ></div>
          </div>

          <p className="text-xs text-blue-500 mt-1">{progressPercent.toFixed(1)}%</p>
        </div>
      </div>

      {/* ⚡ QUICK ADD */}
      <div className="bg-blue-50/60 backdrop-blur rounded-2xl p-4 shadow-sm border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-3">Quick Add</h3>

        <div className="flex gap-4 overflow-x-auto no-scrollbar items-center py-1">
          {/* 100ml */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleLogAmount(100)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer active:scale-95 transition"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-xl shadow-sm">
              🥤
            </div>
            <p className="text-xs mt-1 text-gray-700 font-medium">100ml</p>
          </button>

          {/* 200ml */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleLogAmount(200)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer active:scale-95 transition"
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl shadow-sm">
              🧋
            </div>
            <p className="text-xs mt-1 text-gray-700 font-medium">200ml</p>
          </button>

          {/* 300ml */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleLogAmount(300)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer active:scale-95 transition"
          >
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xl shadow-sm">
              🥛
            </div>
            <p className="text-xs mt-1 text-gray-700 font-medium">300ml</p>
          </button>

          {/* 500ml */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleLogAmount(500)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer active:scale-95 transition"
          >
            <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center text-xl shadow-sm">
              🧃
            </div>
            <p className="text-xs mt-1 text-gray-700 font-medium">500ml</p>
          </button>

          {/* 1000ml (1L) */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleLogAmount(1000)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer active:scale-95 transition text-center"
          >
            <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center shadow-inner">
              <img
                src="/images/bottle_img.jpg"
                alt="Bottle"
                className="w-6 object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <p className="text-xs mt-1 text-blue-700 font-semibold">1L</p>
          </button>
        </div>
      </div>

      {/* ✏️ CUSTOM INPUT */}
      <div className="bg-[#f3edff] border border-[#e5d9ff] rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#5b21b6]">Add Custom Water</h3>
        </div>

        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Enter ml"
            min="1"
            step="any"
            className="flex-1 min-w-0 px-4 py-3 rounded-2xl bg-white border border-[#ddd6fe] focus:outline-none focus:ring-2 focus:ring-violet-400 text-sm shadow-sm"
          />

          <button
            type="submit"
            disabled={submitting}
            className="bg-gradient-to-r from-violet-500 to-purple-500 text-white px-5 py-3 rounded-2xl shadow-md font-medium text-sm active:scale-95 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            {submitting && <RefreshCw size={14} className="animate-spin" />}
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* 🍞 TOAST */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-lg bg-blue-600 text-white text-sm font-medium z-50 flex items-center gap-2 animate-fade-in">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
