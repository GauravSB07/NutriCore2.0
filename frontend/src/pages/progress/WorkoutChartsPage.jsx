import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import '../../components/progress/chartConfig';
import { progressService } from '../../services/api';
import workoutChartsImg from '../../assets/images/workout_charts.png';

export default function WorkoutChartsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const weekOffset = parseInt(searchParams.get('week') || '0', 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fetchWorkoutCharts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await progressService.getWorkoutProgress({ week_offset: weekOffset });
      setData(res);
    } catch (err) {
      setError('Unable to load workout chart metrics.');
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => {
    fetchWorkoutCharts();
  }, [fetchWorkoutCharts]);

  const changeWeek = (delta) => {
    const nextOffset = Math.max(0, weekOffset + delta);
    setSearchParams({ week: nextOffset });
  };

  // Compile exercise progression maps
  const exerciseMap = useMemo(() => {
    const map = {};
    const exProgress = data?.exercise_progress || {};

    Object.values(exProgress).forEach((exercises) => {
      (exercises || []).forEach((ex) => {
        const name = ex.exercise || ex.name;
        if (name && ex.records && ex.records.length > 0) {
          map[name] = ex.records;
        }
      });
    });

    return map;
  }, [data]);

  const exerciseNames = useMemo(() => Object.keys(exerciseMap), [exerciseMap]);

  // Set default exercise when loaded
  useEffect(() => {
    if (exerciseNames.length > 0 && (!selectedExercise || !exerciseMap[selectedExercise])) {
      setSelectedExercise(exerciseNames[0]);
    }
  }, [exerciseNames, selectedExercise, exerciseMap]);

  // Strength progress line chart data
  const currentExerciseRecords = exerciseMap[selectedExercise] || [];
  const strengthLineData = {
    labels: currentExerciseRecords.map((r) => r.date),
    datasets: [
      {
        label: selectedExercise || 'Weight (kg)',
        data: currentExerciseRecords.map((r) => r.weight),
        borderColor: '#7c3aed',
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'rgba(124, 58, 237, 0.2)';
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(124, 58, 237, 0.4)');
          gradient.addColorStop(1, 'rgba(124, 58, 237, 0.0)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#7c3aed',
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} kg`,
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: 'rgba(124, 58, 237, 0.08)' },
        ticks: { callback: (val) => `${val} kg` },
      },
    },
  };

  // Muscle frequency bar chart data
  const muscleReport = data?.weekly_muscle_report || [];
  const muscleLabels = muscleReport.map((m) => m.muscle);
  const muscleCounts = muscleReport.map((m) => m.current_week || 0);

  const muscleBarData = {
    labels: muscleLabels.length ? muscleLabels : ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'],
    datasets: [
      {
        data: muscleCounts.length ? muscleCounts : [0, 0, 0, 0, 0],
        backgroundColor: '#7c3aed',
        borderRadius: 6,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: 'rgba(124, 58, 237, 0.08)' },
        ticks: { stepSize: 1 },
      },
    },
  };

  const weekRange = data?.week_range || {};

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      <div className="px-4 pb-24 pt-4 overflow-y-auto no-scrollbar space-y-5">
        {/* TOP BAR */}
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
              to="/progress/workout"
              className="pill-lavender text-xs font-semibold"
            >
              Overload
            </Link>
            <Link
              to="/progress/muscle-reports"
              className="pill-lavender text-xs font-semibold"
            >
              Balance
            </Link>
          </div>

          <button
            type="button"
            onClick={fetchWorkoutCharts}
            disabled={loading}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#7c3aed]' : ''} />
          </button>
        </div>

        {/* 🏋️ CHART HEADER */}
        <div className="bg-gradient-to-br from-[#ede9fe] to-[#ddd6fe] rounded-[22px] p-5 flex justify-between items-center border border-purple-200/60 shadow-sm">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 m-0">Workout Charts 💪</h1>
            <p className="text-xs text-gray-600 mt-1">Track your progress over time</p>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-white/60 backdrop-blur p-2 shadow-xs flex items-center justify-center flex-shrink-0">
            <img
              src={workoutChartsImg}
              alt="Workout"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* WEEK NAV CARD */}
        <div className="card-lavender flex justify-between items-center">
          <p className="text-xs font-semibold text-gray-700">
            Week:{' '}
            {weekRange.start_of_week && weekRange.end_of_week
              ? `${weekRange.start_of_week} → ${weekRange.end_of_week}`
              : weekOffset === 0
              ? 'Current Week'
              : `${weekOffset} week${weekOffset > 1 ? 's' : ''} ago`}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => changeWeek(1)}
              className="pill-lavender font-medium text-xs cursor-pointer"
            >
              ← Previous
            </button>
            {weekOffset > 0 && (
              <button
                type="button"
                onClick={() => changeWeek(-1)}
                className="pill-lavender font-medium text-xs cursor-pointer"
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs">
            {error}
          </div>
        )}

        {/* 📈 STRENGTH PROGRESS CARD */}
        <div className="card-lavender">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm text-[#4c1d95]">Strength Progress</h3>

            {/* CUSTOM EXERCISE DROPDOWN */}
            <div className="relative w-44">
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="w-full bg-[#ede9fe] border border-purple-200/80 px-3 py-1.5 rounded-xl text-xs flex justify-between items-center text-[#4c1d95] font-medium shadow-xs cursor-pointer"
              >
                <span className="truncate">{selectedExercise || 'Select Exercise'}</span>
                <ChevronDown size={14} className="ml-1 flex-shrink-0" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-purple-100 z-50 max-h-48 overflow-y-auto no-scrollbar py-1">
                  {exerciseNames.length > 0 ? (
                    exerciseNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setSelectedExercise(name);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition cursor-pointer hover:bg-purple-50 ${
                          selectedExercise === name
                            ? 'bg-purple-100 text-[#4c1d95] font-semibold'
                            : 'text-gray-700'
                        }`}
                      >
                        {name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-gray-400">No exercises found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="h-56">
            {currentExerciseRecords.length > 0 ? (
              <Line data={strengthLineData} options={lineOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No logs recorded for this exercise yet.
              </div>
            )}
          </div>
        </div>

        {/* 📊 MUSCLE FREQUENCY CARD */}
        <div className="card-lavender">
          <h3 className="font-semibold text-sm text-[#4c1d95] mb-2">Muscle Frequency</h3>
          <div className="h-52">
            <Bar data={muscleBarData} options={barOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
