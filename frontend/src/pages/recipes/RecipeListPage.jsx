import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, RefreshCw, Utensils } from 'lucide-react';
import { recipeService } from '../../services/api';
import mealFallbackImg from '../../assets/images/meal.webp';

export default function RecipeListPage() {
  const navigate = useNavigate();

  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState(''); // '', 'high_protein', 'low_cal', 'veg'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const searchDebounceRef = useRef(null);

  // Fetch categories once
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const catRes = await recipeService.getCategories();
        setCategories(Array.isArray(catRes) ? catRes : catRes.results || []);
      } catch (err) {
        // non-blocking
      }
    };
    fetchCategories();
  }, []);

  // Fetch recipes based on search, filter, and category
  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCategory) params.category = selectedCategory;
      if (selectedFilter) params.filter = selectedFilter;

      const res = await recipeService.getRecipes(params);
      const list = res.results ? res.results : Array.isArray(res) ? res : res.recipes || [];
      setRecipes(list);
    } catch (err) {
      setError('Unable to load recipe library.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, selectedFilter]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // Debounced search input handler
  const handleSearchChange = (e) => {
    const val = e.target.value;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchTerm(val);
    }, 350);
  };

  const handleTabSelect = (tabId) => {
    if (tabId === 'home') navigate('/');
    else if (tabId === 'nutrition') navigate('/nutrition/meals');
    else if (tabId === 'workouts') navigate('/workouts/start');
    else if (tabId === 'progress') navigate('/progress');
    else if (tabId === 'recipes') navigate('/recipes');
  };

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      <div className="px-0 pb-28 pt-4 overflow-y-auto no-scrollbar space-y-3">
        {/* 🔝 HEADER */}
        <div className="text-center px-4 pt-1 pb-1">
          <h1 className="text-2xl font-bold text-[#4c1d95] tracking-tight">
            🍽️ Recipe Library
          </h1>
        </div>

        {/* 🔍 SEARCH BOX */}
        <div className="mx-4 bg-white rounded-[18px] px-4 py-3 flex items-center gap-2.5 shadow-[0_10px_25px_rgba(139,92,246,0.08)] border border-purple-50">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            defaultValue={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search recipes..."
            className="w-full border-none outline-none text-sm bg-transparent placeholder-gray-400 text-gray-800"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs text-gray-400 hover:text-gray-600 px-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* 🏷️ FILTER CHIPS */}
        <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedFilter('')}
            className={`recipe-filter-chip ${selectedFilter === '' ? 'active' : ''}`}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('high_protein')}
            className={`recipe-filter-chip ${selectedFilter === 'high_protein' ? 'active' : ''}`}
          >
            💪 Protein
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('low_cal')}
            className={`recipe-filter-chip ${selectedFilter === 'low_cal' ? 'active' : ''}`}
          >
            🔥 Low Cal
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('veg')}
            className={`recipe-filter-chip ${selectedFilter === 'veg' ? 'active' : ''}`}
          >
            🥗 Veg
          </button>
        </div>

        {/* 📂 CATEGORIES DROPDOWN BUTTON */}
        <div className="px-4">
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="w-full bg-white rounded-2xl px-4 py-3 flex justify-between items-center text-[13px] font-semibold text-gray-800 shadow-[0_8px_20px_rgba(139,92,246,0.08)] border border-purple-50 cursor-pointer transition hover:bg-purple-50/50"
          >
            <span>
              {selectedCategory
                ? `Category: ${
                    categories.find((c) => c.id === selectedCategory)?.name || 'Filtered'
                  }`
                : 'Categories'}
            </span>
            <span className="text-gray-500">
              {dropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {/* DROPDOWN CATEGORY CHIPS */}
          {dropdownOpen && (
            <div className="flex flex-wrap gap-2 mt-3 p-3 bg-white/90 backdrop-blur rounded-2xl border border-purple-100 shadow-sm animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  setDropdownOpen(false);
                }}
                className={`recipe-filter-chip text-xs ${
                  selectedCategory === null ? 'active' : ''
                }`}
              >
                All Categories
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setDropdownOpen(false);
                  }}
                  className={`recipe-filter-chip text-xs ${
                    selectedCategory === cat.id ? 'active' : ''
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="mx-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex justify-between items-center">
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchRecipes}
              className="text-red-800 font-semibold underline ml-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="py-16 text-center">
            <RefreshCw size={26} className="animate-spin text-[#7c3aed] mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">Loading delicious recipes...</p>
          </div>
        )}

        {/* 🍲 RECIPE CARDS LIST */}
        {!loading && (
          <div className="space-y-3 px-4">
            {recipes.length > 0 ? (
              recipes.map((recipe) => {
                const imgUrl = recipe.image_url || recipe.image;
                const categoryName =
                  typeof recipe.category === 'object'
                    ? recipe.category?.name
                    : recipe.category || 'Uncategorized';

                return (
                  <div
                    key={recipe.id}
                    onClick={() => navigate(`/recipes/${recipe.id}`)}
                    className="recipe-card cursor-pointer"
                  >
                    {/* RECIPE IMAGE */}
                    <img
                      src={imgUrl || mealFallbackImg}
                      alt={recipe.name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = mealFallbackImg;
                      }}
                      loading="lazy"
                      className="w-[82px] h-[82px] rounded-[18px] object-cover flex-shrink-0 bg-gray-200 shadow-xs"
                    />

                    {/* CONTENT */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="m-0 text-[15px] font-bold text-gray-900 leading-snug">
                          {recipe.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">{categoryName}</p>
                      </div>

                      {/* STATS CHIPS */}
                      <div className="flex gap-2 mt-2 flex-wrap items-center">
                        <div className="recipe-stat-box">
                          <span>💪</span>
                          <span>{Number(recipe.protein || 0).toFixed(1)}g</span>
                        </div>

                        <div className="recipe-stat-box">
                          <span>🔥</span>
                          <span>{Math.round(recipe.calories || 0)} kcal</span>
                        </div>

                        {recipe.price != null && Number(recipe.price) > 0 && (
                          <div className="recipe-stat-box bg-emerald-50 text-emerald-700">
                            <span>💰</span>
                            <span>${Number(recipe.price).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 text-gray-500 text-sm">
                <Utensils size={36} className="text-purple-300 mx-auto mb-2" />
                <p className="font-semibold text-gray-700">No recipes found 🍽️</p>
                <p className="text-xs text-gray-400 mt-1">
                  Try adjusting your search query or filter tags.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
