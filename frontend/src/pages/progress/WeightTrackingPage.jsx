import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, RotateCcw, Target, Scale } from 'lucide-react';
import { progressService } from '../../services/api';

export default function WeightTrackingPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [data, setData] = useState({
    current_weight: null,
    start_weight: null,
    target_weight: null,
    height: null,
    weight_progress_percent: 0,
    weight_remaining: null,
    goal: 'cut',
  });

  const [formData, setFormData] = useState({
    weight: '',
    start_weight: '',
    target_weight: '',
    height: '',
  });

  const fetchWeight = useCallback(async () => {
    setLoading(true);
    try {
      const res = await progressService.getWeight();
      setData(res);
      setFormData({
        weight: res.current_weight != null ? String(res.current_weight) : '',
        start_weight: res.start_weight != null ? String(res.start_weight) : '',
        target_weight: res.target_weight != null ? String(res.target_weight) : '',
        height: res.height != null ? String(res.height) : '',
      });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Unable to load weight measurements.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeight();
  }, [fetchWeight]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const payload = {};
    if (formData.weight !== '') payload.weight = parseFloat(formData.weight);
    if (formData.start_weight !== '') payload.start_weight = parseFloat(formData.start_weight);
    if (formData.target_weight !== '') payload.target_weight = parseFloat(formData.target_weight);
    if (formData.height !== '') payload.height = parseFloat(formData.height);

    try {
      const res = await progressService.updateWeight(payload);
      setData(res.data);
      setFeedback({ type: 'success', message: 'Weight measurements saved successfully!' });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update weight measurements.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetWeight = async () => {
    if (!window.confirm('Are you sure you want to reset your current weight record?')) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await progressService.deleteWeight();
      setData(res.data);
      setFormData((prev) => ({ ...prev, weight: '' }));
      setFeedback({ type: 'success', message: 'Current weight has been reset.' });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to reset current weight.' });
    } finally {
      setSubmitting(false);
    }
  };

  // BMI calculation if height and current_weight exist
  let bmi = null;
  let bmiCategory = null;
  if (data.current_weight && data.height) {
    const heightInMeters = data.height / 100;
    bmi = (data.current_weight / (heightInMeters * heightInMeters)).toFixed(1);
    const numBmi = parseFloat(bmi);
    if (numBmi < 18.5) bmiCategory = 'Underweight';
    else if (numBmi < 25) bmiCategory = 'Normal weight';
    else if (numBmi < 30) bmiCategory = 'Overweight';
    else bmiCategory = 'Obese';
  }

  const progressPercent = data.weight_progress_percent || 0;

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
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              Weight & Body Tracker
            </h1>
          </div>

          <button
            type="button"
            onClick={fetchWeight}
            disabled={loading}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
          </button>
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

        {/* ⚖️ HERO WEIGHT STATUS CARD */}
        <div className="bg-gradient-to-br from-[#ede9fe] to-[#ddd6fe] rounded-[24px] p-5 shadow-sm border border-purple-200/60">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
                Current Weight
              </p>
              <h2 className="text-3xl font-extrabold text-gray-900 mt-1">
                {data.current_weight != null ? `${data.current_weight} kg` : '-- kg'}
              </h2>
              {data.weight_remaining != null && (
                <p className="text-xs text-purple-700 mt-1 font-medium">
                  {data.weight_remaining} kg to reach target goal
                </p>
              )}
            </div>

            <div className="w-14 h-14 rounded-2xl bg-white/70 backdrop-blur shadow-xs flex items-center justify-center text-2xl text-purple-600">
              <Scale size={28} />
            </div>
          </div>

          {/* PROGRESS BAR */}
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
              <span>Goal Progress</span>
              <span className="font-bold text-purple-800">{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full bg-white/60 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-purple-700 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* TARGET STATS ROW */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-purple-200/70 text-center">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Start</p>
              <p className="text-xs font-bold text-gray-800 mt-0.5">
                {data.start_weight != null ? `${data.start_weight} kg` : '--'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Target</p>
              <p className="text-xs font-bold text-[#7c3aed] mt-0.5">
                {data.target_weight != null ? `${data.target_weight} kg` : '--'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Goal</p>
              <p className="text-xs font-bold uppercase text-purple-900 mt-0.5">
                {data.goal || 'Cut'}
              </p>
            </div>
          </div>
        </div>

        {/* 📊 BMI CARD */}
        {bmi && (
          <div className="card-lavender flex items-center justify-between py-3">
            <div>
              <p className="text-xs text-gray-500 font-medium">Body Mass Index (BMI)</p>
              <p className="text-lg font-bold text-gray-800 mt-0.5">
                {bmi} <span className="text-xs font-medium text-purple-600">({bmiCategory})</span>
              </p>
            </div>
            <div className="px-3 py-1 rounded-full bg-purple-100 text-[#7c3aed] text-xs font-semibold">
              Height: {data.height} cm
            </div>
          </div>
        )}

        {/* 📝 UPDATE WEIGHT FORM */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-50">
          <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
            <Target size={16} className="text-[#7c3aed]" />
            <span>Update Measurements</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="e.g. 72.5"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-[#7c3aed]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Target Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.target_weight}
                  onChange={(e) => setFormData({ ...formData, target_weight: e.target.value })}
                  placeholder="e.g. 68.0"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-[#7c3aed]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Starting Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.start_weight}
                  onChange={(e) => setFormData({ ...formData, start_weight: e.target.value })}
                  placeholder="e.g. 80.0"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-[#7c3aed]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  placeholder="e.g. 175"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-[#7c3aed]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl text-sm shadow-md active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Measurements'}
              </button>

              <button
                type="button"
                onClick={handleResetWeight}
                disabled={submitting || data.current_weight == null}
                className="px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs transition cursor-pointer disabled:opacity-40"
                title="Reset current weight"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
