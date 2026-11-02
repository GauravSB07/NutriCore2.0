import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getDashboardStats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setError('Unable to load dashboard metrics. Verify superuser permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[420px] mx-auto w-full">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
          Admin Dashboard ⚙️
        </h1>
        {loading && (
          <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={fetchDashboardStats}
            className="font-bold underline ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* GLASS PANEL */}
      <div className="bg-white/70 backdrop-blur-[18px] rounded-[24px] p-3.5 border border-purple-600/15 shadow-[0_12px_30px_rgba(124,58,237,0.15)]">
        {/* USERS SECTION */}
        <div className="text-[11px] text-gray-500 font-semibold tracking-wider mt-1 mb-2 px-1">
          USERS
        </div>

        <Link
          to="/admin/users"
          className="flex items-center justify-between px-3.5 py-3 rounded-[16px] text-gray-900 text-sm font-medium bg-white/60 backdrop-blur-[10px] border border-purple-600/12 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:-translate-y-0.5 transition-all duration-200 mb-1.5 shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">👤</span>
            <span>Users</span>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-xs bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                {stats.users ?? 0}
              </span>
            )}
            <span className="text-gray-400 group-hover:text-purple-600 transition">→</span>
          </div>
        </Link>

        <Link
          to="/admin/profiles"
          className="flex items-center justify-between px-3.5 py-3 rounded-[16px] text-gray-900 text-sm font-medium bg-white/60 backdrop-blur-[10px] border border-purple-600/12 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:-translate-y-0.5 transition-all duration-200 mb-3 shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">🪪</span>
            <span>Profiles</span>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-xs bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                {stats.profiles ?? 0}
              </span>
            )}
            <span className="text-gray-400 group-hover:text-purple-600 transition">→</span>
          </div>
        </Link>

        {/* NUTRITION SECTION */}
        <div className="text-[11px] text-gray-500 font-semibold tracking-wider mt-3 mb-2 px-1">
          NUTRITION
        </div>

        <Link
          to="/admin/categories"
          className="flex items-center justify-between px-3.5 py-3 rounded-[16px] text-gray-900 text-sm font-medium bg-white/60 backdrop-blur-[10px] border border-purple-600/12 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:-translate-y-0.5 transition-all duration-200 mb-1.5 shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">📂</span>
            <span>Categories</span>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-xs bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                {stats.food_categories ?? 0}
              </span>
            )}
            <span className="text-gray-400 group-hover:text-purple-600 transition">→</span>
          </div>
        </Link>

        <Link
          to="/admin/foods"
          className="flex items-center justify-between px-3.5 py-3 rounded-[16px] text-gray-900 text-sm font-medium bg-white/60 backdrop-blur-[10px] border border-purple-600/12 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:-translate-y-0.5 transition-all duration-200 mb-1.5 shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">🍽</span>
            <span>Foods</span>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-xs bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                {stats.foods ?? 0}
              </span>
            )}
            <span className="text-gray-400 group-hover:text-purple-600 transition">→</span>
          </div>
        </Link>

        <Link
          to="/admin/meals"
          className="flex items-center justify-between px-3.5 py-3 rounded-[16px] text-gray-900 text-sm font-medium bg-white/60 backdrop-blur-[10px] border border-purple-600/12 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:-translate-y-0.5 transition-all duration-200 mb-3 shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">🥘</span>
            <span>Meal Logs</span>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-xs bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                {stats.meals_logged_today ?? 0} today
              </span>
            )}
            <span className="text-gray-400 group-hover:text-purple-600 transition">→</span>
          </div>
        </Link>

        {/* RECIPES SECTION */}
        <div className="text-[11px] text-gray-500 font-semibold tracking-wider mt-3 mb-2 px-1">
          RECIPES
        </div>

        <Link
          to="/admin/recipe-categories"
          className="flex items-center justify-between px-3.5 py-3 rounded-[16px] text-gray-900 text-sm font-medium bg-white/60 backdrop-blur-[10px] border border-purple-600/12 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:-translate-y-0.5 transition-all duration-200 mb-1.5 shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">📁</span>
            <span>Recipe Categories</span>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-xs bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                {stats.recipe_categories ?? 0}
              </span>
            )}
            <span className="text-gray-400 group-hover:text-purple-600 transition">→</span>
          </div>
        </Link>

        <Link
          to="/admin/recipes"
          className="flex items-center justify-between px-3.5 py-3 rounded-[16px] text-gray-900 text-sm font-medium bg-white/60 backdrop-blur-[10px] border border-purple-600/12 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:-translate-y-0.5 transition-all duration-200 mb-3 shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">📖</span>
            <span>Recipes</span>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-xs bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                {stats.recipes ?? 0}
              </span>
            )}
            <span className="text-gray-400 group-hover:text-purple-600 transition">→</span>
          </div>
        </Link>

        {/* WORKOUTS SECTION */}
        <div className="text-[11px] text-gray-500 font-semibold tracking-wider mt-3 mb-2 px-1">
          WORKOUTS
        </div>

        <Link
          to="/admin/exercises"
          className="flex items-center justify-between px-3.5 py-3 rounded-[16px] text-gray-900 text-sm font-medium bg-white/60 backdrop-blur-[10px] border border-purple-600/12 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:-translate-y-0.5 transition-all duration-200 mb-1.5 shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">🏋️</span>
            <span>Exercises</span>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-xs bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                {stats.exercises ?? 0}
              </span>
            )}
            <span className="text-gray-400 group-hover:text-purple-600 transition">→</span>
          </div>
        </Link>

        <Link
          to="/admin/muscles"
          className="flex items-center justify-between px-3.5 py-3 rounded-[16px] text-gray-900 text-sm font-medium bg-white/60 backdrop-blur-[10px] border border-purple-600/12 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:-translate-y-0.5 transition-all duration-200 mb-1.5 shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">💪</span>
            <span>Muscle Groups</span>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-xs bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                {stats.muscle_groups ?? 0}
              </span>
            )}
            <span className="text-gray-400 group-hover:text-purple-600 transition">→</span>
          </div>
        </Link>

        <Link
          to="/admin/submuscles"
          className="flex items-center justify-between px-3.5 py-3 rounded-[16px] text-gray-900 text-sm font-medium bg-white/60 backdrop-blur-[10px] border border-purple-600/12 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:-translate-y-0.5 transition-all duration-200 mb-1 shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">🧬</span>
            <span>Sub Muscles</span>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-xs bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                {stats.submuscles ?? 0}
              </span>
            )}
            <span className="text-gray-400 group-hover:text-purple-600 transition">→</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
