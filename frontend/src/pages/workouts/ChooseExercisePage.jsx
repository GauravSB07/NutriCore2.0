import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { workoutService } from '../../services/api';
import { ArrowLeft, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

export default function ChooseExercisePage() {
  const { subId } = useParams();
  const navigate = useNavigate();

  const [subMuscle, setSubMuscle] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingExerciseId, setStartingExerciseId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [subData, exData] = await Promise.all([
          workoutService.getSubMuscleDetail(subId),
          workoutService.getExercises({ sub_muscle: subId }),
        ]);

        if (isMounted) {
          setSubMuscle(subData);
          const list = Array.isArray(exData) ? exData : exData.results || [];
          setExercises(list);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load exercises', err);
          setError('Unable to load exercises for this sub-muscle.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [subId]);

  const handleStartExerciseSession = async (exerciseId) => {
    setStartingExerciseId(exerciseId);
    setError(null);
    try {
      // 1. Create a workout session for this sub-muscle
      const session = await workoutService.createSession({
        sub_muscle_id: parseInt(subId, 10),
      });

      // 2. Navigate to log sets with selected session and exercise
      navigate(`/workouts/log/${session.id}?exercise=${exerciseId}`);
    } catch (err) {
      console.error('Failed to start workout session', err);
      setError('Failed to initiate workout session. Please try again.');
      setStartingExerciseId(null);
    }
  };

  const parentMuscleId = subMuscle?.muscle_group?.id;

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      {/* 🔙 BACK NAVIGATION */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (parentMuscleId) navigate(`/workouts/start/${parentMuscleId}`);
            else navigate('/workouts/start');
          }}
          className="w-10 h-10 rounded-xl bg-[#ede9fe] text-purple-700 flex items-center justify-center font-bold text-lg hover:bg-purple-200 transition cursor-pointer active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-xs font-semibold text-gray-500">Back</span>
      </div>

      {/* 🏋️ HERO */}
      <div className="flex justify-between items-center mt-2">
        <div className="max-w-[210px]">
          <span className="text-[#7c3aed] font-semibold tracking-wider text-xs uppercase block">
            EXERCISES
          </span>
          <h1 className="text-[26px] font-extrabold text-[#111827] my-1 leading-tight">
            {subMuscle ? subMuscle.name : 'Loading...'}
          </h1>
          <p className="text-[12px] text-[#6b7280] leading-snug">
            Target and strengthen your {subMuscle ? subMuscle.name : 'muscles'} effectively.
          </p>
        </div>

        <div className="w-[110px] h-[110px] flex items-center justify-center flex-shrink-0">
          <img
            src={subMuscle?.image_url || subMuscle?.image || '/images/login.jpg'}
            alt={subMuscle?.name || 'Submuscle'}
            className="w-[110px] h-[110px] object-contain drop-shadow"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/images/login.jpg';
            }}
          />
        </div>
      </div>

      {/* SECTION TITLE */}
      <div className="text-[12px] font-bold text-[#6d28d9] tracking-wider pt-2">
        CHOOSE AN EXERCISE
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
        <div className="space-y-4 pt-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-[18px] bg-purple-100/70 animate-pulse"
            ></div>
          ))}
        </div>
      )}

      {/* 📍 EXERCISE TIMELINE LIST */}
      {!loading && exercises.length > 0 && (
        <div className="relative pl-2.5">
          {/* Vertical Dotted Connector */}
          <div
            className="absolute"
            style={{
              left: '42px',
              top: '25px',
              bottom: '25px',
              borderLeft: '2px dotted #c4b5fd',
              zIndex: 1,
            }}
          ></div>

          {exercises.map((e) => {
            const isStarting = startingExerciseId === e.id;

            return (
              <div key={e.id} className="flex items-center mt-5 relative pl-1 z-10">
                {/* CIRCLE WITH PROGRESS ARC */}
                <div
                  className="w-[66px] h-[66px] rounded-full flex items-center justify-center relative flex-shrink-0 bg-[#f8f6fb] shadow-sm"
                  style={{ zIndex: 2 }}
                >
                  {/* ARC */}
                  <div
                    className="absolute inset-0 rounded-full border-[3.5px] border-transparent"
                    style={{
                      borderTopColor: '#7c3aed',
                      borderRightColor: '#a78bfa',
                      transform: 'rotate(90deg)',
                    }}
                  ></div>

                  {/* IMAGE INSIDE CIRCLE */}
                  <img
                    src={e.image_url || e.image || '/images/login.jpg'}
                    alt={e.name}
                    className="w-11 h-11 object-contain rounded-full"
                    onError={(ev) => {
                      ev.target.onerror = null;
                      ev.target.src = '/images/login.jpg';
                    }}
                  />
                </div>

                {/* EXERCISE CARD (clickable for detail) */}
                <Link
                  to={`/workouts/exercises/${e.id}`}
                  className="flex-1 bg-white rounded-[18px] p-3.5 ml-2.5 shadow-[0_10px_20px_rgba(0,0,0,0.06)] border border-purple-50/80 transition hover:shadow-md block min-w-0"
                >
                  <h3 className="text-[13px] font-bold text-gray-800 uppercase truncate">
                    {e.name}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                    {e.description || 'Target and build strength.'}
                  </p>
                  <span className="text-[10px] bg-[#ede9fe] text-[#6d28d9] px-2 py-0.5 rounded-[8px] inline-block mt-1 font-semibold">
                    Strength
                  </span>
                </Link>

                {/* ARROW ACTION BUTTON (starts workout session) */}
                <button
                  type="button"
                  onClick={() => handleStartExerciseSession(e.id)}
                  disabled={isStarting}
                  title="Start logging this exercise"
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] flex items-center justify-center text-white text-lg ml-2 shadow-[0_8px_18px_rgba(124,58,237,0.3)] hover:scale-105 active:scale-95 transition flex-shrink-0 cursor-pointer"
                >
                  {isStarting ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <span>→</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* EMPTY EXERCISES */}
      {!loading && exercises.length === 0 && !error && (
        <div className="text-center py-10 bg-white/60 backdrop-blur rounded-2xl p-4 border border-purple-100">
          <p className="text-3xl mb-1">🏋️</p>
          <p className="text-gray-700 font-semibold text-sm">No Exercises Found</p>
          <p className="text-gray-500 text-xs mt-1">
            No exercises are currently catalogued under this sub-muscle.
          </p>
        </div>
      )}

      {/* 💡 PRO TIP CARD */}
      <div className="bg-[#ede9fe] rounded-[20px] p-4 flex justify-between items-center mt-7 border border-purple-200/50 shadow-sm">
        <div>
          <b className="text-sm text-[#4c1d95] block font-bold">Pro Tip</b>
          <span className="text-xs text-[#6b7280] font-medium">
            Control movement & feel the muscle.
          </span>
        </div>

        <img
          src="/images/protip.png"
          alt="Pro Tip"
          className="w-14 h-14 object-contain flex-shrink-0"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
          }}
        />
      </div>
    </div>
  );
}
