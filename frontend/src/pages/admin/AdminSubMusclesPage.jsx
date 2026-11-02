import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';

export default function AdminSubMusclesPage() {
  const [subMuscles, setSubMuscles] = useState([]);
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    muscle_group: '',
    description: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [subsRes, groupsRes] = await Promise.all([
        adminService.getSubMuscles(),
        adminService.getMuscleGroups().catch(() => ({ data: [] })),
      ]);

      const subsList = Array.isArray(subsRes.data) ? subsRes.data : (subsRes.data?.results || []);
      const groupsList = Array.isArray(groupsRes.data) ? groupsRes.data : (groupsRes.data?.results || []);

      setSubMuscles(subsList);
      setMuscleGroups(groupsList);
    } catch (err) {
      console.error('Failed to load sub muscles:', err);
      setError('Failed to load sub muscles.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingSub(null);
    setFormData({
      name: '',
      muscle_group: muscleGroups.length > 0 ? muscleGroups[0].id : '',
      description: '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (sub) => {
    setEditingSub(sub);
    setFormData({
      name: sub.name || '',
      muscle_group: sub.muscle_group?.id || sub.muscle_group || '',
      description: sub.description || '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormErrors({ name: ['Name is required.'] });
      return;
    }
    if (!formData.muscle_group) {
      setFormErrors({ muscle_group: ['Muscle group is required.'] });
      return;
    }

    setFormSubmitting(true);
    setFormErrors({});
    setError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        muscle_group: formData.muscle_group,
        description: formData.description.trim(),
      };

      if (editingSub) {
        await adminService.updateSubMuscle(editingSub.id, payload);
        setSuccessMsg(`Sub muscle "${formData.name}" updated.`);
      } else {
        await adminService.createSubMuscle(payload);
        setSuccessMsg(`Sub muscle "${formData.name}" created.`);
      }

      setIsFormOpen(false);
      loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Save sub muscle failed:', err);
      const resErrors = err.response?.data;
      if (resErrors && typeof resErrors === 'object') {
        setFormErrors(resErrors);
      } else {
        setError('Failed to save sub muscle.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteSub = async (id, subName) => {
    if (!window.confirm(`Delete sub muscle "${subName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await adminService.deleteSubMuscle(id);
      setSuccessMsg(`Sub muscle "${subName}" deleted.`);
      loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Delete sub muscle failed:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete sub muscle.';
      setError(errMsg);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[420px] mx-auto w-full">
      {/* HEADER */}
      <div className="text-2xl font-extrabold text-gray-900 mb-1">
        Sub Muscles 🧬
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>
          Total Sub Muscles: <strong className="text-purple-700">{subMuscles.length}</strong>
        </span>
        <button
          onClick={openAddModal}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white font-semibold text-xs shadow hover:opacity-95 transition cursor-pointer"
        >
          + Add Sub Muscle
        </button>
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

      {/* LIST */}
      <div className="bg-white/75 backdrop-blur-[18px] rounded-[22px] p-3.5 border border-purple-600/15 shadow-[0_10px_25px_rgba(124,58,237,0.12)]">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : subMuscles.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">No sub muscles found 🧬</p>
        ) : (
          subMuscles.map((s) => (
            <div
              key={s.id}
              className="p-3 rounded-[18px] mb-3 bg-white/65 border border-purple-600/10 hover:bg-[#ede9fe] hover:-translate-y-0.5 transition duration-200"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm text-gray-900">{s.name}</div>
                  <div className="mt-1 inline-flex items-center gap-1 bg-[#f5f3ff] text-[#7c3aed] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold">
                    {s.muscle_group?.name || 'Muscle Group'}
                  </div>
                </div>

                <div className="flex gap-3 text-xs">
                  <button
                    onClick={() => openEditModal(s)}
                    className="text-[#7c3aed] font-semibold hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSub(s.id, s.name)}
                    className="text-[#dc2626] font-semibold hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-[24px] p-5 max-w-[360px] w-full border border-purple-200 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              {editingSub ? 'Edit Sub Muscle 🧬' : 'Add Sub Muscle 🧬'}
            </h3>

            {Object.keys(formErrors).length > 0 && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
                {Object.entries(formErrors).map(([k, errs]) => (
                  <div key={k}>{Array.isArray(errs) ? errs.join(' ') : String(errs)}</div>
                ))}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Sub Muscle Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Upper Chest, Lower Biceps"
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Parent Muscle Group</label>
                <select
                  required
                  value={formData.muscle_group}
                  onChange={(e) => setFormData({ ...formData, muscle_group: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm focus:outline-none focus:border-purple-600"
                >
                  <option value="">Select muscle group...</option>
                  {muscleGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Description</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional notes or details"
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                ></textarea>
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
                  {formSubmitting ? 'Saving...' : 'Save Sub Muscle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
