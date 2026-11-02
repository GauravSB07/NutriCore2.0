import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';

export default function AdminProfilesPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Edit modal state (Profiles are 1-to-1 with User records and created/deleted via User Lifecycle)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [formData, setFormData] = useState({
    user: '',
    height: '',
    weight: '',
    start_weight: '',
    target_weight: '',
    daily_steps_target: 10000,
    daily_calorie_target: 2000,
    daily_protein_target: 150,
    max_cheat_calories_per_day: 500,
    max_cheat_meals_per_day: 1,
    goal: 'maintenance',
    points: 0,
    daily_water_goal: 2000,
  });
  const [imageFile, setImageFile] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const profRes = await adminService.getProfiles();
      const profList = Array.isArray(profRes.data) ? profRes.data : (profRes.data?.results || []);
      setProfiles(profList);
    } catch (err) {
      console.error('Failed to load profiles:', err);
      setError('Failed to load profiles.');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (p) => {
    setEditingProfile(p);
    setFormData({
      user: p.user?.id || p.user,
      height: p.height ?? '',
      weight: p.weight ?? '',
      start_weight: p.start_weight ?? '',
      target_weight: p.target_weight ?? '',
      daily_steps_target: p.daily_steps_target ?? 10000,
      daily_calorie_target: p.daily_calorie_target ?? 2000,
      daily_protein_target: p.daily_protein_target ?? 150,
      max_cheat_calories_per_day: p.max_cheat_calories_per_day ?? 500,
      max_cheat_meals_per_day: p.max_cheat_meals_per_day ?? 1,
      goal: p.goal || 'maintenance',
      points: p.points ?? 0,
      daily_water_goal: p.daily_water_goal ?? 2000,
    });
    setImageFile(null);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!editingProfile) return;

    setFormSubmitting(true);
    setFormErrors({});
    setError(null);

    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, val]) => {
        if (key !== 'user' && val !== null && val !== undefined && val !== '') {
          payload.append(key, val);
        }
      });
      if (imageFile) {
        payload.append('profile_image', imageFile);
      }

      await adminService.updateProfile(editingProfile.id, payload);
      setSuccessMsg('Profile updated successfully.');
      setIsFormOpen(false);
      loadData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Save profile failed:', err);
      const resErrors = err.response?.data;
      if (resErrors && typeof resErrors === 'object') {
        setFormErrors(resErrors);
      } else {
        setError('Failed to update profile.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[420px] mx-auto w-full">
      {/* HEADER */}
      <div className="text-2xl font-extrabold text-gray-900 mb-1">
        Profiles 🪪
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>
          Total Profiles: <strong className="text-purple-700">{profiles.length}</strong>
        </span>
        <span className="text-[11px] text-gray-400">
          (Created automatically with Users)
        </span>
      </div>

      {/* FEEDBACK MESSAGES */}
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

      {/* PROFILES CARD */}
      <div className="bg-white/75 backdrop-blur-[18px] rounded-[22px] p-3.5 border border-purple-600/15 shadow-[0_10px_25px_rgba(124,58,237,0.12)]">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">No profiles found</p>
        ) : (
          profiles.map((p) => {
            const username = p.user?.username || (typeof p.user === 'string' ? p.user : `User #${p.user}`);
            return (
              <div
                key={p.id}
                className="p-3 rounded-[14px] mb-2.5 bg-white/60 border border-purple-600/10 hover:bg-[#ede9fe] hover:-translate-y-0.5 transition duration-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{username}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Target: {p.daily_calorie_target ?? '--'} kcal | {p.weight ? `${p.weight} kg` : 'No weight'}
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 capitalize">
                    {p.goal || 'General'}
                  </span>
                </div>

                <div className="flex gap-3 mt-2 text-xs">
                  <button
                    onClick={() => openEditModal(p)}
                    className="text-[#7c3aed] font-semibold hover:underline cursor-pointer"
                  >
                    Edit Targets
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* EDIT MODAL */}
      {isFormOpen && editingProfile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-[26px] p-5 max-w-[400px] w-full border border-purple-200 shadow-2xl my-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Edit Profile Targets 🪪
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              User: <strong className="text-purple-700">{editingProfile.user?.username || 'User'}</strong>
            </p>

            {Object.keys(formErrors).length > 0 && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
                {Object.entries(formErrors).map(([field, errs]) => (
                  <div key={field}>
                    <strong>{field}:</strong> {Array.isArray(errs) ? errs.join(' ') : String(errs)}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Start Weight</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.start_weight}
                    onChange={(e) => setFormData({ ...formData, start_weight: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Target Weight</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.target_weight}
                    onChange={(e) => setFormData({ ...formData, target_weight: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Daily Calories</label>
                  <input
                    type="number"
                    value={formData.daily_calorie_target}
                    onChange={(e) => setFormData({ ...formData, daily_calorie_target: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Daily Protein (g)</label>
                  <input
                    type="number"
                    value={formData.daily_protein_target}
                    onChange={(e) => setFormData({ ...formData, daily_protein_target: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Daily Steps</label>
                  <input
                    type="number"
                    value={formData.daily_steps_target}
                    onChange={(e) => setFormData({ ...formData, daily_steps_target: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Water Goal (ml)</label>
                  <input
                    type="number"
                    value={formData.daily_water_goal}
                    onChange={(e) => setFormData({ ...formData, daily_water_goal: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Goal</label>
                <select
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                >
                  <option value="weight_loss">Weight Loss</option>
                  <option value="muscle_gain">Muscle Gain</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Profile Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0] || null)}
                  className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-purple-100 file:text-purple-700 file:font-semibold hover:file:bg-purple-200"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white text-xs font-bold shadow hover:opacity-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
