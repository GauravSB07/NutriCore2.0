import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { nutritionService } from '../../services/api';
import { ArrowLeft, RefreshCw, AlertCircle, Check } from 'lucide-react';

export default function FoodDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [food, setFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadFood() {
      setLoading(true);
      setError(null);
      try {
        const data = await nutritionService.getFoodDetail(id);
        if (isMounted) {
          setFood(data);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load food details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadFood();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const changeQty = (delta) => {
    setQuantity((prev) => {
      const next = Math.max(1, prev + delta);
      return next;
    });
  };

  const handleQtyChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      setQuantity(val);
    } else if (e.target.value === '') {
      setQuantity('');
    }
  };

  // Calculations exactly matching Django food_detail.html:
  // if food.unit === 'g' || food.unit === 'ml':
  //    cal = (cal100 / 100) * qty;
  //    prot = (prot100 / 100) * qty;
  // else:
  //    cal = calUnit * qty;
  //    prot = protUnit * qty;
  // percent = min(100, (protein / 30) * 100);
  const q = typeof quantity === 'number' ? quantity : parseFloat(quantity) || 0;
  const isGramOrMl = food?.unit_type === 'g' || food?.unit_type === 'ml';
  const calories = isGramOrMl
    ? ((food?.calories_per_100g || 0) / 100) * q
    : (food?.calories_per_unit || 0) * q;
  const protein = isGramOrMl
    ? ((food?.protein_per_100g || 0) / 100) * q
    : (food?.protein_per_unit || 0) * q;
  const proteinPercent = Math.min(100, Math.round((protein / 30) * 100));

  const handleAddToMeal = async (e) => {
    e.preventDefault();
    if (q <= 0) {
      setError('Please enter a valid quantity greater than 0.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await nutritionService.logMeal({
        food_id: food.id,
        quantity: q,
        unit: food.unit_type || 'g',
        is_cheat: false,
      });
      setSuccessMsg('Meal Added Successfully ✅');
      setTimeout(() => {
        navigate('/nutrition/meals');
      }, 500);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.quantity?.[0] ||
        'Failed to add meal log.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 pt-6 pb-20 space-y-5 animate-pulse">
        <div className="h-6 w-24 bg-gray-200 rounded"></div>
        <div className="h-56 bg-gray-200 rounded-3xl"></div>
        <div className="h-24 bg-gray-200 rounded-2xl"></div>
        <div className="h-20 bg-gray-200 rounded-2xl"></div>
      </div>
    );
  }

  if (error && !food) {
    return (
      <div className="px-4 pt-8 text-center space-y-4">
        <AlertCircle size={40} className="mx-auto text-red-500" />
        <h2 className="text-lg font-bold text-gray-800">Food Item Not Found</h2>
        <p className="text-sm text-gray-500">{error}</p>
        <Link
          to="/nutrition/foods"
          className="inline-block px-5 py-2.5 rounded-2xl bg-purple-600 text-white text-sm font-semibold"
        >
          Back to Library
        </Link>
      </div>
    );
  }

  const unitSuffix =
    food.unit_type === 'g' ? '100g' : food.unit_type === 'ml' ? '100ml' : 'piece';

  return (
    <div className="px-4 pt-4 pb-20 space-y-5">
      {/* Top back link */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/nutrition/foods')}
          className="p-1 rounded-full text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-xs font-medium text-gray-500">Back to Food Library</span>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-100 text-red-600 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-green-100 text-green-700 rounded-xl text-xs flex items-center gap-2">
          <Check size={15} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 🥗 HERO CARD */}
      <div className="relative bg-[#f3f0f7] rounded-3xl p-5 overflow-hidden min-h-[170px] shadow-sm">
        {/* TEXT */}
        <div className="relative z-10 w-1/2">
          <h2 className="text-xl font-semibold text-gray-800 leading-snug">
            {food.name}
          </h2>

          {/* CALORIES */}
          <div className="mt-4 bg-white/70 backdrop-blur px-3 py-2 rounded-xl inline-block shadow-sm">
            🔥 <b><span>{calories.toFixed(1)}</span> kcal</b>
            <span className="text-xs text-gray-500 block">/ {unitSuffix}</span>
          </div>

          {/* PROTEIN */}
          <div className="mt-2 bg-white/70 backdrop-blur px-3 py-2 rounded-xl inline-block shadow-sm">
            💪 <b><span>{protein.toFixed(1)}</span> g</b>
            <span className="text-xs text-gray-500 block">protein</span>
          </div>
        </div>

        {/* IMAGE */}
        <div className="absolute right-0 top-0 h-full w-1/2 flex items-center justify-center p-2">
          {food.image_url || food.image ? (
            <img
              src={food.image_url || food.image}
              alt={food.name}
              className="h-44 object-contain drop-shadow-xl"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/images/login.webp';
              }}
            />
          ) : (
            <div className="w-28 h-28 bg-gray-100 rounded-2xl flex items-center justify-center text-xs text-gray-400">
              No Image
            </div>
          )}
        </div>
      </div>

      {/* 📊 NUTRITION CARD */}
      <div className="bg-white rounded-2xl p-4 shadow flex items-center gap-4">
        {/* CIRCLE */}
        <div className="w-20 h-20 rounded-full border-[6px] border-purple-400 flex items-center justify-center text-sm font-semibold text-purple-600 flex-shrink-0">
          {proteinPercent}%
        </div>

        {/* DETAILS */}
        <div className="flex-1 flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 font-medium text-gray-700">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            Protein
          </div>
          <div className="font-semibold text-gray-800">{protein.toFixed(1)} g</div>
          <div className="text-gray-400 text-xs">100%</div>
        </div>
      </div>

      {/* ⚙️ QUANTITY & SERVING */}
      <form onSubmit={handleAddToMeal} className="space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow flex items-center justify-between">
          {/* LEFT */}
          <div>
            <p className="text-xs text-gray-500">Quantity</p>
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => changeQty(-1)}
                className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-base font-bold active:scale-95 transition cursor-pointer"
              >
                -
              </button>

              <input
                type="number"
                value={quantity}
                onChange={handleQtyChange}
                min="0.1"
                step="any"
                className="w-12 text-center outline-none font-semibold text-gray-800"
              />

              <button
                type="button"
                onClick={() => changeQty(1)}
                className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-base font-bold active:scale-95 transition cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <div className="text-right">
            <p className="text-xs text-gray-500">Serving</p>
            <p className="mt-2 text-sm font-medium text-gray-800">
              1 Piece ({food.serving_quantity || 30} g)
            </p>
          </div>
        </div>

        {/* 🔘 BUTTONS */}
        <div className="flex gap-3">
          {/* ADD */}
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-2xl shadow font-medium cursor-pointer active:scale-95 transition flex items-center justify-center gap-1.5"
          >
            {submitting && <RefreshCw size={15} className="animate-spin" />}
            <span>➕ Add to Meal</span>
          </button>

          {/* CHEAT */}
          <Link
            to={`/nutrition/cheat/${food.id}`}
            className="flex-1 text-center bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-2xl shadow font-medium cursor-pointer active:scale-95 transition flex items-center justify-center gap-1"
          >
            🔥 Cheat
          </Link>
        </div>
      </form>
    </div>
  );
}
