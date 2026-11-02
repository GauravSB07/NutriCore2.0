from django.urls import path
from .views import (
    CategoryListView,
    CategoryDetailView,
    FoodListView,
    FoodDetailView,
    MealLogListCreateView,
    MealLogDetailView,
    DailyNutritionSummaryView,
    WaterIntakeListCreateView,
    WaterIntakeDetailView,
    CheatMealCreateView,
    CheatMealStatusView,
)

urlpatterns = [
    # Food Catalogue Endpoints (Public)
    path('categories/', CategoryListView.as_view(), name='api_nutrition_categories'),
    path('categories/<int:id>/', CategoryDetailView.as_view(), name='api_nutrition_category_detail'),
    path('foods/', FoodListView.as_view(), name='api_nutrition_foods'),
    path('foods/<int:id>/', FoodDetailView.as_view(), name='api_nutrition_food_detail'),

    # Meal Log Endpoints (Authenticated)
    path('meals/', MealLogListCreateView.as_view(), name='api_nutrition_meals'),
    path('meals/<int:id>/', MealLogDetailView.as_view(), name='api_nutrition_meal_detail'),

    # Daily Nutrition Summary (Authenticated)
    path('summary/', DailyNutritionSummaryView.as_view(), name='api_nutrition_summary'),

    # Water Intake Endpoints (Authenticated)
    path('water/', WaterIntakeListCreateView.as_view(), name='api_nutrition_water'),
    path('water/<int:id>/', WaterIntakeDetailView.as_view(), name='api_nutrition_water_detail'),

    # Cheat Meal Endpoints (Authenticated)
    path('cheat/', CheatMealCreateView.as_view(), name='api_nutrition_cheat_create'),
    path('cheat/status/', CheatMealStatusView.as_view(), name='api_nutrition_cheat_status'),
]
