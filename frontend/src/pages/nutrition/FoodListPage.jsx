import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { nutritionService } from '../../services/api';
import { RefreshCw, Search, X } from 'lucide-react';

export default function FoodListPage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextPageUrl, setNextPageUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const searchBoxRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Fetch categories on mount
  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      try {
        const data = await nutritionService.getCategories();
        if (isMounted) {
          const list = Array.isArray(data) ? data : data.results || [];
          setCategories(list);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery]);

  // Autocomplete suggestion matches
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = foods
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((f) => f.name);

    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }, [searchQuery, foods]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch foods with filters
  const fetchFoods = useCallback(
    async (page = 1, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const params = { page };
        if (debouncedQuery) {
          params.search = debouncedQuery;
        }
        if (selectedCategories.size > 0) {
          params.category = Array.from(selectedCategories).join(',');
        }

        const data = await nutritionService.getFoods(params);

        if (Array.isArray(data)) {
          setFoods(data);
          setTotalCount(data.length);
          setNextPageUrl(null);
        } else {
          const results = data.results || [];
          setFoods((prev) => (append ? [...prev, ...results] : results));
          setTotalCount(data.count || results.length);
          setNextPageUrl(data.next || null);
        }
        setCurrentPage(page);
      } catch (err) {
        console.error('Failed to fetch foods', err);
        setError('Failed to load foods. Please check your network connection.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, selectedCategories]
  );

  // Refetch when debounced query or selected categories change
  useEffect(() => {
    fetchFoods(1, false);
  }, [fetchFoods]);

  // Category toggle handler
  const handleToggleCategory = (catId) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // Clear filters
  const handleClearFilters = () => {
    setSelectedCategories(new Set());
    setSearchQuery('');
    setDebouncedQuery('');
    setShowSuggestions(false);
  };

  // Ripple effect on card click
  const handleCardClick = (e, foodId) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const diameter = Math.max(card.clientWidth, card.clientHeight);

    const circle = document.createElement('span');
    circle.style.width = `${diameter}px`;
    circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - diameter / 2}px`;
    circle.style.top = `${e.clientY - rect.top - diameter / 2}px`;
    circle.classList.add('ripple');

    const existing = card.querySelector('.ripple');
    if (existing) existing.remove();
    card.appendChild(circle);

    setTimeout(() => {
      navigate(`/nutrition/foods/${foodId}`);
    }, 180);
  };

  const getUnitDisplay = (food) => {
    const unit = food.unit_type;
    if (unit === 'g') return 'Grams';
    if (unit === 'ml') return 'Ml';
    if (unit === 'unit' || unit === 'piece') return 'Piece';
    return unit ? unit.charAt(0).toUpperCase() + unit.slice(1) : 'Grams';
  };

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      {/* 🔝 HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#111827] leading-none">
            Food Library 🍱
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-1 font-medium">
            Explore foods, calories & nutrition
          </p>
        </div>

        <div className="w-[55px] h-[55px] flex items-center justify-center text-2xl rounded-2xl bg-gradient-to-br from-[#fbcfe8] to-[#ddd6fe] text-[#7c3aed] shadow-[0_6px_14px_rgba(124,58,237,0.15)]">
          🍲
        </div>
      </div>

      <div className="h-[2px] w-full rounded-full bg-gradient-to-r from-[rgba(124,58,237,0.6)] to-[rgba(167,139,250,0.2)]"></div>

      {/* 🔥 CATEGORY FILTERS */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const isSelected = selectedCategories.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleToggleCategory(c.id)}
              className={`px-3 py-2 rounded-xl text-sm transition-all shadow-sm cursor-pointer ${
                isSelected
                  ? 'bg-purple-500 text-white font-medium shadow-purple-200'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {c.name}
            </button>
          );
        })}

        {(selectedCategories.size > 0 || searchQuery) && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm shadow cursor-pointer active:scale-95 transition"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* 🔍 SEARCH */}
      <div className="relative" ref={searchBoxRef}>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search food..."
            className="w-full px-4 py-3 pr-10 rounded-xl bg-white shadow-sm outline-none text-sm text-gray-800 focus:ring-2 focus:ring-purple-300"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={16} />
            </button>
          ) : (
            <Search
              size={16}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute w-full bg-white rounded-xl shadow-lg mt-1 z-50 max-h-40 overflow-y-auto divide-y divide-gray-100 border border-purple-50">
            {suggestions.map((name, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSearchQuery(name);
                  setShowSuggestions(false);
                }}
                className="px-3 py-2 hover:bg-purple-50 cursor-pointer text-sm text-gray-700"
              >
                {name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex justify-between items-center">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchFoods(1, false)}
            className="underline font-semibold ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-3 shadow-sm animate-pulse space-y-2"
            >
              <div className="w-full h-28 bg-gray-200 rounded-xl"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      )}

      {/* 🔥 FOOD GRID */}
      {!loading && foods.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {foods.map((food) => {
            const hasServing = food.serving_name && food.serving_quantity;
            const unitText = getUnitDisplay(food);

            return (
              <div
                key={food.id}
                onClick={(e) => handleCardClick(e, food.id)}
                className="food-card relative overflow-hidden block bg-white rounded-2xl p-3 shadow-sm transition duration-200 hover:scale-[1.02] active:scale-[0.96] cursor-pointer"
              >
                {/* IMAGE */}
                <div className="relative">
                  {food.image_url || food.image ? (
                    <img
                      src={food.image_url || food.image}
                      alt={food.name}
                      className="w-full h-28 object-cover rounded-xl"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/images/login.webp';
                      }}
                    />
                  ) : (
                    <div className="w-full h-28 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400">
                      No Image
                    </div>
                  )}
                </div>

                {/* NAME */}
                <h3 className="mt-2 text-sm font-semibold text-gray-800 line-clamp-1">
                  {food.name}
                </h3>

                {/* SERVING */}
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                  {hasServing ? (
                    <>
                      {food.serving_name} ≈ {food.serving_quantity} {unitText}
                    </>
                  ) : (
                    unitText
                  )}
                </p>

                {/* CALORIES */}
                <p className="text-xs mt-1 text-orange-500 font-medium">
                  🔥{' '}
                  {food.unit_type === 'g'
                    ? `${food.calories_per_100g || 0} kcal / 100g`
                    : food.unit_type === 'ml'
                    ? `${food.calories_per_100g || 0} kcal / 100ml`
                    : `${food.calories_per_unit || 0} kcal / piece`}
                </p>

                {/* PROTEIN */}
                <p className="text-xs text-purple-500 font-medium">
                  💪{' '}
                  {food.unit_type === 'g' || food.unit_type === 'ml'
                    ? `${food.protein_per_100g || 0} g`
                    : `${food.protein_per_unit || 0} g`}{' '}
                  protein
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && foods.length === 0 && (
        <div className="text-center py-12 bg-white/60 backdrop-blur rounded-2xl p-6 shadow-sm border border-purple-100">
          <p className="text-3xl mb-2">🍱</p>
          <p className="text-sm font-semibold text-gray-700">No foods found</p>
          <p className="text-xs text-gray-500 mt-1">
            Try adjusting your category filter or search query.
          </p>
          {(selectedCategories.size > 0 || searchQuery) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-4 px-4 py-2 rounded-xl bg-purple-500 text-white text-xs font-medium shadow cursor-pointer"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* PAGINATION / LOAD MORE */}
      {!loading && nextPageUrl && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => fetchFoods(currentPage + 1, true)}
            disabled={loadingMore}
            className="px-5 py-2.5 rounded-2xl bg-purple-50 text-[#7c3aed] border border-purple-200 text-xs font-semibold hover:bg-purple-100 active:scale-95 transition shadow-sm flex items-center gap-1.5 mx-auto"
          >
            {loadingMore && <RefreshCw size={12} className="animate-spin" />}
            {loadingMore ? 'Loading...' : `Load More (${foods.length} of ${totalCount})`}
          </button>
        </div>
      )}
    </div>
  );
}
