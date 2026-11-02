import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { workoutService } from '../../services/api';
import { RefreshCw, AlertCircle, History, BookOpen } from 'lucide-react';

export default function StartWorkoutPage() {
  const navigate = useNavigate();

  const [muscles, setMuscles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMuscles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workoutService.getMuscles();
      const list = Array.isArray(data) ? data : data.results || [];
      setMuscles(list);
    } catch (err) {
      console.error('Failed to load muscles', err);
      setError('Unable to load workout muscle groups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMuscles();
  }, []);

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      {/* 🔝 TOP NAVIGATION ACTIONS */}
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span className="font-semibold text-purple-600 tracking-wider">NUTRICORE WORKOUT</span>
        <div className="flex items-center gap-2">
          <Link
            to="/workouts/history"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-purple-700 shadow-sm border border-purple-100 hover:bg-purple-50 transition font-medium"
          >
            <History size={13} />
            <span>History</span>
          </Link>
        </div>
      </div>

      {/* 🏋️ HERO */}
      <div className="flex items-center justify-between mt-2">
        <div>
          <span className="text-[#7c3aed] font-semibold text-lg tracking-wider block">
            START YOUR
          </span>
          <h1 className="text-[30px] font-extrabold text-[#111827] mt-0.5 leading-none">
            WORKOUT
          </h1>
        </div>

        <img
          src="/images/startworkout.png"
          alt="Workout"
          className="w-20 h-20 object-contain drop-shadow-sm flex-shrink-0"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/images/login.jpg';
          }}
        />
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchMuscles}
            className="underline font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && (
        <div className="space-y-4 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[110px] rounded-[22px] bg-purple-100/70 animate-pulse"
            ></div>
          ))}
        </div>
      )}

      {/* 🥩 MUSCLE GROUP CARDS */}
      {!loading && muscles.length > 0 && (
        <div className="space-y-4 mt-2">
          {muscles.map((m) => (
            <Link
              key={m.id}
              to={`/workouts/start/${m.id}`}
              className="workout-card block h-[110px] rounded-[22px] overflow-hidden relative flex items-center p-4 text-white text-decoration-none shadow-md transition duration-200 hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.98]"
            >
              {/* IMAGE */}
              <img
                src={m.image_url || m.image || '/images/login.jpg'}
                alt={m.name}
                className="absolute right-0 top-0 h-full w-[65%] object-cover"
                style={{ filter: 'brightness(0.9) contrast(1.05)' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/images/login.jpg';
                }}
              />

              {/* GRADIENT OVERLAY */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to right, rgba(109,40,217,0.95) 0%, rgba(167,139,250,0.8) 40%, rgba(255,255,255,0) 100%)',
                }}
              ></div>

              {/* TEXT */}
              <div className="relative z-10">
                <h3 className="text-[20px] font-bold tracking-wide uppercase">
                  {m.name}
                </h3>
                {m.sub_muscles_count !== undefined && (
                  <p className="text-xs text-white/80 mt-0.5 font-medium">
                    {m.sub_muscles_count} sub-muscles
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && muscles.length === 0 && !error && (
        <div className="text-center py-10 bg-white/60 backdrop-blur rounded-2xl p-4 border border-purple-100">
          <p className="text-3xl mb-1">🏋️</p>
          <p className="text-gray-700 font-semibold text-sm">No Muscle Groups Found</p>
          <p className="text-gray-500 text-xs mt-1">Please check back later.</p>
        </div>
      )}
    </div>
  );
}
