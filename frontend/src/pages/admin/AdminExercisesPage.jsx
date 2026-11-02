import React, { useState, useEffect, useRef } from 'react';
import { adminService } from '../../services/api';

export default function AdminExercisesPage() {
  const [exercises, setExercises] = useState([]);
  const [subMuscles, setSubMuscles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubMuscle, setSelectedSubMuscle] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sub_muscle: '',
    equipment: '',
    description: '',
    steps: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const debounceTimer = useRef(null);

  useEffect(() => {
    loadSubMuscles();
    fetchExercises('', '');
  }, []);

  const loadSubMuscles = async () => {
    try {
      const res = await adminService.getSubMuscles();
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setSubMuscles(list);
    } catch (err) {
      console.error('Failed to load sub muscles:', err);
    }
  };

  const fetchExercises = async (q = searchQuery, sub = selectedSubMuscle) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (q) params.search = q;
      if (sub) params.sub_muscle = sub;
      const res = await adminService.getExercises(params);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setExercises(list);
    } catch (err) {
      console.error('Failed to load exercises:', err);
      setError('Failed to load exercises.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchExercises(val, selectedSubMuscle);
    }, 300);
  };

  const handleSubMuscleFilter = (subId) => {
    setSelectedSubMuscle(subId);
    fetchExercises(searchQuery, subId);
  };

  const openAddModal = () => {
    setEditingExercise(null);
    setFormData({
      name: '',
      sub_muscle: subMuscles.length > 0 ? subMuscles[0].id : '',
      equipment: '',
      description: '',
      steps: '',
    });
    setImageFile(null);
    setImagePreview(null);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (ex) => {
    setEditingExercise(ex);
    setFormData({
      name: ex.name || '',
      sub_muscle: ex.sub_muscle?.id || ex.sub_muscle || '',
      equipment: ex.equipment || '',
      description: ex.description || '',
      steps: ex.steps || '',
    });
    setImageFile(null);
    setImagePreview(ex.image_url || null);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormErrors({});
    setError(null);

    try {
      const payload = new FormData();
      payload.append('name', formData.name.trim());
      if (formData.sub_muscle) payload.append('sub_muscle', formData.sub_muscle);
      if (formData.equipment) payload.append('equipment', formData.equipment.trim());
      if (formData.description) payload.append('description', formData.description.trim());
      if (formData.steps) payload.append('steps', formData.steps.trim());

      if (imageFile) {
        payload.append('image', imageFile);
      }

      if (editingExercise) {
        await adminService.updateExercise(editingExercise.id, payload);
        setSuccessMsg(`Exercise "${formData.name}" updated successfully.`);
      } else {
        await adminService.createExercise(payload);
        setSuccessMsg(`Exercise "${formData.name}" created successfully.`);
      }

      setIsFormOpen(false);
      fetchExercises(searchQuery, selectedSubMuscle);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Save exercise failed:', err);
      const resErrors = err.response?.data;
      if (resErrors && typeof resErrors === 'object') {
        setFormErrors(resErrors);
      } else {
        setError('Failed to save exercise.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteExercise = async (id, name) => {
    if (!window.confirm(`Delete exercise "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await adminService.deleteExercise(id);
      setSuccessMsg(`Exercise "${name}" deleted.`);
      fetchExercises(searchQuery, selectedSubMuscle);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Delete exercise failed:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete exercise.';
      setError(errMsg);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[420px] mx-auto w-full">
      {/* HEADER */}
      <div className="text-2xl font-extrabold text-gray-900 mb-1">
        Exercises 🏋️
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>
          Total Exercises: <strong className="text-purple-700">{exercises.length}</strong>
        </span>
        <button
          onClick={openAddModal}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white font-semibold text-xs shadow hover:opacity-95 transition cursor-pointer"
        >
          + Add Exercise
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

      {/* SEARCH */}
      <div className="mb-2">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search exercises..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-purple-600/20 bg-white/70 text-sm focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
        />
      </div>

      {/* SUB MUSCLE FILTER SELECT */}
      {subMuscles.length > 0 && (
        <div className="mb-3">
          <select
            value={selectedSubMuscle}
            onChange={(e) => handleSubMuscleFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white/80 text-xs font-medium text-gray-700"
          >
            <option value="">All Sub Muscles</option>
            {subMuscles.map((sm) => (
              <option key={sm.id} value={sm.id}>
                {sm.name} ({sm.muscle_group?.name || 'Muscle'})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* EXERCISES LIST */}
      <div className="bg-white/75 backdrop-blur-[18px] rounded-[22px] p-3.5 border border-purple-600/15 shadow-[0_10px_25px_rgba(124,58,237,0.12)]">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : exercises.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">No exercises found</p>
        ) : (
          exercises.map((ex) => (
            <div
              key={ex.id}
              className="p-3 rounded-[14px] mb-2.5 bg-white/60 border border-purple-600/10 hover:bg-[#ede9fe] hover:-translate-y-0.5 transition duration-200 flex gap-3 items-center"
            >
              {/* IMAGE BADGE */}
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200/50 flex-shrink-0 overflow-hidden flex items-center justify-center text-xl">
                {ex.image_url ? (
                  <img
                    src={ex.image_url}
                    alt={ex.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  '🏋️'
                )}
              </div>

              {/* DETAILS */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{ex.name}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {ex.sub_muscle?.name || 'General'}
                  {ex.equipment ? ` • ${ex.equipment}` : ''}
                </div>

                <div className="flex gap-3 mt-1.5 text-xs">
                  <button
                    onClick={() => openEditModal(ex)}
                    className="text-[#7c3aed] font-semibold hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteExercise(ex.id, ex.name)}
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

      {/* ADD / EDIT EXERCISE MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-[26px] p-5 max-w-[400px] w-full border border-purple-200 shadow-2xl my-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              {editingExercise ? 'Edit Exercise 🏋️' : 'Add Exercise 🏋️'}
            </h3>

            {Object.keys(formErrors).length > 0 && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
                {Object.entries(formErrors).map(([k, errs]) => (
                  <div key={k}>
                    <strong>{k}:</strong> {Array.isArray(errs) ? errs.join(' ') : String(errs)}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Exercise Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Sub Muscle</label>
                <select
                  required
                  value={formData.sub_muscle}
                  onChange={(e) => setFormData({ ...formData, sub_muscle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                >
                  <option value="">Select sub muscle...</option>
                  {subMuscles.map((sm) => (
                    <option key={sm.id} value={sm.id}>
                      {sm.name} ({sm.muscle_group?.name || 'Muscle Group'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Equipment</label>
                <input
                  type="text"
                  placeholder="e.g. Barbell, Dumbbells, Bodyweight"
                  value={formData.equipment}
                  onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Description</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                ></textarea>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Steps / Instructions</label>
                <textarea
                  rows="3"
                  value={formData.steps}
                  onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                  placeholder="Step 1: Position yourself... Step 2: Push..."
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                ></textarea>
              </div>

              {/* IMAGE UPLOAD & PREVIEW */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Exercise Image</label>
                {imagePreview && (
                  <div className="mb-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-16 h-16 rounded-xl object-cover border border-purple-200"
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
                  {formSubmitting ? 'Saving...' : 'Save Exercise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
