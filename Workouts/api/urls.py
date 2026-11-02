from django.urls import path
from .views import (
    MuscleGroupListView,
    MuscleGroupDetailView,
    SubMuscleListView,
    SubMuscleDetailView,
    ExerciseListView,
    ExerciseDetailView,
    WorkoutSessionListCreateView,
    WorkoutSessionDetailView,
    WorkoutSessionSetsView,
    WorkoutSetDetailView,
    WorkoutHistoryView,
    WorkoutSummaryView,
)

urlpatterns = [
    # Catalogue Endpoints (Public)
    path('muscles/', MuscleGroupListView.as_view(), name='api_workouts_muscles'),
    path('muscles/<int:id>/', MuscleGroupDetailView.as_view(), name='api_workouts_muscle_detail'),
    path('submuscles/', SubMuscleListView.as_view(), name='api_workouts_submuscles'),
    path('submuscles/<int:id>/', SubMuscleDetailView.as_view(), name='api_workouts_submuscle_detail'),
    path('exercises/', ExerciseListView.as_view(), name='api_workouts_exercises'),
    path('exercises/<int:id>/', ExerciseDetailView.as_view(), name='api_workouts_exercise_detail'),

    # Workout Session Endpoints (Authenticated)
    path('sessions/', WorkoutSessionListCreateView.as_view(), name='api_workouts_sessions'),
    path('sessions/<int:id>/', WorkoutSessionDetailView.as_view(), name='api_workouts_session_detail'),

    # Workout Set Endpoints (Authenticated)
    path('sessions/<int:id>/sets/', WorkoutSessionSetsView.as_view(), name='api_workouts_session_sets'),
    path('sets/<int:id>/', WorkoutSetDetailView.as_view(), name='api_workouts_set_detail'),

    # Workout History & Summary Endpoints (Authenticated)
    path('history/', WorkoutHistoryView.as_view(), name='api_workouts_history'),
    path('summary/', WorkoutSummaryView.as_view(), name='api_workouts_summary'),
]
