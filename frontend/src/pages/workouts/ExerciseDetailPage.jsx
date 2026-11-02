import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { workoutService } from '../../services/api';
import { ArrowLeft, RefreshCw, AlertCircle, Dumbbell } from 'lucide-react';

export default function ExerciseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadExercise() {
      setLoading(true);
      setError(null);
      try {
        const data = await workoutService.getExerciseDetail(id);
        if (isMounted) {
          setExercise(data);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load exercise detail', err);
          setError('Failed to load exercise details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadExercise();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleStartExercise = async () => {
    if (!exercise?.sub_muscle?.id) return;
    setStarting(true);
    try {
      const session = await workoutService.createSession({
        sub_muscle_id: exercise.sub_muscle.id,
      });
      navigate(`/workouts/log/${session.id}?exercise=${exercise.id}`);
    } catch (err) {
      console.error('Failed to create session for exercise', err);
      setError('Could not start workout session.');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 pt-6 pb-20 space-y-4 animate-pulse">
        <div className="h-6 w-20 bg-gray-200 rounded"></div>
        <div className="h-8 w-48 bg-purple-200 rounded"></div>
        <div className="h-56 bg-gray-100 rounded-2xl"></div>
        <div className="h-24 bg-gray-100 rounded-2xl"></div>
      </div>
    );
  }

  if (error && !exercise) {
    return (
      <div className="px-4 pt-8 text-center space-y-4">
        <AlertCircle size={40} className="mx-auto text-red-500" />
        <h2 className="text-lg font-bold text-gray-800">Exercise Not Found</h2>
        <p className="text-sm text-gray-500">{error}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-2xl bg-purple-600 text-white text-sm font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Parse steps (handling \n and list formats)
  const stepsList = exercise?.steps
    ? exercise.steps
        .replace(/\\n/g, '\n')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      {/* 🔙 BACK */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-[#ede9fe] text-purple-700 flex items-center justify-center font-bold text-lg hover:bg-purple-200 transition cursor-pointer active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-xs font-semibold text-gray-500">Back</span>
      </div>

      {/* ERROR */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-1.5">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* 🏋️ TITLE */}
      <div>
        <h1 className="text-[22px] font-bold text-[#4c1d95] leading-tight">
          {exercise.name}
        </h1>

        {/* TAGS */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {exercise.sub_muscle?.name && (
            <span className="inline-block bg-[#ede9fe] text-[#6d28d9] px-2.5 py-1 rounded-[10px] text-[11px] font-medium">
              {exercise.sub_muscle.name}
            </span>
          )}
          {exercise.muscle_group_name && (
            <span className="inline-block bg-[#ede9fe] text-[#6d28d9] px-2.5 py-1 rounded-[10px] text-[11px] font-medium">
              {exercise.muscle_group_name}
            </span>
          )}
          <span className="inline-block bg-[#ede9fe] text-[#6d28d9] px-2.5 py-1 rounded-[10px] text-[11px] font-medium">
            Exercise
          </span>
        </div>
      </div>

      {/* 🖼️ MEDIA BOX */}
      {exercise.image_url || exercise.image ? (
        <div className="mt-3 rounded-[24px] overflow-hidden bg-white p-4 flex items-center justify-center shadow-[0_10px_25px_rgba(124,58,237,0.08)] border border-purple-50">
          <img
            src={exercise.image_url || exercise.image}
            alt={exercise.name}
            className="w-full max-h-[240px] object-contain rounded-[18px]"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/images/login.jpg';
            }}
          />
        </div>
      ) : null}

      {/* 📖 ABOUT SECTION */}
      {exercise.description && (
        <div className="bg-[#ede9fe] p-3.5 rounded-[16px] border border-purple-100 shadow-sm">
          <div className="font-semibold mb-1 text-[#4c1d95] text-[14px]">
            About this exercise
          </div>
          <p className="text-[13px] text-gray-700 leading-relaxed">
            {exercise.description}
          </p>
        </div>
      )}

      {/* 📊 INFO GRID */}
      <div className="flex justify-between gap-2.5 mt-2">
        <div className="bg-[#ede9fe] p-3 rounded-[14px] flex-1 text-center border border-purple-100">
          <div className="text-[11px] text-[#6b7280] font-medium">Primary Muscle</div>
          <div className="text-[14px] font-bold text-gray-800 mt-0.5 truncate">
            {exercise.sub_muscle?.name || 'Full Body'}
          </div>
        </div>

        <div className="bg-[#ede9fe] p-3 rounded-[14px] flex-1 text-center border border-purple-100">
          <div className="text-[11px] text-[#6b7280] font-medium">Equipment</div>
          <div className="text-[14px] font-bold text-gray-800 mt-0.5 truncate">
            {exercise.equipment || 'Dumbbell'}
          </div>
        </div>
      </div>

      {/* 📋 STEPS SECTION */}
      {stepsList.length > 0 && (
        <div className="bg-[#ede9fe] p-3.5 rounded-[16px] border border-purple-100 shadow-sm space-y-2.5">
          <div className="font-semibold text-[#4c1d95] text-[14px]">
            How to Perform
          </div>

          <div className="space-y-2">
            {stepsList.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="w-[22px] h-[22px] bg-[#7c3aed] text-white text-[12px] font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  {idx + 1}
                </div>
                <div className="text-[13px] text-gray-700 leading-snug">{step}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🚀 ACTION BUTTON */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleStartExercise}
          disabled={starting}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white py-3.5 rounded-2xl shadow-lg font-semibold text-sm active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
        >
          {starting ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Dumbbell size={16} />
          )}
          <span>Start Workout with this Exercise</span>
        </button>
      </div>
    </div>
  );
}
