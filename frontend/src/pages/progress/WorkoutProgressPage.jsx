import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Dumbbell } from 'lucide-react';
import { progressService } from '../../services/api';
import workoutProgressHeaderImg from '../../assets/images/workout_progress.png';
import workoutProgressFooterImg from '../../assets/images/workoutprogress.png';

export default function WorkoutProgressPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exerciseProgress, setExerciseProgress] = useState({});

  const fetchWorkoutProgress = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await progressService.getWorkoutProgress();
      setExerciseProgress(res.exercise_progress || {});
    } catch (err) {
      setError('Unable to load workout progression data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkoutProgress();
  }, [fetchWorkoutProgress]);

  const muscleGroups = Object.keys(exerciseProgress);

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      <div className="px-4 pb-24 pt-4 overflow-y-auto no-scrollbar space-y-6">
        {/* TOP BAR & HEADER */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="flex gap-2">
              <Link
                to="/progress/muscle-reports"
                className="pill-lavender text-xs font-semibold"
              >
                Muscle Reports
              </Link>
              <Link
                to="/progress/workout-charts"
                className="pill-lavender text-xs font-semibold"
              >
                Charts
              </Link>
            </div>

            <button
              type="button"
              onClick={fetchWorkoutProgress}
              disabled={loading}
              className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
            </button>
          </div>

          {/* HEADER MAIN */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 m-0">Workout Progress 💪</h1>
              <p className="text-xs text-gray-500 mt-1">
                Track your strength and improve every day
              </p>
            </div>

            <img
              src={workoutProgressHeaderImg}
              alt="Workout Progress"
              className="w-14 h-14 object-contain"
            />
          </div>

          {/* GRADIENT DIVIDER */}
          <div className="progress-divider" />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs">
            {error}
          </div>
        )}

        {/* LOADING PLACEHOLDER */}
        {loading && (
          <div className="py-12 text-center">
            <RefreshCw size={24} className="animate-spin text-[#7c3aed] mx-auto mb-2" />
            <p className="text-xs text-gray-400">Loading exercise progression records...</p>
          </div>
        )}

        {/* 🏋️ EXERCISE PROGRESSION GROUPS */}
        {!loading && muscleGroups.length > 0 ? (
          muscleGroups.map((muscle) => {
            const exercises = exerciseProgress[muscle] || [];
            return (
              <div key={muscle} className="space-y-3">
                {/* MUSCLE TITLE */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-purple-500 text-lg">🏋️</span>
                  <h3 className="font-semibold text-gray-800 text-sm tracking-wide">
                    {muscle}
                  </h3>
                </div>

                {/* EXERCISE CARDS */}
                {exercises.map((ex, idx) => (
                  <div key={idx} className="card-lavender">
                    <div className="flex justify-between items-start">
                      {/* LEFT EXERCISE DETAILS & RECORDS */}
                      <div className="flex-1 pr-2">
                        <h4 className="font-semibold text-sm text-gray-900 mb-2">
                          {ex.exercise || ex.name}
                        </h4>

                        <div className="space-y-1">
                          {(ex.records || []).map((r, rIdx) => (
                            <div key={rIdx} className="text-xs text-gray-500">
                              • {r.date} → <span className="font-medium text-gray-700">{r.weight} kg</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* RIGHT STATUS BADGE */}
                      <div className="flex-shrink-0">
                        {ex.improved ? (
                          <div className="bg-[#ecfdf5] text-[#16a34a] px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs">
                            ✔ Progressive Overload
                          </div>
                        ) : (
                          <div className="bg-[#fef2f2] text-[#dc2626] px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs">
                            ⚠ No Progress
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        ) : (
          !loading && (
            <div className="card-lavender text-center py-8">
              <Dumbbell size={32} className="text-purple-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm font-medium">No workout data yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Log workout sessions to track strength progression over time.
              </p>
            </div>
          )
        )}

        {/* 💬 MOTIVATION CARD */}
        <div className="card-lavender flex justify-between items-center">
          <div>
            <p className="font-semibold text-gray-800 text-sm">Keep it up!</p>
            <p className="text-xs text-gray-500 mt-1">
              Consistency and progressive overload lead to real results.
            </p>
          </div>

          <img
            src={workoutProgressFooterImg}
            alt="Workout Results"
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0 ml-3"
          />
        </div>
      </div>
    </div>
  );
}
