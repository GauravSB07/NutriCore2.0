import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { progressService } from '../../services/api';

export default function LogStepsPage() {
  const navigate = useNavigate();

  const [stepsInput, setStepsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [stepsData, setStepsData] = useState({
    total_steps: 0,
    goal: 8000,
    remaining: 8000,
    progress_percent: 0,
  });
  const [todayLogs, setTodayLogs] = useState([]);

  const fetchSteps = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await progressService.getSteps({ date: today });

      if (res.daily_summary) {
        setStepsData({
          total_steps: res.daily_summary.total_steps || 0,
          goal: res.daily_summary.goal || 8000,
          remaining: res.daily_summary.remaining ?? 8000,
          progress_percent: res.daily_summary.progress_percent || 0,
        });
      }

      setTodayLogs(res.results || []);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to load today’s steps data.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  const handleAddSteps = async (amount) => {
    const num = parseInt(amount, 10);
    if (!num || num <= 0) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      await progressService.logSteps({ steps: num });
      setFeedback({ type: 'success', message: `+${num.toLocaleString()} steps added!` });
      setStepsInput('');
      await fetchSteps();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to log steps. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (id) => {
    try {
      await progressService.deleteSteps(id);
      setFeedback({ type: 'success', message: 'Step entry deleted.' });
      await fetchSteps();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to delete step entry.' });
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      <div className="px-4 pt-4 pb-24 overflow-y-auto no-scrollbar space-y-5">
        {/* TOP BACK BUTTON */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Track Steps</h1>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* 🚶 HEADER CARD */}
        <div className="bg-gradient-to-r from-purple-400 to-purple-600 text-white p-5 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span>🚶</span>
            <span>Steps Tracker</span>
          </h2>

          <div className="flex justify-between mt-3 text-sm">
            <div>
              <p className="text-purple-100">Goal</p>
              <h3 className="text-lg font-bold">
                {loading ? '--' : stepsData.goal.toLocaleString()}
              </h3>
            </div>

            <div>
              <p className="text-purple-100">Done</p>
              <h3 className="text-lg font-bold">
                {loading ? '--' : stepsData.total_steps.toLocaleString()}
              </h3>
            </div>
          </div>
        </div>

        {/* 📊 PROGRESS CARD */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-50">
          <p className="text-sm font-semibold text-gray-700">
            {stepsData.total_steps.toLocaleString()} / {stepsData.goal.toLocaleString()} steps
          </p>

          <div className="w-full bg-gray-200 h-2.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(stepsData.progress_percent, 100)}%` }}
            />
          </div>

          <p className="text-sm text-gray-500 mt-2">
            {stepsData.remaining.toLocaleString()} steps remaining
          </p>
        </div>

        {/* ⚡ QUICK ADD BUTTONS */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quick Add
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleAddSteps(500)}
              className="flex-1 py-3 bg-purple-50 hover:bg-purple-100 text-[#7c3aed] font-bold rounded-xl border border-purple-200 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              +500
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleAddSteps(1000)}
              className="flex-1 py-3 bg-purple-50 hover:bg-purple-100 text-[#7c3aed] font-bold rounded-xl border border-purple-200 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              +1,000
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleAddSteps(2000)}
              className="flex-1 py-3 bg-purple-50 hover:bg-purple-100 text-[#7c3aed] font-bold rounded-xl border border-purple-200 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              +2,000
            </button>
          </div>
        </div>

        {/* ✍️ CUSTOM STEPS FORM */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Custom Entry
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddSteps(stepsInput);
            }}
            className="flex gap-2"
          >
            <input
              type="number"
              min="1"
              value={stepsInput}
              onChange={(e) => setStepsInput(e.target.value)}
              className="border border-gray-300 p-3 rounded-xl w-full text-sm focus:outline-none focus:border-[#7c3aed] bg-white shadow-sm"
              placeholder="Enter steps (e.g. 1500)"
            />

            <button
              type="submit"
              disabled={submitting || !stepsInput}
              className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-6 rounded-xl transition shadow-md active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? '...' : 'Add'}
            </button>
          </form>
        </div>

        {/* 📋 TODAY'S STEP LOGS */}
        {todayLogs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Today's Entries
            </h3>
            <div className="space-y-2">
              {todayLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white rounded-xl p-3 flex justify-between items-center shadow-sm border border-purple-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">👟</span>
                    <span className="font-semibold text-gray-800 text-sm">
                      +{log.steps.toLocaleString()} steps
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteLog(log.id)}
                    className="text-gray-400 hover:text-red-500 p-1 rounded-lg transition"
                    title="Delete entry"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
