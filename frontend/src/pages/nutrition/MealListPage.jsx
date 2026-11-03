import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { nutritionService, dashboardService } from '../../services/api';
import { RefreshCw, Trash2, Edit3, AlertCircle } from 'lucide-react';

export default function MealListPage() {
  const navigate = useNavigate();

  const [meals, setMeals] = useState([]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [targetProtein, setTargetProtein] = useState(80);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const fetchMealsAndSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [summaryRes, mealsRes] = await Promise.allSettled([
        dashboardService.getNutritionSummary(today),
        nutritionService.getMeals({ date: today }),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        const sum = summaryRes.value;
        setTotalCalories(sum.calories?.consumed || 0);
        setTotalProtein(sum.macronutrients?.protein?.consumed || 0);
        setTargetCalories(sum.calories?.target || 2000);
        setTargetProtein(sum.macronutrients?.protein?.target || 80);
      }

      if (mealsRes.status === 'fulfilled' && mealsRes.value) {
        const list = Array.isArray(mealsRes.value)
          ? mealsRes.value
          : mealsRes.value.results || [];
        setMeals(list);
      }
    } catch (err) {
      console.error('Failed to load meals', err);
      setError('Unable to load meals for today.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMealsAndSummary();
  }, [fetchMealsAndSummary]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2500);
  };

  const handleDelete = async (mealId) => {
    if (!window.confirm('Delete this meal log?')) return;

    setDeletingId(mealId);
    try {
      await nutritionService.deleteMeal(mealId);
      showToast('Meal deleted');
      fetchMealsAndSummary();
    } catch (err) {
      alert('Failed to delete meal log.');
    } finally {
      setDeletingId(null);
    }
  };

  // SVG Circle calculation matching Django template
  const radius = 26;
  const circumference = 2 * Math.PI * radius; // ~163.36
  const percent = targetCalories > 0 ? Math.min(totalCalories / targetCalories, 1) : 0;
  const caloriesOffset = circumference * (1 - percent);

  const proteinPercent =
    targetProtein > 0 ? Math.min(100, Math.round((totalProtein / targetProtein) * 100)) : 0;

  return (
    <div className="px-4 pt-4 pb-24 space-y-6">
      {/* 🔝 HEADER */}
      <div className="page-header mt-1.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold text-[#111827] leading-none">
              Meals 🍽️
            </h1>
            <p className="text-[13px] text-[#6b7280] mt-1 font-medium">
              Track your daily nutrition
            </p>
          </div>

          <div className="w-[70px] h-[70px] flex items-center justify-center bg-white/60 rounded-2xl shadow-[0_6px_14px_rgba(0,0,0,0.06)] border border-purple-100/50">
            <img
              src="/images/meal.webp"
              alt="Meals"
              className="w-[60px] h-[60px] object-contain"
              loading="eager"
              decoding="async"
              width={60}
              height={60}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/images/login.webp';
              }}
            />
          </div>
        </div>

        <div className="mt-3.5 h-[2px] w-full rounded-full bg-gradient-to-r from-[rgba(124,58,237,0.6)] to-[rgba(167,139,250,0.2)]"></div>
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
            onClick={fetchMealsAndSummary}
            className="underline font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* 🔥 CALORIES CARD */}
      <div
        className="rounded-[22px] p-4 flex justify-between items-center shadow-[0_10px_25px_rgba(139,92,246,0.15)] border border-white/60"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(240,235,255,0.95))',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div>
          <h2 className="text-3xl font-bold text-gray-900 leading-none">
            {Math.round(totalCalories)}
          </h2>
          <p className="text-sm text-gray-500 mt-1">Calories today</p>
        </div>

        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke="#e9d5ff"
              strokeWidth="5"
              fill="none"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke="#a78bfa"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="163"
              strokeDashoffset={caloriesOffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center text-lg">
            🔥
          </div>
        </div>
      </div>

      {/* 💪 PROTEIN CARD */}
      <div
        className="rounded-[22px] p-4 shadow-[0_10px_25px_rgba(139,92,246,0.15)] border border-white/60"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(240,235,255,0.95))',
          backdropFilter: 'blur(20px)',
        }}
      >
        <h3 className="font-semibold text-gray-800 text-sm">
          {Math.round(totalProtein)}g Protein
        </h3>

        <div className="h-1.5 bg-[#eee] rounded-full overflow-hidden mt-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${proteinPercent}%`,
              background: 'linear-gradient(to right, #7c3aed, #a78bfa)',
            }}
          ></div>
        </div>
      </div>

      {/* 📋 TODAY MEALS */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-gray-600">📋 Today</h3>
          <button
            type="button"
            onClick={fetchMealsAndSummary}
            className="text-gray-400 hover:text-purple-600 p-1"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 bg-white/70 rounded-[18px] animate-pulse p-3"
              ></div>
            ))}
          </div>
        ) : meals.length > 0 ? (
          <div className="space-y-3">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="flex gap-3 p-3 rounded-[18px] bg-white/80 backdrop-blur-md shadow-[0_6px_18px_rgba(139,92,246,0.12)] border border-purple-50 items-center"
              >
                <img
                  src={meal.food?.image_url || meal.food?.image || '/images/login.webp'}
                  alt={meal.food?.name || 'Meal'}
                  className="w-[55px] h-[55px] rounded-[14px] object-cover flex-shrink-0"
                  loading="lazy"
                  decoding="async"
                  width={55}
                  height={55}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/images/login.webp';
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-sm text-gray-800 truncate">
                      {meal.food?.name || 'Meal'}
                    </h4>

                    {meal.is_cheat && (
                      <span className="text-red-500 text-xs font-semibold ml-1 flex-shrink-0">
                        🔥 Cheat
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mt-0.5">
                    {Math.round(meal.calories)} kcal
                  </p>

                  <div className="flex gap-4 text-xs text-gray-600 mt-1">
                    <span>
                      🍽 {meal.quantity} {meal.unit || ''}
                    </span>
                    <span>💪 {Math.round(meal.protein)}g</span>
                  </div>
                </div>

                <div className="text-xs text-purple-600 flex flex-col items-end gap-1.5 ml-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/nutrition/meals/${meal.id}/edit`)}
                    className="font-medium hover:underline text-purple-600 cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 size={12} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(meal.id)}
                    disabled={deletingId === meal.id}
                    className="font-medium hover:underline text-red-500 cursor-pointer flex items-center gap-1"
                  >
                    {deletingId === meal.id ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    <span>Del</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white/50 backdrop-blur rounded-2xl p-4 border border-purple-100">
            <p className="text-2xl mb-1">🍲</p>
            <p className="text-gray-500 text-xs font-medium">No meals logged today</p>
            <Link
              to="/nutrition/log"
              className="inline-block mt-3 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold shadow"
            >
              Log your first meal
            </Link>
          </div>
        )}
      </div>

      {/* ➕ FLOATING ACTION BUTTON */}
      <div className="fab-container">
        <Link
          to="/nutrition/log"
          className="w-14 h-14 flex items-center justify-center bg-gradient-to-r from-purple-500 to-purple-600 text-white text-2xl rounded-full shadow-lg transition transform hover:scale-110 active:scale-95 cursor-pointer"
        >
          +
        </Link>
      </div>

      {/* 🍞 TOAST */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-lg bg-green-500 text-white text-sm font-medium z-50 flex items-center gap-2 animate-fade-in">
          <span>✅</span>
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
