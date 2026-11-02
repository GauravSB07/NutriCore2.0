import React, { useState, useEffect, useRef } from 'react';
import { adminService } from '../../services/api';

const UNIT_CHOICES = [
  { value: 'g', label: 'Grams (g)' },
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'unit', label: 'Unit / Piece' },
  { value: 'serving', label: 'Serving' },
];

export default function AdminFoodsPage() {
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    calories_per_100g: '',
    protein_per_100g: '',
    calories_per_unit: '',
    protein_per_unit: '',
    unit_type: 'g',
    serving_name: '',
    serving_quantity: '',
    categories: [],
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const debounceTimer = useRef(null);

  useEffect(() => {
    loadCategories();
    fetchFoods('', '');
  }, []);

  const loadCategories = async () => {
    try {
      const res = await adminService.getCategories();
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setCategories(list);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const fetchFoods = async (q = searchQuery, cat = selectedCategoryFilter) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (q) params.search = q;
      if (cat) params.category = cat;
      const res = await adminService.getFoods(params);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setFoods(list);
    } catch (err) {
      console.error('Failed to load foods:', err);
      setError('Failed to load foods.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchFoods(val, selectedCategoryFilter);
    }, 300);
  };

  const handleCategoryFilter = (catId) => {
    const newCat = selectedCategoryFilter === String(catId) ? '' : String(catId);
    setSelectedCategoryFilter(newCat);
    fetchFoods(searchQuery, newCat);
  };

  const openAddModal = () => {
    setEditingFood(null);
    setFormData({
      name: '',
      calories_per_100g: '',
      protein_per_100g: '',
      calories_per_unit: '',
      protein_per_unit: '',
      unit_type: 'g',
      serving_name: '',
      serving_quantity: '',
      categories: [],
    });
    setImageFile(null);
    setImagePreview(null);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (food) => {
    setEditingFood(food);
    const catIds = Array.isArray(food.categories)
      ? food.categories.map((c) => (typeof c === 'object' ? c.id : c))
      : [];

    setFormData({
      name: food.name || '',
      calories_per_100g: food.calories_per_100g ?? '',
      protein_per_100g: food.protein_per_100g ?? '',
      calories_per_unit: food.calories_per_unit ?? '',
      protein_per_unit: food.protein_per_unit ?? '',
      unit_type: food.unit_type || 'g',
      serving_name: food.serving_name || '',
      serving_quantity: food.serving_quantity ?? '',
      categories: catIds,
    });
    setImageFile(null);
    setImagePreview(food.image_url || null);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const toggleFormCategory = (id) => {
    setFormData((prev) => {
      const exists = prev.categories.includes(id);
      return {
        ...prev,
        categories: exists ? prev.categories.filter((c) => c !== id) : [...prev.categories, id],
      };
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormErrors({});
    setError(null);

    try {
      const payload = new FormData();
      payload.append('name', formData.name.trim());
      if (formData.calories_per_100g !== '') payload.append('calories_per_100g', formData.calories_per_100g);
      if (formData.protein_per_100g !== '') payload.append('protein_per_100g', formData.protein_per_100g);
      if (formData.calories_per_unit !== '') payload.append('calories_per_unit', formData.calories_per_unit);
      if (formData.protein_per_unit !== '') payload.append('protein_per_unit', formData.protein_per_unit);
      if (formData.unit_type) payload.append('unit_type', formData.unit_type);
      if (formData.serving_name) payload.append('serving_name', formData.serving_name);
      if (formData.serving_quantity !== '') payload.append('serving_quantity', formData.serving_quantity);

      formData.categories.forEach((cid) => {
        payload.append('categories', cid);
      });

      if (imageFile) {
        payload.append('image', imageFile);
      }

      if (editingFood) {
        await adminService.updateFood(editingFood.id, payload);
        setSuccessMsg(`Food "${formData.name}" updated successfully.`);
      } else {
        await adminService.createFood(payload);
        setSuccessMsg(`Food "${formData.name}" created successfully.`);
      }

      setIsFormOpen(false);
      fetchFoods(searchQuery, selectedCategoryFilter);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Save food failed:', err);
      const resErrors = err.response?.data;
      if (resErrors && typeof resErrors === 'object') {
        setFormErrors(resErrors);
      } else {
        setError('Failed to save food item.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteFood = async (id, name) => {
    if (!window.confirm(`Delete food "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await adminService.deleteFood(id);
      setSuccessMsg(`Food "${name}" deleted.`);
      fetchFoods(searchQuery, selectedCategoryFilter);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Delete food failed:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete food.';
      setError(errMsg);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[420px] mx-auto w-full">
      {/* HEADER */}
      <div className="text-2xl font-extrabold text-gray-900 mb-1">
        Foods 🍽
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>
          Total Foods: <strong className="text-purple-700">{foods.length}</strong>
        </span>
        <button
          onClick={openAddModal}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white font-semibold text-xs shadow hover:opacity-95 transition cursor-pointer"
        >
          + Add Food
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
          placeholder="Search foods..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-purple-600/20 bg-white/70 text-sm focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
        />
      </div>

      {/* CATEGORY FILTER PILLS */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 mb-3">
          <button
            onClick={() => handleCategoryFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategoryFilter === ''
                ? 'bg-[#7c3aed] text-white shadow'
                : 'bg-white/70 text-gray-600 hover:bg-purple-100'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCategoryFilter(c.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategoryFilter === String(c.id)
                  ? 'bg-[#7c3aed] text-white shadow'
                  : 'bg-white/70 text-gray-600 hover:bg-purple-100'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* FOOD LIST */}
      <div className="bg-white/75 backdrop-blur-[18px] rounded-[22px] p-3.5 border border-purple-600/15 shadow-[0_10px_25px_rgba(124,58,237,0.12)]">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : foods.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">No foods found</p>
        ) : (
          foods.map((food) => (
            <div
              key={food.id}
              className="p-3 rounded-[14px] mb-2.5 bg-white/60 border border-purple-600/10 hover:bg-[#ede9fe] hover:-translate-y-0.5 transition duration-200 flex gap-3 items-center"
            >
              {/* IMAGE BADGE */}
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200/50 flex-shrink-0 overflow-hidden flex items-center justify-center text-xl">
                {food.image_url ? (
                  <img
                    src={food.image_url}
                    alt={food.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  '🍽'
                )}
              </div>

              {/* DETAILS */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{food.name}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {food.calories_per_100g ? `${food.calories_per_100g} kcal/100g` : ''}
                  {food.protein_per_100g ? ` • ${food.protein_per_100g}g protein` : ''}
                  {food.serving_name ? ` • 1 ${food.serving_name}` : ''}
                </div>

                <div className="flex gap-3 mt-1.5 text-xs">
                  <button
                    onClick={() => openEditModal(food)}
                    className="text-[#7c3aed] font-semibold hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteFood(food.id, food.name)}
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

      {/* ADD / EDIT FOOD MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-[26px] p-5 max-w-[400px] w-full border border-purple-200 shadow-2xl my-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              {editingFood ? 'Edit Food 🍽' : 'Add Food 🍽'}
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
                <label className="text-xs font-semibold text-gray-700 block mb-1">Food Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Calories / 100g</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.calories_per_100g}
                    onChange={(e) => setFormData({ ...formData, calories_per_100g: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Protein / 100g</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.protein_per_100g}
                    onChange={(e) => setFormData({ ...formData, protein_per_100g: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Calories / Unit</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.calories_per_unit}
                    onChange={(e) => setFormData({ ...formData, calories_per_unit: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Protein / Unit</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.protein_per_unit}
                    onChange={(e) => setFormData({ ...formData, protein_per_unit: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
              </div>

              {/* UNIT TYPE PILLS */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Unit Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {UNIT_CHOICES.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, unit_type: u.value })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
                        formData.unit_type === u.value
                          ? 'bg-[#7c3aed] text-white shadow'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Serving Name</label>
                  <input
                    type="text"
                    placeholder="e.g. cup, piece, scoop"
                    value={formData.serving_name}
                    onChange={(e) => setFormData({ ...formData, serving_name: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Serving Quantity</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 100"
                    value={formData.serving_quantity}
                    onChange={(e) => setFormData({ ...formData, serving_quantity: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
              </div>

              {/* CATEGORIES MULTI-SELECT */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Categories</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-purple-100">
                  {categories.map((c) => {
                    const isSelected = formData.categories.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleFormCategory(c.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#7c3aed] text-white shadow-xs'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-purple-50'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* IMAGE UPLOAD & PREVIEW */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Food Image</label>
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
                  {formSubmitting ? 'Saving...' : 'Save Food'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
