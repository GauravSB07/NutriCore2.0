import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { nutritionService } from '../../services/api';
import { ChevronDown, RefreshCw, AlertCircle, ArrowLeft, Check } from 'lucide-react';

export default function LogMealPage() {
  const { id } = useParams(); // If present, edit mode
  const navigate = useNavigate();

  const isEditMode = Boolean(id);

  const [selectedFood, setSelectedFood] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);

  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('g');
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  const [loadingInitial, setLoadingInitial] = useState(Boolean(id));
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const searchBoxRef = useRef(null);
  const unitBoxRef = useRef(null);
  const isSelectingRef = useRef(false);
  const searchTimeoutRef = useRef(null);

  const unitLabels = {
    g: 'Grams',
    ml: 'ML',
    unit: 'Piece',
    serving: 'Serving',
  };

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (unitBoxRef.current && !unitBoxRef.current.contains(e.target)) {
        setShowUnitDropdown(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch initial popular foods or pre-fill existing meal if editing
  useEffect(() => {
    let isMounted = true;
    async function init() {
      if (id) {
        setLoadingInitial(true);
        setError(null);
        try {
          const meal = await nutritionService.getMealDetail(id);
          if (isMounted && meal) {
            setQuantity(meal.quantity);
            setUnit(meal.unit || 'g');
            if (meal.food) {
              isSelectingRef.current = true;
              setSelectedFood(meal.food);
              setSearchQuery(meal.food.name);
            }
          }
        } catch (err) {
          if (isMounted) {
            console.error('Failed to initialize LogMealPage', err);
            setError('Failed to load meal data.');
          }
        } finally {
          if (isMounted) setLoadingInitial(false);
        }
      } else {
        // Create mode: form renders immediately, pre-fetch suggestions in background
        setLoadingInitial(false);
        setLoadingSuggestions(true);
        try {
          const foodsRes = await nutritionService.getFoods({ page_size: 15 });
          const list = Array.isArray(foodsRes) ? foodsRes : foodsRes.results || [];
          if (isMounted) setSuggestions(list);
        } catch (err) {
          console.error('Failed to pre-fetch common foods', err);
        } finally {
          if (isMounted) setLoadingSuggestions(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Debounced server-side autocomplete search based on search query
  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }

    const query = searchQuery.trim();
    if (!query) {
      setShowDropdown(false);
      return;
    }

    // Do not reopen suggestions dropdown if user already selected this food
    if (selectedFood && selectedFood.name.toLowerCase() === query.toLowerCase()) {
      setShowDropdown(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await nutritionService.getFoods({ search: query, page_size: 15 });
        const list = Array.isArray(res) ? res : res.results || [];
        setSuggestions(list);
        setShowDropdown(list.length > 0);
      } catch (err) {
        console.error('Error fetching food suggestions:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedFood]);

  const handleSelectFood = (f) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    isSelectingRef.current = true;
    setSearching(false);
    setSelectedFood(f);
    setSearchQuery(f.name);
    setShowDropdown(false);

    // Auto default unit based on available calorie fields & unit_type
    let defaultUnit = 'g';
    if ((f.calories_per_100g || 0) > 0) {
      defaultUnit = f.unit_type === 'ml' ? 'ml' : 'g';
    } else if ((f.calories_per_unit || 0) > 0) {
      defaultUnit = 'unit';
    } else if (f.unit_type) {
      defaultUnit = f.unit_type === 'piece' ? 'unit' : f.unit_type;
    }

    setUnit(defaultUnit);

    // Auto default quantity if empty or 0
    const curQty = parseFloat(quantity);
    if (!quantity || isNaN(curQty) || curQty <= 0) {
      setQuantity(defaultUnit === 'unit' ? 1 : 100);
    }
  };

  // Preview calculations matching Django backend
  const getCalculatedNutrition = () => {
    if (!selectedFood) return { calories: 0, protein: 0 };

    const q = parseFloat(quantity) || 0;
    if (q <= 0) return { calories: 0, protein: 0 };

    let u = unit;
    const cal100 = selectedFood.calories_per_100g || 0;
    const prot100 = selectedFood.protein_per_100g || 0;
    const calUnit = selectedFood.calories_per_unit || 0;
    const protUnit = selectedFood.protein_per_unit || 0;
    const servingQty = selectedFood.serving_quantity || 0;

    // Serving conversion
    if (u === 'serving') {
      if (servingQty > 0) {
        const scaledQty = q * servingQty;
        const baseUnit = selectedFood.unit_type || 'g';
        if (baseUnit === 'g' || baseUnit === 'ml') {
          const c = cal100 > 0 ? (cal100 / 100.0) * scaledQty : calUnit * scaledQty;
          const p = prot100 > 0 ? (prot100 / 100.0) * scaledQty : protUnit * scaledQty;
          return {
            calories: Math.round(c * 10) / 10,
            protein: Math.round(p * 10) / 10,
          };
        } else {
          const c = calUnit > 0 ? calUnit * scaledQty : (cal100 / 100.0) * scaledQty;
          const p = protUnit > 0 ? protUnit * scaledQty : (prot100 / 100.0) * scaledQty;
          return {
            calories: Math.round(c * 10) / 10,
            protein: Math.round(p * 10) / 10,
          };
        }
      } else if (calUnit > 0) {
        u = 'unit';
      } else if (cal100 > 0) {
        u = 'g';
      }
    }

    let c = 0;
    let p = 0;

    if (u === 'g' || u === 'ml') {
      if (cal100 > 0) {
        c = (cal100 / 100.0) * q;
        p = (prot100 / 100.0) * q;
      } else if (calUnit > 0) {
        c = calUnit * q;
        p = protUnit * q;
      }
    } else {
      // unit or piece
      if (calUnit > 0) {
        c = calUnit * q;
        p = protUnit * q;
      } else if (cal100 > 0) {
        if (servingQty > 0) {
          c = (cal100 / 100.0) * (q * servingQty);
          p = (prot100 / 100.0) * (q * servingQty);
        } else {
          c = (cal100 / 100.0) * (q * 100.0);
          p = (prot100 / 100.0) * (q * 100.0);
        }
      }
    }

    return {
      calories: Math.round(c * 10) / 10,
      protein: Math.round(p * 10) / 10,
    };
  };

  const preview = getCalculatedNutrition();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFood) {
      setError('Please select a food item.');
      return;
    }
    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError('Please enter a valid quantity greater than 0.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        food_id: selectedFood.id,
        quantity: parsedQty,
        unit: unit,
      };

      if (isEditMode) {
        await nutritionService.updateMeal(id, payload);
        setSuccess('Meal Updated Successfully');
      } else {
        await nutritionService.logMeal(payload);
        setSuccess('Meal Logged Successfully');
      }

      setTimeout(() => {
        navigate('/nutrition/meals');
      }, 500);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.quantity?.[0] ||
        err.response?.data?.unit?.[0] ||
        'Failed to save meal log.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial && isEditMode) {
    return (
      <div className="px-4 pt-6 pb-20 space-y-4 animate-pulse">
        <div className="h-14 bg-purple-200 rounded-3xl"></div>
        <div className="h-80 bg-gray-100 rounded-3xl"></div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-20">
      {/* Top back link */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 rounded-full text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-xs font-medium text-gray-500">Back</span>
      </div>

      {/* 🔝 HEADER BANNER */}
      <div className="bg-gradient-to-r from-purple-400 to-purple-500 rounded-3xl p-5 text-white mb-5 relative shadow-md">
        <h2 className="text-lg font-semibold">
          {isEditMode ? 'Edit Meal' : 'Log Your Meal'}
        </h2>

        {isEditMode && (
          <span className="absolute top-4 right-4 bg-white/20 text-xs px-3 py-1 rounded-full backdrop-blur font-medium">
            Editing
          </span>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-2xl text-xs flex items-center gap-2">
          <Check size={15} />
          <span>{success}</span>
        </div>
      )}

      {/* 💎 GLASS CARD */}
      <div
        className="rounded-3xl p-5 space-y-5 shadow-lg border"
        style={{
          backdropFilter: 'blur(20px)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(240,235,255,0.92))',
          borderColor: 'rgba(255,255,255,0.7)',
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 🔍 SEARCH FOOD */}
          <div ref={searchBoxRef}>
            <label className="text-sm text-gray-600 font-medium">Food</label>
            <div className="relative mt-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type food name..."
                className="w-full bg-[#f5f3ff] border border-[#8b5cf6]/20 rounded-2xl p-3 pr-10 outline-none text-sm text-gray-800 focus:ring-2 focus:ring-purple-300"
              />
              {(searching || loadingSuggestions) && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none">
                  <RefreshCw size={16} className="animate-spin" />
                </div>
              )}

              {/* Suggestions Dropdown */}
              {showDropdown && (
                <div className="absolute w-full bg-white rounded-2xl shadow-xl mt-2 max-h-60 overflow-y-auto z-50 divide-y divide-gray-100 border border-purple-100">
                  {searching ? (
                    <div className="flex items-center justify-center gap-2 p-3 text-xs text-purple-600 font-medium">
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Searching foods...</span>
                    </div>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((f) => {
                      const calText =
                        f.calories_per_100g > 0
                          ? `${f.calories_per_100g} kcal`
                          : f.calories_per_unit > 0
                          ? `${f.calories_per_unit} kcal`
                          : 'No data';
                      const protText =
                        f.protein_per_100g > 0
                          ? `${f.protein_per_100g}g`
                          : f.protein_per_unit > 0
                          ? `${f.protein_per_unit}g`
                          : 'No data';

                      return (
                        <div
                          key={f.id}
                          onClick={() => handleSelectFood(f)}
                          className="flex items-center gap-2.5 p-2.5 hover:bg-purple-50 cursor-pointer transition"
                        >
                          <img
                            src={f.image_url || f.image || '/images/login.webp'}
                            alt={f.name}
                            className="w-11 h-11 rounded-xl object-cover"
                            loading="lazy"
                            decoding="async"
                            width={44}
                            height={44}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/images/login.webp';
                            }}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-800 line-clamp-1">
                              {f.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {calText} • {protText}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-xs text-gray-400">No foods found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 🔢 QUANTITY AND UNIT */}
          <div>
            <label className="text-sm text-gray-600 font-medium">Quantity</label>
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                step="0.1"
                min="0.1"
                placeholder="0"
                className="w-2/3 bg-[#f5f3ff] border border-[#8b5cf6]/20 rounded-2xl p-3 outline-none text-sm text-gray-800 focus:ring-2 focus:ring-purple-300"
              />

              {/* Custom Dropdown */}
              <div className="relative w-1/3" ref={unitBoxRef}>
                <button
                  type="button"
                  onClick={() => setShowUnitDropdown((prev) => !prev)}
                  className="w-full h-full bg-[#f5f3ff] border border-[#8b5cf6]/20 rounded-2xl px-3 py-3 flex justify-between items-center text-sm font-medium text-gray-700 cursor-pointer"
                >
                  <span>{unitLabels[unit] || unit}</span>
                  <ChevronDown size={14} className="text-gray-500" />
                </button>

                {showUnitDropdown && (
                  <div className="absolute right-0 w-full bg-white rounded-2xl shadow-xl mt-2 overflow-hidden z-50 border border-purple-100 text-sm">
                    {Object.entries(unitLabels).map(([key, label]) => (
                      <div
                        key={key}
                        onClick={() => {
                          setUnit(key);
                          setShowUnitDropdown(false);
                        }}
                        className={`p-3 cursor-pointer hover:bg-purple-50 transition ${
                          unit === key ? 'bg-purple-100/50 font-semibold text-purple-700' : ''
                        }`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 📊 LIVE PREVIEW */}
          <div className="bg-white/70 rounded-2xl p-3 shadow-sm border border-purple-50">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-500">Calories</p>
                <h3 className="text-lg font-semibold text-gray-800">
                  {preview.calories} <span className="text-xs font-normal text-gray-500">kcal</span>
                </h3>
              </div>

              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-500">Protein</p>
                <h3 className="text-lg font-semibold text-gray-800">
                  {preview.protein} <span className="text-xs font-normal text-gray-500">g</span>
                </h3>
              </div>
            </div>
          </div>

          {/* 🔥 CHEAT BUTTON (SECONDARY) */}
          {selectedFood && (
            <Link
              to={`/nutrition/cheat/${selectedFood.id}`}
              className="block text-center bg-gradient-to-r from-red-400 to-pink-500 text-white py-2.5 rounded-xl shadow-sm text-sm font-medium mt-3 active:scale-95 transition"
            >
              🔥 Eat as Cheat Meal
            </Link>
          )}

          {/* ➕ PRIMARY SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white py-3.5 rounded-2xl shadow-[0_10px_25px_rgba(124,58,237,0.35)] text-base font-semibold active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
          >
            {submitting && <RefreshCw size={16} className="animate-spin" />}
            <span>{isEditMode ? 'Update Meal' : '+ Add Meal'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
