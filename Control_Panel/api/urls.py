from django.urls import path
from .views import (
    AdminDashboardView,
    AdminUserListCreateView,
    AdminUserDetailView,
    AdminProfileListView,
    AdminProfileDetailView,
    AdminMealLogListView,
    AdminMealLogDetailView,
)

urlpatterns = [
    # Dashboard stats
    path('dashboard/', AdminDashboardView.as_view(), name='api_admin_dashboard'),

    # User management
    path('users/', AdminUserListCreateView.as_view(), name='api_admin_users'),
    path('users/<int:id>/', AdminUserDetailView.as_view(), name='api_admin_user_detail'),

    # Profile management
    path('profiles/', AdminProfileListView.as_view(), name='api_admin_profiles'),
    path('profiles/<int:id>/', AdminProfileDetailView.as_view(), name='api_admin_profile_detail'),

    # Meal logs management
    path('meals/', AdminMealLogListView.as_view(), name='api_admin_meals'),
    path('meals/<int:id>/', AdminMealLogDetailView.as_view(), name='api_admin_meal_detail'),
]
