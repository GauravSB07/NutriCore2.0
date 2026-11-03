import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { nutritionService } from '../../services/api';
import { ArrowLeft, RefreshCw, AlertCircle, Check } from 'lucide-react';

export default function CheatMealPage() {
  const { foodId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeFoodId = foodId || searchParams.get('food_id');

  const [food, setFood] = useState(null);
  const [foodsList, setFoodsList] = useState([]);
  const [cheatStatus, setCheatStatus] = useState(null);
  const [quantity, setQuantity] = useState(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [statusData, foodsData] = await Promise.all([
          nutritionService.getCheatStatus(),
          nutritionService.getFoods({ page_size: 100 }),
        ]);

        if (isMounted) {
          setCheatStatus(statusData);
          const list = Array.isArray(foodsData) ? foodsData : foodsData.results || [];
          setFoodsList(list);

          if (activeFoodId) {
            const matched = list.find((f) => String(f.id) === String(activeFoodId));
            if (matched) {
              setFood(matched);
            } else {
              // Fetch individual food
              const detail = await nutritionService.getFoodDetail(activeFoodId);
              if (isMounted) setFood(detail);
            }
          } else if (list.length > 0) {
            // Default to first food if none specified
            setFood(list[0]);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load cheat meal data', err);
          setError('Failed to load cheat meal details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeFoodId]);

  const changeQty = (val) => {
    setQuantity((prev) => {
      const current = parseFloat(prev) || 0;
      const next = current + val;
      return next < 0 ? 0 : next;
    });
  };

  const handleQtyInput = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      setQuantity(val);
    } else if (e.target.value === '') {
      setQuantity('');
    }
  };

  // Real-time calories and points preview
  const q = typeof quantity === 'number' ? quantity : parseFloat(quantity) || 0;
  const unitType = food?.unit_type || 'g';
  const cal100 = food?.calories_per_100g || 0;
  const calUnit = food?.calories_per_unit || 0;

  let calculatedCalories = 0;
  if (unitType === 'g' || unitType === 'ml') {
    if (cal100 > 0) {
      calculatedCalories = (cal100 / 100) * q;
    } else if (calUnit > 0) {
      calculatedCalories = calUnit * q;
    }
  } else {
    if (calUnit > 0) {
      calculatedCalories = calUnit * q;
    } else if (cal100 > 0) {
      calculatedCalories = (cal100 / 100) * (q * (food?.serving_quantity || 100));
    }
  }

  const calories = Math.round(calculatedCalories * 10) / 10;
  const points = Math.floor(calories / 4);

  const unitLabel = (unitType === 'g' && cal100 > 0) ? 'g' : unitType === 'ml' ? 'ml' : 'pcs';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!food) {
      setError('Please select a food.');
      return;
    }
    if (q <= 0) {
      setError('Enter a valid quantity.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await nutritionService.logCheatMeal({
        food_id: food.id,
        quantity: q,
        unit: food.unit_type,
      });

      setSuccessMsg(res.message || `🔥 Cheat meal added (-${points} pts)`);
      setTimeout(() => {
        navigate('/nutrition/meals');
      }, 500);
    } catch (err) {
      const data = err.response?.data;
      const msg =
        data?.detail ||
        data?.is_cheat ||
        data?.quantity?.[0] ||
        data?.non_field_errors?.[0] ||
        'Cheat meal request failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="pb-6 space-y-4 animate-pulse">
        <div className="h-48 bg-gray-200 rounded-b-3xl"></div>
        <div className="px-4 space-y-3">
          <div className="h-16 bg-gray-200 rounded-xl"></div>
          <div className="h-16 bg-gray-200 rounded-xl"></div>
          <div className="h-20 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 space-y-4">
      {/* 🔥 HEADER BANNER */}
      <div className="relative h-48 rounded-b-3xl overflow-hidden shadow-md">
        <img
          src="/images/cheat_img.webp"
          alt="Cheat Meal"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/images/login.webp';
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/70 via-purple-500/40 to-transparent"></div>

        <div className="relative z-10 h-full flex flex-col justify-center px-5 text-white max-w-[65%]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-2 p-1.5 rounded-full bg-black/20 text-white w-8 h-8 flex items-center justify-center hover:bg-black/30 transition"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-2xl font-bold leading-tight">🔥 Cheat Meal</h2>
          <p className="text-sm opacity-90 mt-1">Use your points wisely</p>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* 🔔 MESSAGES */}
        {error && (
          <div className="p-3 rounded-lg text-sm bg-red-100 text-red-600 flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-lg text-sm bg-green-100 text-green-600 flex items-center gap-2">
            <Check size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 💎 POINTS CARD */}
        <div className="bg-white rounded-xl p-3 shadow-sm flex justify-between items-center border border-purple-50">
          <div>
            <p className="text-xs text-gray-500 font-medium">Your Points</p>
            <h2 className="text-xl font-bold text-purple-600">
              {cheatStatus?.points ?? 0} pts
            </h2>
          </div>
          <div className="bg-purple-100 text-purple-600 p-2 rounded-full text-lg">
            ⭐
          </div>
        </div>

        {/* FOOD SELECTOR (if multiple foods available) */}
        {!activeFoodId && foodsList.length > 1 && (
          <div className="bg-white rounded-xl p-2.5 shadow-sm border border-purple-50">
            <label className="text-xs text-gray-500 block mb-1 font-medium">
              Select Cheat Food
            </label>
            <select
              value={food?.id || ''}
              onChange={(e) => {
                const found = foodsList.find((f) => String(f.id) === e.target.value);
                if (found) setFood(found);
              }}
              className="w-full text-sm bg-purple-50/50 p-2 rounded-lg border border-purple-100 outline-none font-medium text-gray-800"
            >
              {foodsList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 🍽 FOOD INFO */}
        {food && (
          <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 border border-purple-50">
            <img
              src={food.image_url || food.image || '/images/login.webp'}
              alt={food.name}
              className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
              loading="eager"
              decoding="async"
              width={56}
              height={56}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/images/login.webp';
              }}
            />

            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{food.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {food.calories_per_100g
                  ? `${food.calories_per_100g} kcal / 100g`
                  : `${food.calories_per_unit || 0} kcal / piece`}
              </p>
            </div>
          </div>
        )}

        {/* 📊 STATS */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-purple-50">
            <p className="text-xs text-gray-500 font-medium">Calories</p>
            <h3 className="font-semibold text-pink-500 text-base mt-0.5">
              <span>{calories.toFixed(1)}</span> kcal
            </h3>
          </div>

          <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-purple-50">
            <p className="text-xs text-gray-500 font-medium">Points</p>
            <h3 className="font-semibold text-purple-500 text-base mt-0.5">
              <span>{points}</span>
            </h3>
          </div>
        </div>

        {/* 🔥 FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 🔢 QUANTITY */}
          <div className="bg-white rounded-xl p-3 shadow-sm space-y-2 border border-purple-50">
            <p className="text-xs text-gray-500 font-medium">Quantity</p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeQty(-1)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-200 active:scale-95 transition cursor-pointer"
              >
                -
              </button>

              <input
                type="number"
                value={quantity}
                onChange={handleQtyInput}
                min="0"
                step="any"
                className="flex-1 text-center bg-gray-100 rounded-lg py-2 text-sm font-semibold text-gray-800 outline-none"
              />

              <button
                type="button"
                onClick={() => changeQty(1)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-200 active:scale-95 transition cursor-pointer"
              >
                +
              </button>

              <span className="text-xs text-gray-500 font-medium min-w-[28px]">
                {unitLabel}
              </span>
            </div>
          </div>

          {/* 🔥 BUTTON */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-xl shadow text-sm font-semibold active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            {submitting && <RefreshCw size={15} className="animate-spin" />}
            <span>🔥 Eat Cheat Meal</span>
          </button>
        </form>
      </div>
    </div>
  );
}
