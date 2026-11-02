import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { recipeService } from '../../services/api';
import mealFallbackImg from '../../assets/images/meal.png';

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecipeDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await recipeService.getRecipeDetail(id);
      setRecipe(res);
    } catch (err) {
      setError('Recipe not found or unable to load details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecipeDetail();
  }, [fetchRecipeDetail]);

  // Robust ingredient list extraction (preserves units and quantities)
  const ingredientsList = React.useMemo(() => {
    if (!recipe) return [];
    if (Array.isArray(recipe.ingredients_list) && recipe.ingredients_list.length > 0) {
      return recipe.ingredients_list;
    }
    if (typeof recipe.ingredients === 'string' && recipe.ingredients.trim()) {
      return recipe.ingredients
        .split(';')
        .map((i) => i.trim())
        .filter(Boolean);
    }
    return [];
  }, [recipe]);

  // Robust steps list extraction (preserves step order and text)
  const stepsList = React.useMemo(() => {
    if (!recipe) return [];
    if (Array.isArray(recipe.steps_list) && recipe.steps_list.length > 0) {
      return recipe.steps_list;
    }
    if (typeof recipe.method === 'string' && recipe.method.trim()) {
      return recipe.method
        .split('.')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [recipe]);

  // Robust tips list extraction
  const tipsList = React.useMemo(() => {
    if (!recipe) return [];
    if (Array.isArray(recipe.tips_list) && recipe.tips_list.length > 0) {
      return recipe.tips_list;
    }
    if (typeof recipe.tips === 'string' && recipe.tips.trim()) {
      return recipe.tips
        .split(';')
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return [];
  }, [recipe]);

  const categoryName =
    typeof recipe?.category === 'object'
      ? recipe?.category?.name
      : recipe?.category || 'NutriCore Dish';

  const imageUrl = recipe?.image_url || recipe?.image;

  return (
    <div className="flex-1 flex flex-col justify-between relative bg-gradient-to-br from-[#e9d5ff] to-[#f5f3ff]">
      <div className="px-3 pb-24 pt-4 overflow-y-auto no-scrollbar space-y-4">
        {/* TOP BAR */}
        <div className="flex justify-between items-center px-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>

          <span className="text-xs font-semibold px-3 py-1 bg-white/80 backdrop-blur rounded-full text-[#4c1d95] shadow-xs border border-purple-100">
            {categoryName}
          </span>

          <button
            type="button"
            onClick={fetchRecipeDetail}
            disabled={loading}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex justify-between items-center">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => navigate('/recipes')}
              className="text-red-800 font-semibold underline ml-2"
            >
              Back to Library
            </button>
          </div>
        )}

        {loading && (
          <div className="py-20 text-center">
            <RefreshCw size={28} className="animate-spin text-[#7c3aed] mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">Loading recipe details...</p>
          </div>
        )}

        {!loading && recipe && (
          /* MAIN WHITE CONTAINER */
          <div className="w-full bg-white/95 rounded-[22px] p-4 shadow-[0_12px_25px_rgba(139,92,246,0.15)] border border-purple-100/60 box-border">
            {/* 🔝 TOP SECTION: TITLE, STATS, & CIRCULAR IMAGE */}
            <div className="flex justify-between items-center gap-2.5">
              <div className="flex-1 pr-1">
                <h1 className="text-2xl font-bold text-[#4c1d95] leading-tight break-words m-0">
                  {recipe.name}
                </h1>

                {/* CIRCULAR STATS GAUGE BADGES */}
                <div className="flex gap-2.5 mt-3">
                  {/* Calories Stat */}
                  <div className="w-[52px] h-[52px] rounded-full border-2 border-[#c084fc] flex flex-col items-center justify-center text-[11px] bg-white text-gray-700 shadow-xs flex-shrink-0">
                    <b className="text-gray-900 leading-tight">
                      {recipe.calories != null ? Math.round(recipe.calories) : '--'}
                    </b>
                    <span className="text-[10px] text-gray-500 leading-none">kcal</span>
                  </div>

                  {/* Protein Stat */}
                  <div className="w-[52px] h-[52px] rounded-full border-2 border-[#c084fc] flex flex-col items-center justify-center text-[11px] bg-white text-gray-700 shadow-xs flex-shrink-0">
                    <b className="text-gray-900 leading-tight">
                      {recipe.protein != null ? Number(recipe.protein).toFixed(1) : '--'}
                    </b>
                    <span className="text-[10px] text-gray-500 leading-none">g</span>
                  </div>
                </div>
              </div>

              {/* CIRCULAR FOOD IMAGE (140px) */}
              <img
                src={imageUrl || mealFallbackImg}
                alt={recipe.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = mealFallbackImg;
                }}
                className="w-[130px] h-[130px] rounded-full object-cover flex-shrink-0 shadow-md border-2 border-purple-200 bg-gray-100"
              />
            </div>

            {/* 🥗 INGREDIENTS CARD */}
            <div className="bg-[#f5f3ff] p-4 rounded-2xl mt-3 border border-purple-100/60">
              <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <span>🥗</span>
                <span>Ingredients</span>
              </h3>

              {ingredientsList.length > 0 ? (
                <ul className="space-y-1.5 pl-0 list-none m-0">
                  {ingredientsList.map((item, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-[#7c3aed] font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400 italic">No ingredient list specified.</p>
              )}
            </div>

            {/* 💡 TIPS CARD */}
            <div className="bg-[#f5f3ff] p-4 rounded-2xl mt-3 border border-purple-100/60">
              <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <span>💡</span>
                <span>Tips</span>
              </h3>

              {tipsList.length > 0 ? (
                <div className="space-y-1.5">
                  {tipsList.map((tip, idx) => (
                    <p key={idx} className="text-sm text-gray-700 m-0 flex items-start gap-2">
                      <span className="text-[#a78bfa] font-bold">•</span>
                      <span>{tip}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600 m-0">
                  Use fresh ingredients and adjust spices to your taste.
                </p>
              )}
            </div>

            {/* 👨‍🍳 PREPARATION STEPS CARD */}
            <div className="bg-[#f5f3ff] p-4 rounded-2xl mt-3 border border-purple-100/60">
              <h3 className="text-base font-semibold text-gray-900 mb-2.5 flex items-center gap-1.5">
                <span>👨‍🍳</span>
                <span>Steps</span>
              </h3>

              {stepsList.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {stepsList.map((step, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-3 rounded-xl text-[13px] text-gray-800 shadow-[0_4px_8px_rgba(0,0,0,0.05)] border border-purple-50 leading-snug flex flex-col justify-between"
                    >
                      <span className="text-xs font-bold text-[#7c3aed] mb-1">
                        Step {idx + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No preparation steps specified.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
