import React, { useState, useEffect, useRef } from 'react';
import { adminService } from '../../services/api';

export default function AdminRecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    calories: '',
    protein: '',
    price: '',
    ingredients: '',
    method: '',
    tips: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const debounceTimer = useRef(null);

  useEffect(() => {
    loadCategories();
    fetchRecipes('', '');
  }, []);

  const loadCategories = async () => {
    try {
      const res = await adminService.getRecipeCategories();
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setCategories(list);
    } catch (err) {
      console.error('Failed to load recipe categories:', err);
    }
  };

  const fetchRecipes = async (q = searchQuery, cat = selectedCategory) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (q) params.search = q;
      if (cat) params.category = cat;
      const res = await adminService.getRecipes(params);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setRecipes(list);
    } catch (err) {
      console.error('Failed to load recipes:', err);
      setError('Failed to load recipes.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchRecipes(val, selectedCategory);
    }, 300);
  };

  const handleCategoryFilter = (catId) => {
    setSelectedCategory(catId);
    fetchRecipes(searchQuery, catId);
  };

  const openAddModal = () => {
    setEditingRecipe(null);
    setFormData({
      name: '',
      category_id: categories.length > 0 ? categories[0].id : '',
      calories: '',
      protein: '',
      price: '',
      ingredients: '',
      method: '',
      tips: '',
    });
    setImageFile(null);
    setImagePreview(null);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (r) => {
    setEditingRecipe(r);
    setFormData({
      name: r.name || '',
      category_id: r.category?.id || r.category || '',
      calories: r.calories ?? '',
      protein: r.protein ?? '',
      price: r.price ?? '',
      ingredients: r.ingredients || '',
      method: r.method || '',
      tips: r.tips || '',
    });
    setImageFile(null);
    setImagePreview(r.image_url || null);
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
      if (formData.category_id) payload.append('category_id', formData.category_id);
      if (formData.calories !== '') payload.append('calories', formData.calories);
      if (formData.protein !== '') payload.append('protein', formData.protein);
      if (formData.price !== '') payload.append('price', formData.price);
      if (formData.ingredients) payload.append('ingredients', formData.ingredients.trim());
      if (formData.method) payload.append('method', formData.method.trim());
      if (formData.tips) payload.append('tips', formData.tips.trim());

      if (imageFile) {
        payload.append('image', imageFile);
      }

      if (editingRecipe) {
        await adminService.updateRecipe(editingRecipe.id, payload);
        setSuccessMsg(`Recipe "${formData.name}" updated successfully.`);
      } else {
        await adminService.createRecipe(payload);
        setSuccessMsg(`Recipe "${formData.name}" created successfully.`);
      }

      setIsFormOpen(false);
      fetchRecipes(searchQuery, selectedCategory);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Save recipe failed:', err);
      const resErrors = err.response?.data;
      if (resErrors && typeof resErrors === 'object') {
        setFormErrors(resErrors);
      } else {
        setError('Failed to save recipe.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteRecipe = async (id, name) => {
    if (!window.confirm(`Delete recipe "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await adminService.deleteRecipe(id);
      setSuccessMsg(`Recipe "${name}" deleted.`);
      fetchRecipes(searchQuery, selectedCategory);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Delete recipe failed:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete recipe.';
      setError(errMsg);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[420px] mx-auto w-full">
      {/* HEADER */}
      <div className="text-2xl font-extrabold text-gray-900 mb-1">
        Recipes 📖
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>
          Total Recipes: <strong className="text-purple-700">{recipes.length}</strong>
        </span>
        <button
          onClick={openAddModal}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white font-semibold text-xs shadow hover:opacity-95 transition cursor-pointer"
        >
          + Add Recipe
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
          placeholder="Search recipes..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-purple-600/20 bg-white/70 text-sm focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
        />
      </div>

      {/* CATEGORY FILTER SELECT */}
      {categories.length > 0 && (
        <div className="mb-3">
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white/80 text-xs font-medium text-gray-700"
          >
            <option value="">All Recipe Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* RECIPES LIST */}
      <div className="bg-white/75 backdrop-blur-[18px] rounded-[22px] p-3.5 border border-purple-600/15 shadow-[0_10px_25px_rgba(124,58,237,0.12)]">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : recipes.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">No recipes found</p>
        ) : (
          recipes.map((r) => (
            <div
              key={r.id}
              className="p-3 rounded-[14px] mb-2.5 bg-white/60 border border-purple-600/10 hover:bg-[#ede9fe] hover:-translate-y-0.5 transition duration-200 flex gap-3 items-center"
            >
              {/* IMAGE BADGE */}
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200/50 flex-shrink-0 overflow-hidden flex items-center justify-center text-xl">
                {r.image_url ? (
                  <img
                    src={r.image_url}
                    alt={r.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  '📖'
                )}
              </div>

              {/* DETAILS */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{r.name}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {r.category?.name || 'Recipe'}
                  {r.calories ? ` • ${r.calories} kcal` : ''}
                  {r.protein ? ` • ${r.protein}g protein` : ''}
                </div>

                <div className="flex gap-3 mt-1.5 text-xs">
                  <button
                    onClick={() => openEditModal(r)}
                    className="text-[#7c3aed] font-semibold hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteRecipe(r.id, r.name)}
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

      {/* ADD / EDIT RECIPE MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-[26px] p-5 max-w-[400px] w-full border border-purple-200 shadow-2xl my-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              {editingRecipe ? 'Edit Recipe 📖' : 'Add Recipe 📖'}
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
                <label className="text-xs font-semibold text-gray-700 block mb-1">Recipe Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Calories</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.calories}
                    onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Protein (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.protein}
                    onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Ingredients (separated by semicolons ';')
                </label>
                <textarea
                  rows="2"
                  value={formData.ingredients}
                  onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                  placeholder="200g chicken breast; 1 tbsp olive oil; salt & pepper"
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                ></textarea>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Method (steps separated by periods '.')
                </label>
                <textarea
                  rows="3"
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  placeholder="Heat pan. Cook chicken for 8 mins. Serve hot."
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                ></textarea>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Tips (optional)</label>
                <textarea
                  rows="2"
                  value={formData.tips}
                  onChange={(e) => setFormData({ ...formData, tips: e.target.value })}
                  placeholder="Optional cooking tips"
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm"
                ></textarea>
              </div>

              {/* IMAGE UPLOAD & PREVIEW */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Recipe Image</label>
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
                  {formSubmitting ? 'Saving...' : 'Save Recipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
