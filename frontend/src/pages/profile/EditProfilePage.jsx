import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/api';
import loginFallbackImg from '../../assets/images/login.jpg';
import { ArrowLeft, CheckCircle2, AlertCircle, Upload } from 'lucide-react';

export default function EditProfilePage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const profile = user?.profile || {};

  const [formData, setFormData] = useState({
    goal: profile.goal || 'fat_loss',
    height: profile.height ?? '',
    weight: profile.weight ?? '',
    start_weight: profile.start_weight ?? '',
    target_weight: profile.target_weight ?? '',
    daily_calorie_target: profile.daily_calorie_target ?? '',
    daily_protein_target: profile.daily_protein_target ?? '',
    daily_steps_target: profile.daily_steps_target ?? '',
    daily_water_goal: profile.daily_water_goal ?? '',
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(profile.profile_image || loginFallbackImg);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (profile.profile_image) {
      setImagePreview(profile.profile_image);
    }
  }, [profile.profile_image]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (selectedFile) {
        // Use multipart/form-data when uploading an image
        const data = new FormData();
        data.append('profile_image', selectedFile);

        // Append profile nested fields
        data.append('profile.goal', formData.goal);
        if (formData.height) data.append('profile.height', parseFloat(formData.height));
        if (formData.weight) data.append('profile.weight', parseFloat(formData.weight));
        if (formData.start_weight) data.append('profile.start_weight', parseFloat(formData.start_weight));
        if (formData.target_weight) data.append('profile.target_weight', parseFloat(formData.target_weight));
        if (formData.daily_calorie_target) data.append('profile.daily_calorie_target', parseFloat(formData.daily_calorie_target));
        if (formData.daily_protein_target) data.append('profile.daily_protein_target', parseFloat(formData.daily_protein_target));
        if (formData.daily_steps_target) data.append('profile.daily_steps_target', parseInt(formData.daily_steps_target, 10));
        if (formData.daily_water_goal) data.append('profile.daily_water_goal', parseFloat(formData.daily_water_goal));
        data.append('profile.is_onboarded', 'true');

        await authService.updateMe(data, true);
      } else {
        // Standard JSON payload
        const payload = {
          profile: {
            goal: formData.goal,
            height: formData.height ? parseFloat(formData.height) : null,
            weight: formData.weight ? parseFloat(formData.weight) : null,
            start_weight: formData.start_weight ? parseFloat(formData.start_weight) : null,
            target_weight: formData.target_weight ? parseFloat(formData.target_weight) : null,
            daily_calorie_target: formData.daily_calorie_target ? parseFloat(formData.daily_calorie_target) : 2000,
            daily_protein_target: formData.daily_protein_target ? parseFloat(formData.daily_protein_target) : 80,
            daily_steps_target: formData.daily_steps_target ? parseInt(formData.daily_steps_target, 10) : 8000,
            daily_water_goal: formData.daily_water_goal ? parseFloat(formData.daily_water_goal) : 3000,
            is_onboarded: true,
          },
        };

        await authService.updateMe(payload, false);
      }

      await refreshProfile();
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => {
        navigate('/profile');
      }, 900);
    } catch (err) {
      if (err.response?.data) {
        const d = err.response.data;
        if (typeof d === 'object') {
          const msgs = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`);
          setError(msgs.join(' · '));
        } else {
          setError('Failed to update profile. Please verify your entries.');
        }
      } else {
        setError('Network error updating profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-gradient-to-br from-[#e9d5ff] to-[#c084fc] min-h-full">
      <div className="p-4 pb-12 overflow-y-auto no-scrollbar">
        {/* TOP NAV BAR */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 text-xs text-[#5b21b6] font-semibold bg-white/70 backdrop-blur px-3 py-1.5 rounded-full shadow-xs hover:bg-white transition cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>
          <span className="text-xs font-semibold text-white/80">Account Settings</span>
        </div>

        {/* MAIN CONTAINER */}
        <div className="bg-white/95 rounded-[28px] p-5 border border-[#a78bfa]/30 shadow-lg">
          <h2 className="text-center text-[22px] font-bold text-[#6d28d9] mb-5 tracking-tight">
            Edit Profile
          </h2>

          {/* NOTIFICATION MESSAGES */}
          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* PROFILE IMAGE */}
            <div className="flex flex-col items-center gap-2.5 mb-5">
              <img
                src={imagePreview}
                alt="Profile Preview"
                className="w-[110px] h-[110px] rounded-full object-cover border-4 border-[#a78bfa] shadow-md"
              />

              <div className="w-full bg-[#f5f3ff] border border-[#a78bfa]/40 rounded-[14px] p-2.5 text-center">
                <label className="flex items-center justify-center gap-1.5 text-xs text-[#7c3aed] font-semibold cursor-pointer">
                  <Upload size={14} />
                  <span>Choose Profile Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* GOAL DROPDOWN */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#6b7280] mb-1">
                Fitness Goal
              </label>
              <div className="relative">
                <select
                  name="goal"
                  value={formData.goal}
                  onChange={handleChange}
                  className="w-full p-3 rounded-[16px] border-2 border-[#a78bfa] bg-white text-[15px] font-medium text-gray-800 outline-none cursor-pointer focus:border-[#7c3aed] focus:ring-3 focus:ring-[#7c3aed]/15 transition"
                >
                  <option value="fat_loss">Fat Loss</option>
                  <option value="muscle_gain">Muscle Gain</option>
                  <option value="maintain">Maintain</option>
                </select>
              </div>
            </div>

            {/* PERSONAL STATS SECTION */}
            <div className="mt-4 bg-[#f5f3ff] p-3.5 rounded-[18px] border border-[#a78bfa]/25">
              <div className="text-[13px] font-semibold text-[#6b7280] mb-2.5">
                Personal Stats
              </div>

              <div className="mb-3">
                <label className="block text-xs text-[#6b7280] mb-1">Height (cm)</label>
                <input
                  type="number"
                  name="height"
                  step="0.1"
                  value={formData.height}
                  onChange={handleChange}
                  placeholder="Enter height in cm"
                  className="w-full p-3 rounded-[14px] border-[1.5px] border-[#a78bfa]/40 bg-white text-sm text-gray-800 outline-none focus:border-[#7c3aed] box-border"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label className="block text-xs text-[#6b7280] mb-1">Current Weight (kg)</label>
                  <input
                    type="number"
                    name="weight"
                    step="0.1"
                    value={formData.weight}
                    onChange={handleChange}
                    placeholder="Current weight"
                    className="w-full p-3 rounded-[14px] border-[1.5px] border-[#a78bfa]/40 bg-white text-sm text-gray-800 outline-none focus:border-[#7c3aed] box-border"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#6b7280] mb-1">Start Weight (kg)</label>
                  <input
                    type="number"
                    name="start_weight"
                    step="0.1"
                    value={formData.start_weight}
                    onChange={handleChange}
                    placeholder="Starting weight"
                    className="w-full p-3 rounded-[14px] border-[1.5px] border-[#a78bfa]/40 bg-white text-sm text-gray-800 outline-none focus:border-[#7c3aed] box-border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#6b7280] mb-1">Target Weight (kg)</label>
                <input
                  type="number"
                  name="target_weight"
                  step="0.1"
                  value={formData.target_weight}
                  onChange={handleChange}
                  placeholder="Target weight"
                  className="w-full p-3 rounded-[14px] border-[1.5px] border-[#a78bfa]/40 bg-white text-sm text-gray-800 outline-none focus:border-[#7c3aed] box-border"
                />
              </div>
            </div>

            {/* DAILY TARGETS SECTION */}
            <div className="mt-4 bg-[#f5f3ff] p-3.5 rounded-[18px] border border-[#a78bfa]/25">
              <div className="text-[13px] font-semibold text-[#6b7280] mb-2.5">
                Daily Targets
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label className="block text-xs text-[#6b7280] mb-1">Calories Target</label>
                  <input
                    type="number"
                    name="daily_calorie_target"
                    value={formData.daily_calorie_target}
                    onChange={handleChange}
                    placeholder="kcal / day"
                    className="w-full p-3 rounded-[14px] border-[1.5px] border-[#a78bfa]/40 bg-white text-sm text-gray-800 outline-none focus:border-[#7c3aed] box-border"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#6b7280] mb-1">Protein Target (g)</label>
                  <input
                    type="number"
                    name="daily_protein_target"
                    value={formData.daily_protein_target}
                    onChange={handleChange}
                    placeholder="grams / day"
                    className="w-full p-3 rounded-[14px] border-[1.5px] border-[#a78bfa]/40 bg-white text-sm text-gray-800 outline-none focus:border-[#7c3aed] box-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-[#6b7280] mb-1">Steps Target</label>
                  <input
                    type="number"
                    name="daily_steps_target"
                    value={formData.daily_steps_target}
                    onChange={handleChange}
                    placeholder="Daily steps"
                    className="w-full p-3 rounded-[14px] border-[1.5px] border-[#a78bfa]/40 bg-white text-sm text-gray-800 outline-none focus:border-[#7c3aed] box-border"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#6b7280] mb-1">Water Goal (ml)</label>
                  <input
                    type="number"
                    name="daily_water_goal"
                    value={formData.daily_water_goal}
                    onChange={handleChange}
                    placeholder="ml / day"
                    className="w-full p-3 rounded-[14px] border-[1.5px] border-[#a78bfa]/40 bg-white text-sm text-gray-800 outline-none focus:border-[#7c3aed] box-border"
                  />
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-5 p-3.5 rounded-[16px] bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white text-[15px] font-semibold cursor-pointer shadow-md hover:opacity-95 active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Save Changes'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
