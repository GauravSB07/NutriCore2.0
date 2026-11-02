from django.urls import path
from .views import (
    DailyProgressView,
    DailyProgressDetailView,
    StepsLogListCreateView,
    StepsLogDetailView,
    WeightProgressView,
    WeeklyProgressView,
    MonthlyProgressView,
    WorkoutProgressView,
    ProgressHistoryView,
    ProgressSummaryView,
)

urlpatterns = [
    # Daily Progress Endpoints (Authenticated)
    path('daily/', DailyProgressView.as_view(), name='api_progress_daily'),
    path('daily/<int:id>/', DailyProgressDetailView.as_view(), name='api_progress_daily_detail'),

    # Step Tracking Endpoints (Authenticated)
    path('steps/', StepsLogListCreateView.as_view(), name='api_progress_steps'),
    path('steps/<int:id>/', StepsLogDetailView.as_view(), name='api_progress_steps_detail'),

    # Weight & Body Measurement Endpoints (Authenticated)
    path('weight/', WeightProgressView.as_view(), name='api_progress_weight'),

    # Weekly & Monthly Progress Reports (Authenticated)
    path('weekly/', WeeklyProgressView.as_view(), name='api_progress_weekly'),
    path('monthly/', MonthlyProgressView.as_view(), name='api_progress_monthly'),

    # Workout Progress & Muscle Balance (Authenticated)
    path('workout/', WorkoutProgressView.as_view(), name='api_progress_workout'),

    # Progress History & Lifetime Summary (Authenticated)
    path('history/', ProgressHistoryView.as_view(), name='api_progress_history'),
    path('summary/', ProgressSummaryView.as_view(), name='api_progress_summary'),
]
