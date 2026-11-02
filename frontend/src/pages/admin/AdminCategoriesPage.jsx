import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [name, setName] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getCategories();
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setCategories(list);
    } catch (err) {
      console.error('Failed to load food categories:', err);
      setError('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setName('');
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setName(cat.name || '');
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
      if (editingCategory) {
        await adminService.updateCategory(editingCategory.id, { name: name.trim() });
        setSuccessMsg(`Category "${name}" updated.`);
      } else {
        await adminService.createCategory({ name: name.trim() });
        setSuccessMsg(`Category "${name}" created.`);
      }

      setIsFormOpen(false);
      fetchCategories();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Save category failed:', err);
      const resErrors = err.response?.data;
      if (resErrors && typeof resErrors === 'object') {
        setFormErrors(resErrors);
      } else {
        setError('Failed to save category.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id, catName) => {
    if (!window.confirm(`Delete category "${catName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await adminService.deleteCategory(id);
      setSuccessMsg(`Category "${catName}" deleted.`);
      fetchCategories();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Delete category failed:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete category.';
      setError(errMsg);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[420px] mx-auto w-full">
      {/* HEADER */}
      <div className="text-2xl font-extrabold text-gray-900 mb-1">
        Categories 📂
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>
          Total Categories: <strong className="text-purple-700">{categories.length}</strong>
        </span>
        <button
          onClick={openAddModal}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white font-semibold text-xs shadow hover:opacity-95 transition cursor-pointer"
        >
          + Add Category
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

      {/* CARD LIST */}
      <div className="bg-white/75 backdrop-blur-[18px] rounded-[22px] p-3.5 border border-purple-600/15 shadow-[0_10px_25px_rgba(124,58,237,0.12)]">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : categories.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">No categories found</p>
        ) : (
          categories.map((c) => {
            const count = c.foods_count ?? (Array.isArray(c.foods) ? c.foods.length : (c.food_count ?? 0));
            return (
              <div
                key={c.id}
                className="p-3 rounded-[14px] mb-2.5 bg-white/60 border border-purple-600/10 hover:bg-[#ede9fe] hover:-translate-y-0.5 transition duration-200"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-gray-900">{c.name}</span>
                  <span className="text-xs bg-[#ede9fe] text-[#6d28d9] px-2 py-0.5 rounded-full font-medium">
                    {count} foods
                  </span>
                </div>

                <div className="flex gap-3 mt-2 text-xs">
                  <button
                    onClick={() => openEditModal(c)}
                    className="text-[#7c3aed] font-semibold hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
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

      {/* ADD/EDIT MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-[24px] p-5 max-w-[360px] w-full border border-purple-200 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              {editingCategory ? 'Edit Category 📂' : 'Add Category 📂'}
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
                <label className="text-xs font-semibold text-gray-700 block mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fruits, Protein, Dairy"
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm focus:outline-none focus:border-purple-600"
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
                  {formSubmitting ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
