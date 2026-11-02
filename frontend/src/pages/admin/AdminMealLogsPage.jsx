import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';

export default function AdminMealLogsPage() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    fetchMeals('');
  }, []);

  const fetchMeals = async (dateStr = selectedDate) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (dateStr) params.date = dateStr;
      const res = await adminService.getMealLogs(params);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setMeals(list);
    } catch (err) {
      console.error('Failed to load meal logs:', err);
      setError('Failed to load global meal logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const d = e.target.value;
    setSelectedDate(d);
    fetchMeals(d);
  };

  const handleClearDate = () => {
    setSelectedDate('');
    fetchMeals('');
  };

  const handleDeleteMeal = async (id, foodName) => {
    if (!window.confirm(`Delete meal log for "${foodName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await adminService.deleteMealLog(id);
      setSuccessMsg('Meal log deleted successfully.');
      fetchMeals(selectedDate);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Delete meal log failed:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete meal log.';
      setError(errMsg);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[420px] mx-auto w-full">
      {/* HEADER */}
      <div className="text-2xl font-extrabold text-gray-900 mb-1">
        Meal Logs 🍽
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>
          Total Logs: <strong className="text-purple-700">{meals.length}</strong>
        </span>
        {selectedDate && (
          <button
            onClick={handleClearDate}
            className="text-purple-600 font-semibold hover:underline cursor-pointer"
          >
            Show All Dates
          </button>
        )}
      </div>

      {/* FEEDBACK */}
      {successMsg && (
        <div className="mb-3 p-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* DATE FILTER */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-700 block mb-1">Filter by Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white/80 text-sm focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
        />
      </div>

      {/* MEAL LOGS LIST */}
      <div className="bg-white/75 backdrop-blur-[18px] rounded-[22px] p-3.5 border border-purple-600/15 shadow-[0_10px_25px_rgba(124,58,237,0.12)]">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : meals.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">No meal logs found</p>
        ) : (
          meals.map((m) => {
            const foodName = m.food?.name || m.food_name || 'Food item';
            const username = m.user?.username || m.user_username || (typeof m.user === 'string' ? m.user : `User #${m.user}`);
            return (
              <div
                key={m.id}
                className="p-3 rounded-[14px] mb-2.5 bg-white/60 border border-purple-600/10 hover:bg-[#ede9fe] hover:-translate-y-0.5 transition duration-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{foodName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      👤 {username} • {m.date}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {m.quantity} {m.unit || 'g'} •{' '}
                      <span className="font-medium text-purple-700">{m.calories ?? 0} kcal</span> •{' '}
                      <span>{m.protein ?? 0}g protein</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {m.is_cheat ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                        Cheat
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#ede9fe] text-[#6d28d9]">
                        Log
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-2 text-xs">
                  <button
                    onClick={() => handleDeleteMeal(m.id, foodName)}
                    className="text-[#dc2626] font-semibold hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
