import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { workoutService } from '../../services/api';
import { ArrowLeft, RefreshCw, AlertCircle, Trash2, Check } from 'lucide-react';

export default function LogSetsPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryExerciseId = searchParams.get('exercise');

  const [session, setSession] = useState(null);
  const [sets, setSets] = useState([]);
  const [subExercises, setSubExercises] = useState([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState(queryExerciseId || '');

  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submittingSet, setSubmittingSet] = useState(false);
  const [deletingSetId, setDeletingSetId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fetchSessionAndSets = useCallback(async () => {
    try {
      const [sessionData, setsData] = await Promise.all([
        workoutService.getSessionDetail(sessionId),
        workoutService.getSessionSets(sessionId),
      ]);
      setSession(sessionData);
      setSets(Array.isArray(setsData) ? setsData : setsData.results || []);

      // If we have sub-muscle, fetch exercises list under this sub-muscle
      if (sessionData?.sub_muscle?.id) {
        const exRes = await workoutService.getExercises({
          sub_muscle: sessionData.sub_muscle.id,
        });
        const exList = Array.isArray(exRes) ? exRes : exRes.results || [];
        setSubExercises(exList);

        if (!queryExerciseId && exList.length > 0) {
          setSelectedExerciseId(String(exList[0].id));
        }
      }
    } catch (err) {
      console.error('Failed to load session/sets', err);
      setError('Unable to load workout session.');
    }
  }, [sessionId, queryExerciseId]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      setLoadingInitial(true);
      setError(null);
      await fetchSessionAndSets();
      if (isMounted) setLoadingInitial(false);
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [fetchSessionAndSets]);

  const showToast = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 2500);
  };

  const handleAddSet = async (e) => {
    e.preventDefault();
    if (!selectedExerciseId) {
      setError('Please select an exercise.');
      return;
    }
    const numReps = parseInt(reps, 10);
    const numWeight = parseFloat(weight);

    if (isNaN(numReps) || numReps <= 0) {
      setError('Please enter a valid reps number greater than 0.');
      return;
    }
    if (isNaN(numWeight) || numWeight < 0) {
      setError('Please enter a valid weight.');
      return;
    }

    setSubmittingSet(true);
    setError(null);

    try {
      await workoutService.logSet(sessionId, {
        exercise_id: parseInt(selectedExerciseId, 10),
        reps: numReps,
        weight: numWeight,
      });

      // Reset inputs & refresh sets
      setReps('');
      setWeight('');
      showToast('Set added successfully!');
      const updatedSets = await workoutService.getSessionSets(sessionId);
      setSets(Array.isArray(updatedSets) ? updatedSets : updatedSets.results || []);
    } catch (err) {
      console.error('Failed to add set', err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.reps?.[0] ||
        err.response?.data?.weight?.[0] ||
        'Failed to log set.';
      setError(msg);
    } finally {
      setSubmittingSet(false);
    }
  };

  const handleDeleteSet = async (setId) => {
    if (!window.confirm('Delete this set?')) return;
    setDeletingSetId(setId);
    try {
      await workoutService.deleteSet(setId);
      showToast('Set deleted.');
      const updatedSets = await workoutService.getSessionSets(sessionId);
      setSets(Array.isArray(updatedSets) ? updatedSets : updatedSets.results || []);
    } catch (err) {
      alert('Failed to delete set.');
    } finally {
      setDeletingSetId(null);
    }
  };

  // Total volume calculation: volume = reps * weight
  const totalVolume = sets.reduce((acc, s) => acc + (s.volume || s.reps * s.weight || 0), 0);

  if (loadingInitial) {
    return (
      <div className="px-4 pt-6 pb-20 space-y-4 animate-pulse">
        <div className="h-6 w-24 bg-gray-200 rounded"></div>
        <div className="h-44 bg-gray-100 rounded-3xl"></div>
        <div className="h-48 bg-gray-100 rounded-2xl"></div>
      </div>
    );
  }

  const selectedExerciseObj = subExercises.find(
    (e) => String(e.id) === String(selectedExerciseId)
  );

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      {/* 🔝 HEADER */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/workouts/start')}
          className="w-10 h-10 rounded-xl bg-[#ede9fe] text-purple-700 flex items-center justify-center font-bold text-lg hover:bg-purple-200 transition cursor-pointer active:scale-95 flex-shrink-0"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-semibold tracking-wider">
            LOG WORKOUT
          </p>
          <h2 className="text-[17px] font-bold text-gray-900 truncate">
            {session?.sub_muscle?.name || 'Workout Session'}
          </h2>
        </div>
      </div>

      {/* MESSAGES */}
      {error && (
        <div className="p-3 bg-red-100 text-red-600 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-green-100 text-green-700 rounded-2xl text-xs flex items-center gap-2">
          <Check size={15} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 📋 FORM CARD */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_10px_20px_rgba(0,0,0,0.06)] border border-purple-50 space-y-3.5">
        {/* EXERCISE SELECTOR */}
        {subExercises.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 block mb-1 font-semibold">
              Exercise
            </label>
            <div className="bg-[#f3f4f6] rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-sm">🏋️</span>
              <select
                value={selectedExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-gray-800 outline-none"
              >
                {subExercises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <form onSubmit={handleAddSet} className="space-y-3">
          {/* REPS */}
          <div>
            <label className="text-xs text-gray-600 font-medium">Reps</label>
            <div className="mt-1 bg-[#f3f4f6] rounded-xl px-3 py-2.5 flex items-center gap-2.5">
              <span className="text-sm">🔁</span>
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="Enter reps"
                min="1"
                required
                className="w-full bg-transparent outline-none text-sm font-semibold text-gray-800"
              />
            </div>
          </div>

          {/* WEIGHT */}
          <div>
            <label className="text-xs text-gray-600 font-medium">Weight (kg)</label>
            <div className="mt-1 bg-[#f3f4f6] rounded-xl px-3 py-2.5 flex items-center gap-2.5">
              <span className="text-sm">🏋️</span>
              <input
                type="number"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Enter weight in kg"
                min="0"
                required
                className="w-full bg-transparent outline-none text-sm font-semibold text-gray-800"
              />
            </div>
          </div>

          {/* ADD SET BUTTON */}
          <button
            type="submit"
            disabled={submittingSet}
            className="w-full bg-[#d8b4fe] hover:bg-[#c084fc] text-[#4c1d95] py-3 rounded-xl font-bold text-sm shadow-sm transition active:scale-95 cursor-pointer mt-2 flex items-center justify-center gap-1.5"
          >
            {submittingSet && <RefreshCw size={15} className="animate-spin" />}
            <span>+ Add Set</span>
          </button>
        </form>
      </div>

      {/* 📊 SESSION SUMMARY BANNER */}
      {sets.length > 0 && (
        <div className="bg-gradient-to-r from-purple-100 to-purple-50 p-3.5 rounded-2xl flex justify-between items-center border border-purple-200/60 shadow-sm">
          <div>
            <span className="text-xs text-gray-500 font-medium">Total Sets</span>
            <p className="text-lg font-bold text-purple-900">{sets.length}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium">Total Volume</span>
            <p className="text-lg font-bold text-purple-900">{Math.round(totalVolume)} kg</p>
          </div>
        </div>
      )}

      {/* 🏋️ LOGGED SETS */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-bold text-gray-800">Logged Sets</h3>
          <span className="text-xs text-gray-400 font-medium">{sets.length} sets</span>
        </div>

        {sets.length > 0 ? (
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-purple-50 divide-y divide-gray-100">
            {sets.map((s, idx) => (
              <div
                key={s.id}
                className="py-2.5 flex items-center justify-between first:pt-1 last:pb-1"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-[#7c3aed] text-xs font-bold flex items-center justify-center">
                      {s.set_number || idx + 1}
                    </span>
                    <span className="font-semibold text-sm text-gray-800">
                      {s.exercise?.name || selectedExerciseObj?.name || 'Exercise'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 mt-1 pl-7 flex items-center gap-2.5">
                    <span>🔁 {s.reps} reps</span>
                    <span>•</span>
                    <span>🏋️ {s.weight} kg</span>
                    <span>•</span>
                    <span className="text-purple-600 font-medium">
                      Vol: {Math.round(s.volume || s.reps * s.weight)} kg
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteSet(s.id)}
                  disabled={deletingSetId === s.id}
                  className="p-2 text-gray-400 hover:text-red-500 transition cursor-pointer"
                  title="Delete set"
                >
                  {deletingSetId === s.id ? (
                    <RefreshCw size={14} className="animate-spin text-red-500" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 text-center border border-purple-50 text-gray-400 space-y-1">
            <p className="text-2xl">📋</p>
            <p className="text-xs font-semibold text-gray-600">No sets yet</p>
            <p className="text-[11px] text-gray-400">
              Enter reps and weight above to add your first set.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
