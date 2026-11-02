import React, { useState, useEffect, useRef } from 'react';
import { adminService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    is_staff: false,
    is_superuser: false,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const debounceTimer = useRef(null);

  useEffect(() => {
    fetchUsers(searchQuery);
  }, []);

  const fetchUsers = async (q = '') => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getUsers(q ? { search: q } : {});
      const userList = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setUsers(userList);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchUsers(val);
    }, 300);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      is_staff: false,
      is_superuser: false,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setFormData({
      username: u.username || '',
      email: u.email || '',
      password: '',
      is_staff: !!u.is_staff,
      is_superuser: !!u.is_superuser,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormErrors({});
    setError(null);

    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        is_staff: formData.is_staff,
        is_superuser: formData.is_superuser,
      };
      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingUser) {
        await adminService.updateUser(editingUser.id, payload);
        setSuccessMsg(`User "${formData.username}" updated successfully.`);
      } else {
        if (!formData.password) {
          setFormErrors({ password: ['Password is required for new users.'] });
          setFormSubmitting(false);
          return;
        }
        await adminService.createUser(payload);
        setSuccessMsg(`User "${formData.username}" created successfully.`);
      }

      setIsFormOpen(false);
      fetchUsers(searchQuery);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Save user failed:', err);
      const resErrors = err.response?.data;
      if (resErrors && typeof resErrors === 'object') {
        setFormErrors(resErrors);
      } else {
        setError('Failed to save user.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteUser = async (id, username) => {
    if (id === currentUser?.id) {
      alert('You cannot delete your own active superuser account.');
      return;
    }

    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await adminService.deleteUser(id);
      setSuccessMsg(`User "${username}" deleted.`);
      fetchUsers(searchQuery);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Delete user failed:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete user.';
      setError(errMsg);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[420px] mx-auto w-full">
      {/* HEADER */}
      <div className="text-2xl font-extrabold text-gray-900 mb-1">
        Users 👤
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>
          Total Users: <strong className="text-purple-700">{users.length}</strong>
        </span>
        <button
          onClick={openAddModal}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white font-semibold text-xs shadow hover:opacity-95 transition cursor-pointer"
        >
          + Add
        </button>
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

      {/* SEARCH BAR */}
      <div className="mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search users..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-purple-600/20 bg-white/70 text-sm focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
        />
      </div>

      {/* USERS CARD */}
      <div className="bg-white/75 backdrop-blur-[18px] rounded-[22px] p-3.5 border border-purple-600/15 shadow-[0_10px_25px_rgba(124,58,237,0.12)]">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">No users found</p>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="p-3 rounded-[14px] mb-2.5 bg-white/60 border border-purple-600/10 hover:bg-[#ede9fe] hover:-translate-y-0.5 transition duration-200"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-sm text-gray-900">{u.username}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{u.email || 'No email set'}</div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {u.is_superuser ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-200 text-purple-800">
                      Superuser
                    </span>
                  ) : u.is_staff ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#ede9fe] text-[#6d28d9]">
                      Staff
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">
                      User
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-2 text-xs">
                <button
                  onClick={() => openEditModal(u)}
                  className="text-[#7c3aed] font-semibold hover:underline cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteUser(u.id, u.username)}
                  className="text-[#dc2626] font-semibold hover:underline cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white/90 backdrop-blur-md rounded-[24px] p-5 max-w-[390px] w-full border border-purple-200 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              {editingUser ? 'Edit User ✏️' : 'Add User 👤'}
            </h3>

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
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  {editingUser ? 'Password (leave blank to keep current)' : 'Password'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : 'Enter password'}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="flex items-center gap-4 py-1">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_staff}
                    onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
                    className="accent-purple-600"
                  />
                  Staff Status
                </label>

                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_superuser}
                    onChange={(e) => setFormData({ ...formData, is_superuser: e.target.checked })}
                    className="accent-purple-600"
                  />
                  Superuser
                </label>
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
                  {formSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
