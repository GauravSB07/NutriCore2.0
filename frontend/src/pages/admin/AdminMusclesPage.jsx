import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';

export default function AdminMusclesPage() {
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [name, setName] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchMuscleGroups();
  }, []);

  const fetchMuscleGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getMuscleGroups();
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setMuscleGroups(list);
    } catch (err) {
      console.error('Failed to load muscle groups:', err);
      setError('Failed to load muscle groups.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingGroup(null);
    setName('');
    setImageFile(null);
    setImagePreview(null);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (group) => {
    setEditingGroup(group);
    setName(group.name || '');
    setImageFile(null);
    setImagePreview(group.image_url || null);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormErrors({ name: ['Name is required.'] });
      return;
    }

    setFormSubmitting(true);
    setFormErrors({});
    setError(null);

    try {
      const payload = new FormData();
      payload.append('name', name.trim());
      if (imageFile) {
        payload.append('image', imageFile);
      }

      if (editingGroup) {
        await adminService.updateMuscleGroup(editingGroup.id, payload);
        setSuccessMsg(`Muscle group "${name}" updated.`);
      } else {
        await adminService.createMuscleGroup(payload);
        setSuccessMsg(`Muscle group "${name}" created.`);
      }

      setIsFormOpen(false);
      fetchMuscleGroups();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Save muscle group failed:', err);
      const resErrors = err.response?.data;
      if (resErrors && typeof resErrors === 'object') {
        setFormErrors(resErrors);
      } else {
        setError('Failed to save muscle group.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteGroup = async (id, groupName) => {
    if (!window.confirm(`Delete muscle group "${groupName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await adminService.deleteMuscleGroup(id);
      setSuccessMsg(`Muscle group "${groupName}" deleted.`);
      fetchMuscleGroups();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Delete muscle group failed:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete muscle group.';
      setError(errMsg);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[420px] mx-auto w-full">
      {/* HEADER */}
      <div className="text-2xl font-extrabold text-gray-900 mb-1">
        Muscle Groups 💪
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>
          Total Groups: <strong className="text-purple-700">{muscleGroups.length}</strong>
        </span>
        <button
          onClick={openAddModal}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white font-semibold text-xs shadow hover:opacity-95 transition cursor-pointer"
        >
          + Add Group
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
        ) : muscleGroups.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">No muscle groups found 💪</p>
        ) : (
          muscleGroups.map((g) => (
            <div
              key={g.id}
              className="p-3 rounded-[18px] mb-3 bg-white/65 border border-purple-600/10 hover:bg-[#ede9fe] hover:-translate-y-0.5 transition duration-200 flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-sm text-gray-900">{g.name}</div>
                <div className="flex gap-3 mt-1.5 text-xs">
                  <button
                    onClick={() => openEditModal(g)}
                    className="text-[#7c3aed] font-semibold hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(g.id, g.name)}
                    className="text-[#dc2626] font-semibold hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* BADGE IMAGE */}
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-purple-50 flex items-center justify-center border-2 border-purple-600/12 shadow-sm text-xl flex-shrink-0">
                {g.image_url ? (
                  <img
                    src={g.image_url}
                    alt={g.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  '💪'
                )}
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
              {editingGroup ? 'Edit Muscle Group 💪' : 'Add Muscle Group 💪'}
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
                <label className="text-xs font-semibold text-gray-700 block mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chest, Back, Legs"
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Group Image</label>
                {imagePreview && (
                  <div className="mb-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-14 h-14 rounded-xl object-cover border border-purple-200"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    setImageFile(file || null);
                    if (file) {
                      setImagePreview(URL.createObjectURL(file));
                    }
                  }}
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
                  {formSubmitting ? 'Saving...' : 'Save Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
