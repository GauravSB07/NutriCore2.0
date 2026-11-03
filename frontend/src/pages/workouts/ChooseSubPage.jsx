import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { workoutService } from '../../services/api';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

export default function ChooseSubPage() {
  const { muscleId } = useParams();
  const navigate = useNavigate();

  const [muscle, setMuscle] = useState(null);
  const [subMuscles, setSubMuscles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [muscleData, subsData] = await Promise.all([
          workoutService.getMuscleDetail(muscleId),
          workoutService.getSubMuscles(muscleId),
        ]);

        if (isMounted) {
          setMuscle(muscleData);
          const list = Array.isArray(subsData) ? subsData : subsData.results || [];
          setSubMuscles(list);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load submuscles', err);
          setError('Unable to load submuscles for this muscle group.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [muscleId]);

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      {/* 🔙 BACK NAVIGATION */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/workouts/start')}
          className="w-10 h-10 rounded-xl bg-[#ede9fe] text-purple-700 flex items-center justify-center font-bold text-lg hover:bg-purple-200 transition cursor-pointer active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[12px] text-[#6b7280] font-semibold tracking-wider">
            CHOOSE WORKOUT
          </p>
          <h2 className="text-[22px] font-bold text-[#111827] leading-tight">
            {muscle ? muscle.name : 'Muscle Group'}
          </h2>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="underline font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="space-y-4 mt-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[120px] rounded-[22px] bg-purple-100/70 animate-pulse"
            ></div>
          ))}
        </div>
      )}

      {/* 🥩 SUBMUSCLE CARDS */}
      {!loading && subMuscles.length > 0 && (
        <div className="space-y-4 mt-2">
          {subMuscles.map((s) => (
            <Link
              key={s.id}
              to={`/workouts/start/sub/${s.id}`}
              className="block h-[120px] rounded-[22px] overflow-hidden relative flex items-center p-4 text-white text-decoration-none shadow-md transition duration-200 hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.98]"
            >
              {/* IMAGE */}
              <img
                src={s.image_url || s.image || '/images/login.webp'}
                alt={s.name}
                className="absolute right-0 bottom-0 h-full w-[60%] object-cover filter contrast-[1.1] saturate-[1.1]"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/images/login.webp';
                }}
              />

              {/* SMOOTH GRADIENT OVERLAY */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to right, rgba(124,58,237,0.88) 0%, rgba(124,58,237,0.70) 35%, rgba(167,139,250,0.35) 65%, rgba(255,255,255,0) 100%)',
                }}
              ></div>

              {/* TEXT */}
              <div className="relative z-10">
                <div className="text-[22px] font-bold uppercase tracking-wide">
                  {s.name}
                </div>
                {s.exercises_count !== undefined && (
                  <p className="text-xs text-white/90 mt-1 font-medium">
                    {s.exercises_count} exercises
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* EMPTY */}
      {!loading && subMuscles.length === 0 && !error && (
        <div className="text-center py-10 bg-white/60 backdrop-blur rounded-2xl p-4 border border-purple-100">
          <p className="text-3xl mb-1">💪</p>
          <p className="text-gray-700 font-semibold text-sm">No Sub-Muscles Found</p>
          <p className="text-gray-500 text-xs mt-1">There are no submuscles in this group yet.</p>
        </div>
      )}
    </div>
  );
}
